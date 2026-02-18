import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
