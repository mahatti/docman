"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return children;

  const isQa = pathname === "/qna";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0e17" }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: isQa ? "hidden" : "auto", minWidth: 0 }}>{children}</main>
    </div>
  );
}
