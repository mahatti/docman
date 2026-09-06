"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { fetchDashboard } from "@/lib/api";
import { formatActivityTime, formatDate, formatSize } from "@/lib/format";
import type { DashboardSummary } from "@/lib/types";

function statusLabel(status: string) {
  if (status === "ready") return { text: "Siap", bg: "rgba(52,211,153,0.12)", color: "#34d399" };
  if (status === "error") return { text: "Error", bg: "rgba(239,68,68,0.12)", color: "#ef4444" };
  return { text: "Proses", bg: "rgba(251,191,36,0.12)", color: "#fbbf24" };
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDashboard()
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Gagal memuat dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const totalDocs = summary?.totalDocs ?? 0;
  const totalProcedures = summary?.totalProcedures ?? 0;
  const totalPages = summary?.totalPages ?? 0;
  const totalSize = summary?.totalSize ?? 0;
  const ready = summary?.ready ?? 0;
  const docs = summary?.documents ?? [];
  const recentActivity = summary?.recentActivity ?? [];
  const tagList = summary?.topTags ?? [];

  return (
    <div style={{ padding: "36px 40px" }}>
      <div className="mb-8">
        <h1 style={{ fontFamily: "DM Serif Display, serif", fontSize: 30, color: "#e8edf5", marginBottom: 6 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 13.5, color: "#8899bb" }}>Ringkasan repository dokumen dan aktivitas tanya jawab Anda</p>
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 16 }}>{error}</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <StatCard
          label="Total Dokumen"
          value={totalDocs}
          sub={`${ready} dokumen siap`}
          accent
          icon={
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />
        <StatCard
          label="Stored Procedures"
          value={totalProcedures}
          sub="Prosedur unik dari TSD"
          icon={
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8M4 18h8" />
            </svg>
          }
        />
        <StatCard
          label="Total Halaman"
          value={totalPages}
          sub={totalDocs ? `Rata-rata ${Math.round(totalPages / totalDocs)} hal/dok` : "Belum ada dokumen"}
          icon={
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          }
        />
        <StatCard
          label="Total Ukuran"
          value={formatSize(totalSize)}
          sub="Seluruh dokumen"
          icon={
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V9c0-2-1-3-3-3h-5L9 3H7C5 3 4 4 4 7z" />
            </svg>
          }
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        <div style={{ background: "#0f1520", border: "1px solid #1a2235", borderRadius: 12, padding: "22px 24px" }}>
          <h2 style={{ fontFamily: "DM Serif Display, serif", fontSize: 18, color: "#e8edf5", marginBottom: 16 }}>
            Dokumen Terbaru
          </h2>
          {loading ? (
            <p style={{ fontSize: 13, color: "#3a4a66" }}>Memuat dokumen…</p>
          ) : docs.length === 0 ? (
            <p style={{ fontSize: 13, color: "#3a4a66" }}>Belum ada dokumen</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Dokumen", "Modul", "Versi", "Halaman", "Prosedur", "Diupload", "Status"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        fontSize: 10.5,
                        fontFamily: "JetBrains Mono, monospace",
                        color: "#3a4a66",
                        letterSpacing: "0.08em",
                        paddingBottom: 10,
                        borderBottom: "1px solid #1a2235",
                      }}
                    >
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => {
                  const badge = statusLabel(doc.status);
                  return (
                    <tr key={doc.id} style={{ borderBottom: "1px solid #0f1520" }}>
                      <td style={{ padding: "11px 0", fontSize: 13, color: "#e8edf5", fontWeight: 500 }}>
                        <div>{doc.name.length > 36 ? doc.name.slice(0, 36) + "…" : doc.name}</div>
                        {doc.documentCode && (
                          <div style={{ fontSize: 11, color: "#3a4a66", fontFamily: "JetBrains Mono, monospace" }}>
                            {doc.documentCode}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: "#fbbf24", fontFamily: "JetBrains Mono, monospace" }}>
                        {doc.moduleName || "—"}
                      </td>
                      <td style={{ fontSize: 13, color: "#8899bb" }}>{doc.version ? `v${doc.version}` : "—"}</td>
                      <td style={{ fontSize: 13, color: "#e8edf5", fontFamily: "JetBrains Mono, monospace" }}>
                        {doc.pages || "—"}
                      </td>
                      <td style={{ fontSize: 13, color: "#fbbf24", fontFamily: "JetBrains Mono, monospace", paddingLeft: 4 }}>
                        {doc.procedures}
                      </td>
                      <td style={{ fontSize: 12, color: "#3a4a66" }}>{formatDate(doc.uploadedAt)}</td>
                      <td>
                        <span
                          style={{
                            fontSize: 10,
                            background: badge.bg,
                            color: badge.color,
                            padding: "2px 8px",
                            borderRadius: 20,
                            fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {badge.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div style={{ background: "#0f1520", border: "1px solid #1a2235", borderRadius: 12, padding: "20px 22px" }}>
            <h2 style={{ fontFamily: "DM Serif Display, serif", fontSize: 17, color: "#e8edf5", marginBottom: 14 }}>
              Aktivitas
            </h2>
            <div className="flex flex-col gap-3">
              {recentActivity.length === 0 ? (
                <p style={{ fontSize: 13, color: "#3a4a66" }}>Belum ada aktivitas</p>
              ) : (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: activity.color,
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <p style={{ fontSize: 12.5, color: "#e8edf5", fontWeight: 500 }}>{activity.event}</p>
                      <p style={{ fontSize: 11.5, color: "#3a4a66" }}>{activity.detail}</p>
                    </div>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10.5,
                        color: "#3a4a66",
                        fontFamily: "JetBrains Mono, monospace",
                        flexShrink: 0,
                      }}
                    >
                      {formatActivityTime(activity.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ background: "#0f1520", border: "1px solid #1a2235", borderRadius: 12, padding: "20px 22px" }}>
            <h2 style={{ fontFamily: "DM Serif Display, serif", fontSize: 17, color: "#e8edf5", marginBottom: 14 }}>
              Topik
            </h2>
            <div className="flex flex-wrap gap-2">
              {tagList.length === 0 ? (
                <p style={{ fontSize: 13, color: "#3a4a66" }}>Belum ada topik</p>
              ) : (
                tagList.map((item) => (
                  <span
                    key={item.tag}
                    style={{
                      fontSize: 11.5,
                      background: "#1a2235",
                      color: "#aabbd4",
                      padding: "4px 10px",
                      borderRadius: 20,
                      border: "1px solid #253048",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {item.tag}
                    <span style={{ color: "#fbbf24", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>{item.count}</span>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
