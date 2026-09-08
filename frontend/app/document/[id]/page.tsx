"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { openDocumentInWord } from "@/lib/api";

export default function DocumentWordOpenPage() {
  const params = useParams<{ id: string }>();
  const documentId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (!documentId) return;
    void openDocumentInWord(documentId);
  }, [documentId]);

  return (
    <div style={{ padding: "36px 40px", maxWidth: 640 }}>
      <h1 style={{ fontFamily: "DM Serif Display, serif", fontSize: 28, color: "#e8edf5", marginBottom: 10 }}>
        Membuka Microsoft Word
      </h1>
      <p style={{ fontSize: 14, color: "#8899bb", lineHeight: 1.6, marginBottom: 16 }}>
        Dokumen dibuka di Word untuk dilihat. Perubahan di Word tidak disimpan ke DocMan.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => documentId && void openDocumentInWord(documentId)}
          style={{
            background: "#fbbf24",
            color: "#0a0e17",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Buka lagi di Word
        </button>
        <Link href="/document" style={{ color: "#fbbf24", fontSize: 13 }}>
          Kembali ke daftar
        </Link>
      </div>
    </div>
  );
}
