// Geofabrik region index: every downloadable extract with its parent and outline, so the
// downloader page can browse continents, countries and sub-regions, and so automatic region
// selection can use real outlines instead of rectangles.
import { readStateFile, writeStateFile } from "./catalog.mjs";

export const DEFAULT_INDEX_URL = "https://download.geofabrik.de/index-v1.json";
const INDEX_FILE = "geofabrik-index.json";
const ADDED_FILE = "regions.json";
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const SIZE_TTL_MS = 24 * 3600 * 1000;

const round = (value) => Math.round(value * 1000) / 1000;

/** Local key for a Geofabrik id: "us/california" -> "us-california". */
export const keyFor = (id) => String(id).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

/** File name of a download URL, which links built-in regions to Geofabrik ids. */
const fileOf = (url) => String(url ?? "").split("/").pop();

/** [minLon, minLat, maxLon, maxLat] of a ring of [lon, lat] points. */
export function ringBox(ring) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

/** Even-odd point-in-polygon test on one ring of [lon, lat] points. */
export function ringContains(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a catalog region (outlines when known, else its boxes) contains a point. */
export function regionContains(region, lon, lat) {
  if (region.areas?.length) return region.areas.some((ring) => ringContains(ring, lon, lat));
  return (region.bounds ?? []).some(([minLon, minLat, maxLon, maxLat]) => lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat);
}

/** Outer rings of a GeoJSON Polygon or MultiPolygon, rounded to about 100 m. */
function outerRings(geometry) {
  if (!geometry) return [];
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons
    .map((polygon) => (polygon[0] ?? []).map(([lon, lat]) => [round(lon), round(lat)]))
    .filter((ring) => ring.length >= 4);
}

/** Compact form of the Geofabrik GeoJSON index. */
export function parseIndex(json) {
  const features = Array.isArray(json?.features) ? json.features : [];
  const regions = [];
  for (const feature of features) {
    const p = feature?.properties ?? {};
    const url = p.urls?.pbf;
    if (typeof p.id !== "string" || typeof url !== "string" || !/^https:\/\//.test(url)) continue;
    const areas = outerRings(feature.geometry);
    regions.push({
      id: p.id,
      name: String(p.name ?? p.id),
      parent: typeof p.parent === "string" ? p.parent : null,
      url,
      areas,
      bbox: areas.length ? ringBox(areas.flat()) : null,
    });
  }
  return regions;
}

export class GeofabrikIndex {
  constructor({ dataDir, catalog, log, url = DEFAULT_INDEX_URL, fetchImpl = (...args) => fetch(...args) }) {
    this.dataDir = dataDir;
    this.catalog = catalog;
    this.log = (line) => log(`[maps] ${line}`);
    this.url = url;
    this.fetch = fetchImpl;
    this.regions = [];
    this.byId = new Map();
    this.fetchedAt = null;
    this.error = null;
    this.refreshing = null;
    this.sizes = new Map(); // id -> { bytes, at }
  }

  /** Regions added from the index earlier, as catalog entries. */
  static async loadAdded(dataDir) {
    const saved = await readStateFile(dataDir, ADDED_FILE);
    return (Array.isArray(saved.regions) ? saved.regions : []).filter(
      (region) => region && typeof region.key === "string" && keyFor(region.key) === region.key && typeof region.url === "string",
    );
  }

  /** Read the cached index and refresh it in the background when it is old or missing. */
  async init() {
    const cached = await readStateFile(this.dataDir, INDEX_FILE);
    if (Array.isArray(cached.regions)) this.use(cached.regions, cached.fetchedAt ?? null);
    const age = this.fetchedAt ? Date.now() - Date.parse(this.fetchedAt) : Infinity;
    if (!(age < MAX_AGE_MS)) void this.refresh().catch(() => {});
  }

  use(regions, fetchedAt) {
    this.regions = regions;
    this.byId = new Map(regions.map((region) => [region.id, region]));
    this.fetchedAt = fetchedAt;
    this.link();
  }

  /** Give catalog regions their Geofabrik id and outline (matched by download file name). */
  link() {
    const byFile = new Map(this.regions.map((region) => [fileOf(region.url), region]));
    for (const region of this.catalog) {
      const match = (region.geofabrik && this.byId.get(region.geofabrik)) || byFile.get(fileOf(region.url));
      if (!match) continue;
      region.geofabrik = match.id;
      if (match.areas.length) region.areas = match.areas;
    }
  }

  /** Download the index again (at most one request at a time). */
  refresh() {
    this.refreshing ??= (async () => {
      try {
        this.log(`Updating the Geofabrik region index from ${this.url}`);
        const response = await this.fetch(this.url, { signal: AbortSignal.timeout(120_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const regions = parseIndex(await response.json());
        if (!regions.length) throw new Error("the index lists no regions");
        const fetchedAt = new Date().toISOString();
        await writeStateFile(this.dataDir, INDEX_FILE, { fetchedAt, url: this.url, regions }, { compact: true });
        this.use(regions, fetchedAt);
        this.error = null;
        this.log(`[OK] Geofabrik region index: ${regions.length} regions.`);
      } catch (error) {
        const cause = error?.cause?.code ? ` (${error.cause.code})` : "";
        this.error = `${error.message}${cause}`;
        this.log(`[WARN] Could not update the Geofabrik region index: ${this.error}`);
        throw error;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  get(id) {
    return this.byId.get(id) ?? null;
  }

  children(id) {
    return this.regions.filter((region) => region.parent === id);
  }

  /** The catalog entry for an index region, if it is in the catalog. */
  catalogEntry(id) {
    return this.catalog.find((region) => region.geofabrik === id) ?? null;
  }

  /** Download size of a region's .osm.pbf (HEAD request, cached for a day); null when unknown. */
  async size(id) {
    const region = this.get(id);
    if (!region) return null;
    const cached = this.sizes.get(id);
    if (cached && Date.now() - cached.at < SIZE_TTL_MS) return cached.bytes;
    try {
      const response = await this.fetch(region.url, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
      const bytes = response.ok ? Number(response.headers.get("content-length")) || null : null;
      this.sizes.set(id, { bytes, at: Date.now() });
      return bytes;
    } catch {
      return null;
    }
  }

  /**
   * Add an index region to the catalog (if it is not there yet) and save the list of added
   * regions. Returns the catalog entry.
   */
  async addToCatalog(id, sizeBytes = null) {
    const source = this.get(id);
    if (!source) throw Object.assign(new Error(`Unknown Geofabrik region: ${id}`), { code: "unknown-region" });
    const existing = this.catalogEntry(id);
    if (existing) return existing;
    let key = keyFor(id);
    if (!key || this.catalog.some((region) => region.key === key)) key = keyFor(`gf-${id}`);
    if (this.catalog.some((region) => region.key === key)) throw new Error(`Region key ${key} is already used.`);
    const parent = source.parent ? this.get(source.parent) : null;
    const entry = {
      key,
      label: parent && !source.name.includes(parent.name) && parent.parent ? `${source.name} (${parent.name})` : source.name,
      group: "added",
      graph: key,
      url: source.url,
      // Same notation as the built-in catalog, so the size estimates work before downloading.
      download: sizeBytes ? (sizeBytes >= 1e9 ? `${(sizeBytes / 1e9).toFixed(1)}GB` : `${Math.max(1, Math.round(sizeBytes / 1e6))}MB`) : "",
      expanded: sizeBytes ? `about ${(sizeBytes * 3) >= 1e9 ? `${((sizeBytes * 3) / 1e9).toFixed(1)}GB` : `${Math.round((sizeBytes * 3) / 1e6)}MB`}` : "",
      bounds: source.areas.map((ring) => ringBox(ring)),
      areas: source.areas,
      geofabrik: source.id,
      pbf: `${key}-latest.osm.pbf`,
      osrm: `${key}-latest.osrm`,
    };
    this.catalog.push(entry);
    await this.saveAdded();
    this.log(`Added ${entry.label} (${id}) to the region list.`);
    return entry;
  }

  /** Take an added region off the list again (only regions that were added from the index). */
  async removeFromCatalog(key) {
    const index = this.catalog.findIndex((region) => region.key === key && region.group === "added");
    if (index < 0) throw new Error(`${key} is not an added region.`);
    this.catalog.splice(index, 1);
    await this.saveAdded();
  }

  saveAdded() {
    const regions = this.catalog
      .filter((region) => region.group === "added")
      .map(({ key, label, group, graph, url, download, expanded, bounds, areas, geofabrik }) => ({
        key,
        label,
        group,
        graph,
        url,
        download,
        expanded,
        bounds,
        areas,
        geofabrik,
      }));
    return writeStateFile(this.dataDir, ADDED_FILE, { regions });
  }

  /**
   * The smallest index region whose outline contains every point ([lon, lat]), or null. Used to
   * suggest which map to request when a route falls outside the prepared regions.
   */
  locate(points) {
    let best = null;
    let bestArea = Infinity;
    for (const region of this.regions) {
      if (!region.areas?.length || !points.every(([lon, lat]) => regionContains(region, lon, lat))) continue;
      const [minLon, minLat, maxLon, maxLat] = region.bbox ?? ringBox(region.areas.flat());
      const area = (maxLon - minLon) * (maxLat - minLat);
      if (area < bestArea) {
        best = region;
        bestArea = area;
      }
    }
    return best;
  }

  /**
   * Prepared catalog regions (other than the given key) that cover a box: its middle and four
   * points 10% in from its corners, so outlines that share a border with the box still count.
   */
  coveredBy(bbox, prepared, exceptKey) {
    if (!bbox) return [];
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const dLon = (maxLon - minLon) * 0.1;
    const dLat = (maxLat - minLat) * 0.1;
    const points = [
      [minLon + dLon, minLat + dLat],
      [minLon + dLon, maxLat - dLat],
      [maxLon - dLon, minLat + dLat],
      [maxLon - dLon, maxLat - dLat],
      [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
    ];
    return prepared.filter((region) => region.key !== exceptKey && points.every(([lon, lat]) => regionContains(region, lon, lat)));
  }
}
