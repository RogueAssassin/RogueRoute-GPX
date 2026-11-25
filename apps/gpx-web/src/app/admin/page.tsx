import type { Metadata } from "next";
import AdminLogin from "../../components/admin-login";
import AdminPanel from "../../components/admin-panel";
import { adminEnabled, isAdminSession } from "../../lib/auth";
import "../maps/maps.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · RogueRoute GPX",
  description: "Manage RogueRoute GPX map regions: requests, the map queue, files and updates.",
  robots: { index: false },
};

export default async function AdminPage() {
  if (!adminEnabled()) {
    return (
      <main className="maps admin">
        <h1>Admin</h1>
        <div className="maps-card">
          <p>Administration is turned off on this server.</p>
          <p className="maps-muted">
            Set <code>ADMIN_PASSWORD</code> in <code>.env</code> and run <code>./rogueroute-gpx restart</code>. Until then, manage maps with{" "}
            <code>./rogueroute-gpx osm</code>.
          </p>
        </div>
      </main>
    );
  }
  return (await isAdminSession()) ? <AdminPanel /> : <AdminLogin />;
}
