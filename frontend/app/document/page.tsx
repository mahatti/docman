"use client";

import { useCallback, useRef, useState } from "react";
import { IconDoc, IconUpload } from "@/components/icons";
import { useDocuments } from "@/lib/documents-provider";
import { formatDate, formatSize } from "@/lib/format";
import type { DocItem } from "@/lib/types";

export default function DocumentPage() {
  const { docs, setDocs } = useDocuments();
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  const handleFiles = useCallback(
    (files: FileList) => {
      const newDocs: DocItem[] = Array.from(files).map((f, i) => ({
        id: Date.now() + i + "",
        name: f.name,
        size: f.size,
        type: f.name.split(".").pop()?.toLowerCase() || "pdf",
        uploadedAt: new Date(),
        pages: Math.floor(Math.random() * 80) + 10,
        procedures: Math.floor(Math.random() * 15) + 1,
        status: "ready",
        tags: ["baru"],
      }));
      setDocs((prev) => [...newDocs, ...prev]);
    },
    [setDocs],
  );

  return (
    <div style={{ padding: "36px 40px" }}>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: "DM Serif Display, serif", fontSize: 30, color: "#e8edf5", marginBottom: 6 }}>
            Manajemen Dokumen
          </h1>
          <p style={{ fontSize: 13.5, color: "#8899bb" }}>
            {docs.length} dokumen tersimpan · {docs.reduce((s, d) => s + d.procedures, 0)} prosedur terindeks
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
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
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
        >
          <IconUpload /> Upload Dokumen
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt"
          style={{ display: "none" }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
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
          Seret & lepas dokumen di sini, atau <span style={{ color: "#fbbf24" }}>pilih file</span>
        </p>
        <p style={{ fontSize: 12, color: "#3a4a66", marginTop: 4 }}>DOCX</p>
      </div>

      <div style={{ position: "relative", marginBottom: 20 }}>
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
          placeholder="Cari dokumen…"
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

      <div className="flex flex-col gap-3">
        {filtered.map((doc) => (
          <div
            key={doc.id}
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
              <p style={{ fontSize: 14, color: "#e8edf5", fontWeight: 500, marginBottom: 2 }}>{doc.name}</p>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: 12, color: "#3a4a66" }}>{formatDate(doc.uploadedAt)}</span>
                <span style={{ fontSize: 12, color: "#3a4a66" }}>{formatSize(doc.size)}</span>
                <span style={{ fontSize: 12, color: "#8899bb" }}>{doc.pages} halaman</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {doc.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 11,
                    background: "#1a2235",
                    color: "#8899bb",
                    padding: "2px 8px",
                    borderRadius: 20,
                    border: "1px solid #253048",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#fbbf24", fontFamily: "JetBrains Mono, monospace" }}>
                {doc.procedures}
              </p>
              <p style={{ fontSize: 11, color: "#3a4a66" }}>prosedur</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "#3a4a66" }}>
            <p style={{ fontSize: 14 }}>Tidak ada dokumen ditemukan</p>
          </div>
        )}
      </div>
    </div>
  );
}
