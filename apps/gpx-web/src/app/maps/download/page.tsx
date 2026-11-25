import type { Metadata } from "next";
import MapDownloader from "../../../components/map-downloader";
import "../maps.css";

export const metadata: Metadata = {
  title: "Find a map · RogueRoute GPX",
  description: "Browse Geofabrik regions on a map, see what this server can route, and request a missing map.",
};

export default function MapDownloadPage() {
  return <MapDownloader />;
}
