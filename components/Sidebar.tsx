"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", icon: "💬", label: "Chat" },
  { href: "/preparations", icon: "📋", label: "Preparations" },
  { href: "/extension", icon: "🧩", label: "Extension" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar" style={{ width: 240, flexShrink: 0 }}>
      <div className="sidebar-top">
        <div className="brand">FAFSA Buddy</div>
        <div className="subtle">Your financial aid guide</div>
      </div>

      <nav className="stepper">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`step${active ? " active" : ""}`}
            >
              <span className="step-num" style={{ fontSize: 16 }}>
                {tab.icon}
              </span>
              <span className="step-label">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
