import type {
  AuthExchangeResponse,
  BookmarkDto,
  BookmarksResponse,
  ClassifyResponse,
  SyncResponse,
  UserDto,
} from "./types";

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_API_BASE_URL = "https://x-bookmarks-manager.vercel.app";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || DEFAULT_API_BASE_URL;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  token?: string | null;
  body?: unknown;
  query?: Record<string, string | null | undefined>;
};

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(path, API_BASE_URL);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path, options.query), {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload?.error || `Request failed (${response.status})`, response.status);
  }
  return payload as T;
}

export function startAuth() {
  return request<{ url: string }>("/api/mobile/auth/start", { method: "POST" });
}

export function exchangeAuthCode(code: string) {
  return request<AuthExchangeResponse>("/api/mobile/auth/exchange", {
    method: "POST",
    body: { code },
  });
}

export function getMe(token: string) {
  return request<{ user: UserDto }>("/api/mobile/auth/me", { token });
}

export function logout(token: string | null) {
  return request<{ ok?: boolean }>("/api/mobile/auth/logout", { method: "POST", token });
}

export function listBookmarks(input: {
  token: string;
  category?: string | null;
  cursor?: string | null;
  query?: string | null;
}) {
  return request<BookmarksResponse>("/api/mobile/bookmarks", {
    token: input.token,
    query: {
      category: input.category || undefined,
      cursor: input.cursor || undefined,
      query: input.query || undefined,
    },
  });
}

export function getBookmark(token: string, id: string) {
  return request<{ bookmark: BookmarkDto }>(`/api/mobile/bookmarks/${id}`, { token });
}

export function updateBookmarkCategory(token: string, id: string, category: string) {
  return request<{ ok: boolean }>(`/api/mobile/bookmarks/${id}`, {
    method: "PATCH",
    token,
    body: { category },
  });
}

export function syncBookmarks(token: string, cursor?: string | null) {
  return request<SyncResponse>("/api/mobile/sync", {
    method: "POST",
    token,
    body: { cursor: cursor || null },
  });
}

export function classifyBookmarks(token: string) {
  return request<ClassifyResponse>("/api/mobile/classify", { method: "POST", token });
}
