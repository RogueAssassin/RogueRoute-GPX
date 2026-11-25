"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type Step = "starting" | "download" | "extract" | "partition" | "customize" | "swap";
export type Goal = "downloaded" | "prepared" | "updated";

type Region = {
  key: string;
  label: string;
  group: string;
  download: string;
  expanded: string;
  state: "missing" | "partial" | "downloaded" | "prepared";
  queue: "working" | "queued" | null;
  failed: boolean;
  preparedAt: string | null;
  /** Estimated (or measured) peak memory to prepare, in bytes. */
  memoryNeeded: number;
  /** Not prepared and estimated to need more memory than map work may use. */
  tooLarge: boolean;
};

type Limits = { capped: boolean; cap: number; budget: number };

export type Current = {
  region: string;
  goal: Goal;
  step: Step;
  steps: Step[];
  stepIndex: number;
  startedAt: string;
  stepStartedAt: string;
  progress: { bytes?: number; total?: number | null; rate?: number; verifying?: boolean } | null;
};

type MapsResponse = {
  activeRegion: string | null;
  osrm: { state: string; region: string | null; switchTarget: string | null };
  queue: { paused: boolean; current: Current | null; pending: { region: string; goal: Goal }[] };
  limits: Limits;
  regions: Region[];
  /** The visitor is logged in to /admin. */
  admin: boolean;
};

/** What a region looks like on this page, from its files and its place in the queue. */
type View = "ready" | "working" | "queued" | "waiting" | "missing" | "failed";

const VIEW_LABEL: Record<View, string> = {
  ready: "Ready",
  working: "In progress",
  queued: "Queued",
  waiting: "Downloaded, not prepared",
  missing: "Not downloaded",
  failed: "Failed",
};

export const STEP_LABEL: Record<Step, string> = {
  starting: "Starting",
  download: "Download",
  extract: "Extract",
  partition: "Partition",
  customize: "Customize",
  swap: "Swap in",
};

const STEP_HELP: Record<Step, string> = {
  starting: "Checking the files on disk.",
  download: "Downloading the OpenStreetMap extract from Geofabrik.",
  extract: "Reading every road and path in the extract. This is the longest and most memory-hungry step.",
  partition: "Splitting the road network into cells for fast routing.",
  customize: "Calculating walking times across each cell.",
  swap: "Replacing the old map data with the new data (routing pauses for a moment if this region is being served).",
};

export const GOAL_LABEL: Record<Goal, string> = {
  downloaded: "download only",
  prepared: "download and prepare",
  updated: "update to the latest data",
};

function viewOf(region: Region): View {
  if (region.queue === "working") return "working";
  if (region.state === "prepared") return "ready";
  if (region.queue === "queued") return "queued";
  if (region.failed) return "failed";
  return region.state === "downloaded" ? "waiting" : "missing";
}

