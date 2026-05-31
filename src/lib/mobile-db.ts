import type { NextRequest } from "next/server";
import { getBuiltinRuleSummaries, type CategoryRuleLike } from "@/lib/classifier";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { addSeconds, isExpired, randomToken, sha256, toIso } from "@/lib/mobile-security";
import type { FetchedBookmark } from "@/lib/twitter";

export interface MobileUser {
  id: string;
  x_user_id: string;
  x_username: string;
  display_name: string;
}

export interface MobileSession {
  token: string;
  expiresAt: string;
}

export interface StoredCloudToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
}

export interface MobileBookmark {
  id: string;
  text: string;
  author_id: string;
  author_name: string;
  author_username: string;
  created_at: string | null;
  category: string;
  media_urls: string[];
  local_media: string[];
  bookmarked_at: string;
  raw_json: Record<string, unknown>;
}

function decodeList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function decodeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mapBookmark(row: Record<string, unknown>): MobileBookmark {
  return {
    id: String(row.id || ""),
    text: String(row.text || ""),
    author_id: String(row.author_id || ""),
    author_name: String(row.author_name || ""),
    author_username: String(row.author_username || ""),
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    category: String(row.category || "uncategorized"),
    media_urls: decodeList(row.media_urls),
    local_media: decodeList(row.local_media),
    bookmarked_at: String(row.bookmarked_at || ""),
    raw_json: decodeObject(row.raw_json),
  };
}

export async function saveMobileOAuthState(state: string, codeVerifier: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("mobile_oauth_states").upsert({
    state,
    code_verifier: codeVerifier,
    expires_at: toIso(addSeconds(new Date(), 600)),
  });
  if (error) throw new Error(error.message);
}

export async function consumeMobileOAuthState(state: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mobile_oauth_states")
    .select("code_verifier, expires_at")
    .eq("state", state)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || isExpired(data.expires_at)) return null;

  await supabase.from("mobile_oauth_states").delete().eq("state", state);
  return data.code_verifier as string;
}

export async function upsertUserAndToken(input: {
  xUserId: string;
  username: string;
  displayName: string;
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
}): Promise<MobileUser> {
  const supabase = getSupabaseAdmin();
  const { data: user, error: userError } = await supabase
    .from("app_users")
    .upsert({
      x_user_id: input.xUserId,
      x_username: input.username,
      display_name: input.displayName,
      updated_at: new Date().toISOString(),
    }, { onConflict: "x_user_id" })
    .select("id,x_user_id,x_username,display_name")
    .single();
  if (userError) throw new Error(userError.message);

  const { error: tokenError } = await supabase.from("oauth_tokens").upsert({
    user_id: user.id,
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    expires_at: toIso(addSeconds(new Date(), input.expiresInSeconds)),
    updated_at: new Date().toISOString(),
  });
  if (tokenError) throw new Error(tokenError.message);

  return user as MobileUser;
}

export async function createLoginCode(userId: string): Promise<string> {
  const code = randomToken(24);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("mobile_login_codes").insert({
    code_hash: sha256(code),
    user_id: userId,
    expires_at: toIso(addSeconds(new Date(), 300)),
  });
  if (error) throw new Error(error.message);
  return code;
}

export async function consumeLoginCode(code: string): Promise<MobileUser | null> {
  const supabase = getSupabaseAdmin();
  const hash = sha256(code);
  const { data, error } = await supabase
    .from("mobile_login_codes")
    .select("user_id, expires_at, consumed_at")
    .eq("code_hash", hash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.consumed_at || isExpired(data.expires_at)) return null;

  await supabase
    .from("mobile_login_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("code_hash", hash);

  return getUser(data.user_id as string);
}

export async function createMobileSession(userId: string): Promise<MobileSession> {
  const token = randomToken(36);
  const expiresAt = toIso(addSeconds(new Date(), 60 * 60 * 24 * 30));
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("mobile_sessions").insert({
    token_hash: sha256(token),
    user_id: userId,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return { token, expiresAt };
}

export async function revokeMobileSession(token: string) {
  const supabase = getSupabaseAdmin();
  await supabase.from("mobile_sessions").delete().eq("token_hash", sha256(token));
}

export async function requireMobileUser(req: NextRequest): Promise<MobileUser> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Unauthorized");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mobile_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", sha256(match[1]))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || isExpired(data.expires_at)) throw new Error("Unauthorized");

  await supabase
    .from("mobile_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("token_hash", sha256(match[1]));

  return getUser(data.user_id as string);
}

export async function getUser(userId: string): Promise<MobileUser> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_users")
    .select("id,x_user_id,x_username,display_name")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  return data as MobileUser;
}

