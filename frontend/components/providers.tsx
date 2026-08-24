"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { DocumentsProvider } from "@/lib/documents-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DocumentsProvider>
      <AppShell>{children}</AppShell>
    </DocumentsProvider>
  );
}
