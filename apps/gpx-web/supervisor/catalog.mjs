import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const KEY = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const GRAPH_SUFFIXES = ["mldgr", "partition", "cell_metrics"];

export async function loadCatalog(file) {
  const parsed = JSON.parse(await readFile(file, "utf8"));
  return parsed.regions.map((region) => {
    if (!KEY.test(region.key) || !KEY.test(region.graph)) throw new Error(`Invalid catalog entry: ${region.key}`);
    return {
      ...region,
      pbf: `${region.graph}-latest.osm.pbf`,
      osrm: `${region.graph}-latest.osrm`,
    };
  });
}

async function nonEmpty(path) {
  try {
    const info = await stat(path);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

export async function isPrepared(dataDir, region) {
  for (const suffix of GRAPH_SUFFIXES) {
    if (!(await nonEmpty(join(dataDir, `${region.osrm}.${suffix}`)))) return false;
  }
  return true;
}

export async function missingGraphFiles(dataDir, region) {
  const missing = [];
  for (const suffix of GRAPH_SUFFIXES) {
    const name = `${region.osrm}.${suffix}`;
    if (!(await nonEmpty(join(dataDir, name)))) missing.push(name);
  }
  return missing;
}

/** missing | partial | downloaded | prepared */
export async function fileState(dataDir, region) {
  if (await isPrepared(dataDir, region)) return "prepared";
  if (await nonEmpty(join(dataDir, region.pbf))) return "downloaded";
  if (await nonEmpty(join(dataDir, `${region.pbf}.part`))) return "partial";
  return "missing";
}

const stateDir = (dataDir) => join(dataDir, ".rogueroute-gpx");

/** Read a JSON file from /data/.rogueroute-gpx; a missing or damaged file reads as {}. */
export async function readStateFile(dataDir, name) {
  try {
    return JSON.parse(await readFile(join(stateDir(dataDir), name), "utf8"));
  } catch {
    return {};
  }
}

/** Write a JSON file in /data/.rogueroute-gpx atomically (temp file, then rename). */
export async function writeStateFile(dataDir, name, value, { compact = false } = {}) {
  const dir = stateDir(dataDir);
  await mkdir(dir, { recursive: true });
  const file = join(dir, name);
  await writeFile(`${file}.tmp`, `${JSON.stringify(value, null, compact ? 0 : 2)}\n`);
  await rename(`${file}.tmp`, file);
}

export const readState = (dataDir) => readStateFile(dataDir, "state.json");
export const writeState = (dataDir, state) => writeStateFile(dataDir, "state.json", state);

/** Upper bound of a catalog size such as "2-4GB" or "300MB-2GB", in bytes (0 when unknown). */
export function catalogBytes(text) {
  const match = /([\d.]+)\s*(MB|GB)\s*$/i.exec(String(text ?? ""));
  if (!match) return 0;
  return Number(match[1]) * (match[2].toUpperCase() === "GB" ? 1e9 : 1e6);
}