export async function getCloudToken(userId: string): Promise<StoredCloudToken | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("access_token,refresh_token,expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | null,
    expiresAt: data.expires_at as string,
  };
}

export async function updateCloudToken(userId: string, token: StoredCloudToken) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("oauth_tokens").upsert({
    user_id: userId,
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expires_at: token.expiresAt,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function getUserRules(userId: string): Promise<CategoryRuleLike[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("category_rules")
    .select("category,keywords,priority")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("priority", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as CategoryRuleLike[];
}

export async function upsertCloudBookmarks(userId: string, bookmarks: Array<FetchedBookmark & { category?: string }>) {
  if (!bookmarks.length) return;
  const supabase = getSupabaseAdmin();
  const ids = bookmarks.map((bookmark) => bookmark.id);
  const { data: existing, error: existingError } = await supabase
    .from("bookmarks")
    .select("id,category")
    .eq("user_id", userId)
    .in("id", ids);
  if (existingError) throw new Error(existingError.message);
  const categoryById = new Map((existing || []).map((row) => [row.id as string, row.category as string]));

  const rows = bookmarks.map((bookmark) => ({
    user_id: userId,
    id: bookmark.id,
    text: bookmark.text,
    author_id: bookmark.author_id,
    author_name: bookmark.author_name,
    author_username: bookmark.author_username,
    created_at: bookmark.created_at || null,
    category: categoryById.get(bookmark.id) || bookmark.category || "uncategorized",
    media_urls: JSON.parse(bookmark.media_urls || "[]") as string[],
    local_media: [],
    raw_json: JSON.parse(bookmark.raw_json || "{}") as Record<string, unknown>,
  }));
  const { error } = await supabase
    .from("bookmarks")
    .upsert(rows, { onConflict: "user_id,id", ignoreDuplicates: false });
  if (error) throw new Error(error.message);
}

export async function listCloudBookmarks(input: {
  userId: string;
  category?: string;
  query?: string;
  cursor?: string;
  limit?: number;
}) {
  const supabase = getSupabaseAdmin();
  const limit = Math.min(Math.max(input.limit || 30, 1), 50);
  const offset = input.cursor ? Number(Buffer.from(input.cursor, "base64url").toString("utf8")) : 0;

  let query = supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .range(Number.isFinite(offset) ? offset : 0, (Number.isFinite(offset) ? offset : 0) + limit);

  if (input.category && input.category !== "all") query = query.eq("category", input.category);
  if (input.query) {
    const term = input.query.replace(/[%_]/g, "");
    query = query.or(`text.ilike.%${term}%,author_name.ilike.%${term}%,author_username.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const bookmarks = (data || []).slice(0, limit).map((row) => mapBookmark(row));
  const nextOffset = (Number.isFinite(offset) ? offset : 0) + limit;
  const nextCursor = (data || []).length > limit ? Buffer.from(String(nextOffset)).toString("base64url") : null;

  return {
    bookmarks,
    nextCursor,
    counts: await getCategoryCounts(input.userId),
    allCategories: await getAllCloudCategories(input.userId),
  };
}

export async function getCloudBookmark(userId: string, id: string): Promise<MobileBookmark | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapBookmark(data) : null;
}

export async function updateCloudBookmarkCategory(userId: string, id: string, category: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("bookmarks")
    .update({ category })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getAllCloudBookmarksForClassify(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bookmarks")
    .select("id,text,author_name,author_username,raw_json")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: String(row.id || ""),
    text: String(row.text || ""),
    author_name: String(row.author_name || ""),
    author_username: String(row.author_username || ""),
    raw_json: JSON.stringify(row.raw_json || {}),
  }));
}

export async function batchUpdateCloudCategories(userId: string, updates: { id: string; category: string }[]) {
  const supabase = getSupabaseAdmin();
  for (const update of updates) {
    const { error } = await supabase
      .from("bookmarks")
      .update({ category: update.category })
      .eq("user_id", userId)
      .eq("id", update.id);
    if (error) throw new Error(error.message);
  }
}

async function getCategoryCounts(userId: string): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("bookmarks").select("category").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const category = String(row.category || "uncategorized");
    counts[category] = (counts[category] || 0) + 1;
  }
  return counts;
}

async function getAllCloudCategories(userId: string): Promise<string[]> {
  const counts = await getCategoryCounts(userId);
  const names = new Set<string>(Object.keys(counts));
  for (const summary of getBuiltinRuleSummaries()) names.add(summary.category);
  names.delete("uncategorized");
  return [...names].sort();
}
