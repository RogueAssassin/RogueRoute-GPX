// Shapes used by the admin page and its API routes.

export type MapRequest = {
  id: string;
  name: string;
  count: number;
  firstAt: string;
  lastAt: string;
  status: "open" | "approved" | "dismissed";
  notes: { text: string; at: string }[];
  resolvedAt?: string;
  key?: string;
};
