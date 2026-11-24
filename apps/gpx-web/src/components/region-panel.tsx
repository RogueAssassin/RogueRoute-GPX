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

const STATE_COLOURS: Record<string, string> = {
  ready: "#41d99b",
  loading: "#f59e0b",
  switching: "#f59e0b",
  failed: "#f87171",
  "no-graph": "#f87171",
  unavailable: "#f87171",
};

const TOKEN_KEY = "rogueroute-gpx.adminToken";

/** The admin token saved on the /maps page, if any; it lets "Load now" skip the cooldown. */
function readToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

type MapsSummary = { current: string | null; step: string | null; pending: number };

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
  const [maps, setMaps] = useState<MapsSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/regions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Region status is unavailable.");
      setRegions(data.regions);
      setOsrm(data.osrm);
      setActiveRegion(data.activeRegion);
      setMaps(data.maps ?? null);
      setNotice(null);
    } catch (error) {
      setOsrm({ state: "unavailable", region: null, error: null, switchTarget: null, cooldownRemainingSeconds: 0 });
      setNotice(error instanceof Error ? error.message : "Region status is unavailable.");
    }
  }, []);

  useEffect(() => {
    setToken(readToken());
    void refresh();
  }, [refresh]);

  // Poll quickly while a graph loads, slowly while map work runs in the background.
  const changing = osrm?.state === "loading" || osrm?.state === "switching";
  const mapWork = Boolean(maps?.current);
  useEffect(() => {
    if (!changing && !mapWork) return;
    const timer = window.setInterval(() => void refresh(), changing ? 3_000 : 15_000);
    return () => window.clearInterval(timer);
  }, [changing, mapWork, refresh]);

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

  const stateLabel = osrm
    ? osrm.state === "switching" || osrm.state === "loading"
      ? `loading ${label(osrm.switchTarget ?? osrm.region)}`
      : osrm.state
    : "checking";

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

      <div style={{ marginTop: 10, color: "#cbd5e1" }}>
        {maps?.current
          ? `Map work in the background: ${label(maps.current)}${maps.step ? ` (${maps.step})` : ""}${maps.pending ? `, ${maps.pending} more waiting` : ""}. `
          : null}
        <a href="/maps" style={{ color: "#93c5fd" }}>
          Map status{maps?.current ? "" : " and downloads"} →
        </a>
      </div>
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
