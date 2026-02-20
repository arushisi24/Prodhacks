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

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px" }}>
        <div style={{ maxWidth: 620 }}>
          <div className="callout">
            <div className="callout-title">🧩 Extension still in development</div>
            <div className="callout-body">
              The overlay UI is scaffolded but not yet fully built. The install steps above will load
              it — it just won&apos;t inject content on the page yet.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
