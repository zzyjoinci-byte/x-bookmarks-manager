import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "bookmarks.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initTables(db);
  }
  return db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      text TEXT,
      author_id TEXT,
      author_name TEXT,
      author_username TEXT,
      created_at TEXT,
      category TEXT DEFAULT 'uncategorized',
      media_urls TEXT DEFAULT '[]',
      local_media TEXT DEFAULT '[]',
      bookmarked_at TEXT DEFAULT (datetime('now')),
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      keywords TEXT NOT NULL,
      priority INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at INTEGER NOT NULL,
      user_id TEXT,
      username TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS link_previews (
      url TEXT PRIMARY KEY,
      final_url TEXT,
      title TEXT,
      description TEXT,
      image TEXT,
      site_name TEXT,
      excerpt TEXT,
      status TEXT,
      fetched_at INTEGER
    );
  `);

  // Migrate: add columns if missing
  const columns = db.prepare("PRAGMA table_info(bookmarks)").all() as { name: string }[];
  const hasColumn = (name: string) => columns.some((c) => c.name === name);
  if (!hasColumn("media_urls")) {
    db.exec("ALTER TABLE bookmarks ADD COLUMN media_urls TEXT DEFAULT '[]'");
  }
  if (!hasColumn("local_media")) {
    db.exec("ALTER TABLE bookmarks ADD COLUMN local_media TEXT DEFAULT '[]'");
  }

  // Seed default rules if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM category_rules").get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare(
      "INSERT INTO category_rules (category, keywords, priority) VALUES (?, ?, ?)"
    );
    const defaults = [
      ["技术/开发", "code,programming,github,api,javascript,python,rust,dev,bug,deploy,docker,aws,backend,frontend,framework,typescript,react,nextjs,node", 10],
      ["AI/机器学习", "ai,gpt,llm,machine learning,neural,model,prompt,claude,openai,chatgpt,deeplearning,transformer,diffusion,agent", 10],
      ["设计", "design,figma,ui,ux,css,typography,color,layout,sketch,prototype,wireframe", 8],
      ["加密货币", "crypto,bitcoin,btc,eth,blockchain,web3,defi,nft,solana,token,wallet", 8],
      ["新闻/时事", "breaking,news,report,announced,update,election,policy,government", 5],
      ["工具/产品", "tool,app,launch,product,saas,open source,startup,release,changelog", 5],
    ];
    const insertMany = db.transaction(() => {
      for (const [category, keywords, priority] of defaults) {
        insert.run(category, keywords, priority);
      }
    });
    insertMany();
  }
}

// --- Bookmarks ---

export interface Bookmark {
  id: string;
  text: string;
  author_id: string;
  author_name: string;
  author_username: string;
  created_at: string;
  category: string;
  media_urls: string;
  local_media: string;
  bookmarked_at: string;
  raw_json: string;
}

export function upsertBookmark(bookmark: Omit<Bookmark, "bookmarked_at">) {
  const db = getDb();
  db.prepare(`
    INSERT INTO bookmarks (id, text, author_id, author_name, author_username, created_at, category, media_urls, local_media, raw_json)
    VALUES (@id, @text, @author_id, @author_name, @author_username, @created_at, @category, @media_urls, @local_media, @raw_json)
    ON CONFLICT(id) DO UPDATE SET
      text = @text,
      author_name = @author_name,
      author_username = @author_username,
      category = @category,
      media_urls = @media_urls,
      local_media = @local_media,
      raw_json = @raw_json
  `).run(bookmark);
}

export function getBookmarks(category?: string): Bookmark[] {
  const db = getDb();
  if (category && category !== "all") {
    return db.prepare("SELECT * FROM bookmarks WHERE category = ? ORDER BY created_at DESC").all(category) as Bookmark[];
  }
  return db.prepare("SELECT * FROM bookmarks ORDER BY created_at DESC").all() as Bookmark[];
}

export function getExistingIds(): Set<string> {
  const db = getDb();
  const rows = db.prepare("SELECT id FROM bookmarks").all() as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

export function updateBookmarkMedia(id: string, mediaUrls: string) {
  const db = getDb();
  db.prepare("UPDATE bookmarks SET media_urls = ? WHERE id = ?").run(mediaUrls, id);
}

export function updateBookmarkLocalMedia(id: string, localMedia: string) {
  const db = getDb();
  db.prepare("UPDATE bookmarks SET local_media = ? WHERE id = ?").run(localMedia, id);
}

export function updateBookmarkRawJson(id: string, rawJson: string) {
  const db = getDb();
  db.prepare("UPDATE bookmarks SET raw_json = ? WHERE id = ?").run(rawJson, id);
}

export function getAllBookmarkIds(): string[] {
  const db = getDb();
  const rows = db.prepare("SELECT id FROM bookmarks").all() as { id: string }[];
  return rows.map((r) => r.id);
}

export function getBookmarkById(id: string): Bookmark | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as Bookmark | undefined;
}

// --- Auth tokens ---

export interface StoredAuthToken {
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
  user_id: string | null;
  username: string | null;
}

export function saveAuthToken(token: StoredAuthToken) {
  const db = getDb();
  db.prepare(`
    INSERT INTO auth_tokens (id, access_token, refresh_token, expires_at, user_id, username, updated_at)
    VALUES (1, @access_token, @refresh_token, @expires_at, @user_id, @username, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      access_token = @access_token,
      refresh_token = @refresh_token,
      expires_at = @expires_at,
      user_id = COALESCE(@user_id, user_id),
      username = COALESCE(@username, username),
      updated_at = datetime('now')
  `).run(token);
}

export function loadAuthToken(): StoredAuthToken | null {
  const db = getDb();
  const row = db.prepare("SELECT access_token, refresh_token, expires_at, user_id, username FROM auth_tokens WHERE id = 1").get() as StoredAuthToken | undefined;
  return row || null;
}

export function clearAuthToken() {
  const db = getDb();
  db.prepare("DELETE FROM auth_tokens WHERE id = 1").run();
}

// --- Link previews ---

export interface LinkPreview {
  url: string;
  final_url: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
  excerpt: string | null;
  status: string;
  fetched_at: number;
}

export function upsertLinkPreview(preview: LinkPreview) {
  const db = getDb();
  db.prepare(`
    INSERT INTO link_previews (url, final_url, title, description, image, site_name, excerpt, status, fetched_at)
    VALUES (@url, @final_url, @title, @description, @image, @site_name, @excerpt, @status, @fetched_at)
    ON CONFLICT(url) DO UPDATE SET
      final_url = @final_url,
      title = @title,
      description = @description,
      image = @image,
      site_name = @site_name,
      excerpt = @excerpt,
      status = @status,
      fetched_at = @fetched_at
  `).run(preview);
}

export function getLinkPreviews(urls: string[]): Record<string, LinkPreview> {
  if (urls.length === 0) return {};
  const db = getDb();
  const placeholders = urls.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM link_previews WHERE url IN (${placeholders})`)
    .all(...urls) as LinkPreview[];
  const result: Record<string, LinkPreview> = {};
  for (const row of rows) result[row.url] = row;
  return result;
}

