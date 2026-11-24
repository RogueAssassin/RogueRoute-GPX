import { request } from "node:http";
import { timingSafeEqual } from "node:crypto";

export type RegionState = "missing" | "partial" | "downloaded" | "prepared";

export type SupervisorRegion = {
  key: string;
  label: string;
  group: string;
  download: string;
  expanded: string;
  bounds: [number, number, number, number][];
  state: RegionState;
  queue: "working" | "queued" | null;
  failure: MapFailure | null;
  preparedAt: string | null;
};

export type MapFailure = { message: string; step: string | null; at: string };

export type OsrmStatus = {
  state: "stopped" | "no-graph" | "loading" | "ready" | "switching" | "failed";
  region: string | null;
  graph: string | null;
  error: string | null;
  since: string;
  switchTarget: string | null;
  cooldownRemainingSeconds: number;
};

export type MapStep = "starting" | "download" | "extract" | "partition" | "customize";

export type QueueStatus = {
  paused: boolean;
  current: {
    region: string;
    goal: "downloaded" | "prepared";
    step: MapStep;
    steps: MapStep[];
    stepIndex: number;
    startedAt: string;
    stepStartedAt: string;
    progress: { bytes?: number; total?: number | null; rate?: number; verifying?: boolean } | null;
  } | null;
  pending: { region: string; goal: "downloaded" | "prepared" }[];
  failures: Record<string, MapFailure>;
  history: Record<string, { downloadedAt?: string; preparedAt?: string; prepareSeconds?: number }>;
  log?: { seq: number; line: string }[];
  lastSeq: number;
};

export type SupervisorStatus = {
  ok: true;
  activeRegion: string | null;
  osrm: OsrmStatus;
  queue: QueueStatus;
  disk: { free: number; total: number } | null;
  memory: number;
  regions: SupervisorRegion[];
};

export class ControlError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

const socketPath = () => process.env.ROGUEROUTE_CONTROL_SOCKET || "/tmp/rogueroute-gpx.sock";

/** Longest a region switch may take: the supervisor's graph load timeout plus slack. */
export const SWITCH_TIMEOUT_MS = (Number(process.env.ROGUEROUTE_STARTUP_TIMEOUT_SECONDS) || 600) * 1000 + 60_000;

/** Call the in-container supervisor over its unix socket. */
export function control<T>(method: "GET" | "POST", path: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = request(
      {
        socketPath: socketPath(),
        method,
        path,
        headers: payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          } catch {
            /* keep empty */
          }
          const status = res.statusCode ?? 500;
          if (status >= 400) reject(new ControlError(String(data.error || `Supervisor returned HTTP ${status}`), status, data.code as string));
          else resolve(data as T);
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new ControlError("The OSRM supervisor did not answer in time.", 504)));
    req.once("error", (error: NodeJS.ErrnoException) =>
      reject(
        error instanceof ControlError
          ? error
          : new ControlError(
              error.code === "ENOENT" || error.code === "ECONNREFUSED"
                ? "The OSRM supervisor is not running (development mode or a broken container)."
                : error.message,
              503,
              "unavailable",
            ),
      ),
    );
    req.end(payload);
  });
}

export const getStatus = () => control<SupervisorStatus>("GET", "/status");

export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof ControlError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return Response.json({ error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

/** True when ADMIN_TOKEN is configured and the request carries it as a bearer token. */
export function isAdmin(request: Request) {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Public view of the region list: no bounds and no job log. */
export function publicRegions(status: SupervisorStatus) {
  return status.regions.map(({ key, label, group, download, expanded, state }) => ({ key, label, group, download, expanded, state }));
}

/**
 * Map progress for the public /maps page: what is prepared, in progress and waiting. Failure
 * details, disk space and the log stay behind the admin token.
 */
export function publicMaps(status: SupervisorStatus) {
  const { queue } = status;
  return {
    ok: true,
    activeRegion: status.activeRegion,
    osrm: { state: status.osrm.state, region: status.osrm.region, switchTarget: status.osrm.switchTarget },
    queue: { paused: queue.paused, current: queue.current, pending: queue.pending },
    regions: status.regions.map(({ key, label, group, download, expanded, state, queue: queued, failure, preparedAt }) => ({
      key,
      label,
      group,
      download,
      expanded,
      state,
      queue: queued,
      failed: Boolean(failure),
      preparedAt,
    })),
  };
}
