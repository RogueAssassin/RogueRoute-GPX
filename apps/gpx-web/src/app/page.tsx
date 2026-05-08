"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Point = [number, number];

type OsrmRegion = {
  key: string;
  label: string;
  pbf: string;
  graph: string;
  group: string;
};

type GenerateResponse = {
  stats: {
    routerMode: string;
    routeMode: string;
    waypointCount: number;
    legCount: number;
    manualOverrideLegs: number;
    totalDistanceKm: number;
    totalDurationMinutes: number;
    warnings?: string[];
  };
  gpx: string;
  plan: {
    orderedWaypoints: Array<{
      id: string;
      lat: number;
      lng: number;
      name?: string;
    }>;
    legs: Array<{
      geometry: Point[];
      overrideUsed?: boolean;
      warning?: string;
    }>;
  };
  orderedWaypoints: Array<{
    id: string;
    lat: number;
    lng: number;
    name?: string;
  }>;
  mapState?: {
    centerLat: number;
    centerLng: number;
    zoom: number;
  };
  source?: {
    type: string;
    pluginVersion?: string;
  };
  requestOptions?: {
    strictLandRouting: boolean;
    allowFerries: boolean;
    allowManualOverride: boolean;
  };
};

function sanitizeFilename(value: string) {
  return (value || "route")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function projectPoint(
  point: Point,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  width = 900,
  height = 500,
) {
  const [lat, lng] = point;
  const padding = 26;
  const latSpan = bounds.maxLat - bounds.minLat || 0.001;
  const lngSpan = bounds.maxLng - bounds.minLng || 0.001;

  const x = padding + ((lng - bounds.minLng) / lngSpan) * (width - padding * 2);
  const y =
    height -
    padding -
    ((lat - bounds.minLat) / latSpan) * (height - padding * 2);

  return { x, y };
}

export default function HomePage() {
  const [input, setInput] = useState(
    "-37.8136,144.9631,Start\n-37.8140,144.9650\n-37.8152,144.9671\n-37.8160,144.9690,Finish",
  );
  const [routeMode, setRouteMode] = useState("optimize-middle");
  const [routeName, setRouteName] = useState("RogueRoute Night Run");
  const [strictLandRouting, setStrictLandRouting] = useState(true);
  const [allowFerries, setAllowFerries] = useState(false);
  const [allowManualOverride, setAllowManualOverride] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [regions, setRegions] = useState<OsrmRegion[]>([]);
  const [activeRegion, setActiveRegion] = useState("australia");
  const [selectedRegion, setSelectedRegion] = useState("australia");
  const [switchingRegion, setSwitchingRegion] = useState(false);
  const [regionNotice, setRegionNotice] = useState<string | null>(null);

  useEffect(() => {
    const savedRouteMode = window.localStorage.getItem("rogue.routeMode");
    const savedRouteName = window.localStorage.getItem("rogue.routeName");
    const savedStrictLand = window.localStorage.getItem(
      "rogue.strictLandRouting",
    );
    const savedFerries = window.localStorage.getItem("rogue.allowFerries");
    const savedOverride = window.localStorage.getItem(
      "rogue.allowManualOverride",
    );

    if (savedRouteMode) setRouteMode(savedRouteMode);
    if (savedRouteName) setRouteName(savedRouteName);
    if (savedStrictLand) setStrictLandRouting(savedStrictLand === "true");
    if (savedFerries) setAllowFerries(savedFerries === "true");
    if (savedOverride) setAllowManualOverride(savedOverride === "true");

    if (window.location.hash.startsWith("#import=")) {
      try {
        const payload = decodeURIComponent(
          window.location.hash.replace("#import=", ""),
        );
        setInput(payload);
        setImportNotice("Imported route payload from IITC plugin.");
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      } catch {
        setImportNotice("Failed to import IITC payload from URL.");
      }
    }

    void refreshRegions();
  }, []);

  useEffect(
    () => window.localStorage.setItem("rogue.routeMode", routeMode),
    [routeMode],
  );
  useEffect(
    () => window.localStorage.setItem("rogue.routeName", routeName),
    [routeName],
  );
  useEffect(
    () =>
      window.localStorage.setItem(
        "rogue.strictLandRouting",
        String(strictLandRouting),
      ),
    [strictLandRouting],
  );
  useEffect(
    () =>
      window.localStorage.setItem("rogue.allowFerries", String(allowFerries)),
    [allowFerries],
  );
  useEffect(
    () =>
      window.localStorage.setItem(
        "rogue.allowManualOverride",
        String(allowManualOverride),
      ),
    [allowManualOverride],
  );

  const previewLegs = useMemo(() => result?.plan.legs ?? [], [result]);
  const previewPoints = useMemo(
    () => previewLegs.flatMap((leg) => leg.geometry),
    [previewLegs],
  );

  const bounds = useMemo(() => {
    if (!previewPoints.length) {
      return { minLat: -37.82, maxLat: -37.81, minLng: 144.96, maxLng: 144.97 };
    }
    const lats = previewPoints.map((p) => p[0]);
    const lngs = previewPoints.map((p) => p[1]);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [previewPoints]);

  async function refreshRegions() {
    try {
      const response = await fetch("/api/osrm/regions", { cache: "no-store" });
      const data = await response.json();
      if (Array.isArray(data.regions)) setRegions(data.regions);
      if (data.activeRegion) {
        setActiveRegion(data.activeRegion);
        setSelectedRegion(data.activeRegion);
      }
    } catch {
      setRegionNotice(
        "Region catalogue is unavailable from the web container.",
      );
    }
  }

  async function switchRegion() {
    setSwitchingRegion(true);
    setError(null);
    setRegionNotice(`Switching OSRM to ${selectedRegion}...`);
    try {
      const response = await fetch("/api/osrm/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: selectedRegion }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to switch OSRM region");
      setActiveRegion(data.activeRegion || selectedRegion);
      setRegionNotice(
        `OSRM region ready: ${data.activeRegion || selectedRegion}`,
      );
    } catch (err) {
      setRegionNotice(null);
      setError(
        err instanceof Error ? err.message : "Failed to switch OSRM region",
      );
    } finally {
      setSwitchingRegion(false);
    }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setImportNotice(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          routeMode,
          name: routeName || "Generated Route",
          strictLandRouting,
          allowFerries,
          allowManualOverride,
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to generate route");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function onFileSelected(file: File) {
    const text = await file.text();
    setInput(text);
    setImportNotice(`Loaded ${file.name}`);
  }

  function downloadDebugJson() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeFilename(routeName || "route")}-debug.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const gpxDownloadName = `${sanitizeFilename(routeName || "route")}.gpx`;

  return (
    <main style={{ maxWidth: 1380, margin: "0 auto", padding: 24 }}>
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(148,163,184,0.18)",
          borderRadius: 28,
          padding: 28,
          marginBottom: 24,
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(17,24,39,0.88)), radial-gradient(circle at top left, rgba(34,211,238,0.25), transparent 35%)",
          boxShadow: "0 28px 80px rgba(2,6,23,0.55)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(56,189,248,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.08) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0.2))",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "1.15fr 0.85fr",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.8)",
                border: "1px solid rgba(56,189,248,0.24)",
                color: "#93c5fd",
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "#22d3ee",
                  boxShadow: "0 0 18px #22d3ee",
                }}
              />
              RogueRoute-GPX · Cyber Neon Wolf OSRM Edition
            </div>
            <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.05 }}>
              RogueRoute GPX
            </h1>
            <p style={{ fontSize: 19, color: "#cbd5e1", maxWidth: 700 }}>
              Built by RogueAssassin with the V8 Neon Wolf look, now upgraded
              for OSRM-first GPX generation, road/path-following geometry, IITC
              exports, strict land routing, and visible fallback warnings.
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              {[
                "Cyber Neon Wolf UI",
                "OSRM road/path routing",
                "Snap-to-network guards",
                "IITC Alt-click legend",
                "Regional OSM downloader",
              ].map((item) => (
                <span
                  key={item}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "rgba(30,41,59,0.78)",
                    border: "1px solid rgba(168,85,247,0.28)",
                    color: "#e2e8f0",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div
            style={{
              borderRadius: 24,
              border: "1px solid rgba(56,189,248,0.24)",
              background: "rgba(2,6,23,0.72)",
              padding: 20,
            }}
          >
            <svg
              viewBox="0 0 480 280"
              width="100%"
              height="260"
              aria-label="Cyber wolf route graphic"
            >
              <defs>
                <linearGradient id="routeGlow" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
                <filter id="softGlow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d="M118 208 L170 102 L218 136 L258 76 L318 98 L356 60 L394 104 L350 164 L360 214 L310 190 L258 226 L206 210 L150 226 Z"
                fill="rgba(15,23,42,0.92)"
                stroke="rgba(148,163,184,0.35)"
                strokeWidth="3"
              />
              <path
                d="M178 116 L224 82 L248 126 L286 92 L332 106 L350 146 L326 176 L280 172 L236 204 L200 182 Z"
                fill="none"
                stroke="url(#routeGlow)"
                strokeWidth="5"
                strokeLinejoin="round"
                strokeLinecap="round"
                filter="url(#softGlow)"
              />
              {[
                [178, 116],
                [224, 82],
                [248, 126],
                [286, 92],
                [332, 106],
                [350, 146],
                [326, 176],
                [280, 172],
                [236, 204],
                [200, 182],
              ].map(([cx, cy], i) => (
                <g key={i}>
                  <circle cx={cx} cy={cy} r="10" fill="rgba(34,211,238,0.14)" />
                  <circle cx={cx} cy={cy} r="4" fill="#22d3ee" />
                </g>
              ))}
              <path
                d="M152 98 L208 48 L274 54 L334 24 L388 50 L420 94 L390 90 L356 70 L340 118 L302 100 L256 148 L198 144 Z"
                fill="rgba(2,6,23,0.92)"
                stroke="url(#routeGlow)"
                strokeWidth="3"
              />
              <circle
                cx="334"
                cy="94"
                r="6"
                fill="#a855f7"
                filter="url(#softGlow)"
              />
            </svg>
          </div>
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <section style={panelStyle}>
          <h2 style={sectionTitle}>Generator</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <label style={fieldStyle}>
              <span>Route name</span>
              <input
                value={routeName}
                onChange={(event) => setRouteName(event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>Route mode</span>
              <select
                value={routeMode}
                onChange={(event) => setRouteMode(event.target.value)}
                style={inputStyle}
              >
                <option value="preserve-order">Preserve order</option>
                <option value="optimize-middle">Optimize middle</option>
                <option value="loop">Loop</option>
              </select>
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0,1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <ToggleCard
              title="Strict land"
              hint="No silent fallback when a road/path route is missing."
              enabled={strictLandRouting}
              onToggle={setStrictLandRouting}
            />
            <ToggleCard
              title="Allow ferries"
              hint="Use ferries when the routing engine supports them."
              enabled={allowFerries}
              onToggle={setAllowFerries}
            />
            <ToggleCard
              title="Manual override"
              hint="Warn and allow direct segments when routing cannot find geometry."
              enabled={allowManualOverride}
              onToggle={setAllowManualOverride}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <label style={fieldStyle}>
              <span>Upload coords / JSON / CSV / payload</span>
              <input
                type="file"
                accept=".txt,.csv,.json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onFileSelected(file);
                }}
              />
            </label>
            <a
              href="/downloads/iitc/rogueroute-exporter.user.js"
              style={{ ...buttonLink, background: "rgba(88,28,135,0.42)" }}
              download
            >
              Download IITC Plugin
            </a>
          </div>

          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={18}
            style={textareaStyle}
          />

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 12,
            }}
          >
            <button onClick={generate} disabled={loading} style={primaryButton}>
              {loading ? "Generating route..." : "Generate RogueRoute GPX"}
            </button>

            {result?.gpx && (
              <a
                href={`data:application/gpx+xml;charset=utf-8,${encodeURIComponent(result.gpx)}`}
                download={gpxDownloadName}
                style={buttonLink}
              >
                Download {gpxDownloadName}
              </a>
            )}

            {result && (
              <button onClick={downloadDebugJson} style={secondaryButton}>
                Download Debug JSON
              </button>
            )}
          </div>

          {(importNotice || error) && (
            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              {importNotice && <div style={noticeStyle}>{importNotice}</div>}
              {error && <div style={errorStyle}>Error: {error}</div>}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitle}>Operations Deck</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0,1fr))",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <StatCard
              label="Router"
              value={result?.stats.routerMode ?? "Awaiting run"}
            />
            <StatCard
              label="Distance"
              value={result ? `${result.stats.totalDistanceKm} km` : "—"}
            />
            <StatCard
              label="Duration"
              value={result ? `${result.stats.totalDurationMinutes} min` : "—"}
            />
            <StatCard
              label="Override legs"
              value={result ? String(result.stats.manualOverrideLegs) : "0"}
            />
          </div>

          <div
            style={{
              background: "rgba(2,6,23,0.72)",
              border: "1px solid rgba(56,189,248,0.15)",
              borderRadius: 18,
              padding: 10,
            }}
          >
            <svg viewBox="0 0 900 500" width="100%" height="330">
              <rect
                x="0"
                y="0"
                width="900"
                height="500"
                fill="rgba(2,6,23,0.98)"
                rx="18"
              />
              <g opacity="0.2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <line
                    key={`h-${i}`}
                    x1="0"
                    x2="900"
                    y1={i * 40 + 20}
                    y2={i * 40 + 20}
                    stroke="#334155"
                  />
                ))}
                {Array.from({ length: 18 }).map((_, i) => (
                  <line
                    key={`v-${i}`}
                    y1="0"
                    y2="500"
                    x1={i * 50 + 20}
                    x2={i * 50 + 20}
                    stroke="#1e293b"
                  />
                ))}
              </g>
              {previewLegs.map((leg, index) => {
                const coords = leg.geometry
                  .map((point) => {
                    const p = projectPoint(point, bounds);
                    return `${p.x},${p.y}`;
                  })
                  .join(" ");
                return (
                  <polyline
                    key={index}
                    points={coords}
                    fill="none"
                    stroke={leg.overrideUsed ? "#ef4444" : "#22d3ee"}
                    strokeWidth="4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={leg.overrideUsed ? "12 10" : undefined}
                  />
                );
              })}
              {result?.orderedWaypoints.map((point, index) => {
                const p = projectPoint([point.lat, point.lng], bounds);
                return (
                  <g key={point.id}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="9"
                      fill="rgba(168,85,247,0.18)"
                    />
                    <circle cx={p.x} cy={p.y} r="4" fill="#a855f7" />
                    <text
                      x={p.x + 10}
                      y={p.y - 10}
                      fill="#e2e8f0"
                      fontSize="12"
                    >
                      {index + 1}
                    </text>
                  </g>
                );
              })}
              {!previewLegs.length && (
                <text x="30" y="50" fill="#94a3b8">
                  No route preview yet.
                </text>
              )}
            </svg>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            <div style={subPanelStyle}>
              <strong>Status</strong>
              <div style={{ marginTop: 8, color: "#cbd5e1" }}>
                Routing mode:{" "}
                <span style={{ color: "#22d3ee" }}>
                  {result?.stats.routerMode ?? "Not generated"}
                </span>
                <br />
                Strict road/path routing:{" "}
                <span
                  style={{ color: strictLandRouting ? "#22d3ee" : "#cbd5e1" }}
                >
                  {strictLandRouting ? "On" : "Off"}
                </span>
                <br />
                Ferries/transport links:{" "}
                <span style={{ color: allowFerries ? "#22d3ee" : "#cbd5e1" }}>
                  {allowFerries ? "Allowed" : "Blocked"}
                </span>
                <br />
                Manual override:{" "}
                <span
                  style={{ color: allowManualOverride ? "#f97316" : "#cbd5e1" }}
                >
                  {allowManualOverride ? "Allowed with warning" : "Blocked"}
                </span>
              </div>
            </div>

            <div style={subPanelStyle}>
              <strong>OSRM Region Switcher</strong>
              <p style={{ margin: "8px 0", color: "#cbd5e1" }}>
                One OSRM container stays running. Pick a prepared region and
                RogueRoute will update .env, restart OSRM, then continue routing
                against that graph.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <select
                  value={selectedRegion}
                  onChange={(event) => setSelectedRegion(event.target.value)}
                  style={{ ...inputStyle, minWidth: 230 }}
                >
                  {(regions.length
                    ? regions
                    : [
                        {
                          key: "australia",
                          label: "Australia",
                          pbf: "australia-latest.osm.pbf",
                          graph: "australia.osrm",
                          group: "core",
                        },
                      ]
                  ).map((region) => (
                    <option key={region.key} value={region.key}>
                      {region.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={switchRegion}
                  disabled={switchingRegion || selectedRegion === activeRegion}
                  style={secondaryButton}
                >
                  {switchingRegion ? "Switching..." : "Switch OSRM Region"}
                </button>
                <button onClick={refreshRegions} style={secondaryButton}>
                  Refresh
                </button>
              </div>
              <div style={{ marginTop: 8, color: "#cbd5e1" }}>
                Active region:{" "}
                <span style={{ color: "#22d3ee" }}>{activeRegion}</span>
              </div>
              {regionNotice && (
                <div style={{ ...noticeStyle, marginTop: 10 }}>
                  {regionNotice}
                </div>
              )}
            </div>

            <div style={subPanelStyle}>
              <strong>Warnings</strong>
              <ul
                style={{
                  margin: "10px 0 0 18px",
                  padding: 0,
                  color: "#cbd5e1",
                }}
              >
                {(result?.stats.warnings?.length
                  ? result.stats.warnings
                  : ["No warnings."]
                ).map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {result?.orderedWaypoints?.length ? (
        <section style={{ ...panelStyle, marginTop: 24 }}>
          <h2 style={sectionTitle}>Ordered Waypoints</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["#", "Name", "Latitude", "Longitude"].map((header) => (
                    <th
                      key={header}
                      style={{
                        textAlign: "left",
                        padding: 10,
                        borderBottom: "1px solid rgba(148,163,184,0.22)",
                        color: "#93c5fd",
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.orderedWaypoints.map((point, index) => (
                  <tr key={point.id}>
                    <td style={cellStyle}>{index + 1}</td>
                    <td style={cellStyle}>{point.name || point.id}</td>
                    <td style={cellStyle}>{point.lat}</td>
                    <td style={cellStyle}>{point.lng}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function ToggleCard({
  title,
  hint,
  enabled,
  onToggle,
}: {
  title: string;
  hint: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      style={{
        textAlign: "left",
        background: enabled
          ? "linear-gradient(135deg, rgba(8,47,73,0.9), rgba(88,28,135,0.55))"
          : "rgba(15,23,42,0.72)",
        border: `1px solid ${enabled ? "rgba(34,211,238,0.4)" : "rgba(148,163,184,0.18)"}`,
        color: "#f8fafc",
        borderRadius: 18,
        padding: 14,
        cursor: "pointer",
        boxShadow: enabled
          ? "0 0 0 1px rgba(34,211,238,0.1), 0 12px 24px rgba(14,116,144,0.18)"
          : "none",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
      >
        <strong>{title}</strong>
        <span style={{ color: enabled ? "#22d3ee" : "#94a3b8" }}>
          {enabled ? "ON" : "OFF"}
        </span>
      </div>
      <p style={{ marginBottom: 0, color: "#cbd5e1", fontSize: 13 }}>{hint}</p>
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={subPanelStyle}>
      <div style={{ color: "#93c5fd", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(15,23,42,0.94), rgba(2,6,23,0.94))",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: 24,
  padding: 20,
  boxShadow: "0 18px 44px rgba(2,6,23,0.42)",
};

const subPanelStyle: CSSProperties = {
  background: "rgba(2,6,23,0.72)",
  border: "1px solid rgba(56,189,248,0.16)",
  borderRadius: 18,
  padding: 14,
};

const sectionTitle: CSSProperties = {
  marginTop: 0,
  marginBottom: 14,
  fontSize: 28,
};
const fieldStyle: CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  gap: 6,
};
const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.2)",
  background: "#020617",
  color: "#f8fafc",
};
const textareaStyle: CSSProperties = {
  width: "100%",
  background: "#020617",
  color: "#f8fafc",
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 16,
  padding: 14,
  boxSizing: "border-box",
  fontFamily: "monospace",
  fontSize: 13,
};
const primaryButton: CSSProperties = {
  border: 0,
  padding: "12px 18px",
  borderRadius: 14,
  cursor: "pointer",
  background: "linear-gradient(90deg, #0891b2, #7c3aed)",
  color: "#fff",
  fontWeight: 700,
  boxShadow: "0 12px 30px rgba(14,116,144,0.28)",
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
const buttonLink: CSSProperties = {
  background: "rgba(51,65,85,0.88)",
  color: "#fff",
  textDecoration: "none",
  padding: "12px 18px",
  borderRadius: 14,
  display: "inline-flex",
  alignItems: "center",
  fontWeight: 600,
};
const noticeStyle: CSSProperties = {
  background: "rgba(8,47,73,0.7)",
  border: "1px solid rgba(34,211,238,0.18)",
  padding: 12,
  borderRadius: 14,
  color: "#cffafe",
};
const errorStyle: CSSProperties = {
  background: "rgba(69,10,10,0.6)",
  border: "1px solid rgba(248,113,113,0.22)",
  padding: 12,
  borderRadius: 14,
  color: "#fecaca",
};
const cellStyle: CSSProperties = {
  padding: 10,
  borderBottom: "1px solid rgba(30,41,59,0.9)",
  color: "#cbd5e1",
};
