// Shapes of the downloader data (Geofabrik region index), shared by the API routes and the page.

/** A closed ring of [lon, lat] points. */
export type Ring = [number, number][];
/** [minLon, minLat, maxLon, maxLat] */
export type Box = [number, number, number, number];

export type IndexEntry = {
  id: string;
  name: string;
  parent: string | null;
  bbox: Box | null;
  /** Catalog key when this region is in the region list, and its file state. */
  key: string | null;
  state: "missing" | "partial" | "downloaded" | "prepared" | null;
};

export type PreparedOutline = { key: string; label: string; id: string | null; areas: Ring[] | null; bounds: Box[] };

export type IndexResponse = {
  ok: true;
  fetchedAt: string | null;
  error: string | null;
  regions: IndexEntry[];
  prepared: PreparedOutline[];
};

export type RegionDetail = {
  ok: true;
  region: { id: string; name: string; parent: string | null; url: string; bbox: Box | null; areas: Ring[] };
  parents: { id: string; name: string }[];
  children: { id: string; name: string; areas: Ring[]; key: string | null }[];
  /** Download size in bytes, from Geofabrik; null when unknown. */
  size: number | null;
  memoryNeeded: number | null;
  limits: { cap: number; capped: boolean; budget: number };
  tooLarge: boolean;
  catalog: {
    key: string;
    label: string;
    added: boolean;
    state: "missing" | "partial" | "downloaded" | "prepared";
    queue: "working" | "queued" | null;
    failure: string | null;
  } | null;
  coveredBy: { key: string; label: string }[];
};

/** Geofabrik ids are lowercase words, digits and hyphens, with "/" for US states. */
export const GEOFABRIK_ID = /^[a-z0-9][a-z0-9/-]{0,80}$/;
