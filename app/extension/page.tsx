"use client";

import AppShell from "@/components/AppShell";

export default function ExtensionPage() {
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
          <div className="title">Extension</div>
          <div className="pill">Chrome only</div>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "32px 24px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>

          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🧩</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
              FAFSA Buddy for Chrome
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 15, margin: 0 }}>
              Autofills your info directly on studentaid.gov — no copy-pasting required.
            </p>
          </div>

          {/* Feature pills */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 32, flexWrap: "wrap" }}>
            {["Saves you time", "Works on studentaid.gov", "Uses your chat info"].map((f) => (
              <span
                key={f}
                style={{
                  background: "var(--surface-2, #f1f5f9)",
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                  padding: "5px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text)",
                }}
              >
                ✓ {f}
              </span>
            ))}
          </div>

          {/* Status banner */}
          <div
            style={{
              background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
              border: "1px solid #fde68a",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 24,
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
            }}
          >
            <div style={{ fontSize: 22, flexShrink: 0 }}>⏳</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#92400e" }}>
                Under review by the Chrome Web Store
              </div>
              <div style={{ fontSize: 14, color: "#78350f", lineHeight: 1.5 }}>
                Our extension is pending approval by Google. Once live it will be available for
                one-click install. For now, download below and load it manually.
              </div>
            </div>
          </div>

          {/* Download card */}
          <div
            style={{
              background: "var(--surface, #fff)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                FAFSA Buddy Extension
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                fafsa-buddy-extension.zip · Chrome 88+
              </div>
            </div>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                background: "#2563eb",
                color: "#fff",
                borderRadius: 8,
                padding: "9px 18px",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              ↓ Download
            </a>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
