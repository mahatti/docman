export interface DocItem {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  pages: number;
  procedures: number;
  status: "processing" | "ready" | "error";
  tags: string[];
}

export interface Source {
  docName: string;
  page: number;
  excerpt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp: Date;
}
