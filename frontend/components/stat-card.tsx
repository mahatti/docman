import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  icon: ReactNode;
}

export function StatCard({ label, value, sub, accent, icon }: StatCardProps) {
  return (
    <div
      style={{
        background: "#0f1520",
        border: "1px solid #1a2235",
        borderRadius: 12,
        padding: "20px 22px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: accent ? "rgba(251,191,36,0.06)" : "rgba(58,74,102,0.15)",
        }}
      />
      <div className="flex items-start justify-between mb-3">
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: accent ? "rgba(251,191,36,0.12)" : "#1a2235",
            color: accent ? "#fbbf24" : "#8899bb",
          }}
          className="flex items-center justify-center"
        >
          {icon}
        </div>
      </div>
      <p style={{ fontSize: 26, fontWeight: 700, color: "#e8edf5", lineHeight: 1, marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 12, color: "#8899bb", fontWeight: 500 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: "#3a4a66", marginTop: 6, fontFamily: "JetBrains Mono, monospace" }}>{sub}</p>}
    </div>
  );
}
