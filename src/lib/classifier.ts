import { getCategoryRules, type BookmarkForClassify } from "./db";

type ClassifiableBookmark = Partial<BookmarkForClassify> & { text: string };

interface NormalizedSignalBag {
  mainText: string;
  urlText: string;
  authorText: string;
}

interface BuiltinRule {
  category: string;
  priority: number;
  strong: string[];
  keywords: string[];
  urlKeywords?: string[];
  authorKeywords?: string[];
}

const BUILTIN_RULES: BuiltinRule[] = [
  {
    category: "AI/机器学习",
    priority: 12,
    strong: [
      "claude code",
      "chatgpt",
      "openai",
      "anthropic",
      "deepseek",
      "gemini",
      "qwen",
      "minimax",
      "openclaw",
      "vibe coding",
      "context window",
      "上下文",
      "提示词",
      "大模型",
      "智能体",
      "agent memory",
      "记忆系统",
    ],
    keywords: [
      "ai",
      "llm",
      "gpt",
      "agent",
      "agents",
      "prompt",
      "prompts",
      "memory",
      "模型",
      "推理",
      "生成式",
      "coding agent",
      "codex",
      "claude",
      "qwen code",
      "stitch",
      "swe-bench",
    ],
    authorKeywords: ["ai", "gpt", "llm", "claude", "openclaw"],
  },
  {
    category: "技术/开发",
    priority: 11,
    strong: [
      "typescript",
      "javascript",
      "python",
      "next.js",
      "react",
      "github",
      "open source",
      "前端",
      "后端",
      "编程",
      "开发",
      "命令行",
      "工作流",
      "工程化",
      "部署",
      "docker",
      "api",
      "oauth",
      "bitwarden",
      "1password",
      "passkey",
      "密码管理",
      "自建",
      "remotion",
    ],
    keywords: [
      "frontend",
      "backend",
      "cli",
      "framework",
      "repo",
      "git",
      "node",
      "rust",
      "java",
      "debug",
      "script",
      "scripts",
      "workflow",
      "skill",
      "skills",
      "tool calling",
      "terminal",
      "代码",
      "开源",
      "项目",
    ],
    urlKeywords: ["github.com", "npmjs.com"],
  },
  {
    category: "设计",
    priority: 10,
    strong: [
      "figma",
      "framer",
      "ui/ux",
      "ui ux",
      "design system",
      "landing page",
      "品牌设计",
      "网页设计",
      "界面设计",
      "动效",
      "排版",
      "配色",
      "字体",
    ],
    keywords: [
      "design",
      "designer",
      "ui",
      "ux",
      "layout",
      "typography",
      "color",
      "colors",
      "prototype",
      "wireframe",
      "revamp",
      "animation",
      "motion",
      "dark mode",
      "new look",
      "glow up",
      "aesthetics",
      "badge unlock",
      "icon",
      "branding",
      "visual",
      "style guide",
      "品牌手册",
      "设计规范",
      "界面",
      "网站",
    ],
    urlKeywords: ["figma.com", "dribbble.com", "behance.net"],
  },
  {
    category: "加密货币",
    priority: 10,
    strong: [
      "bitcoin",
      "比特币",
      "blockchain",
      "web3",
      "defi",
      "nft",
      "币安",
      "okx",
      "bybit",
      "kraken",
      "钱包",
      "链上",
      "多签",
      "backpack",
      "出金",
    ],
    keywords: [
      "crypto",
      "btc",
      "eth",
      "sol",
      "solana",
      "token",
      "wallet",
      "polymarket",
      "u卡",
      "欧易",
      "gas",
      "空投",
    ],
    authorKeywords: ["crypto", "btc", "eth", "defou", "polymarket"],
  },
  {
    category: "出海/网络",
    priority: 9,
    strong: [
      "esim",
      "sim卡",
      "手机卡",
      "签证",
      "nomad pass",
      "数字游民",
      "wise",
      "ocbc",
      "vps",
      "vpn",
      "proxy",
      "webrtc",
      "静态住宅 ip",
      "沃达丰",
      "giffgaff",
      "voxi",
      "港卡",
      "护照",
      "汇款",
    ],
    keywords: [
      "ip",
      "机场",
      "线路",
      "流量",
      "海外",
      "收款",
      "充值",
      "shadowrocket",
      "出境",
      "移民",
      "马来西亚",
      "英国",
      "德国",
      "支付宝",
      "短信",
      "接码",
    ],
    urlKeywords: ["wise.com", "voxi.co.uk", "vodafone", "giffgaff.com"],
  },
  {
    category: "金融/投资",
    priority: 8,
    strong: [
      "美股",
      "股票",
      "投资",
      "基金",
      "财富",
      "cagr",
      "纳斯达克",
      "标普",
      "量化",
      "买方",
      "分析师",
      "仓位",
      "护城河",
    ],
    keywords: [
      "finance",
      "market",
      "markets",
      "trading",
      "risk",
      "portfolio",
      "performance",
      "dashboard",
      "capital",
      "company",
      "美元",
      "收益",
      "汇率",
      "资产",
      "报告",
    ],
    authorKeywords: ["investor", "trader", "quant"],
  },
  {
    category: "工具/产品",
    priority: 7,
    strong: [
      "tool",
      "tools",
      "product",
      "saas",
      "app",
      "插件",
      "效率工具",
      "开箱即用",
      "上线",
      "发布",
    ],
    keywords: [
      "launch",
      "release",
      "update",
      "changelog",
      "service",
      "服务",
      "产品",
      "工具",
      "平台",
      "功能",
      "支持",
    ],
  },
  {
    category: "新闻/时事",
    priority: 6,
    strong: ["breaking", "breaking news", "政府", "政策", "快讯", "官宣", "新闻"],
    keywords: ["news", "report", "announced", "announcement", "update", "election", "policy"],
  },
  {
    category: "生活/健康",
    priority: 6,
    strong: ["健身", "减重", "减肥", "fitness", "gym", "health", "训练计划", "喝酒"],
    keywords: ["运动", "饮食", "海边", "旅行", "休息", "旅游", "散心", "hotel", "airline", "trip", "호텔"],
  },
];

