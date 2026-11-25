"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Login failed.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
      setBusy(false);
    }
  }

  return (
    <main className="maps admin admin-login">
      <form className="maps-card admin-login-card" onSubmit={login}>
        <h1>Admin</h1>
        <p className="maps-muted">Map requests, the map queue, files and updates. Log in with the password set as ADMIN_PASSWORD in .env.</p>
        <label>
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus required />
        </label>
        <button type="submit" disabled={busy || !password}>
          {busy ? "Logging in…" : "Log in"}
        </button>
        {error && <div className="maps-alert">{error}</div>}
      </form>
    </main>
  );
}
