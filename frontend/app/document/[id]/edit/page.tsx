"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchOnlyOfficeConfig,
  forceSaveOnlyOfficeDocument,
  type OnlyOfficeEditorPayload,
} from "@/lib/api";
import { useDocuments } from "@/lib/documents-provider";

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (
        id: string,
        config: Record<string, unknown>,
      ) => { destroyEditor?: () => void };
    };
  }
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const headerButtonStyle = {
  fontSize: 13,
  borderRadius: 8,
  padding: "8px 14px",
  cursor: "pointer",
  border: "1px solid #253048",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

function loadOnlyOfficeScript(documentServerUrl: string): Promise<void> {
  const src = `${documentServerUrl.replace(/\/$/, "")}/web-apps/apps/api/documents/api.js`;
  const existing = document.querySelector<HTMLScriptElement>(`script[data-onlyoffice="api"]`);
  if (existing) {
    if (window.DocsAPI) return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Gagal memuat ONLYOFFICE API.")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.onlyoffice = "api";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(
        new Error(
          `Tidak bisa memuat ONLYOFFICE Docs dari ${documentServerUrl}. ` +
            "Pastikan Document Server berjalan (docker compose up -d), lalu muat ulang halaman ini.",
        ),
      );
    document.head.appendChild(script);
  });
}

