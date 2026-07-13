"use client";

import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

type Point = [number, number];

type MapWaypoint = {
  id: string;
  lat: number;
  lng: number;
  name?: string;
};

type MapSnap = {
  lat: number;
  lng: number;
  distanceMeters: number;
};

type MapLeg = {
  from: MapWaypoint;
  to: MapWaypoint;
  geometry: Point[];
  snappedFrom?: MapSnap;
  snappedTo?: MapSnap;
  overrideUsed?: boolean;
};

type RoutingFailure = {
  kind: "no-segment" | "no-route";
  legIndex: number;
  waypointIndex?: number;
  point?: MapWaypoint;
  attemptedSnapRadiiMeters: number[];
  maxSnapRadiusMeters: number;
};

type RouteMapProps = {
  legs: MapLeg[];
  waypoints: MapWaypoint[];
  failure?: RoutingFailure | null;
  initialView?: {
    centerLat: number;
    centerLng: number;
    zoom: number;
  };
};

function MapViewport({
  points,
  initialView,
}: {
  points: Point[];
  initialView?: RouteMapProps["initialView"];
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [34, 34], maxZoom: 17 });
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    if (initialView) {
      map.setView(
        [initialView.centerLat, initialView.centerLng],
        initialView.zoom,
      );
    }
  }, [initialView, map, points]);

  return null;
}

export default function RouteMap({
  legs,
  waypoints,
  failure,
  initialView,
}: RouteMapProps) {
  const corrections = useMemo(
    () =>
      legs.flatMap((leg, legIndex) => {
        const items: Array<{
          key: string;
          original: Point;
          snapped: Point;
          distanceMeters: number;
        }> = [];
        if (leg.snappedFrom && leg.snappedFrom.distanceMeters >= 1) {
          items.push({
            key: `${legIndex}-from`,
            original: [leg.from.lat, leg.from.lng],
            snapped: [leg.snappedFrom.lat, leg.snappedFrom.lng],
            distanceMeters: leg.snappedFrom.distanceMeters,
          });
        }
        if (leg.snappedTo && leg.snappedTo.distanceMeters >= 1) {
          items.push({
            key: `${legIndex}-to`,
            original: [leg.to.lat, leg.to.lng],
            snapped: [leg.snappedTo.lat, leg.snappedTo.lng],
            distanceMeters: leg.snappedTo.distanceMeters,
          });
        }
        return items;
      }),
    [legs],
  );

  const focusPoints = useMemo<Point[]>(() => {
    const geometry = legs.flatMap((leg) => leg.geometry);
    if (geometry.length) return geometry;
    if (failure?.point) return [[failure.point.lat, failure.point.lng]];
    return waypoints.map((point) => [point.lat, point.lng]);
  }, [failure, legs, waypoints]);

  const center: Point = initialView
    ? [initialView.centerLat, initialView.centerLng]
    : [-37.8136, 144.9631];

  return (
    <div
      className="rogueroute-map"
      style={{
        position: "relative",
        height: 360,
        overflow: "hidden",
        borderRadius: 14,
      }}
    >
      <MapContainer
        center={center}
        zoom={initialView?.zoom ?? 13}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport points={focusPoints} initialView={initialView} />

        {legs.map((leg, index) => (
          <Polyline
            key={`leg-${index}`}
            positions={leg.geometry}
            pathOptions={{
              color: leg.overrideUsed ? "#ef4444" : "#22d3ee",
              weight: 5,
              opacity: 0.92,
              dashArray: leg.overrideUsed ? "12 10" : undefined,
            }}
          />
        ))}

        {corrections.map((correction) => (
          <Polyline
            key={`snap-line-${correction.key}`}
            positions={[correction.original, correction.snapped]}
            pathOptions={{
              color: "#f59e0b",
              weight: 3,
              opacity: 0.9,
              dashArray: "6 6",
            }}
          >
            <Tooltip>
              Snapped {Math.round(correction.distanceMeters)}m to a routable path
            </Tooltip>
          </Polyline>
        ))}

        {waypoints.map((point, index) => (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            radius={7}
            pathOptions={{
              color: "#e9d5ff",
              fillColor: "#a855f7",
              fillOpacity: 0.92,
              weight: 2,
            }}
          >
            <Tooltip>
              {index + 1}. {point.name || point.id}
            </Tooltip>
          </CircleMarker>
        ))}

        {failure?.point && (
          <CircleMarker
            center={[failure.point.lat, failure.point.lng]}
            radius={13}
            pathOptions={{
              color: "#fee2e2",
              fillColor: "#ef4444",
              fillOpacity: 0.78,
              weight: 3,
            }}
          >
            <Tooltip permanent direction="top">
              Waypoint {(failure.waypointIndex ?? 0) + 1} could not reach a
              routable foot path within {failure.maxSnapRadiusMeters}m
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      <div
        style={{
          position: "absolute",
          zIndex: 1000,
          left: 12,
          bottom: 24,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          padding: "7px 10px",
          borderRadius: 10,
          background: "rgba(2,6,23,0.88)",
          border: "1px solid rgba(148,163,184,0.24)",
          color: "#e2e8f0",
          fontSize: 12,
          pointerEvents: "none",
        }}
      >
        <span style={{ color: "#22d3ee" }}>━ Routed path</span>
        <span style={{ color: "#a855f7" }}>● Waypoint</span>
        <span style={{ color: "#f59e0b" }}>┄ Auto-snap</span>
        {failure?.point && <span style={{ color: "#ef4444" }}>● Failed point</span>}
      </div>
    </div>
  );
}
