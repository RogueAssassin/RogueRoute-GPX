export type RouteMode = "preserve-order" | "optimize-middle" | "loop";

export type RouteRequest = {
  mode: RouteMode;
  keepStartFixed?: boolean;
  keepEndFixed?: boolean;
  name?: string;
  strictLandRouting?: boolean;
  allowFerries?: boolean;
  allowManualOverride?: boolean;
};
