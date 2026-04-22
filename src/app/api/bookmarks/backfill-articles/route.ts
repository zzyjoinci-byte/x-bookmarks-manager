import { NextResponse } from "next/server";
import { getAllBookmarkIds, updateBookmarkRawJson } from "@/lib/db";
import { getValidAccessToken } from "@/lib/oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BASE_URL = "https://api.x.com/2";
const TWEET_FIELDS =
  "created_at,author_id,text,attachments,entities,lang,note_tweet,public_metrics,article,referenced_tweets";
// Nested expansion `referenced_tweets.id.author_id` is required so that the
// authors of quoted tweets land in includes.users — without it we only get
// the primary tweets' authors.
const EXPANSIONS = "author_id,referenced_tweets.id,referenced_tweets.id.author_id";
const USER_FIELDS = "name,username,profile_image_url";

const STATUS_URL_RE = /^https?:\/\/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i;

type RawUrl = { expanded_url?: string; unwound_url?: string };
type RawTweet = {
  id: string;
  text?: string;
  entities?: { urls?: RawUrl[] };
  note_tweet?: { entities?: { urls?: RawUrl[] } };
  referenced_tweets?: Array<{ id?: string; type?: string }>;
  article?: { plain_text?: string };
} & Record<string, unknown>;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function extractReferencedIds(tweet: RawTweet): string[] {
  const ids = new Set<string>();
  if (Array.isArray(tweet.referenced_tweets)) {
    for (const r of tweet.referenced_tweets) if (r?.id) ids.add(r.id);
  }
  const urlLists: RawUrl[][] = [
    tweet.entities?.urls || [],
    tweet.note_tweet?.entities?.urls || [],
  ];
  for (const list of urlLists) {
    for (const u of list) {
      const url = u?.expanded_url || u?.unwound_url;
      if (!url) continue;
      const m = String(url).match(STATUS_URL_RE);
      if (m) ids.add(m[1]);
    }
  }
  return [...ids];
}

async function fetchTweetsBatch(
  ids: string[],
  token: string
): Promise<{ data: RawTweet[]; users: Record<string, { name: string; username: string; profile_image_url?: string }>; errors: string[] }> {
  const errors: string[] = [];
  const users: Record<string, { name: string; username: string; profile_image_url?: string }> = {};
  const data: RawTweet[] = [];

  for (const batch of chunk(ids, 100)) {
    const params = new URLSearchParams({
      ids: batch.join(","),
      "tweet.fields": TWEET_FIELDS,
      expansions: EXPANSIONS,
      "user.fields": USER_FIELDS,
    });
    const res = await fetch(`${BASE_URL}/tweets?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      errors.push(`status=${res.status}: ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    const json = (await res.json()) as {
      data?: RawTweet[];
      includes?: {
        users?: Array<{ id: string; name: string; username: string; profile_image_url?: string }>;
        tweets?: RawTweet[];
      };
      errors?: Array<{ value?: string; detail?: string }>;
    };
    if (json.data) data.push(...json.data);
    if (json.includes?.tweets) data.push(...json.includes.tweets);
    if (json.includes?.users) {
      for (const u of json.includes.users) {
        users[u.id] = { name: u.name, username: u.username, profile_image_url: u.profile_image_url };
      }
    }
  }
  return { data, users, errors };
}

// POST /api/bookmarks/backfill-articles
// Re-fetches every bookmark with tweet.fields=article AND follows quote/status
// references so articles that live on a referenced tweet (not the bookmarked
// tweet itself) are captured into raw_json._referenced[].
export async function POST() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated. Please authorize with X first." },
      { status: 401 }
    );
  }

  const bookmarkIds = getAllBookmarkIds();
  if (bookmarkIds.length === 0) {
    return NextResponse.json({ total: 0, updated: 0, withArticle: 0, apiCalls: 0 });
  }

  let apiCalls = 0;
  const allTweets: Record<string, RawTweet> = {};
  const usersById: Record<string, { name: string; username: string; profile_image_url?: string }> = {};
  const errors: string[] = [];

  // Pass 1: fetch the bookmark tweets themselves (with referenced_tweets expansion).
  {
    const { data, users, errors: es } = await fetchTweetsBatch(bookmarkIds, token);
    apiCalls += Math.ceil(bookmarkIds.length / 100);
    for (const t of data) allTweets[t.id] = t;
    Object.assign(usersById, users);
    errors.push(...es);
  }

  // Pass 2: find every referenced ID that wasn't captured by the first pass
  // (e.g. x.com/user/status/ID hyperlinks that weren't formal quotes) and
  // fetch them too — their article/plain_text is what the user expects.
  const needed = new Set<string>();
  for (const bmId of bookmarkIds) {
    const bm = allTweets[bmId];
    if (!bm) continue;
    for (const refId of extractReferencedIds(bm)) {
      if (!allTweets[refId]) needed.add(refId);
    }
  }
  if (needed.size > 0) {
    const ids = [...needed];
    const { data, users, errors: es } = await fetchTweetsBatch(ids, token);
    apiCalls += Math.ceil(ids.length / 100);
    for (const t of data) allTweets[t.id] = t;
    Object.assign(usersById, users);
    errors.push(...es);
  }

  // Attach referenced tweets (with their article content + author info) onto
  // the bookmark's raw_json under a non-API key `_referenced`. The renderer
  // falls back to this when the bookmark tweet itself has no article.
  let updated = 0;
  let withArticle = 0;
  let withReferencedArticle = 0;
  let missing = 0;

  for (const bmId of bookmarkIds) {
    const bm = allTweets[bmId];
    if (!bm) {
      missing++;
      continue;
    }
    const refIds = extractReferencedIds(bm);
    const referenced = refIds
      .map((id) => allTweets[id])
      .filter(Boolean)
      .map((t) => {
        const author = usersById[t.author_id as string];
        return {
          ...t,
          _author: author ? { name: author.name, username: author.username } : undefined,
        };
      });

    const enriched = { ...bm, _referenced: referenced };
    updateBookmarkRawJson(bmId, JSON.stringify(enriched));
    updated++;
    if (bm.article?.plain_text) {
      withArticle++;
    } else if (referenced.some((r) => r.article?.plain_text)) {
      withReferencedArticle++;
    }
  }

  return NextResponse.json({
    total: bookmarkIds.length,
    updated,
    withArticle,
    withReferencedArticle,
    missing,
    apiCalls,
    errors: errors.slice(0, 5),
  });
}
