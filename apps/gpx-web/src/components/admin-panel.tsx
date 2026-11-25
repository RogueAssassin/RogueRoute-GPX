"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRequest } from "../lib/admin";
import type { SupervisorRegion, SupervisorStatus } from "../lib/control";
import MapDownloader from "./map-downloader";
import { ago, CurrentTask, GOAL_LABEL, gb } from "./map-status";

type AdminStatus = SupervisorStatus & { requests: MapRequest[] };
type Tab = "requests" | "queue" | "regions" | "add";

const TABS: { id: Tab; label: string }[] = [
  { id: "requests", label: "Requests" },
  { id: "queue", label: "Queue" },
  { id: "regions", label: "Regions" },
  { id: "add", label: "Add regions" },
];

const STATE_LABEL: Record<SupervisorRegion["state"], string> = {
  prepared: "Ready",
  downloaded: "Downloaded",
  partial: "Partly downloaded",
  missing: "No files",
};

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString() : "unknown");

async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.location.reload(); // session expired: show the login form
  if (!response.ok) throw new Error(data.error || "The action failed.");
  return data;
}

/** /admin after login: map requests, the queue, every region's files and updates, and adding regions. */
export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("requests");
  const [data, setData] = useState<AdminStatus | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const since = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Open the tab named in the address (#queue), and keep it there when switching.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as Tab;
    if (TABS.some((entry) => entry.id === fromHash)) setTab(fromHash);
  }, []);
  const openTab = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  };

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/status?since=${since.current}`, { cache: "no-store" });
      if (response.status === 401) return window.location.reload();
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Map status is unavailable.");
      setData(body);
      const lines: { seq: number; line: string }[] = body.queue.log ?? [];
      if (lines.length) {
        setLog((current) => [...current, ...lines.map((entry) => entry.line)].slice(-400));
        since.current = body.queue.lastSeq;
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Map status is unavailable.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const working = Boolean(data?.queue.current) || data?.osrm.state === "loading" || data?.osrm.state === "switching";
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, working ? 2_000 : 10_000);
    return () => window.clearInterval(timer);
  }, [working, refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ kind: "ok", text: success });
    } catch (caught) {
      setNotice({ kind: "error", text: caught instanceof Error ? caught.message : "The action failed." });
    } finally {
      setBusy(false);
      await refresh();
    }
  }
  const queue = (action: string, regions?: string[], extra: Record<string, unknown> = {}) => post("/api/admin/queue", { action, regions, ...extra });

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  }

  const openRequests = data?.requests.filter((request) => request.status === "open") ?? [];
  const updates = data?.regions.filter((region) => region.update?.available) ?? [];
  const counts: Record<Tab, number | null> = {
    requests: openRequests.length,
    queue: data ? (data.queue.current ? 1 : 0) + data.queue.pending.length : null,
    regions: updates.length || null,
    add: null,
  };

  return (
    <main className="maps admin">
      <header className="maps-header">
        <div>
          <h1>Admin</h1>
          <p className="maps-lede">Approve map requests, watch the map queue, keep regions up to date and clear out files you no longer need.</p>
        </div>
        <div className="admin-session">
          {data?.disk && (
            <span className="maps-muted">
              Disk {gb(data.disk.free)} free of {gb(data.disk.total)} · {data.limits.capped ? `memory cap ${gb(data.limits.cap)}` : `${gb(data.limits.cap)} RAM`}
            </span>
          )}
          <button type="button" className="maps-small" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`panel-${entry.id}`}
            className={tab === entry.id ? "is-current" : undefined}
            onClick={() => openTab(entry.id)}
          >
            {entry.label}
            {counts[entry.id] ? <span className="admin-count">{counts[entry.id]}</span> : null}
          </button>
        ))}
      </div>

      {error && <div className="maps-alert">{error}</div>}
      {notice && <div className={notice.kind === "ok" ? "maps-ok" : "maps-alert"}>{notice.text}</div>}

      <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {!data && tab !== "add" && <p className="maps-muted">Loading…</p>}
        {data && tab === "requests" && <RequestsTab data={data} busy={busy} run={run} />}
        {data && tab === "queue" && <QueueTab data={data} log={log} now={now} busy={busy} run={run} queue={queue} />}
        {data && tab === "regions" && <RegionsTab data={data} now={now} busy={busy} run={run} queue={queue} />}
        {tab === "add" && <MapDownloader embedded />}
      </section>
    </main>
  );
}

type Run = (action: () => Promise<unknown>, success: string) => Promise<void>;
type QueueCall = (action: string, regions?: string[], extra?: Record<string, unknown>) => Promise<unknown>;

function RequestsTab({ data, busy, run }: { data: AdminStatus; busy: boolean; run: Run }) {
  const [showResolved, setShowResolved] = useState(false);
  const open = data.requests.filter((request) => request.status === "open");
  const resolved = data.requests.filter((request) => request.status !== "open");
  const resolve = (request: MapRequest, action: "approve" | "dismiss") =>
    run(
      () => post("/api/admin/requests", { id: request.id, action }),
      action === "approve" ? `${request.name} is added and queued to download and prepare.` : `Dismissed the request for ${request.name}.`,
    );
  return (
    <div className="admin-stack">
      <div className="maps-card">
        <div className="maps-card-head">
          <h2>Waiting for you</h2>
          <span className="maps-muted">Visitors ask for these from Find a map and from the route builder.</span>
        </div>
        {open.length ? (
          <ul className="admin-list">
            {open.map((request) => (
              <RequestRow key={request.id} request={request} regions={data.regions}>
                <button type="button" disabled={busy} onClick={() => void resolve(request, "approve")}>
                  Download and prepare
                </button>
                <button type="button" className="is-quiet" disabled={busy} onClick={() => void resolve(request, "dismiss")}>
                  Dismiss
                </button>
              </RequestRow>
            ))}
          </ul>
        ) : (
          <p className="maps-muted">No map requests are waiting.</p>
        )}
      </div>
      {resolved.length > 0 && (
        <div className="maps-card">
          <div className="maps-card-head">
            <h2>Handled</h2>
            <button type="button" className="maps-link" onClick={() => setShowResolved(!showResolved)}>
              {showResolved ? "Hide" : `Show ${resolved.length}`}
            </button>
          </div>
          {showResolved && (
            <ul className="admin-list">
              {resolved.map((request) => (
                <RequestRow key={request.id} request={request} regions={data.regions}>
                  <span className={`maps-chip ${request.status === "approved" ? "is-active" : ""}`}>
                    {request.status === "approved" ? "Approved" : "Dismissed"} {request.resolvedAt ? day(request.resolvedAt) : ""}
                  </span>
                </RequestRow>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function RequestRow({ request, regions, children }: { request: MapRequest; regions: SupervisorRegion[]; children: React.ReactNode }) {
  const entry = regions.find((region) => region.key === request.key);
  return (
    <li className="admin-row">
      <div className="admin-row-main">
        <strong>{request.name}</strong>
        <span className="maps-muted">
          {request.id} · asked {request.count} time{request.count === 1 ? "" : "s"}, last {day(request.lastAt)}
          {entry ? ` · ${entry.queue === "working" ? "being built" : entry.queue === "queued" ? "queued" : STATE_LABEL[entry.state].toLowerCase()}` : ""}
        </span>
        {request.notes.map((note) => (
          <q key={note.at} className="admin-note">
            {note.text}
          </q>
        ))}
      </div>
      <div className="maps-actions">
        <a className="maps-link" href={`/maps/download?id=${encodeURIComponent(request.id)}`} target="_blank" rel="noreferrer">
          See on map
        </a>
        {children}
      </div>
    </li>
  );
}

function QueueTab({ data, log, now, busy, run, queue }: { data: AdminStatus; log: string[]; now: number; busy: boolean; run: Run; queue: QueueCall }) {
  const label = (key: string) => data.regions.find((region) => region.key === key)?.label ?? key;
  const { current, pending, paused, failures } = data.queue;
  const waiting = data.regions.filter((region) => region.state === "downloaded" && !region.queue && !region.failure && region.memoryNeeded <= data.limits.budget);
  const failed = Object.entries(failures);
  return (
    <div className="admin-stack">
      <div className="maps-admin-row">
        {paused ? (
          <button type="button" disabled={busy} onClick={() => void run(() => queue("resume"), "Queue resumed.")}>
            Resume queue
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void run(() => queue("pause"), "Queue paused; the current task finishes first.")}>
            Pause queue
          </button>
        )}
        <button type="button" disabled={busy || !current} onClick={() => void run(() => queue("cancel"), "Cancelling the current task.")}>
          Cancel current
        </button>
        <button type="button" disabled={busy || !failed.length} onClick={() => void run(() => queue("retry"), "Failed regions are queued again.")}>
          Retry failed
        </button>
        <button
          type="button"
          disabled={busy || !waiting.length}
          onClick={() => void run(() => queue("add", waiting.map((region) => region.key)), `Queued ${waiting.length} downloaded region(s) to prepare.`)}
        >
          Prepare all downloaded
        </button>
        <button type="button" disabled={busy || !pending.length} onClick={() => void run(() => queue("clear"), "Cleared the waiting tasks.")}>
          Clear waiting
        </button>
      </div>
      <section className="maps-now">
        <div className="maps-card">
          <div className="maps-card-head">
            <h2>Now working on</h2>
            {paused && <span className="maps-chip is-paused">Queue paused</span>}
          </div>
          {current ? <CurrentTask current={current} label={label(current.region)} now={now} /> : <p className="maps-muted">Nothing.</p>}
        </div>
        <div className="maps-card">
          <div className="maps-card-head">
            <h2>Up next</h2>
            <span className="maps-muted">{pending.length} waiting</span>
          </div>
          {pending.length ? (
            <ol className="maps-next">
              {pending.map((item) => (
                <li key={item.region}>
                  <span>{label(item.region)}</span>
                  <span className="maps-actions">
                    <span className="maps-muted">{GOAL_LABEL[item.goal]}</span>
                    <button type="button" className="maps-small" disabled={busy} onClick={() => void run(() => queue("remove", [item.region]), `Removed ${label(item.region)} from the queue.`)}>
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="maps-muted">The queue is empty.</p>
          )}
        </div>
      </section>
      {failed.length > 0 && (
        <div className="maps-card">
          <h2>Failed</h2>
          <ul className="admin-list">
            {failed.map(([key, failure]) => (
              <li key={key} className="admin-row">
                <div className="admin-row-main">
                  <strong>{label(key)}</strong>
                  <span className="maps-failure">
                    {failure.step ? `During ${failure.step}: ` : ""}
                    {failure.message}
                  </span>
                  <span className="maps-muted">{ago(failure.at, now)}</span>
                </div>
                <div className="maps-actions">
                  <button type="button" className="maps-small" disabled={busy} onClick={() => void run(() => queue("retry", [key]), `Retrying ${label(key)}.`)}>
                    Retry
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="maps-card">
        <div className="maps-card-head">
          <h2>Map log</h2>
          <span className="maps-muted">Since this page was opened (the last 300 lines before it)</span>
        </div>
        <pre className="maps-log" aria-label="Map log">
          {log.slice(-200).join("\n") || "No map work since the container started."}
        </pre>
      </div>
    </div>
  );
}

function RegionsTab({ data, now, busy, run, queue }: { data: AdminStatus; now: number; busy: boolean; run: Run; queue: QueueCall }) {
  const [search, setSearch] = useState("");
  const [onlyFiles, setOnlyFiles] = useState(true);
  const regions = useMemo(() => {
    const text = search.trim().toLowerCase();
    return data.regions.filter(
      (region) =>
        (!onlyFiles || region.state !== "missing" || region.queue || region.group === "added") &&
        (!text || region.label.toLowerCase().includes(text) || region.key.includes(text)),
    );
  }, [data.regions, search, onlyFiles]);
  const updates = data.regions.filter((region) => region.update?.available && !region.queue);
  const checked = data.updates?.checkedAt;

  return (
    <div className="admin-stack">
      <div className="maps-card">
        <div className="maps-card-head">
          <h2>Map updates</h2>
          <span className="maps-muted">
            Geofabrik publishes new data daily. Last checked {checked ? ago(checked, now) : "never"}
            {data.updates?.checkDays ? `, checked every ${data.updates.checkDays} days` : ", automatic checks are off"}
            {data.updates?.autoDays ? `; regions older than ${data.updates.autoDays} days update themselves.` : "."}
          </span>
        </div>
        <div className="maps-admin-row">
          <button
            type="button"
            disabled={busy || data.updates?.checking}
            onClick={() => void run(() => post("/api/admin/updates", { action: "check" }), "Checked Geofabrik for newer data.")}
          >
            {data.updates?.checking ? "Checking…" : "Check for updates now"}
          </button>
          <button
            type="button"
            disabled={busy || !updates.length}
            onClick={() =>
              void run(() => queue("update", updates.map((region) => region.key)), `Queued updates of ${updates.map((region) => region.label).join(", ")}.`)
            }
          >
            Update all ({updates.length})
          </button>
        </div>
        <p className="maps-muted">
          An update downloads and prepares the new data next to the old files and then swaps them, so the region keeps routing until the new
          data is ready.
        </p>
      </div>

      <div className="maps-card">
        <div className="maps-card-head">
          <h2>Regions and files</h2>
          <span className="maps-actions">
            <label className="admin-check">
              <input type="checkbox" checked={onlyFiles} onChange={(event) => setOnlyFiles(event.target.checked)} /> Only regions with files
            </label>
            <input type="search" className="admin-search" placeholder="Filter" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Filter regions" />
          </span>
        </div>
        {regions.length ? (
          <ul className="admin-list">
            {regions.map((region) => (
              <RegionRow key={region.key} region={region} data={data} busy={busy} run={run} queue={queue} />
            ))}
          </ul>
        ) : (
          <p className="maps-muted">No regions match. Add regions from the Add regions tab.</p>
        )}
      </div>
    </div>
  );
}

function RegionRow({ region, data, busy, run, queue }: { region: SupervisorRegion; data: AdminStatus; busy: boolean; run: Run; queue: QueueCall }) {
  const active = region.key === data.activeRegion;
  const tooLarge = region.state !== "prepared" && region.memoryNeeded > data.limits.budget;
  const hasFiles = region.state !== "missing";
  const deleteFiles = () => {
    if (!window.confirm(`Delete every map file of ${region.label} and take it off the region list? This cannot be undone. You can add it again from the Add regions tab.`)) return;
    void run(() => post("/api/admin/files", { key: region.key, removeFromList: true }), `Deleted ${region.label} and took it off the list.`);
  };
  return (
    <li className={`admin-row ${active ? "is-active" : ""}`}>
      <div className="admin-row-main">
        <strong>
          {region.label}
          {active && <span className="maps-chip is-active">Serving</span>}
          {region.update?.available && <span className="maps-chip is-update">Update available</span>}
          {tooLarge && <span className="maps-chip is-too-large">Too large</span>}
        </strong>
        <span className="maps-muted">
          {region.key} · {region.queue === "working" ? "being built" : region.queue === "queued" ? "queued" : STATE_LABEL[region.state]}
          {region.download ? ` · ${region.download} download` : ""}
          {hasFiles ? ` · data from ${day(region.dataDate)}` : ""}
          {region.update?.available ? ` · Geofabrik has ${day(region.update.remoteDate)}` : ""}
          {region.update?.error ? ` · update check failed: ${region.update.error}` : ""}
        </span>
        {region.failure && <span className="maps-failure">{region.failure.message}</span>}
      </div>
      <div className="maps-actions">
        {!region.queue && (region.state === "missing" || region.state === "partial" || region.state === "downloaded") && (
          <button
            type="button"
            className="maps-small"
            disabled={busy}
            onClick={() => {
              if (tooLarge && !window.confirm(`${region.label} probably needs about ${gb(region.memoryNeeded)} of memory. Try anyway?`)) return;
              void run(() => queue("add", [region.key], { goal: "prepared", force: tooLarge }), `${region.label} is queued.`);
            }}
          >
            {region.state === "downloaded" ? "Prepare" : "Download and prepare"}
          </button>
        )}
        {!region.queue && (region.state === "missing" || region.state === "partial") && (
          <button type="button" className="maps-small" disabled={busy} onClick={() => void run(() => queue("add", [region.key], { goal: "downloaded" }), `${region.label} is queued to download.`)}>
            Download only
          </button>
        )}
        {!region.queue && (region.state === "prepared" || region.state === "downloaded") && (
          <button type="button" className="maps-small" disabled={busy} onClick={() => void run(() => queue("update", [region.key]), `${region.label} is queued to update.`)}>
            {region.update?.available ? "Update" : "Re-download"}
          </button>
        )}
        {region.state === "prepared" && !active && (
          <button
            type="button"
            className="maps-small"
            disabled={busy}
            onClick={() => void run(() => post("/api/regions/switch", { region: region.key }), `Serving ${region.label}.`)}
          >
            Load now
          </button>
        )}
        {region.queue && (
          <button type="button" className="maps-small" disabled={busy} onClick={() => void run(() => queue(region.queue === "working" ? "cancel" : "remove", [region.key]), `Stopped ${region.label}.`)}>
            {region.queue === "working" ? "Cancel" : "Unqueue"}
          </button>
        )}
        {!region.queue && (
          <button
            type="button"
            className="maps-small is-danger"
            disabled={busy || active}
            title={active ? "Load another region first" : undefined}
            onClick={hasFiles ? deleteFiles : () => void run(() => post("/api/admin/geofabrik", { action: "remove", key: region.key }), `${region.label} was removed from the list.`)}
          >
            {hasFiles ? "Delete files" : "Remove from list"}
          </button>
        )}
      </div>
    </li>
  );
}
