import AppShell from "@/components/AppShell";

const STEPS = [
  {
    num: 1,
    title: "Download the extension files",
    body: 'Go to the GitHub repo and download or clone it. The extension lives in the fafsa-navigator-overlay/ folder.',
  },
  {
    num: 2,
    title: 'Open Chrome Extensions',
    body: 'In Chrome, go to chrome://extensions in your address bar. Make sure "Developer mode" is toggled ON in the top-right corner.',
  },
  {
    num: 3,
    title: 'Load the extension',
    body: 'Click "Load unpacked" and select the fafsa-navigator-overlay/ folder from the repo.',
  },
  {
    num: 4,
    title: 'Pin it to your toolbar',
    body: 'Click the puzzle piece icon in Chrome → find "FAFSA Navigator Overlay" → click the pin icon so it shows in your toolbar.',
  },
  {
    num: 5,
    title: 'Go to StudentAid.gov',
    body: 'Navigate to studentaid.gov to start your FAFSA. The extension will activate automatically on that site.',
  },
];

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
          <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 24px" }}>
            The FAFSA Navigator Overlay is a Chrome extension that sits on top of StudentAid.gov and
            gives you real-time guidance while you fill out the actual form.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {STEPS.map((s) => (
              <div key={s.num} className="card" style={{ display: "flex", gap: 14 }}>
                <span
                  className="step-num"
                  style={{ flexShrink: 0, marginTop: 2, width: 32, height: 32 }}
                >
                  {s.num}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{s.body}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="callout" style={{ marginTop: 24 }}>
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
