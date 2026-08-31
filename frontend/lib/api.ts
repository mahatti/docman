import type { ActivityItem, ChatMessage, DashboardSummary, DocItem, DocumentFilters, Source } from "./types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

interface ApiEnvelope<T> {
  status: string;
  message?: string;
  data: T;
}

interface ApiDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string | null;
  pages: number;
  procedures: number;
  procedureNames?: string[];
  status: DocItem["status"];
  tags: string[];
  moduleId: string | null;
  moduleName: string | null;
  documentCode: string | null;
  version: string | null;
  fileName?: string | null;
}

interface ApiChatMessage {
  id?: number;
  role: ChatMessage["role"];
  content: string;
  sources?: Source[];
  timestamp: string | null;
}

interface ApiActivity {
  id: number;
  event: string;
  detail: string;
  color: string;
  createdAt: string | null;
}

interface ApiDashboard {
  totalDocs: number;
  totalProcedures: number;
  totalPages: number;
  totalSize: number;
  ready: number;
  topTags: { tag: string; count: number }[];
  recentActivity: ApiActivity[];
  documents: ApiDocument[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error("Tidak bisa terhubung ke backend. Pastikan Flask berjalan di port 5000.");
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(
      response.ok ? "Respons server tidak valid." : "Backend tidak merespons. Pastikan Flask berjalan di port 5000.",
    );
  }

  if (!response.ok || payload.status !== "success") {
    throw new Error(payload.message || "Permintaan ke server gagal.");
  }
  return payload.data;
}

export function mapDocument(item: ApiDocument): DocItem {
  return {
    id: item.id,
    name: item.name,
    size: item.size || 0,
    type: item.type || "",
    uploadedAt: item.uploadedAt ? new Date(item.uploadedAt) : new Date(),
    pages: item.pages || 0,
    procedures: item.procedures || 0,
    procedureNames: item.procedureNames || [],
    status: item.status || "ready",
    tags: item.tags || [],
    moduleId: item.moduleId,
    moduleName: item.moduleName,
    documentCode: item.documentCode,
    version: item.version,
    fileName: item.fileName,
  };
}

export function mapChatMessage(item: ApiChatMessage): ChatMessage {
  return {
    id: item.id,
    role: item.role,
    content: item.content,
    sources: item.sources || [],
    timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
  };
}

function mapActivity(item: ApiActivity): ActivityItem {
  return {
    id: item.id,
    event: item.event,
    detail: item.detail,
    color: item.color,
    createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
  };
}

export async function fetchDocuments(): Promise<DocItem[]> {
  const data = await request<ApiDocument[] | ApiDocument>("/api/documents");
  const items = Array.isArray(data) ? data : [data];
  return items.map(mapDocument);
}

export async function fetchDocumentFilters(): Promise<DocumentFilters> {
  return request<DocumentFilters>("/api/documents/filters");
}

export async function uploadDocuments(files: FileList | File[]): Promise<DocItem[]> {
  const form = new FormData();
  Array.from(files).forEach((file) => form.append("files", file));
  const data = await request<ApiDocument[] | ApiDocument>("/api/documents", {
    method: "POST",
    body: form,
  });
  const items = Array.isArray(data) ? data : [data];
  return items.map(mapDocument);
}

export async function deleteDocument(documentId: string): Promise<void> {
  await request<unknown>(`/api/documents/${documentId}`, { method: "DELETE" });
}

export async function fetchDashboard(): Promise<DashboardSummary> {
  const data = await request<ApiDashboard>("/api/dashboard");
  return {
    totalDocs: data.totalDocs || 0,
    totalProcedures: data.totalProcedures || 0,
    totalPages: data.totalPages || 0,
    totalSize: data.totalSize || 0,
    ready: data.ready || 0,
    topTags: data.topTags || [],
    recentActivity: (data.recentActivity || []).map(mapActivity),
    documents: (data.documents || []).map(mapDocument),
  };
}

export async function fetchMessages(): Promise<ChatMessage[]> {
  const data = await request<ApiChatMessage[]>("/api/qna/messages");
  return (data || []).map(mapChatMessage);
}

export async function askQuestion(question: string, documentId?: string): Promise<ChatMessage> {
  const data = await request<ApiChatMessage>("/api/qna/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      documentId: !documentId || documentId === "all" ? null : documentId,
    }),
  });
  return mapChatMessage(data);
}
