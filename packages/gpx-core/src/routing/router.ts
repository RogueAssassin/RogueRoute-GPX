import type { RoutePlan } from "../domain/route-plan";
import type { RouteRequest } from "../domain/route-options";
import type { Waypoint } from "../domain/waypoint";

export interface Router {
  route(waypoints: Waypoint[], request: RouteRequest): Promise<RoutePlan>;
}
