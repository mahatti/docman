"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error", error);
  }, [error]);

  return (
    <div style={{ padding: "36px 40px" }}>
      <h1 style={{ fontFamily: "DM Serif Display, serif", fontSize: 24, color: "#e8edf5", marginBottom: 8 }}>
        Terjadi kesalahan
      </h1>
      <p style={{ fontSize: 13.5, color: "#8899bb", marginBottom: 16 }}>Halaman gagal dimuat. Silakan coba lagi.</p>
      <button
        onClick={reset}
        style={{
          background: "#fbbf24",
          color: "#0a0e17",
          border: "none",
          borderRadius: 8,
          padding: "10px 18px",
          fontSize: 13.5,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Coba lagi
      </button>
    </div>
  );
}
