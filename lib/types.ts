import type { ObjectId } from "mongodb";

export interface BinDoc {
  _id?: ObjectId;
  token: string;
  name?: string;
  createdAt: Date;
  requestCount: number;
  redactHeaders: boolean;
  responseStatus?: number;
  responseBody?: unknown;
}

export interface RequestDoc {
  _id?: ObjectId;
  binId: string;
  method: string;
  path: string;
  query: Record<string, unknown>;
  headers: Record<string, string>;
  ip: string;
  userAgent: string;
  contentType: string;
  bodyRaw?: string;
  bodyJson?: unknown;
  bodyEncoding: "utf8" | "base64";
  bodyTruncated: boolean;
  sizeBytes: number;
  receivedAt: Date;
  durationMs: number;
  responseStatus: number;
}

export interface RequestSummary {
  id: string;
  method: string;
  path: string;
  sizeBytes: number;
  receivedAt: string;
  contentType: string;
}

export interface RequestDetail extends RequestSummary {
  query: Record<string, unknown>;
  headers: Record<string, string>;
  ip: string;
  userAgent: string;
  bodyRaw?: string;
  bodyJson?: unknown;
  bodyEncoding: "utf8" | "base64";
  bodyTruncated: boolean;
  durationMs: number;
  responseStatus: number;
}
