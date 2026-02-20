"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ChecklistPage() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((d) => setProgress(d.progress ?? 0))
      .catch(() => {});
  }, []);

  const pct = Math.round(progress * 100);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">Checklist</div>
          <div className="subtle">What you&apos;ll likely need for FAFSA + verification</div>
        </div>

        <nav className="stepper">
          <Link href="/" className="step">
            <span className="step-num">←</span>
            <span className="step-label">Back to chat</span>
          </Link>
          <div className="divider" />
          <div className="subtle" style={{ marginTop: 6 }}>
            Sections
          </div>
          <a className="tiny-link" href="#tax">
            Taxes
          </a>
          <a className="tiny-link" href="#bank">
            Assets &amp; banking
          </a>
          <a className="tiny-link" href="#identity">
            Identity
          </a>
          <a className="tiny-link" href="#schools">
            Schools
          </a>
        </nav>

        <div className="sidebar-footer">
          <Link className="tiny-link" href="/dashboard">
            Developer dashboard
          </Link>
        </div>
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
              <div className="card-title">Your personalized checklist</div>
              <div className="card-subtitle">
                This is a general checklist. Your school may ask for additional verification later.
              </div>

              <div className="section" id="tax">
                <div className="section-title">Taxes &amp; income</div>
                <CheckItem label="Federal tax return info (student and/or parent, depending on dependency)" />
                <CheckItem label="W-2s / income statements (if applicable)" />
                <CheckItem label="Records of untaxed income (if applicable)" />
              </div>

              <div className="section" id="bank">
                <div className="section-title">Assets &amp; banking</div>
                <CheckItem label="Current checking/savings balances (use ranges if needed)" />
                <CheckItem label="Bank statements (PDFs) for verification (if requested)" />

                <div className="callout">
                  <div className="callout-title">Bank statement call script</div>
                  <div className="callout-body">
                    &ldquo;Hi — I need my most recent checking and savings statements for a financial
                    aid application. Can you tell me how to download PDF statements from online
                    banking? If I can&apos;t access online banking, can you mail them or make printed
                    copies available at a branch?&rdquo;
                    <div className="callout-small">
                      Don&apos;t share full account numbers, PINs, or passwords.
                    </div>
                  </div>
                </div>
              </div>

              <div className="section" id="identity">
                <div className="section-title">Identity &amp; basics</div>
                <CheckItem label="Legal name, date of birth, contact info" />
                <CheckItem label="Driver's license/state ID (if you have one)" />
              </div>

              <div className="section" id="schools">
                <div className="section-title">Schools &amp; timing</div>
                <CheckItem label="List of schools to receive your FAFSA" />
                <CheckItem label="Application deadlines / priority aid deadlines" />
              </div>
            </div>

            <div className="card">
              <div className="card-title">Upload area (optional)</div>
              <div className="card-subtitle">
                For the hackathon MVP, this is UI-only (no backend upload). You can connect it later.
              </div>

              <div className="upload">
                <div className="upload-box">
                  <div className="upload-title">Drop files here</div>
                  <div className="upload-subtle">PDF statements, tax docs, etc.</div>
                  <button className="btn" type="button">
                    Choose file
                  </button>
                </div>
                <div className="subtle" style={{ marginTop: 12 }}>
                  Tip: For privacy, store nothing server-side unless you really need it. If you do,
                  encrypt at rest and use short retention windows.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function CheckItem({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
