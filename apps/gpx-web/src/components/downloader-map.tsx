"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Box, PreparedOutline, Ring } from "../lib/geofabrik";

type LatLng = [number, number];

/** Leaflet wants [lat, lng]; outlines are stored as [lon, lat]. */
const toLatLngs = (rings: Ring[]): LatLng[][] => rings.map((ring) => ring.map(([lon, lat]) => [lat, lon] as LatLng));
const boxRing = ([minLon, minLat, maxLon, maxLat]: Box): Ring => [
  [minLon, minLat],
  [maxLon, minLat],
  [maxLon, maxLat],
  [minLon, maxLat],
  [minLon, minLat],
];

/** Box around the outlines, leaving out rings that wrap the date line (such as the Aleutians). */
function fitBox(rings: Ring[], fallback: Box | null): Box | null {
  const boxes = rings
    .map((ring): Box => {
      const lons = ring.map(([lon]) => lon);
      const lats = ring.map(([, lat]) => lat);
      return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
    })
    .sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]));
  // Start from the largest ring and add the others while the view stays under half the globe.
  let box: Box | null = null;
  for (const ringBox of boxes) {
    const union: Box = box
      ? [Math.min(box[0], ringBox[0]), Math.min(box[1], ringBox[1]), Math.max(box[2], ringBox[2]), Math.max(box[3], ringBox[3])]
      : ringBox;
    if (union[2] - union[0] <= 180) box = union;
  }
  return box ?? fallback;
}

function FitTo({ box }: { box: Box | null }) {
  const map = useMap();
  useEffect(() => {
    if (!box) return;
    const [minLon, minLat, maxLon, maxLat] = box;
    map.fitBounds(
      [
        [minLat, minLon],
        [maxLat, maxLon],
      ],
      { padding: [24, 24], maxZoom: 9, animate: true },
    );
  }, [map, box]);
  return null;
}

export type DownloaderMapProps = {
  selected: { id: string; name: string; areas: Ring[]; bbox: Box | null } | null;
  subregions: { id: string; name: string; areas: Ring[]; key: string | null }[];
  prepared: PreparedOutline[];
  onSelect: (id: string) => void;
};

/**
 * World map for the downloader: prepared regions in green, the selected region in cyan and its
 * sub-regions as clickable outlines.
 */
export default function DownloaderMap({ selected, subregions, prepared, onSelect }: DownloaderMapProps) {
  const preparedShapes = useMemo(
    () => prepared.map((region) => ({ ...region, positions: toLatLngs(region.areas?.length ? region.areas : region.bounds.map(boxRing)) })),
    [prepared],
  );
  const selectedShape = useMemo(() => (selected ? toLatLngs(selected.areas) : null), [selected]);
  const childShapes = useMemo(() => subregions.map((child) => ({ ...child, positions: toLatLngs(child.areas) })), [subregions]);
  const fitTarget = useMemo(() => (selected ? fitBox(selected.areas, selected.bbox) : null), [selected]);

  return (
    <MapContainer center={[20, 10]} zoom={2} minZoom={2} worldCopyJump className="downloader-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {preparedShapes.map((region) => (
        <Polygon
          key={`prepared-${region.key}`}
          positions={region.positions}
          pathOptions={{ color: "#41d99b", weight: 1, fillOpacity: 0.12, interactive: false }}
        />
      ))}
      {selectedShape && (
        <Polygon key={`selected-${selected?.id}`} positions={selectedShape} pathOptions={{ color: "#22d3ee", weight: 3, fillOpacity: 0.08 }} />
      )}
      {childShapes.map((child) => (
        <Polygon
          key={`child-${child.id}`}
          positions={child.positions}
          pathOptions={{ color: child.key ? "#41d99b" : "#a78bfa", weight: 1.5, fillOpacity: 0.06, dashArray: "4 4" }}
          eventHandlers={{ click: () => onSelect(child.id) }}
        >
          <Tooltip sticky>{child.name}</Tooltip>
        </Polygon>
      ))}
      <FitTo box={fitTarget} />
    </MapContainer>
  );
}
