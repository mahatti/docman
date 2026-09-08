import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:5000")
  .replace("://localhost", "://127.0.0.1")
  .replace(/\/$/, "");

const HOP_BY_HOP = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function copyHeaders(source: Headers) {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

async function proxyRequest(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const incoming = new URL(request.url);
  const target = `${BACKEND_URL}/api/${path.join("/")}${incoming.search}`;
  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  try {
    const body = hasBody ? await request.arrayBuffer() : undefined;
    const response = await fetch(target, {
      method,
      headers: copyHeaders(request.headers),
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(300_000),
      ...(hasBody ? { duplex: "half" as const } : {}),
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: copyHeaders(response.headers),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      {
        status: "error",
        message: timedOut
          ? "Backend terlalu lama merespons. Coba lagi atau periksa koneksi OpenAI."
          : "Tidak bisa terhubung ke backend. Pastikan Flask berjalan di port 5000.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}

export function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}
