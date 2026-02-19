"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CollectedFields } from "@/lib/session";
import UploadDocButton from "@/components/UploadDocButton";

// Bank-specific instructions
function bankSteps(bankName: string | undefined, who: "student" | "parent"): string {
  const name = (bankName || "").toLowerCase();
  const prefix = who === "parent" ? "your parent's" : "your";

  if (name.includes("chase"))
    return `Log into ${prefix} Chase account at chase.com → go to Accounts → Statements → download the last 2 months as PDF`;
  if (name.includes("wells fargo") || name.includes("wellsfargo"))
    return `Log into ${prefix} Wells Fargo account at wellsfargo.com → go to Accounts → Statements & Documents → download the last 2 months as PDF`;
  if (name.includes("bank of america") || name.includes("bofa"))
    return `Log into ${prefix} Bank of America account at bankofamerica.com → go to Accounts → Statements → download the last 2 months as PDF`;
  if (name.includes("citi"))
    return `Log into ${prefix} Citi account at online.citi.com → go to Statements → download the last 2 months as PDF`;
  if (name.includes("td bank") || name.includes("tdbank"))
    return `Log into ${prefix} TD Bank account at tdbank.com → go to Accounts → View Statements → download the last 2 months as PDF`;
  if (name.includes("us bank") || name.includes("usbank"))
    return `Log into ${prefix} U.S. Bank account at usbank.com → go to Statements → download the last 2 months as PDF`;
  if (name.includes("capital one"))
    return `Log into ${prefix} Capital One account at capitalone.com → go to Account → Statements → download the last 2 months as PDF`;
  if (name.includes("pnc"))
    return `Log into ${prefix} PNC account at pnc.com → go to Accounts → Statements → download the last 2 months as PDF`;
  if (bankName)
    return `Log into ${prefix} ${bankName} online banking → find the Statements or Documents section → download the last 2 months as PDF`;
  return `Log into ${prefix} bank's online portal → find Statements or Documents → download the last 2 months as PDF`;
}

interface CheckItem {
  key: string;
  label: string;
  steps: string;
  done: boolean;
  uploadable?: boolean;
}

function buildChecklist(fields: CollectedFields): CheckItem[] {
  const items: CheckItem[] = [];

  // Bank statement — student
  if (fields.bank_name || fields.has_checking || fields.has_savings) {
    items.push({
      key: "bank_student",
      label: `Your bank statement${fields.bank_name ? ` (${fields.bank_name})` : ""}`,
      steps: bankSteps(fields.bank_name, "student"),
      done: false,
      uploadable: true,
    });
  }

  // Bank statement — parent (if dependent)
  if (fields.independent === false && fields.parent_bank_name) {
    items.push({
      key: "bank_parent",
      label: `Parent's bank statement (${fields.parent_bank_name})`,
      steps: bankSteps(fields.parent_bank_name, "parent"),
      done: false,
      uploadable: true,
    });
  }

  // W-2
  if (fields.has_w2) {
    items.push({
      key: "w2",
      label: "Your W-2 from last year",
      steps:
        "Contact your employer's HR or payroll department and ask for your 2024 W-2. Many companies also post it in an employee portal like ADP or Workday.",
      done: false,
      uploadable: true,
    });
  }

  // Tax return
  if (fields.filed_taxes || fields.has_tax_return) {
    items.push({
      key: "tax_return",
      label: "Your federal tax return (or transcript)",
      steps:
        "Go to IRS.gov → click 'Get Your Tax Record' → sign in or create an account → download your 2024 Tax Return Transcript as a PDF.",
      done: false,
      uploadable: true,
    });
  }

  // Parent tax return if dependent
  if (fields.independent === false && fields.filed_taxes) {
    items.push({
      key: "tax_parent",
      label: "Parent's federal tax return",
      steps:
        "Ask a parent to log into IRS.gov → Get Your Tax Record → download their 2024 Tax Return Transcript. If they used a tax preparer, they can request a copy directly.",
      done: false,
      uploadable: true,
    });
  }

  // Schools
  if (fields.schools && fields.schools.length > 0) {
    items.push({
      key: "schools",
      label: `School list: ${fields.schools.join(", ")}`,
      steps:
        "When you fill out FAFSA, search for each school by name and add them. Look up each school's priority financial aid deadline on their admissions website — earlier = more money.",
      done: false,
      uploadable: false,
    });
  }

  // Identity / basics — always needed
  items.push({
    key: "personal_info",
    label: "Your personal info",
    steps:
      "Have your legal name, date of birth, address, and Social Security Number ready. You'll enter these directly on StudentAid.gov — don't write them down anywhere else.",
    done: false,
    uploadable: false,
  });

  return items;
}

