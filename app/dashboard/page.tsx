"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

async function postJSON(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function DashboardPage() {
  const [stateJson, setStateJson] = useState("{}");
  const [progress, setProgress] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const data = await fetch("/api/state").then((r) => r.json());
      setStateJson(JSON.stringify(data, null, 2));
      setProgress(data.progress ?? 0);
    } catch {
      setStateJson('{ "error": "Could not fetch state" }');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function resetSession() {
    await postJSON("/api/reset", {});
    await refresh();
  }

  const pct = Math.round(progress * 100);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">Dashboard</div>
          <div className="subtle">Debug session state</div>
        </div>

        <nav className="stepper">
          <Link href="/" className="step">
            <span className="step-num">←</span>
            <span className="step-label">Back to chat</span>
          </Link>
          <Link href="/preparations" className="step">
            <span className="step-num">✓</span>
            <span className="step-label">Checklist</span>
          </Link>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="title-wrap">
            <div className="title">FAFSA Buddy</div>
            <div className="pill">
              <span>🔒</span>
              <span>Private session</span>
            </div>
          </div>
          <div className="progress-wrap">
            <div className="progress-label">
              <span>Progress</span>
              <span>{pct ? `${pct}%` : "—"}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </header>

        <section className="page">
          <div className="page-grid">
            <div className="card">
              <div className="card-title">Current session</div>
              <div className="card-subtitle">
                Pulled from <code>/api/state</code>. This is what the session is storing.
              </div>

              <pre className="codebox">{stateJson}</pre>

              <div className="row">
                <button className="btn" type="button" onClick={refresh}>
                  Refresh
                </button>
                <button className="btn danger" type="button" onClick={resetSession}>
                  Reset session
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Notes</div>
              <div className="card-subtitle">
                If you want this to feel like the Figma stepper, map:
              </div>
              <ul className="ul">
                <li>
                  <b>apply</b> mode → &ldquo;Goal &amp; basics&rdquo; + &ldquo;Household/dependency&rdquo;
                </li>
                <li>
                  <b>estimate</b> mode → &ldquo;Taxes &amp; income&rdquo; + &ldquo;Assets &amp; banking&rdquo;
                </li>
                <li>
                  <b>documents</b> mode → &ldquo;Checklist&rdquo;
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