export default function DocumentEditPage() {
  const params = useParams<{ id: string }>();
  const documentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { refresh } = useDocuments();

  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null);
  const wasDirtyRef = useRef(false);

  const [payload, setPayload] = useState<OnlyOfficeEditorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  const handleSave = useCallback(async () => {
    if (!documentId || saveState === "saving" || !editorReady) return;
    setConfirmCancel(false);
    setSaveState("saving");
    setSaveMessage("Menyimpan ke DocMan dan memperbarui indeks Q&A…");
    try {
      const result = await forceSaveOnlyOfficeDocument(documentId, payload?.documentKey);
      if (result.error === 4) {
        setSaveState("idle");
        setSaveMessage("Tidak ada perubahan untuk disimpan.");
        return;
      }
      wasDirtyRef.current = false;
      setSaveState("saved");
      setSaveMessage(result.message || "Dokumen berhasil disimpan. Versi terbaru siap untuk unduh dan Q&A.");
      void refresh();
    } catch (err) {
      console.error(err);
      setSaveState("error");
      setSaveMessage(err instanceof Error ? err.message : "Gagal menyimpan dokumen.");
    }
  }, [documentId, editorReady, payload?.documentKey, refresh, saveState]);

  const leaveEditor = useCallback(() => {
    if (editorRef.current?.destroyEditor) {
      try {
        editorRef.current.destroyEditor();
      } catch {
        // ignore
      }
    }
    editorRef.current = null;
    router.push("/document");
  }, [router]);

  const handleCancelClick = useCallback(() => {
    if (saveState === "saving") return;
    if (saveState === "dirty" || wasDirtyRef.current) {
      setConfirmCancel(true);
      return;
    }
    leaveEditor();
  }, [leaveEditor, saveState]);

  const handleConfirmCancel = useCallback(() => {
    setConfirmCancel(false);
    leaveEditor();
  }, [leaveEditor]);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setEditorReady(false);
      try {
        const data = await fetchOnlyOfficeConfig(documentId);
        if (cancelled) return;
        setPayload(data);
        await loadOnlyOfficeScript(data.documentServerUrl);
        if (cancelled) return;
        if (!window.DocsAPI) {
          throw new Error("ONLYOFFICE DocsAPI tidak tersedia setelah script dimuat.");
        }

        const placeholder = document.getElementById("onlyoffice-editor");
        if (!placeholder) throw new Error("Kontainer editor tidak ditemukan.");

        if (editorRef.current?.destroyEditor) {
          try {
            editorRef.current.destroyEditor();
          } catch {
            // ignore
          }
        }

        const config: Record<string, unknown> = {
          ...data.config,
          events: {
            onAppReady: () => {
              setEditorReady(true);
              setSaveMessage("Editor siap. Edit dokumen, lalu tekan Simpan untuk menyimpan ke DocMan.");
            },
            onDocumentStateChange: (event: { data?: boolean }) => {
              if (event?.data) {
                wasDirtyRef.current = true;
                setSaveState((prev) => (prev === "saving" ? prev : "dirty"));
                setSaveMessage((prev) =>
                  prev && prev.startsWith("Menyimpan")
                    ? prev
                    : "Ada perubahan yang belum disimpan ke DocMan.",
                );
              }
            },
            onError: (event: { data?: unknown }) => {
              console.error("ONLYOFFICE error", event);
              setSaveState("error");
              setSaveMessage("Terjadi kesalahan pada ONLYOFFICE Docs Editor.");
            },
            onWarning: (event: { data?: unknown }) => {
              console.warn("ONLYOFFICE warning", event);
            },
          },
        };

        editorRef.current = new window.DocsAPI.DocEditor("onlyoffice-editor", config);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Gagal membuka editor dokumen.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (editorRef.current?.destroyEditor) {
        try {
          editorRef.current.destroyEditor();
        } catch {
          // ignore
        }
      }
      editorRef.current = null;
    };
  }, [documentId]);

  useEffect(() => {
    if (!confirmCancel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmCancel(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmCancel]);

  const bannerColor =
    saveState === "error"
      ? "#ef4444"
      : saveState === "saved"
        ? "#34d399"
        : saveState === "saving" || saveState === "dirty"
          ? "#fbbf24"
          : "#8899bb";

  const isSaving = saveState === "saving";
  const canSave = editorReady && !loading && !error && !isSaving;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "100vh" }}>
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #1a2235",
          background: "#0f1520",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 11, color: "#3a4a66", marginBottom: 2 }}>Edit Dokumen · ONLYOFFICE Docs</p>
          <h1
            style={{
              fontFamily: "DM Serif Display, serif",
              fontSize: 20,
              color: "#e8edf5",
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {payload?.documentName || "Memuat dokumen…"}
          </h1>
        </div>
        <div className="flex items-center gap-2" style={{ flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={isSaving}
            style={{
              ...headerButtonStyle,
              background: "transparent",
              color: "#8899bb",
              opacity: isSaving ? 0.6 : 1,
              cursor: isSaving ? "not-allowed" : "pointer",
            }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            style={{
              ...headerButtonStyle,
              background: "#fbbf24",
              color: "#0a0e17",
              border: "none",
              fontWeight: 600,
              opacity: canSave ? 1 : 0.55,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
          >
            {isSaving ? "Menyimpan…" : "Simpan"}
          </button>
          <Link
            href="/document"
            onClick={(event) => {
              if (saveState === "dirty" || wasDirtyRef.current) {
                event.preventDefault();
                setConfirmCancel(true);
              }
            }}
            style={{
              ...headerButtonStyle,
              color: "#aabbd4",
              background: "transparent",
            }}
          >
            Ke daftar
          </Link>
        </div>
      </div>

      {(saveMessage || error) && (
        <div
          style={{
            padding: "10px 20px",
            background: "#0a0e17",
            borderBottom: "1px solid #1a2235",
            fontSize: 12.5,
            color: error ? "#ef4444" : bannerColor,
            flexShrink: 0,
          }}
        >
          {error || saveMessage}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, position: "relative", background: "#0a0e17" }}>
        {loading && (
          <p style={{ color: "#8899bb", fontSize: 13.5, padding: 24 }}>Menyiapkan ONLYOFFICE Docs Editor…</p>
        )}
        {error && !loading && (
          <div style={{ padding: 24 }}>
            <p style={{ color: "#ef4444", fontSize: 14, marginBottom: 12 }}>{error}</p>
            <Link href="/document" style={{ color: "#fbbf24", fontSize: 13 }}>
              Kembali ke daftar dokumen
            </Link>
          </div>
        )}
        <div
          id="onlyoffice-editor"
          style={{
            width: "100%",
            height: "100%",
            minHeight: 480,
            display: error ? "none" : "block",
          }}
        />
      </div>

      {confirmCancel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-edit-title"
          onClick={() => setConfirmCancel(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 14, 23, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 400,
              background: "#0f1520",
              border: "1px solid #253048",
              borderRadius: 12,
              padding: "22px 24px",
            }}
          >
            <h2
              id="cancel-edit-title"
              style={{ fontFamily: "DM Serif Display, serif", fontSize: 20, color: "#e8edf5", marginBottom: 8 }}
            >
              Batalkan edit?
            </h2>
            <p style={{ fontSize: 13, color: "#8899bb", lineHeight: 1.6, marginBottom: 20 }}>
              Perubahan yang belum disimpan akan hilang. Dokumen di DocMan tetap versi sebelumnya.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                style={{
                  ...headerButtonStyle,
                  background: "transparent",
                  color: "#8899bb",
                }}
              >
                Lanjut edit
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                style={{
                  ...headerButtonStyle,
                  background: "#ef4444",
                  border: "none",
                  color: "#fff",
                }}
              >
                Batalkan edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
