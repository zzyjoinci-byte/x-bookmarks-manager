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
      bookmarked_at TEXT DEFAULT (datetime('now')),
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS category_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      keywords TEXT NOT NULL,
      priority INTEGER DEFAULT 0
    );
  `);

  // Migrate: add media_urls column if missing
  const columns = db.prepare("PRAGMA table_info(bookmarks)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "media_urls")) {
    db.exec("ALTER TABLE bookmarks ADD COLUMN media_urls TEXT DEFAULT '[]'");
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
  bookmarked_at: string;
  raw_json: string;
}

export function upsertBookmark(bookmark: Omit<Bookmark, "bookmarked_at">) {
  const db = getDb();
  db.prepare(`
    INSERT INTO bookmarks (id, text, author_id, author_name, author_username, created_at, category, media_urls, raw_json)
    VALUES (@id, @text, @author_id, @author_name, @author_username, @created_at, @category, @media_urls, @raw_json)
    ON CONFLICT(id) DO UPDATE SET
      text = @text,
      author_name = @author_name,
      author_username = @author_username,
      category = @category,
      media_urls = @media_urls,
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
