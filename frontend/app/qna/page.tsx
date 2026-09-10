"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconSend, IconTrash } from "@/components/icons";
import { askQuestion, clearChatHistory, fetchMessages } from "@/lib/api";
import { useDocuments } from "@/lib/documents-provider";
import type { ChatMessage } from "@/lib/types";

function formatMessageHtml(content: string) {
  return content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
}

function isUnavailableInDocumentContext(content: string) {
  return /informasi tidak (tersedia|ada|ditemukan|terdapat).{0,40}(konteks|dokumen yang (diberikan|dipilih))|tidak (tersedia|ada|ditemukan|terdapat) (dalam|di|pada) (konteks|dokumen yang (diberikan|dipilih))|di luar konteks dokumen|bukan bagian dari konteks dokumen/i.test(
    content,
  );
}

export default function QnaPage() {
  const { docs, loading: docsLoading, error: docsError } = useDocuments();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<string>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const readyDocs = docs.filter((doc) => doc.status === "ready");
  const selectedDocument = readyDocs.find((doc) => doc.id === selectedDoc) ?? null;

  useEffect(() => {
    let active = true;
    fetchMessages()
      .then((items) => {
        if (active) setMessages(items);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Gagal memuat percakapan.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const isAllDocuments = selectedDoc === "all";
  const canAsk = isAllDocuments ? readyDocs.length > 0 : Boolean(selectedDocument);

  useEffect(() => {
    if (selectedDoc === "all") return;
    if (!docs.some((doc) => doc.id === selectedDoc && doc.status === "ready")) {
      setSelectedDoc("all");
    }
  }, [docs, selectedDoc]);

  const copyAnswer = async (key: string, content: string) => {
    const text = content.trim();
    if (!text) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    if (!copied) {
      console.error("Gagal menyalin jawaban");
      return;
    }
    setCopiedKey(key);
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
      copiedTimerRef.current = null;
    }, 1600);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    if (!canAsk) {
      setError(
        readyDocs.length === 0
          ? "Belum ada dokumen siap untuk Q&A."
          : "Pilih lingkup dokumen di panel kanan.",
      );
      return;
    }
    setError(null);
    const question = input.trim();
    const userMsg: ChatMessage = { role: "user", content: question, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const assistant = await askQuestion(question, selectedDoc);
      setMessages((prev) => [...prev, assistant]);
      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      console.error("Gagal menghasilkan jawaban", err);
      setError(err instanceof Error ? err.message : "Gagal menghasilkan jawaban. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (clearing || loading || messages.length === 0) return;
    setError(null);
    setClearing(true);
    try {
      await clearChatHistory();
      setMessages([]);
      setConfirmClear(false);
    } catch (err) {
      console.error("Gagal menghapus riwayat percakapan", err);
      setError(err instanceof Error ? err.message : "Gagal menghapus riwayat percakapan.");
    } finally {
      setClearing(false);
    }
  };

  const suggestions = [
    "Prosedur apa saja yang ada di TSD ini?",
    "Jelaskan USP_INSERT_DETAIL_CAT2",
    "Segment LLL-LLL_Exposure_Data_STG untuk apa?",
    "Apa alur data di sp_LLL_MONITORING_STG?",
  ];

  return (
    <>
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "24px 32px 16px", borderBottom: "1px solid #1a2235", flexShrink: 0 }}>
          <div className="flex items-start justify-between gap-4">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontFamily: "DM Serif Display, serif", fontSize: 24, color: "#e8edf5" }}>Tanya Jawab Dokumen</h1>
              <p
                title={selectedDocument?.name}
                style={{
                  fontSize: 13,
                  color: "#8899bb",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 560,
                }}
              >
                {selectedDocument
                  ? `Lingkup: ${selectedDocument.name} — jawaban hanya dari dokumen ini`
                  : "Lingkup: semua dokumen — jawaban memakai sumber dari seluruh dokumen"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={messages.length === 0 || loading || clearing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "1px solid #253048",
                color: messages.length === 0 || loading || clearing ? "#3a4a66" : "#8899bb",
                borderRadius: 8,
                padding: "7px 12px",
                fontSize: 12,
                cursor: messages.length === 0 || loading || clearing ? "default" : "pointer",
                flexShrink: 0,
                marginTop: 4,
              }}
            >
              <IconTrash />
              {clearing ? "Menghapus…" : "Hapus riwayat"}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }} className="flex flex-col gap-5">
          {messages.map((msg, i) => {
            const messageKey = `${msg.id ?? "local"}-${msg.timestamp.getTime()}-${i}`;
            const copied = copiedKey === messageKey;
            return (
            <div key={messageKey} style={{ display: "flex", gap: 12, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
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

                {msg.sources && msg.sources.length > 0 && !isUnavailableInDocumentContext(msg.content) && (
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
                          <span
                            title={src.docName}
                            style={{
                              fontSize: 11,
                              color: "#fbbf24",
                              fontFamily: "JetBrains Mono, monospace",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                            }}
                          >
                            {src.docName} · hal. {src.page}
                          </span>
                        </div>
                        <p style={{ fontSize: 11.5, color: "#8899bb", fontStyle: "italic" }}>&quot;{src.excerpt}&quot;</p>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  className="flex items-center gap-2"
                  style={{ marginTop: 4, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
                >
                  <p style={{ fontSize: 10.5, color: "#3a4a66", fontFamily: "JetBrains Mono, monospace" }}>
                    {msg.timestamp.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {msg.role === "assistant" && (
                    <button
                      type="button"
                      title={copied ? "Disalin" : "Salin jawaban"}
                      aria-label={copied ? "Disalin" : "Salin jawaban"}
                      onClick={() => void copyAnswer(messageKey, msg.content)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 22,
                        height: 22,
                        padding: 0,
                        background: "transparent",
                        border: "none",
                        borderRadius: 6,
                        color: copied ? "#34d399" : "#8899bb",
                        cursor: "pointer",
                      }}
                    >
                      {copied ? <IconCheck /> : <IconCopy />}
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })}

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

        {messages.length === 0 && !loading && (
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
              placeholder={
                selectedDocument
                  ? `Ketik pertanyaan tentang ${selectedDocument.name}`
                  : "Ketik pertanyaan tentang semua dokumen"
              }
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
              disabled={!input.trim() || loading || !canAsk}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: input.trim() && !loading && canAsk ? "#fbbf24" : "#1a2235",
                border: "none",
                cursor: input.trim() && !loading && canAsk ? "pointer" : "default",
                color: input.trim() && !loading && canAsk ? "#0a0e17" : "#3a4a66",
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
          <p
            title={selectedDocument?.name}
            style={{
              fontSize: 11,
              color: "#3a4a66",
              marginTop: 6,
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selectedDocument
              ? `Jawaban hanya dari ${selectedDocument.name} · Selalu verifikasi informasi penting`
              : "Jawaban dihasilkan dari semua dokumen yang terupload · Selalu verifikasi informasi penting"}
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
          LINGKUP DOKUMEN
        </p>
        <p style={{ fontSize: 11.5, color: "#5a6b88", lineHeight: 1.5, marginBottom: 10 }}>
          Pilih semua dokumen, atau satu dokumen tertentu.
        </p>
        {docsError && (
          <p style={{ fontSize: 12, color: "#ef4444", lineHeight: 1.5, marginBottom: 10 }}>{docsError}</p>
        )}
        <button
          type="button"
          title="Semua dokumen"
          onClick={() => setSelectedDoc("all")}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "8px 10px",
            borderRadius: 8,
            border: "none",
            background: isAllDocuments ? "#1a2235" : "transparent",
            color: isAllDocuments ? "#fbbf24" : "#8899bb",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 6,
          }}
        >
          Semua Dokumen
        </button>
        {docsLoading ? (
          <p style={{ fontSize: 12, color: "#3a4a66", lineHeight: 1.5 }}>Memuat dokumen…</p>
        ) : (
          readyDocs.map((doc) => (
          <button
            key={doc.id}
            type="button"
            title={doc.name}
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
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {doc.name}
          </button>
          ))
        )}
        {!docsLoading && readyDocs.length === 0 && !docsError && (
          <p style={{ fontSize: 12, color: "#3a4a66", lineHeight: 1.5 }}>Belum ada dokumen siap untuk Q&A.</p>
        )}
      </div>
    </div>

    {confirmClear && (
      <div
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
          style={{
            width: "100%",
            maxWidth: 380,
            background: "#0f1520",
            border: "1px solid #253048",
            borderRadius: 12,
            padding: "22px 24px",
          }}
        >
          <h2 style={{ fontFamily: "DM Serif Display, serif", fontSize: 20, color: "#e8edf5", marginBottom: 8 }}>
            Hapus riwayat percakapan?
          </h2>
          <p style={{ fontSize: 13, color: "#8899bb", lineHeight: 1.6, marginBottom: 20 }}>
            Semua pertanyaan dan jawaban akan dihapus. Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              disabled={clearing}
              style={{
                background: "transparent",
                border: "1px solid #253048",
                color: "#8899bb",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                cursor: clearing ? "default" : "pointer",
              }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={clearHistory}
              disabled={clearing}
              style={{
                background: "#ef4444",
                border: "none",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                cursor: clearing ? "wait" : "pointer",
              }}
            >
              {clearing ? "Menghapus…" : "Hapus riwayat"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
