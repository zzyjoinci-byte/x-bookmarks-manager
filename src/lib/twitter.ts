const BASE_URL = "https://api.x.com/2";

interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

interface TwitterMedia {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  url?: string;
  preview_image_url?: string;
}

interface TwitterTweet {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  attachments?: {
    media_keys?: string[];
  };
}

interface BookmarksResponse {
  data?: TwitterTweet[];
  includes?: {
    users?: TwitterUser[];
    media?: TwitterMedia[];
  };
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

export async function getMe(accessToken: string): Promise<TwitterUser> {
  const res = await fetch(`${BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get user info: ${res.status} ${body}`);
  }
  const json = await res.json();
  return json.data;
}

export interface FetchedBookmark {
  id: string;
  text: string;
  author_id: string;
  author_name: string;
  author_username: string;
  created_at: string;
  media_urls: string;
  raw_json: string;
}

export interface FetchResult {
  bookmarks: FetchedBookmark[];
  apiCalls: number;
  stoppedEarly: boolean;
}

export async function fetchBookmarks(
  accessToken: string,
  existingIds: Set<string>,
  maxResults: number = 100
): Promise<FetchResult> {
  const user = await getMe(accessToken);
  const allBookmarks: FetchedBookmark[] = [];
  let paginationToken: string | undefined;
  let apiCalls = 0;
  let stoppedEarly = false;

  do {
    const params = new URLSearchParams({
      max_results: String(Math.min(maxResults, 100)),
      "tweet.fields": "created_at,author_id,text,attachments,entities,lang",
      expansions: "author_id,attachments.media_keys",
      "user.fields": "name,username",
      "media.fields": "url,preview_image_url,type",
    });
    if (paginationToken) {
      params.set("pagination_token", paginationToken);
    }

    const url = `${BASE_URL}/users/${user.id}/bookmarks?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    apiCalls++;

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to fetch bookmarks: ${res.status} ${body}`);
    }

    const json: BookmarksResponse = await res.json();

    if (!json.data) break;

    const usersMap = new Map<string, TwitterUser>();
    if (json.includes?.users) {
      for (const u of json.includes.users) {
        usersMap.set(u.id, u);
      }
    }

    const mediaMap = new Map<string, TwitterMedia>();
    if (json.includes?.media) {
      for (const m of json.includes.media) {
        mediaMap.set(m.media_key, m);
      }
    }

    let knownCount = 0;

    for (const tweet of json.data) {
      if (existingIds.has(tweet.id)) {
        knownCount++;
        continue;
      }

      const author = usersMap.get(tweet.author_id || "");
      const mediaUrls: string[] = [];
      if (tweet.attachments?.media_keys) {
        for (const key of tweet.attachments.media_keys) {
          const media = mediaMap.get(key);
          if (media) {
            const imgUrl = media.url || media.preview_image_url;
            if (imgUrl) mediaUrls.push(imgUrl);
          }
        }
      }

      allBookmarks.push({
        id: tweet.id,
        text: tweet.text,
        author_id: tweet.author_id || "",
        author_name: author?.name || "Unknown",
        author_username: author?.username || "unknown",
        created_at: tweet.created_at || "",
        media_urls: JSON.stringify(mediaUrls),
        raw_json: JSON.stringify(tweet),
      });
    }

    // If all items in this page are already known, stop pagination
    if (knownCount === json.data.length) {
      stoppedEarly = true;
      break;
    }

    paginationToken = json.meta?.next_token;
  } while (paginationToken);

  return { bookmarks: allBookmarks, apiCalls, stoppedEarly };
}
