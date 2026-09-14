"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconDoc, IconDownload, IconUpload } from "@/components/icons";
import { documentFileUrl, isDocxFile, openDocumentInWord, wordFileName } from "@/lib/api";
import { useDocuments } from "@/lib/documents-provider";
import { formatDate, formatSize } from "@/lib/format";
import type { DocItem } from "@/lib/types";

const TSD_TEMPLATE_HREF = "/templates/NTT_Data_Draft%20TSD%20TEMPLATE.docx";
const TSD_TEMPLATE_NAME = "NTT_Data_Draft TSD TEMPLATE.docx";
const DOCX_ACCEPT = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const actionButtonStyle = {
  background: "transparent",
  border: "1px solid #253048",
  color: "#8899bb",
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: 11,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
} as const;

const selectStyle = {
  background: "#0f1520",
  border: "1px solid #1a2235",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  color: "#e8edf5",
  outline: "none",
  width: "100%",
} as const;

export default function DocumentPage() {
  const { docs, filterOptions, loading, error, upload, remove } = useDocuments();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [moduleId, setModuleId] = useState("all");
  const [procedure, setProcedure] = useState("all");
  const [documentCode, setDocumentCode] = useState("all");
  const [version, setVersion] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return docs.filter((doc) => {
      if (moduleId !== "all" && doc.moduleId !== moduleId) return false;
      if (procedure !== "all" && !doc.procedureNames.some((name) => name === procedure)) return false;
      if (documentCode !== "all" && doc.documentCode !== documentCode) return false;
      if (version !== "all" && doc.version !== version) return false;
      if (!term) return true;
      const haystack = [
        doc.name,
        doc.fileName,
        doc.documentCode,
        doc.version,
        doc.moduleName,
        ...doc.procedureNames,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [docs, documentCode, moduleId, procedure, search, version]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const selected = Array.from(files);
      const docxFiles = selected.filter(isDocxFile);
      const skipped = selected.length - docxFiles.length;
      if (!docxFiles.length) {
        setUploadError("Hanya file .docx yang bisa diunggah. PDF dan jenis lain dinonaktifkan.");
        return;
      }
      setUploadError(skipped ? `${skipped} file diabaikan karena bukan .docx.` : null);
      setUploading(true);
      try {
        await upload(docxFiles);
      } catch (err) {
        console.error(err);
        setUploadError(err instanceof Error ? err.message : "Gagal mengunggah dokumen.");
      } finally {
        setUploading(false);
      }
    },
    [upload],
  );

  return (
    <div style={{ padding: "36px 40px" }}>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: "DM Serif Display, serif", fontSize: 30, color: "#e8edf5", marginBottom: 6 }}>
            Manajemen TSD
          </h1>
          <p style={{ fontSize: 13.5, color: "#8899bb" }}>
            {docs.length} TSD tersimpan · {docs.reduce((sum, doc) => sum + doc.procedures, 0)} prosedur terindeks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={TSD_TEMPLATE_HREF}
            download={TSD_TEMPLATE_NAME}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              color: "#e8edf5",
              border: "1px solid #253048",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            <IconDownload /> Unduh Template
          </a>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#fbbf24",
              color: "#0a0e17",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: uploading ? "wait" : "pointer",
              opacity: uploading ? 0.7 : 1,
              transition: "opacity 0.15s",
            }}
          >
            <IconUpload /> {uploading ? "Memproses…" : "Upload TSD"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={DOCX_ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        style={{
          border: `2px dashed ${dragging ? "#fbbf24" : "#253048"}`,
          borderRadius: 12,
          padding: "32px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 24,
          background: dragging ? "rgba(251,191,36,0.04)" : "#0f1520",
          transition: "all 0.2s",
        }}
      >
        <div
          style={{ width: 48, height: 48, borderRadius: 12, background: "#1a2235", margin: "0 auto 12px" }}
          className="flex items-center justify-center"
        >
          <IconUpload />
        </div>
        <p style={{ fontSize: 14, color: "#aabbd4", fontWeight: 500 }}>
          Seret & lepas TSD di sini, atau <span style={{ color: "#fbbf24" }}>pilih file</span>
        </p>
        <p style={{ fontSize: 12, color: "#3a4a66", marginTop: 4 }}>Hanya file DOCX</p>
      </div>

      {(error || uploadError) && (
        <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{uploadError || error}</p>
      )}

      <div style={{ position: "relative", marginBottom: 12 }}>
        <svg
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="#3a4a66"
          strokeWidth={2}
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari judul, kode dokumen, modul, prosedur, atau versi…"
          style={{
            width: "100%",
            background: "#0f1520",
            border: "1px solid #1a2235",
            borderRadius: 8,
            padding: "10px 14px 10px 40px",
            fontSize: 13.5,
            color: "#e8edf5",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} style={selectStyle}>
          <option value="all">Semua modul</option>
          {filterOptions.modules.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select value={procedure} onChange={(e) => setProcedure(e.target.value)} style={selectStyle}>
          <option value="all">Semua prosedur</option>
          {filterOptions.procedures.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        <select value={documentCode} onChange={(e) => setDocumentCode(e.target.value)} style={selectStyle}>
          <option value="all">Semua kode dokumen</option>
          {filterOptions.documentCodes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <select value={version} onChange={(e) => setVersion(e.target.value)} style={selectStyle}>
          <option value="all">Semua versi</option>
          {filterOptions.versions.map((item) => (
            <option key={item} value={item}>
              v{item}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "#8899bb", fontSize: 13.5 }}>Memuat dokumen…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onDelete={remove} />
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "#3a4a66" }}>
              <p style={{ fontSize: 14 }}>Tidak ada TSD yang cocok dengan filter</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentCard({
  doc,
  onDelete,
}: {
  doc: DocItem;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = deleting;
  const canEdit = doc.status === "ready" && (doc.type === "docx" || /\.docx$/i.test(doc.fileName || doc.name));

  const handleOpenWord = () => {
    setActionError(null);
    try {
      openDocumentInWord(doc.id, doc.fileName || doc.name);
    } catch (err) {
      console.error(err);
      setActionError("Tidak bisa membuka Microsoft Word. Pastikan Word terpasang di komputer ini.");
    }
  };

  const handleCancelDelete = () => {
    if (busy) return;
    setConfirming(false);
  };

  useEffect(() => {
    if (!confirming) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setConfirming(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirming, deleting]);

  const handleDelete = async () => {
    if (busy) return;
    setActionError(null);
    setDeleting(true);
    try {
      await onDelete(doc.id);
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "Gagal menghapus dokumen.");
      setDeleting(false);
    }
  };

  return (
    <div
      style={{
        background: "#0f1520",
        border: "1px solid #1a2235",
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        transition: "border-color 0.15s",
      }}
    >
      <IconDoc type={doc.type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, color: "#e8edf5", fontWeight: 500, marginBottom: 4 }}>{doc.name}</p>
        <div className="flex items-center gap-3" style={{ flexWrap: "wrap" }}>
          {doc.moduleName && (
            <span style={{ fontSize: 11, color: "#fbbf24", fontFamily: "JetBrains Mono, monospace" }}>{doc.moduleName}</span>
          )}
          {doc.documentCode && <span style={{ fontSize: 12, color: "#8899bb" }}>{doc.documentCode}</span>}
          {doc.version && <span style={{ fontSize: 12, color: "#3a4a66" }}>v{doc.version}</span>}
          <span style={{ fontSize: 12, color: "#3a4a66" }}>{doc.pages ? `${doc.pages} hal` : "—"}</span>
          <span style={{ fontSize: 12, color: "#3a4a66" }}>{formatDate(doc.uploadedAt)}</span>
          <span style={{ fontSize: 12, color: "#3a4a66" }}>{formatSize(doc.size)}</span>
        </div>
        {doc.procedureNames.length > 0 && (
          <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginTop: 8 }}>
            {doc.procedureNames.map((name) => (
              <span
                key={name}
                style={{
                  fontSize: 11,
                  background: "#1a2235",
                  color: "#aabbd4",
                  padding: "2px 8px",
                  borderRadius: 20,
                  border: "1px solid #253048",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: "#fbbf24", fontFamily: "JetBrains Mono, monospace" }}>
          {doc.procedures}
        </p>
        <p style={{ fontSize: 11, color: "#3a4a66" }}>prosedur</p>
        <div className="flex items-center gap-2" style={{ marginTop: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Link
            href={`/document/${doc.id}/edit`}
            style={{
              ...actionButtonStyle,
              pointerEvents: canEdit ? "auto" : "none",
              opacity: canEdit ? 1 : 0.45,
              cursor: canEdit ? "pointer" : "not-allowed",
              color: canEdit ? "#fbbf24" : "#8899bb",
              borderColor: canEdit ? "#3a4a20" : "#253048",
            }}
            aria-disabled={!canEdit}
            title={
              canEdit
                ? "Edit dokumen di ONLYOFFICE Docs"
                : doc.status === "processing"
                  ? "Dokumen masih diproses"
                  : "Dokumen belum siap untuk diedit"
            }
            onClick={(e) => {
              if (!canEdit) e.preventDefault();
            }}
          >
            Buka/Edit Dokumen
          </Link>
          <a
            href={documentFileUrl(doc.id)}
            download={wordFileName(doc.fileName || doc.name)}
            style={actionButtonStyle}
          >
            Unduh
          </a>
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              setConfirming(true);
            }}
            disabled={busy}
            style={{ ...actionButtonStyle, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}
          >
            Hapus
          </button>
        </div>
        {actionError && !confirming && (
          <p style={{ color: "#ef4444", fontSize: 11, marginTop: 8, maxWidth: 220 }}>{actionError}</p>
        )}
      </div>
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-doc-title-${doc.id}`}
          onClick={handleCancelDelete}
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
              maxWidth: 380,
              background: "#0f1520",
              border: "1px solid #253048",
              borderRadius: 12,
              padding: "22px 24px",
            }}
          >
            <h2
              id={`delete-doc-title-${doc.id}`}
              style={{ fontFamily: "DM Serif Display, serif", fontSize: 20, color: "#e8edf5", marginBottom: 8 }}
            >
              Hapus dokumen?
            </h2>
            <p style={{ fontSize: 13, color: "#8899bb", lineHeight: 1.6, marginBottom: 20 }}>
              <span style={{ color: "#e8edf5" }}>{doc.name}</span> akan dihapus. Tindakan ini tidak dapat dibatalkan.
            </p>
            {actionError && (
              <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 16 }}>{actionError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={busy}
                style={{
                  background: "transparent",
                  border: "1px solid #253048",
                  color: "#8899bb",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: busy ? "default" : "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                style={{
                  background: "#ef4444",
                  border: "none",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: busy ? "wait" : "pointer",
                }}
              >
                {deleting ? "Menghapus…" : "Hapus dokumen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
