"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { IndexEntry, IndexResponse, RegionDetail } from "../lib/geofabrik";

const DownloaderMap = dynamic(() => import("./downloader-map"), {
  ssr: false,
  loading: () => <div className="downloader-map downloader-map-loading">Loading map…</div>,
});

type IndexState = IndexResponse & { adminEnabled: boolean };

const TOKEN_KEY = "rogueroute-gpx.adminToken";
const gb = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`);
const STATE_LABEL: Record<string, string> = {
  prepared: "Prepared",
  downloaded: "Downloaded",
  partial: "Downloading",
  missing: "In list",
};

function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** The /maps/download page: browse Geofabrik regions on a map and add them to the queue. */
export default function MapDownloader() {
  const [index, setIndex] = useState<IndexState | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RegionDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setToken(readToken()), []);

  const loadIndex = useCallback(async () => {
    try {
      const response = await fetch("/api/geofabrik", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The region index is unavailable.");
      setIndex(body);
      setIndexError(body.error);
    } catch (error) {
      setIndexError(error instanceof Error ? error.message : "The region index is unavailable.");
    }
  }, []);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  // While the index is still being downloaded by the server, check again shortly.
  useEffect(() => {
    if (!index || index.regions.length) return;
    const timer = window.setTimeout(() => void loadIndex(), 5000);
    return () => window.clearTimeout(timer);
  }, [index, loadIndex]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const response = await fetch(`/api/geofabrik/region?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Region details are unavailable.");
      setDetail(body);
    } catch (error) {
      setDetail(null);
      setDetailError(error instanceof Error ? error.message : "Region details are unavailable.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const byId = useMemo(() => new Map((index?.regions ?? []).map((region) => [region.id, region])), [index]);
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, IndexEntry[]>();
    for (const region of index?.regions ?? []) map.set(region.parent, [...(map.get(region.parent) ?? []), region]);
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [index]);

  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      setNotice(null);
      // Open the tree down to the selected region.
      setExpanded((current) => {
        const next = new Set(current);
        for (let entry = byId.get(id); entry; entry = entry.parent ? byId.get(entry.parent) : undefined) next.add(entry.id);
        return next;
      });
      void loadDetail(id);
    },
    [byId, loadDetail],
  );

  function saveToken(value: string) {
    setToken(value);
    try {
      sessionStorage.setItem(TOKEN_KEY, value);
    } catch {
      /* private window: keep it in memory only */
    }
  }

  async function act(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/geofabrik", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The action failed.");
      setNotice({ kind: "ok", text: success });
      await loadIndex();
      if (selectedId) await loadDetail(selectedId);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "The action failed." });
    } finally {
      setBusy(false);
    }
  }

  const matches = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (text.length < 2 || !index) return null;
    return index.regions.filter((region) => region.name.toLowerCase().includes(text) || region.id.includes(text)).slice(0, 60);
  }, [search, index]);

  const pathName = (entry: IndexEntry) => {
    const names: string[] = [];
    for (let parent = entry.parent ? byId.get(entry.parent) : undefined; parent; parent = parent.parent ? byId.get(parent.parent) : undefined) names.unshift(parent.name);
    return names.join(" › ");
  };

  const canAdmin = Boolean(index?.adminEnabled && token);
  // Stable objects, so the map only re-fits when another region is selected.
  const selectedShape = useMemo(
    () => (detail ? { id: detail.region.id, name: detail.region.name, areas: detail.region.areas, bbox: detail.region.bbox } : null),
    [detail],
  );
  const subregions = useMemo(() => detail?.children ?? [], [detail]);

  return (
    <main className="maps downloader">
      <header className="maps-header">
        <div>
          <a className="maps-back" href="/maps">
            ← Map status
          </a>
          <h1>Add map regions</h1>
          <p className="maps-lede">
            Browse every region Geofabrik publishes, from continents down to states. Pick the smallest region that covers where
            you route: it downloads and prepares faster and needs far less memory.
          </p>
        </div>
        {index?.fetchedAt && (
          <div className="maps-live">
            Region list from {new Date(index.fetchedAt).toLocaleDateString()}
            {canAdmin && (
              <button type="button" className="maps-small" disabled={busy} onClick={() => void act({ action: "refresh" }, "Region list updated.")}>
                Update
              </button>
            )}
          </div>
        )}
      </header>

      {indexError && <div className="maps-alert">{indexError}</div>}

      <section className="downloader-layout">
        <aside className="maps-card downloader-tree" aria-label="Regions">
          <input
            type="search"
            className="downloader-search"
            placeholder="Search regions, e.g. California, Victoria, Bayern"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search regions"
          />
          {matches ? (
            <ul className="downloader-list">
              {matches.length === 0 && <li className="maps-muted">No region matches “{search.trim()}”.</li>}
              {matches.map((entry) => (
                <li key={entry.id}>
                  <button type="button" className={`downloader-row ${entry.id === selectedId ? "is-selected" : ""}`} onClick={() => select(entry.id)}>
                    <span>
                      {entry.name}
                      <small className="maps-muted">{pathName(entry)}</small>
                    </span>
                    {entry.state && <span className={`downloader-badge is-${entry.state}`}>{STATE_LABEL[entry.state]}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Tree
              parent={null}
              childrenOf={childrenOf}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={(id) =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onSelect={select}
            />
          )}
        </aside>

        <div className="downloader-main">
          <DownloaderMap
            selected={selectedShape}
            subregions={subregions}
            prepared={index?.prepared ?? []}
            onSelect={select}
          />
          <p className="maps-muted downloader-legend">
            <span className="legend-swatch is-prepared" /> prepared on this server · <span className="legend-swatch is-selected" /> selected ·{" "}
            <span className="legend-swatch is-sub" /> sub-regions (click to open)
          </p>

          <section className="maps-card downloader-detail" aria-live="polite">
            {!selectedId && <p className="maps-muted">Pick a region from the list or search for one.</p>}
            {loadingDetail && !detail && <p className="maps-muted">Loading…</p>}
            {detailError && <div className="maps-alert">{detailError}</div>}
            {detail && (
              <RegionPanel
                detail={detail}
                loading={loadingDetail}
                canAdmin={canAdmin}
                busy={busy}
                onSelect={select}
                act={act}
              />
            )}
            {notice && <div className={notice.kind === "ok" ? "maps-ok" : "maps-alert"}>{notice.text}</div>}
            {index?.adminEnabled && !token && (
              <div className="maps-admin-row">
                <input type="password" placeholder="Admin token" value={token} onChange={(event) => saveToken(event.target.value)} aria-label="Admin token" />
                <span className="maps-muted">Enter the admin token to add regions.</span>
              </div>
            )}
            {index && !index.adminEnabled && <p className="maps-muted">Adding regions needs ADMIN_TOKEN set in .env, or use ./rogueroute-gpx osm add.</p>}
          </section>
        </div>
      </section>
    </main>
  );
}

function Tree({
  parent,
  childrenOf,
  expanded,
  selectedId,
  onToggle,
  onSelect,
}: {
  parent: string | null;
  childrenOf: Map<string | null, IndexEntry[]>;
  expanded: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const items = childrenOf.get(parent) ?? [];
  if (!items.length) return null;
  return (
    <ul className={parent ? "downloader-list is-nested" : "downloader-list"}>
      {items.map((entry) => {
        const hasChildren = (childrenOf.get(entry.id)?.length ?? 0) > 0;
        const open = expanded.has(entry.id);
        return (
          <li key={entry.id}>
            <div className={`downloader-row ${entry.id === selectedId ? "is-selected" : ""}`}>
              {hasChildren ? (
                <button type="button" className="downloader-toggle" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${entry.name}`} onClick={() => onToggle(entry.id)}>
                  {open ? "▾" : "▸"}
                </button>
              ) : (
                <span className="downloader-toggle" />
              )}
              <button type="button" className="downloader-name" onClick={() => onSelect(entry.id)}>
                {entry.name}
              </button>
              {entry.state && <span className={`downloader-badge is-${entry.state}`}>{STATE_LABEL[entry.state]}</span>}
            </div>
            {open && hasChildren && (
              <Tree parent={entry.id} childrenOf={childrenOf} expanded={expanded} selectedId={selectedId} onToggle={onToggle} onSelect={onSelect} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RegionPanel({
  detail,
  loading,
  canAdmin,
  busy,
  onSelect,
  act,
}: {
  detail: RegionDetail;
  loading: boolean;
  canAdmin: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  act: (payload: Record<string, unknown>, success: string) => Promise<void>;
}) {
  const { region, catalog, limits } = detail;
  const name = region.name;
  const inQueue = catalog?.queue;
  const prepared = catalog?.state === "prepared";
  const add = (goal: "prepared" | "downloaded", force = false) =>
    act(
      { action: "add", id: region.id, goal, force },
      `${name} is queued to ${goal === "prepared" ? "download (if needed) and prepare" : "download"}. Progress is on Map status.`,
    );

  return (
    <div className={loading ? "is-loading" : ""}>
      <nav className="downloader-crumbs" aria-label="Region path">
        {detail.parents.map((parent) => (
          <span key={parent.id}>
            <button type="button" className="maps-link" onClick={() => onSelect(parent.id)}>
              {parent.name}
            </button>
            {" › "}
          </span>
        ))}
      </nav>
      <div className="maps-card-head">
        <h2>{name}</h2>
        {catalog && (
          <span className={`downloader-badge is-${inQueue ?? catalog.state}`}>
            {inQueue === "working" ? "Being built" : inQueue === "queued" ? "Queued" : STATE_LABEL[catalog.state]}
          </span>
        )}
      </div>

      <dl className="downloader-facts">
        <div>
          <dt>Download</dt>
          <dd>{detail.size ? gb(detail.size) : "unknown"}</dd>
        </div>
        <div>
          <dt>Memory to prepare</dt>
          <dd>{detail.memoryNeeded ? `about ${gb(detail.memoryNeeded)}` : "unknown"}</dd>
        </div>
        <div>
          <dt>Map work may use</dt>
          <dd>{gb(limits.budget)}</dd>
        </div>
        <div>
          <dt>Sub-regions</dt>
          <dd>{detail.children.length || "none"}</dd>
        </div>
      </dl>

      {detail.coveredBy.length > 0 && !prepared && (
        <p className="maps-ok">
          Already covered by {detail.coveredBy.map((region) => region.label).join(", ")} (prepared). Routes here work today; add this only
          if you want a smaller graph of its own.
        </p>
      )}
      {detail.tooLarge && !prepared && (
        <p className="maps-alert">
          Too large for this server: it needs about {detail.memoryNeeded ? gb(detail.memoryNeeded) : "?"} of memory and map work may use{" "}
          {gb(limits.budget)}.
          {detail.children.length ? ` Pick one of its ${detail.children.length} sub-regions instead.` : " Raise ROGUEROUTE_MEMORY_LIMIT or try it anyway."}
        </p>
      )}
      {catalog?.failure && <p className="maps-failure">Last attempt failed: {catalog.failure}</p>}

      {canAdmin && !prepared && !inQueue && (
        <div className="maps-admin-row">
          {!detail.tooLarge && (
            <button type="button" disabled={busy} onClick={() => void add("prepared")}>
              {catalog?.state === "downloaded" ? "Prepare" : "Download and prepare"}
            </button>
          )}
          {catalog?.state !== "downloaded" && (
            <button type="button" disabled={busy} onClick={() => void add("downloaded")}>
              Download only
            </button>
          )}
          {detail.tooLarge && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`${name} probably needs more memory than map work may use. It will run inside the memory cap, and the watchdog stops it if the server runs low. Try anyway?`)) {
                  void add("prepared", true);
                }
              }}
            >
              Prepare anyway
            </button>
          )}
          {catalog?.added && catalog.state === "missing" && (
            <button type="button" className="maps-small" disabled={busy} onClick={() => void act({ action: "remove", key: catalog.key }, `${name} was removed from the list.`)}>
              Remove from list
            </button>
          )}
        </div>
      )}
      {inQueue && (
        <p className="maps-muted">
          In the map queue. Follow it on <a href="/maps">Map status</a>.
        </p>
      )}

      {detail.children.length > 0 && (
        <>
          <h3>Sub-regions</h3>
          <ul className="downloader-children">
            {detail.children
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((child) => (
                <li key={child.id}>
                  <button type="button" className={`maps-chip ${child.key ? "is-active" : ""}`} onClick={() => onSelect(child.id)}>
                    {child.name}
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}