export const gb = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`);

export function duration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

export function ago(iso: string | null, now: number) {
  if (!iso) return null;
  const ms = now - Date.parse(iso);
  if (ms < 60_000) return "just now";
  return `${duration(ms)} ago`;
}


export default function MapStatus() {
  const [data, setData] = useState<MapsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<View | "all">("all");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/maps", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Map status is unavailable.");
      setData(body);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Map status is unavailable.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const busy = Boolean(data?.queue.current) || data?.osrm.state === "loading" || data?.osrm.state === "switching";
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      void refresh();
    };
    const timer = window.setInterval(tick, busy ? 2_000 : 10_000);
    return () => window.clearInterval(timer);
  }, [busy, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);


  const regions = useMemo(() => data?.regions ?? [], [data]);
  const counts = useMemo(() => {
    const result: Record<View, number> = { ready: 0, working: 0, queued: 0, waiting: 0, missing: 0, failed: 0 };
    for (const region of regions) result[viewOf(region)] += 1;
    return result;
  }, [regions]);
  const label = (key: string | null | undefined) => regions.find((region) => region.key === key)?.label ?? key ?? "";
  const groups = useMemo(() => {
    const visible = regions.filter((region) => filter === "all" || viewOf(region) === filter);
    const byGroup = new Map<string, Region[]>();
    for (const region of visible) byGroup.set(region.group, [...(byGroup.get(region.group) ?? []), region]);
    return [...byGroup.entries()];
  }, [regions, filter]);

  const current = data?.queue.current ?? null;
  const pending = data?.queue.pending ?? [];
  const order: View[] = ["ready", "working", "queued", "waiting", "failed", "missing"];

  return (
    <main className="maps">
      <header className="maps-header">
        <div>
          <h1>Map status</h1>
          <p className="maps-lede">
            Which map regions can be routed right now, which one is being built, and what is still waiting. Map work runs in
            the background, one region at a time, smallest first.
          </p>
          <a className="maps-link maps-add-link" href="/maps/download">
            Missing a place? Find its map and request it →
          </a>
          {data?.admin && (
            <a className="maps-link maps-add-link" href="/admin">
              Manage maps in Admin →
            </a>
          )}
        </div>
        <div className="maps-live" aria-live="polite">
          <span className={`maps-dot ${error ? "is-down" : busy ? "is-busy" : ""}`} />
          {error ? "Offline" : updatedAt ? `Updated ${Math.max(0, Math.round((now - updatedAt) / 1000))}s ago` : "Loading…"}
        </div>
      </header>

      {error && <div className="maps-alert">{error}</div>}

      {data && (
        <>
          <section className="maps-summary" aria-label="Summary">
            <div className="maps-overall">
              <div className="maps-overall-head">
                <strong>
                  {counts.ready} of {regions.length} regions ready
                </strong>
                <span>
                  Serving <b>{label(data.activeRegion) || "nothing yet"}</b>
                  {data.osrm.state !== "ready" && ` · OSRM ${data.osrm.state}${data.osrm.switchTarget ? ` ${label(data.osrm.switchTarget)}` : ""}`}
                </span>
              </div>
              {data.limits && (
                <p className="maps-muted maps-limits">
                  {data.limits.capped ? `Memory cap ${gb(data.limits.cap)}` : `No memory cap (${gb(data.limits.cap)} RAM)`} · map
                  work may use up to {gb(data.limits.budget)}. Larger regions are not prepared automatically.
                </p>
              )}
              <div className="maps-bar" role="img" aria-label={order.map((view) => `${VIEW_LABEL[view]}: ${counts[view]}`).join(", ")}>
                {order.map((view) =>
                  counts[view] ? (
                    <span key={view} className={`maps-bar-part is-${view}`} style={{ flexGrow: counts[view] }} title={`${VIEW_LABEL[view]}: ${counts[view]}`} />
                  ) : null,
                )}
              </div>
            </div>
            <div className="maps-tiles">
              {order.map((view) => (
                <button
                  key={view}
                  type="button"
                  className={`maps-tile is-${view} ${filter === view ? "is-selected" : ""}`}
                  onClick={() => setFilter(filter === view ? "all" : view)}
                  aria-pressed={filter === view}
                >
                  <span className="maps-tile-count">{counts[view]}</span>
                  <span className="maps-tile-label">{VIEW_LABEL[view]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="maps-now" aria-label="Now working on">
            <div className="maps-card">
              <div className="maps-card-head">
                <h2>Now working on</h2>
                {data.queue.paused && <span className="maps-chip is-paused">Queue paused</span>}
              </div>
              {current ? <CurrentTask current={current} label={label(current.region)} now={now} /> : (
                <p className="maps-muted">
                  {!pending.length ? "Nothing. Every queued region is done." : data.queue.paused ? "Nothing while the queue is paused." : "Starting the next region…"}
                </p>
              )}
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
                      <span className="maps-muted">
                        {item.goal === "prepared" && regions.find((r) => r.key === item.region)?.state === "downloaded" ? "prepare" : GOAL_LABEL[item.goal]}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="maps-muted">The queue is empty.</p>
              )}
            </div>
          </section>

          <section aria-label="Regions">
            <div className="maps-section-head">
              <h2>Regions</h2>
              {filter !== "all" && (
                <button type="button" className="maps-link" onClick={() => setFilter("all")}>
                  Show all
                </button>
              )}
            </div>
            {groups.map(([group, items]) => (
              <div key={group} className="maps-group">
                <h3>{group === "core" ? "Core regions" : group === "popular" ? "Popular regions" : group === "added" ? "Added regions" : group}</h3>
                <ul className="maps-regions">
                  {items.map((region) => {
                    const view = viewOf(region);
                    return (
                      <li key={region.key} className={`maps-region is-${view}`}>
                        <div className="maps-region-main">
                          <span className="maps-region-name">
                            {region.label}
                            {region.key === data.activeRegion && <span className="maps-chip is-active">Serving</span>}
                            {region.tooLarge && (
                              <a
                                className="maps-chip is-too-large"
                                href="/maps/download"
                                title={`Needs about ${gb(region.memoryNeeded)} of memory; map work may use ${gb(data.limits.budget)}. Pick a smaller region instead.`}
                              >
                                Too large: pick a smaller region
                              </a>
                            )}
                          </span>
                          <span className="maps-muted">
                            {region.download} download · {region.expanded} prepared
                            {region.memoryNeeded > 0 && view !== "ready" ? ` · needs ~${gb(region.memoryNeeded)} memory` : ""}
                            {region.preparedAt && view === "ready" ? ` · built ${ago(region.preparedAt, now)}` : ""}
                          </span>
                        </div>
                        <div className="maps-region-side">
                          <span className={`maps-state is-${view}`}>{VIEW_LABEL[view]}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>

        </>
      )}
    </main>
  );
}

export function CurrentTask({ current, label, now }: { current: Current; label: string; now: number }) {
  const progress = current.progress;
  const percent = progress?.total && progress.bytes !== undefined ? Math.min(100, (progress.bytes / progress.total) * 100) : null;
  const eta = progress?.rate && progress.total && progress.bytes !== undefined ? ((progress.total - progress.bytes) / progress.rate) * 1000 : null;
  let detail = STEP_HELP[current.step];
  if (current.step === "download" && progress?.verifying) detail = "Verifying the download checksum.";
  else if (current.step === "download" && progress?.bytes !== undefined) {
    detail = `${gb(progress.bytes)}${progress.total ? ` of ${gb(progress.total)}` : ""}${progress.rate ? ` · ${(progress.rate / 1e6).toFixed(1)} MB/s` : ""}${eta ? ` · about ${duration(eta)} left` : ""}`;
  }
  return (
    <div className="maps-task">
      <div className="maps-task-title">
        <strong>{label}</strong>
        <span className="maps-muted">
          {GOAL_LABEL[current.goal]} · started {ago(current.startedAt, now)}
        </span>
      </div>
      <ol className="maps-steps">
        {current.steps.map((step, index) => (
          <li key={step} className={index < current.stepIndex ? "is-done" : index === current.stepIndex ? "is-current" : ""}>
            {STEP_LABEL[step]}
          </li>
        ))}
      </ol>
      <div
        className={`maps-progress ${percent === null ? "is-indeterminate" : ""}`}
        role="progressbar"
        aria-label={`${label}: ${STEP_LABEL[current.step]}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent === null ? undefined : Math.round(percent)}
      >
        <span style={percent === null ? undefined : { width: `${percent}%` }} />
      </div>
      <p className="maps-muted">
        {STEP_LABEL[current.step]}
        {percent !== null ? ` ${Math.floor(percent)}%` : ""} · {duration(now - Date.parse(current.stepStartedAt))} in this step
        <br />
        {detail}
      </p>
    </div>
  );
}
