import type { Metadata } from "next";
import MapStatus from "../../components/map-status";
import "./maps.css";

export const metadata: Metadata = {
  title: "Map status · RogueRoute GPX",
  description: "Which OSRM map regions are ready, being prepared, or still waiting.",
};

export default function MapsPage() {
  return <MapStatus />;
}