export default function ChecklistPage() {
  const [fields, setFields] = useState<CollectedFields>({});
  const [progress, setProgress] = useState(0);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((d) => {
        setFields(d.fields ?? {});
        setProgress(d.progress ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const items = buildChecklist(fields);
  const uploads = (fields as any).uploads ?? {};

  useEffect(() => {
    setChecked(items.map(() => false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  const pct = Math.round(progress * 100);
  const doneCount = checked.filter(Boolean).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top bar */}
      <header
        className="topbar"
        style={{
          borderRadius: 0,
          margin: 0,
          border: "none",
          borderBottom: "1px solid var(--border)",
          padding: "14px 24px",
        }}
      >
        <div className="title-wrap">
          <div className="title">FAFSA Buddy</div>
          <div className="pill">
            <span>🔒</span>
            <span>Private session</span>
          </div>
        </div>
        <div className="progress-wrap">
          <div className="progress-label">
            <span>Profile complete</span>
            <span>{pct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>
            Your personalized checklist
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            Based on your answers — here&apos;s exactly what to grab and how to get it.
          </p>
        </div>

        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading your checklist...</div>
        ) : items.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <p style={{ color: "var(--muted)" }}>
              Looks like we didn&apos;t collect enough info yet.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-block",
                marginTop: 12,
                color: "var(--teal)",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              ← Go back to chat
            </Link>
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 13,
                color: "var(--muted)",
                marginBottom: 16,
              }}
            >
              {doneCount} of {items.length} gathered
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map((item, i) => (
                <div
                  key={i}
                  className="card"
                  style={{
                    opacity: checked[i] ? 0.55 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked[i] ?? false}
                      onChange={() => toggle(i)}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          marginBottom: 6,
                          textDecoration: checked[i] ? "line-through" : "none",
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        {item.steps}
                        
                        <div style={{ marginTop: 10 }}>
                          {item.uploadable ? (
                            uploads[item.key]?.url ? (
                              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <a
                                  href={uploads[item.key].url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontWeight: 700, color: "var(--teal)", textDecoration: "none" }}
                                  onClick={(e) => e.stopPropagation()} // don't toggle checkbox
                                >
                                  View uploaded file →
                                </a>

                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation(); // don't toggle checkbox

                                    if (!confirm("Remove this uploaded file?")) return;

                                    const res = await fetch(`/api/uploads?docType=${encodeURIComponent(item.key)}`, {
                                      method: "DELETE",
                                    });

                                    const json = await res.json().catch(() => ({}));
                                    if (!res.ok) {
                                      alert(json.error || "Delete failed");
                                      return;
                                    }

                                    // Refresh state so the Upload button re-appears
                                    const d = await fetch("/api/state").then((r) => r.json());
                                    setFields(d.fields ?? {});
                                    setProgress(d.progress ?? 0);
                                  }}
                                  style={{
                                    border: "1px solid var(--border)",
                                    background: "transparent",
                                    borderRadius: 10,
                                    padding: "6px 10px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <UploadDocButton
                                docType={item.key}
                                onSaved={async () => {
                                  const d = await fetch("/api/state").then((r) => r.json());
                                  setFields(d.fields ?? {});
                                  setProgress(d.progress ?? 0);
                                }}
                              />
                            )
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
              <Link href="/" className="btn">
                ← Back to chat
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
