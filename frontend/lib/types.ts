export interface ProcedureItem {
  id: string;
  name: string;
  description?: string | null;
  documentCount?: number;
}

export interface ModuleItem {
  id: string;
  name: string;
  documentCount?: number;
}

export interface DocumentFilters {
  modules: ModuleItem[];
  procedures: ProcedureItem[];
  versions: string[];
  documentCodes: string[];
}

export interface DocItem {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  pages: number;
  procedures: number;
  procedureNames: string[];
  status: "processing" | "ready" | "error";
  tags: string[];
  moduleId: string | null;
  moduleName: string | null;
  documentCode: string | null;
  version: string | null;
  fileName?: string | null;
}

export interface Source {
  docName: string;
  page: number;
  excerpt: string;
}

export interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export interface ActivityItem {
  id: number;
  event: string;
  detail: string;
  color: string;
  createdAt: Date;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface DashboardSummary {
  totalDocs: number;
  totalProcedures: number;
  totalPages: number;
  totalSize: number;
  ready: number;
  topTags: TagCount[];
  recentActivity: ActivityItem[];
  documents: DocItem[];
}
