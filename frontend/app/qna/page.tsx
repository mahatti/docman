"use client";

import { useRef, useState } from "react";
import { IconSend } from "@/components/icons";
import { useDocuments } from "@/lib/documents-provider";
import { CANNED, detectTopic, SAMPLE_QA } from "@/lib/sample-data";
import type { ChatMessage } from "@/lib/types";

function formatMessageHtml(content: string) {
  return content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
}

export default function QnaPage() {
  const { docs } = useDocuments();
  const [messages, setMessages] = useState<ChatMessage[]>(SAMPLE_QA);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<string>("all");
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = () => {
    if (!input.trim() || loading) return;
    setError(null);
    const userMsg: ChatMessage = { role: "user", content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    const q = input;
    setInput("");
    setLoading(true);
    window.setTimeout(() => {
      try {
        const topic = detectTopic(q);
        const resp = CANNED[topic];
        const aiMsg: ChatMessage = {
          role: "assistant",
          content: resp.answer,
          sources: resp.sources,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } catch (err) {
        console.error("Gagal menghasilkan jawaban", err);
        setError("Gagal menghasilkan jawaban. Coba lagi.");
      } finally {
        setLoading(false);
      }
    }, 1400);
  };

  const suggestions = [
    "Apa isi laporan keuangan Q3?",
    "Prosedur pengadaan barang?",
    "Kebijakan cuti karyawan?",
    "Cara menggunakan sistem ERP?",
  ];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "24px 32px 16px", borderBottom: "1px solid #1a2235", flexShrink: 0 }}>
          <h1 style={{ fontFamily: "DM Serif Display, serif", fontSize: 24, color: "#e8edf5" }}>Tanya Jawab Dokumen</h1>
          <p style={{ fontSize: 13, color: "#8899bb" }}>
            Ajukan pertanyaan tentang dokumen Anda — sistem akan mencari jawaban dari dokumen Anda
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }} className="flex flex-col gap-5">
          {messages.map((msg, i) => (
            <div key={`${msg.timestamp.getTime()}-${i}`} style={{ display: "flex", gap: 12, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: msg.role === "user" ? "#fbbf24" : "#1a2235",
                  border: msg.role === "assistant" ? "1px solid #253048" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                }}
              >
                {msg.role === "user" ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0a0e17" }}>A</span>
                ) : (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
                    />
                  </svg>
                )}
              </div>

              <div style={{ maxWidth: "72%", minWidth: 0 }}>
                <div
                  style={{
                    background: msg.role === "user" ? "#1a2235" : "#0f1520",
                    border: "1px solid #1a2235",
                    borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                    padding: "12px 16px",
                  }}
                >
                  <p
                    style={{ fontSize: 13.5, color: "#e8edf5", lineHeight: 1.65, whiteSpace: "pre-line" }}
                    dangerouslySetInnerHTML={{ __html: formatMessageHtml(msg.content) }}
                  />
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {msg.sources.map((src) => (
                      <div
                        key={`${src.docName}-${src.page}-${src.excerpt}`}
                        style={{
                          background: "rgba(251,191,36,0.06)",
                          border: "1px solid rgba(251,191,36,0.15)",
                          borderRadius: 8,
                          padding: "8px 12px",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth={2}>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <span style={{ fontSize: 11, color: "#fbbf24", fontFamily: "JetBrains Mono, monospace" }}>
                            {src.docName} · hal. {src.page}
                          </span>
                        </div>
                        <p style={{ fontSize: 11.5, color: "#8899bb", fontStyle: "italic" }}>&quot;{src.excerpt}&quot;</p>
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ fontSize: 10.5, color: "#3a4a66", marginTop: 4, fontFamily: "JetBrains Mono, monospace" }}>
                  {msg.timestamp.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#1a2235",
                  border: "1px solid #253048",
                  flexShrink: 0,
                }}
                className="flex items-center justify-center"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
                  />
                </svg>
              </div>
              <div
                style={{
                  background: "#0f1520",
                  border: "1px solid #1a2235",
                  borderRadius: "4px 12px 12px 12px",
                  padding: "14px 18px",
                  display: "flex",
                  gap: 5,
                  alignItems: "center",
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#fbbf24",
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {error && (
            <p style={{ fontSize: 12.5, color: "#ef4444" }}>{error}</p>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length < 4 && (
          <div style={{ padding: "0 32px 12px" }} className="flex gap-2 flex-wrap">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                style={{
                  background: "#0f1520",
                  border: "1px solid #253048",
                  borderRadius: 20,
                  padding: "6px 14px",
                  fontSize: 12,
                  color: "#8899bb",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: "12px 32px 24px", borderTop: "1px solid #1a2235", flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 10,
              background: "#0f1520",
              border: "1px solid #253048",
              borderRadius: 12,
              padding: "10px 14px",
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ketik pertanyaan tentang dokumen"
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 13.5,
                color: "#e8edf5",
                resize: "none",
                lineHeight: 1.5,
                fontFamily: "Inter, sans-serif",
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: input.trim() && !loading ? "#fbbf24" : "#1a2235",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
                color: input.trim() && !loading ? "#0a0e17" : "#3a4a66",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.15s",
                alignSelf: "flex-end",
              }}
            >
              <IconSend />
            </button>
          </div>
          <p style={{ fontSize: 11, color: "#3a4a66", marginTop: 6, textAlign: "center" }}>
            Jawaban dihasilkan dari konten dokumen yang terupload · Selalu verifikasi informasi penting
          </p>
        </div>
      </div>

      <div
        style={{
          width: 260,
          borderLeft: "1px solid #1a2235",
          background: "#0f1520",
          padding: "24px 18px",
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontSize: 11,
            color: "#3a4a66",
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}
        >
          SUMBER DOKUMEN
        </p>
        <button
          onClick={() => setSelectedDoc("all")}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "8px 10px",
            borderRadius: 8,
            border: "none",
            background: selectedDoc === "all" ? "#1a2235" : "transparent",
            color: selectedDoc === "all" ? "#fbbf24" : "#8899bb",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 6,
          }}
        >
          Semua Dokumen
        </button>
        {docs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => setSelectedDoc(doc.id)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              background: selectedDoc === doc.id ? "#1a2235" : "transparent",
              color: selectedDoc === doc.id ? "#fbbf24" : "#8899bb",
              fontSize: 12.5,
              cursor: "pointer",
              marginBottom: 4,
              lineHeight: 1.4,
            }}
          >
            {doc.name.length > 26 ? doc.name.slice(0, 26) + "…" : doc.name}
          </button>
        ))}
      </div>
    </div>
  );
}
