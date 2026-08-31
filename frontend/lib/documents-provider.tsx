"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchDocumentFilters, fetchDocuments, uploadDocuments, deleteDocument } from "./api";
import type { DocItem, DocumentFilters } from "./types";

interface DocumentsContextValue {
  docs: DocItem[];
  filterOptions: DocumentFilters;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  upload: (files: FileList | File[]) => Promise<void>;
  remove: (documentId: string) => Promise<void>;
}

const EMPTY_FILTERS: DocumentFilters = {
  modules: [],
  procedures: [],
  versions: [],
  documentCodes: [],
};

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [filterOptions, setFilterOptions] = useState<DocumentFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const [nextDocs, nextFilters] = await Promise.all([fetchDocuments(), fetchDocumentFilters()]);
    setDocs(nextDocs);
    setFilterOptions(nextFilters);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh()
      .catch((err: unknown) => {
        if (!active) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Gagal memuat dokumen.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      await uploadDocuments(files);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (documentId: string) => {
      setError(null);
      await deleteDocument(documentId);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ docs, filterOptions, loading, error, refresh, upload, remove }),
    [docs, filterOptions, loading, error, refresh, upload, remove],
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments() {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error("useDocuments must be used within DocumentsProvider");
  return ctx;
}