function normalize(value: string | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[_#@/\\|()[\]{}"'`~!$%^&*+=<>?,.:;，。！？、：；（）【】《》]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRawJson(rawJson?: string) {
  if (!rawJson) return {};
  try {
    return JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function collectSignals(bookmark: ClassifiableBookmark): NormalizedSignalBag {
  const raw = parseRawJson(bookmark.raw_json);
  const entities = typeof raw.entities === "object" && raw.entities ? (raw.entities as Record<string, unknown>) : {};
  const urls = Array.isArray(entities.urls) ? entities.urls : [];
  const urlTextParts: string[] = [];

  for (const entry of urls) {
    if (!entry || typeof entry !== "object") continue;
    const urlEntry = entry as Record<string, unknown>;
    urlTextParts.push(
      String(urlEntry.expanded_url || ""),
      String(urlEntry.display_url || ""),
      String(urlEntry.title || ""),
      String(urlEntry.description || "")
    );
  }

  const article = typeof raw.article === "object" && raw.article ? (raw.article as Record<string, unknown>) : {};
  const noteTweet = typeof raw.note_tweet === "object" && raw.note_tweet ? (raw.note_tweet as Record<string, unknown>) : {};
  const cardUri = typeof raw.card_uri === "string" ? raw.card_uri : "";
  const rawText = typeof raw.text === "string" ? raw.text : "";
  const mediaUrls = toStringArray(raw.media_urls);

  const mainText = normalize(
    [
      bookmark.text,
      article.title,
      noteTweet.text,
      rawText,
      article.description,
      article.display_title,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const urlText = normalize(
    [...urlTextParts, cardUri, ...mediaUrls]
      .filter(Boolean)
      .join(" ")
  );

  const authorText = normalize(`${bookmark.author_name || ""} ${bookmark.author_username || ""}`);

  return { mainText, urlText, authorText };
}

function countMatches(haystack: string, keywords: string[] | undefined): number {
  if (!haystack || !keywords?.length) return 0;
  let matches = 0;
  for (const keyword of keywords) {
    const normalizedKeyword = normalize(keyword);
    if (normalizedKeyword && haystack.includes(normalizedKeyword)) {
      matches++;
    }
  }
  return matches;
}

function scoreBuiltinRule(rule: BuiltinRule, signals: NormalizedSignalBag): number {
  const strongMatches = countMatches(signals.mainText, rule.strong);
  const keywordMatches = countMatches(signals.mainText, rule.keywords);
  const urlMatches = countMatches(signals.urlText, rule.urlKeywords);
  const authorMatches = countMatches(signals.authorText, rule.authorKeywords);
  const totalMatches = strongMatches + keywordMatches + urlMatches + authorMatches;

  if (totalMatches === 0) {
    return -1;
  }

  return (
    strongMatches * 24 +
    keywordMatches * 10 +
    urlMatches * 12 +
    authorMatches * 4 +
    rule.priority
  );
}

function scoreCustomRule(
  keywords: string,
  priority: number,
  signals: NormalizedSignalBag
): number {
  const terms = keywords.split(",").map((term) => normalize(term)).filter(Boolean);
  if (!terms.length) return -1;

  const mainMatches = countMatches(signals.mainText, terms);
  const urlMatches = countMatches(signals.urlText, terms);
  const authorMatches = countMatches(signals.authorText, terms);
  const totalMatches = mainMatches + urlMatches + authorMatches;

  if (totalMatches === 0) return -1;

  return priority * 3 + mainMatches * 12 + urlMatches * 8 + authorMatches * 3 + totalMatches;
}

export function classify(bookmark: ClassifiableBookmark | string): string {
  const item: ClassifiableBookmark =
    typeof bookmark === "string" ? { text: bookmark } : bookmark;

  const signals = collectSignals(item);
  let bestCategory = "uncategorized";
  let bestScore = -1;

  for (const builtinRule of BUILTIN_RULES) {
    const score = scoreBuiltinRule(builtinRule, signals);
    if (score > bestScore) {
      bestCategory = builtinRule.category;
      bestScore = score;
    }
  }

  for (const customRule of getCategoryRules()) {
    const score = scoreCustomRule(customRule.keywords, customRule.priority, signals);
    if (score > bestScore) {
      bestCategory = customRule.category;
      bestScore = score;
    }
  }

  return bestScore < 0 ? "uncategorized" : bestCategory;
}

export function classifyMany(
  items: ClassifiableBookmark[]
): { id: string; category: string }[] {
  return items.map((item) => ({
    id: item.id || "",
    category: classify(item),
  }));
}

export interface BuiltinRuleSummary {
  category: string;
  priority: number;
  strong: string[];
  keywords: string[];
  urlKeywords: string[];
  authorKeywords: string[];
}

export function getBuiltinRuleSummaries(): BuiltinRuleSummary[] {
  return BUILTIN_RULES.map((r) => ({
    category: r.category,
    priority: r.priority,
    strong: r.strong,
    keywords: r.keywords,
    urlKeywords: r.urlKeywords || [],
    authorKeywords: r.authorKeywords || [],
  }));
}
