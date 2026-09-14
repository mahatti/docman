"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return children;

  const isQa = pathname === "/qna";
  const isEditor = Boolean(pathname?.match(/^\/document\/[^/]+\/edit\/?$/));
  const fillViewport = isQa || isEditor;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0e17" }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: fillViewport ? "hidden" : "auto", minWidth: 0, height: fillViewport ? "100vh" : undefined }}>
        {children}
      </main>
    </div>
  );
}
