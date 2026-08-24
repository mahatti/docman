"use client";

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { SAMPLE_DOCS } from "./sample-data";
import type { DocItem } from "./types";

interface DocumentsContextValue {
  docs: DocItem[];
  setDocs: Dispatch<SetStateAction<DocItem[]>>;
}

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs] = useState<DocItem[]>(SAMPLE_DOCS);
  const value = useMemo(() => ({ docs, setDocs }), [docs]);

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments() {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocuments must be used within DocumentsProvider");
  return ctx;
}
