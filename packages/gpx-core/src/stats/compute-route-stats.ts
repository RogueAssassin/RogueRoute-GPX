import type { RoutePlan } from "../domain/route-plan";

export function computeRouteStats(plan: RoutePlan) {
  const manualOverrideLegs = plan.legs.filter((leg) => leg.overrideUsed).length;

  return {
    routerMode: plan.mode,
    routeMode: plan.routeMode,
    waypointCount: plan.orderedWaypoints.length,
    legCount: plan.legs.length,
    manualOverrideLegs,
    totalDistanceMeters: Math.round(plan.totalDistanceMeters),
    totalDistanceKm: Number((plan.totalDistanceMeters / 1000).toFixed(3)),
    totalDurationSeconds: Math.round(plan.totalDurationSeconds),
    totalDurationMinutes: Number((plan.totalDurationSeconds / 60).toFixed(1)),
    bounds: plan.bounds,
    warnings: plan.warnings ?? [],
    geometryDetail: plan.geometrySummary?.detail ?? "full",
    sourceTrackPointCount: plan.geometrySummary?.sourceTrackPointCount ?? 0,
    trackPointCount: plan.geometrySummary?.trackPointCount ?? 0,
    removedTrackPointCount: plan.geometrySummary?.removedTrackPointCount ?? 0,
    duplicateTrackPointCount: plan.geometrySummary?.duplicateTrackPointCount ?? 0,
    simplificationToleranceMeters: plan.geometrySummary?.toleranceMeters ?? 0,
    trackPointLimit: plan.geometrySummary?.pointLimit,
    withinTrackPointLimit: plan.geometrySummary?.withinPointLimit ?? true,
  };
}
