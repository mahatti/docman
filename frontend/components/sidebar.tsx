"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconChat, IconFile, IconGrid } from "./icons";

const NAV = [
  { href: "/dashboard", label: "Dasbor", icon: <IconGrid /> },
  { href: "/document", label: "Dokumen", icon: <IconFile /> },
  { href: "/qna", label: "Tanya Jawab", icon: <IconChat /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const [activePath, setActivePath] = useState<string | null>(null);

  useEffect(() => {
    setActivePath(pathname);
  }, [pathname]);

  return (
    <aside
      style={{ width: 220, minWidth: 220, background: "#0f1520", borderRight: "1px solid #1a2235" }}
      className="flex flex-col h-screen sticky top-0"
    >
      <div style={{ padding: "28px 20px 24px" }}>
        <div className="flex items-center gap-2 mb-1">
          <div
            style={{ width: 28, height: 28, background: "#fbbf24", borderRadius: 6 }}
            className="flex items-center justify-center"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#0a0e17" strokeWidth={2.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <span style={{ fontFamily: "DM Serif Display, serif", fontSize: 17, color: "#e8edf5", letterSpacing: "-0.01em" }}>
            DocMan
          </span>
        </div>
        <p style={{ fontSize: 11, color: "#3a4a66", marginLeft: 36, fontFamily: "JetBrains Mono, monospace" }}>Document Management</p>
      </div>

      <nav className="flex-1 px-3">
        <p
          style={{
            fontSize: 10,
            color: "#3a4a66",
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: "0.1em",
            padding: "0 8px 10px",
          }}
        >
          NAVIGASI
        </p>
        {NAV.map((item) => {
          const active = activePath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                borderRadius: 8,
                marginBottom: 2,
                background: active ? "#1a2235" : "transparent",
                color: active ? "#fbbf24" : "#8899bb",
                fontSize: 13.5,
                fontWeight: active ? 500 : 400,
                transition: "all 0.15s",
                textAlign: "left",
                textDecoration: "none",
              }}
            >
              {item.icon}
              {item.label}
              {active && (
                <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: "#fbbf24" }} />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
