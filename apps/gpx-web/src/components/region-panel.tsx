"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Region = {
  key: string;
  label: string;
  group: string;
  download: string;
  expanded: string;
  state: "missing" | "partial" | "downloaded" | "prepared";
};

type OsrmStatus = {
  state: "stopped" | "no-graph" | "loading" | "ready" | "switching" | "failed" | "unavailable";
  region: string | null;
  error: string | null;
  switchTarget: string | null;
  cooldownRemainingSeconds: number;
};

type Job = {
  type: "download" | "prepare";
  regions: string[];
  status: "running" | "succeeded" | "failed";
  currentRegion: string | null;
  progress: { bytes: number; total: number | null } | null;
  log: { seq: number; line: string }[];
};

const STATE_COLOURS: Record<string, string> = {
  ready: "#41d99b",
  loading: "#f59e0b",
  switching: "#f59e0b",
  failed: "#f87171",
  "no-graph": "#f87171",
  unavailable: "#f87171",
};

const TOKEN_KEY = "rogueroute-gpx.adminToken";

function readToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function RegionPanel({
  choice,
  onChoiceChange,
  lastUsed,
}: {
  choice: string;
  onChoiceChange: (value: string) => void;
  lastUsed?: { key: string; label: string; switched: boolean } | null;
}) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [osrm, setOsrm] = useState<OsrmStatus | null>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [adminEnabled, setAdminEnabled] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [adminRegion, setAdminRegion] = useState("");
  const [job, setJob] = useState<Job | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/regions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Region status is unavailable.");
      setRegions(data.regions);
      setOsrm(data.osrm);
      setActiveRegion(data.activeRegion);
      setAdminEnabled(Boolean(data.adminEnabled));
      setNotice(null);
    } catch (error) {
      setOsrm({ state: "unavailable", region: null, error: null, switchTarget: null, cooldownRemainingSeconds: 0 });
      setNotice(error instanceof Error ? error.message : "Region status is unavailable.");
    }
  }, []);

  const refreshJob = useCallback(async (adminToken: string) => {
    if (!adminToken) return;
    const response = await fetch("/api/admin/jobs", { cache: "no-store", headers: { authorization: `Bearer ${adminToken}` } });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setJob(data.job ?? null);
    else setNotice(data.error || "Admin token rejected.");
  }, []);

  useEffect(() => {
    setToken(readToken());
    void refresh();
  }, [refresh]);

  // Poll while something is changing: a graph loading or a map job running.
  const changing = osrm?.state === "loading" || osrm?.state === "switching" || job?.status === "running";
  useEffect(() => {
    if (!changing) return;
    const timer = window.setInterval(() => {
      void refresh();
      void refreshJob(token);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [changing, refresh, refreshJob, token]);

  useEffect(() => {
    if (lastUsed) void refresh();
  }, [lastUsed, refresh]);

  const prepared = regions.filter((region) => region.state === "prepared");
  const label = (key: string | null) => regions.find((region) => region.key === key)?.label ?? key ?? "none";

  async function switchNow(key: string) {
    setBusy(true);
    setNotice(`Loading ${label(key)}… large regions can take a minute.`);
    try {
      const response = await fetch("/api/regions/switch", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ region: key }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to switch region.");
      setNotice(`Serving ${label(data.activeRegion)}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to switch region.");
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function startJob(type: "download" | "prepare") {
    if (!adminRegion) return setNotice("Pick a region first.");
    const response = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ type, regions: [adminRegion] }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setNotice(data.error || `Failed to start ${type}.`);
    setJob(data.job);
    setNotice(`${type === "download" ? "Download" : "Preparation"} of ${label(adminRegion)} started.`);
  }

  function saveToken(value: string) {
    setToken(value);
    try {
      window.sessionStorage.setItem(TOKEN_KEY, value);
    } catch {
      /* session storage unavailable */
    }
  }

  const stateLabel = osrm
    ? osrm.state === "switching" || osrm.state === "loading"
      ? `loading ${label(osrm.switchTarget ?? osrm.region)}`
      : osrm.state
    : "checking";
  const progress = job?.progress?.total ? Math.round((job.progress.bytes / job.progress.total) * 100) : null;

  return (
    <div style={subPanelStyle}>
      <strong>Map region</strong>
      <p style={{ margin: "8px 0", color: "#cbd5e1" }}>
        On Auto, RogueRoute GPX picks the prepared region that contains your waypoints and loads it
        if needed. Choose a region to force it.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select value={choice} onChange={(event) => onChoiceChange(event.target.value)} style={{ ...inputStyle, minWidth: 230 }}>
          <option value="auto">Auto (from waypoints)</option>
          {prepared.map((region) => (
            <option key={region.key} value={region.key}>
              {region.label}
            </option>
          ))}
        </select>
        {choice !== "auto" && choice !== activeRegion && (
          <button onClick={() => void switchNow(choice)} disabled={busy || changing} style={secondaryButton}>
            {busy ? "Loading…" : "Load now"}
          </button>
        )}
        <button onClick={() => void refresh()} style={secondaryButton}>
          Refresh
        </button>
      </div>
      <div style={{ marginTop: 8, color: "#cbd5e1" }}>
        Serving: <span style={{ color: "#22d3ee" }}>{label(activeRegion)}</span>
        {" · OSRM: "}
        <span style={{ color: STATE_COLOURS[osrm?.state ?? ""] ?? "#cbd5e1" }}>{stateLabel}</span>
        {lastUsed && (
          <>
            <br />
            Last route: <span style={{ color: "#22d3ee" }}>{lastUsed.label}</span>
            {lastUsed.switched ? " (region loaded for this route)" : ""}
          </>
        )}
        <br />
        Prepared: {prepared.length ? prepared.map((region) => region.label).join(", ") : "none yet"}
      </div>
      {osrm?.error && <div style={{ ...noticeStyle, marginTop: 10 }}>{osrm.error}</div>}
      {notice && <div style={{ ...noticeStyle, marginTop: 10 }}>{notice}</div>}

      {adminEnabled && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", color: "#93c5fd" }}>Map administration</summary>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <input
              type="password"
              placeholder="Admin token"
              value={token}
              onChange={(event) => saveToken(event.target.value)}
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select value={adminRegion} onChange={(event) => setAdminRegion(event.target.value)} style={{ ...inputStyle, minWidth: 230 }}>
                <option value="">Choose a region…</option>
                {regions.map((region) => (
                  <option key={region.key} value={region.key}>
                    {region.label} · {region.state} · {region.download}
                  </option>
                ))}
              </select>
              <button onClick={() => void startJob("download")} disabled={!token} style={secondaryButton}>
                Download
              </button>
              <button onClick={() => void startJob("prepare")} disabled={!token} style={secondaryButton}>
                Prepare
              </button>
              <button
                onClick={() => adminRegion && void switchNow(adminRegion)}
                disabled={!token || !adminRegion || busy}
                style={secondaryButton}
              >
                Load now
              </button>
              <button onClick={() => void refreshJob(token)} disabled={!token} style={secondaryButton}>
                Job status
              </button>
            </div>
            {job && (
              <div style={{ ...noticeStyle, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 220, overflowY: "auto" }}>
                {`${job.type} ${job.regions.join(", ")}: ${job.status}${job.currentRegion ? ` (${job.currentRegion}${progress !== null ? ` ${progress}%` : ""})` : ""}\n`}
                {job.log.slice(-30).map((entry) => entry.line).join("\n")}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

const subPanelStyle: CSSProperties = {
  background: "rgba(2,6,23,0.72)",
  border: "1px solid rgba(56,189,248,0.16)",
  borderRadius: 18,
  padding: 14,
};
const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.2)",
  background: "#020617",
  color: "#f8fafc",
};
const secondaryButton: CSSProperties = {
  border: 0,
  padding: "12px 18px",
  borderRadius: 14,
  cursor: "pointer",
  background: "rgba(71,85,105,0.9)",
  color: "#fff",
  fontWeight: 600,
};
const noticeStyle: CSSProperties = {
  background: "rgba(8,47,73,0.7)",
  border: "1px solid rgba(34,211,238,0.18)",
  padding: 12,
  borderRadius: 14,
  color: "#cffafe",
};