export function hasLinkPreview(url: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT 1 FROM link_previews WHERE url = ?").get(url);
  return !!row;
}

export function updateBookmarkCategory(id: string, category: string) {
  const db = getDb();
  db.prepare("UPDATE bookmarks SET category = ? WHERE id = ?").run(category, id);
}

export function getBookmarkCount(): Record<string, number> {
  const db = getDb();
  const rows = db.prepare("SELECT category, COUNT(*) as count FROM bookmarks GROUP BY category").all() as { category: string; count: number }[];
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.category] = row.count;
  }
  return counts;
}

// --- Category Rules ---

export interface CategoryRule {
  id: number;
  category: string;
  keywords: string;
  priority: number;
}

export function getAllCategoryNames(): string[] {
  const db = getDb();
  const fromRules = db.prepare("SELECT DISTINCT category FROM category_rules").all() as { category: string }[];
  const fromBookmarks = db.prepare("SELECT DISTINCT category FROM bookmarks").all() as { category: string }[];
  const names = new Set<string>();
  for (const r of fromRules) names.add(r.category);
  for (const r of fromBookmarks) names.add(r.category);
  names.delete("uncategorized");
  return [...names].sort();
}

export function getCategoryRules(): CategoryRule[] {
  const db = getDb();
  return db.prepare("SELECT * FROM category_rules ORDER BY priority DESC").all() as CategoryRule[];
}

export function addCategoryRule(category: string, keywords: string, priority: number = 0) {
  const db = getDb();
  db.prepare("INSERT INTO category_rules (category, keywords, priority) VALUES (?, ?, ?)").run(category, keywords, priority);
}

export function deleteCategoryRule(id: number) {
  const db = getDb();
  db.prepare("DELETE FROM category_rules WHERE id = ?").run(id);
}

export type BookmarkForClassify = Pick<
  Bookmark,
  "id" | "text" | "author_name" | "author_username" | "raw_json"
>;

export function getAllBookmarksForClassify(): BookmarkForClassify[] {
  const db = getDb();
  return db
    .prepare("SELECT id, text, author_name, author_username, raw_json FROM bookmarks")
    .all() as BookmarkForClassify[];
}

export function getAllBookmarksForMedia(): Array<{ id: string; media_urls: string; local_media: string }> {
  const db = getDb();
  return db
    .prepare("SELECT id, media_urls, local_media FROM bookmarks")
    .all() as Array<{ id: string; media_urls: string; local_media: string }>;
}

export function batchUpdateCategories(updates: { id: string; category: string }[]) {
  const db = getDb();
  const stmt = db.prepare("UPDATE bookmarks SET category = ? WHERE id = ?");
  const updateAll = db.transaction(() => {
    for (const { id, category } of updates) {
      stmt.run(category, id);
    }
  });
  updateAll();
}
