"use client";

import { useState, useEffect, useRef } from "react";
import AppShell from "@/components/AppShell";
import { CollectedFields } from "@/lib/session";

// ─── Doc definitions ────────────────────────────────────────────────────────

interface DocDef {
  id: string;
  label: string;
  instruction: string;
  required: boolean;
}

const GENERIC_DOCS: DocDef[] = [
  {
    id: "photo_id",
    label: "Government-issued photo ID",
    instruction: "Driver's license, state ID, or passport.",
    required: true,
  },
  {
    id: "ssn_note",
    label: "Social Security Number",
    instruction: "You'll enter this directly on StudentAid.gov — do NOT upload it here.",
    required: true,
  },
  {
    id: "student_tax",
    label: "Your federal tax return",
    instruction: "Your most recent 1040 or tax transcript from IRS.gov.",
    required: true,
  },
  {
    id: "w2",
    label: "W-2 / income records",
    instruction: "W-2 from your employer, or other proof of income if self-employed.",
    required: true,
  },
  {
    id: "bank_statement",
    label: "Bank account balances / statements",
    instruction: "Recent checking and savings statements showing current balances.",
    required: true,
  },
  {
    id: "parent_tax",
    label: "Parent's federal tax return",
    instruction: "Required if you're a dependent student.",
    required: false,
  },
  {
    id: "parent_bank",
    label: "Parent's bank account balances",
    instruction: "Required if you're a dependent student.",
    required: false,
  },
];

function buildPersonalizedDocs(fields: CollectedFields): DocDef[] {
  const docs: DocDef[] = [];
  const isDependent = fields.independent === false;

  docs.push({
    id: "photo_id",
    label: "Government-issued photo ID",
    instruction: "Driver's license, state ID, or passport.",
    required: true,
  });

  docs.push({
    id: "ssn_note",
    label: "Social Security Number",
    instruction: "Enter this directly on StudentAid.gov — do NOT upload it here.",
    required: true,
  });

  if (fields.filed_taxes !== false) {
    docs.push({
      id: "student_tax",
      label: "Your federal tax return",
      instruction: "Your most recent 1040. Get a transcript at IRS.gov → Get Your Tax Record.",
      required: true,
    });
  }

  if (fields.has_w2 !== false) {
    docs.push({
      id: "w2",
      label: "Your W-2",
      instruction: "Ask your employer's HR or payroll department for your most recent W-2.",
      required: true,
    });
  }

  if (fields.has_checking || fields.has_savings || fields.bank_name) {
    docs.push({
      id: "bank_statement",
      label: `Bank statement${fields.bank_name ? ` (${fields.bank_name})` : ""}`,
      instruction: "Download your most recent 2 months of checking and savings statements as PDFs.",
      required: true,
    });
  }

  if (isDependent) {
    docs.push({
      id: "parent_tax",
      label: "Parent's federal tax return",
      instruction: "Ask a parent to download their tax transcript from IRS.gov → Get Your Tax Record.",
      required: true,
    });

    if (fields.parent_bank_name || isDependent) {
      docs.push({
        id: "parent_bank",
        label: `Parent's bank statement${fields.parent_bank_name ? ` (${fields.parent_bank_name})` : ""}`,
        instruction: "Parent's most recent 2 months of checking/savings statements.",
        required: true,
      });
    }
  }

  return docs;
}

// ─── Upload slot component ───────────────────────────────────────────────────

function UploadSlot({
  doc,
  uploaded,
  onUpload,
}: {
  doc: DocDef;
  uploaded: string | null;
  onUpload: (docId: string, fileName: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SSN note has no upload slot
  const noUpload = doc.id === "ssn_note";

  async function handleFile(file: File) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("docType", doc.id);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      onUpload(doc.id, file.name);
    } catch (e) {
      setError("Upload failed — try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        opacity: uploaded ? 0.75 : 1,
      }}
    >
      {/* Status dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: uploaded ? "var(--teal)" : "#e2e8f0",
          border: `2px solid ${uploaded ? "var(--teal-2)" : "#cbd5e1"}`,
          marginTop: 5,
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{doc.label}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 999,
              background: doc.required ? "#eefbfb" : "#f8fafc",
              color: doc.required ? "#0b4f50" : "var(--muted)",
              border: `1px solid ${doc.required ? "#cdecee" : "#e2e8f0"}`,
            }}
          >
            {doc.required ? "Required" : "Optional"}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: noUpload ? 0 : 10 }}>
          {doc.instruction}
        </div>

        {!noUpload && (
          <>
            {uploaded ? (
              <div style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>
                ✓ {uploaded}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  className="btn"
                  style={{ fontSize: 13, padding: "6px 12px" }}
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload file"}
                </button>
                {error && (
                  <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>
                )}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "fafsa_uploads";

export default function PreparationsPage() {
  const [fields, setFields] = useState<CollectedFields | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load upload status from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUploaded(JSON.parse(saved));
    } catch {
      // ignore
    }

    // Load collected fields from session
    fetch("/api/state")
      .then((r) => r.json())
      .then((d) => {
        setFields(d.fields ?? {});
        setLoading(false);
      })
      .catch(() => {
        setFields({});
        setLoading(false);
      });
  }, []);

  function handleUpload(docId: string, fileName: string) {
    const next = { ...uploaded, [docId]: fileName };
    setUploaded(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  const isPersonalized =
    fields !== null && Object.keys(fields).length >= 3;

  const docs = isPersonalized ? buildPersonalizedDocs(fields!) : GENERIC_DOCS;
  const uploadableDocs = docs.filter((d) => d.id !== "ssn_note");
  const doneCount = uploadableDocs.filter((d) => uploaded[d.id]).length;

  return (
    <AppShell>
      <header
        className="topbar"
        style={{
          flexShrink: 0,
          borderRadius: 0,
          margin: 0,
          border: "none",
          borderBottom: "1px solid var(--border)",
          padding: "14px 24px",
        }}
      >
        <div className="title-wrap">
          <div className="title">Checklist</div>
          {isPersonalized && (
            <div className="pill" style={{ background: "#eefbfb", borderColor: "#cdecee", color: "#0b4f50" }}>
              ✓ Personalized for you
            </div>
          )}
        </div>
        {!loading && uploadableDocs.length > 0 && (
          <div className="progress-wrap">
            <div className="progress-label">
              <span>Documents gathered</span>
              <span>
                {doneCount}/{uploadableDocs.length}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(doneCount / uploadableDocs.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "24px",
        }}
      >
        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading...</div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
                {isPersonalized
                  ? "Based on your conversation, here are the documents that apply to you."
                  : "Here are the documents most FAFSA applicants need. Chat with the AI first to get a personalized list."}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 680 }}>
              {docs.map((doc) => (
                <UploadSlot
                  key={doc.id}
                  doc={doc}
                  uploaded={uploaded[doc.id] ?? null}
                  onUpload={handleUpload}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
