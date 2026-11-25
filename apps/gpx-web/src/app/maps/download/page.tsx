import type { Metadata } from "next";
import MapDownloader from "../../../components/map-downloader";
import "../maps.css";

export const metadata: Metadata = {
  title: "Add map regions · RogueRoute GPX",
  description: "Browse Geofabrik regions on a map and add them to the RogueRoute GPX map queue.",
};

export default function MapDownloadPage() {
  return <MapDownloader />;
}
