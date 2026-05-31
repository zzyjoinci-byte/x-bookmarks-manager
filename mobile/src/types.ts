export type Screen = "feed" | "categories" | "me";

export interface UserDto {
  id: string;
  x_user_id?: string;
  x_username: string;
  display_name: string;
}

export interface BookmarkDto {
  id: string;
  text: string;
  author_id?: string;
  author_name: string;
  author_username: string;
  created_at: string | null;
  category: string;
  media_urls: string[];
  local_media?: string[];
  bookmarked_at?: string;
  raw_json?: Record<string, unknown>;
}

export interface BookmarksResponse {
  bookmarks: BookmarkDto[];
  nextCursor: string | null;
  counts: Record<string, number>;
  allCategories: string[];
}

export interface AuthExchangeResponse {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface SyncResponse {
  synced: number;
  nextCursor: string | null;
  done: boolean;
}

export interface ClassifyResponse {
  reclassified: number;
}
