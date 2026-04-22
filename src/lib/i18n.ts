export type Lang = "en" | "zh";

// Centralised UI strings. Values may contain `{name}` placeholders replaced
// via the second argument of `translate`.
export const DICT = {
  en: {
    appTitle: "X Bookmarks Manager",
    manageRules: "Manage Rules",
    authorize: "Authorize with X",
    connected: "Connected",
    logout: "Logout",
    toggleThemeDark: "Switch to dark mode",
    toggleThemeLight: "Switch to light mode",
    toggleLang: "中 / EN",

    sync: "Sync Bookmarks",
    syncing: "Syncing…",
    reclassify: "Re-classify All",
    backfillMedia: "Backfill Media",
    backfillMediaHint: "Download every bookmark's media locally so it survives if the original tweet is deleted.",
    fetchLinks: "Fetch Link Previews",
    fetchLinksHint: "Fetch title / description / cover for every short link across your bookmarks.",
    backfillArticles: "Backfill Articles",
    backfillArticlesHint: "Re-fetch every bookmark from X to pull X Article full text (plain_text).",

    authPromptIntro: "Please open this link in a browser where you are already logged into X:",
    copy: "Copy",
    open: "Open",
    authRedirectNote: "After you authorize, you will be redirected back here automatically.",
    authSuccess: "Authorization successful! You can now sync bookmarks.",
    authError: "Auth error: {err}",

    syncMessage: "Synced {synced} new bookmarks, {apiCalls} API call(s){early}",
    syncEarly: " (stopped early, all caught up)",
    syncFailed: "Sync failed",
    networkError: "Network error",

    reclassifyMessage: "Re-classified {count} bookmarks",

    backfillMediaWorking: "",
    backfillMediaMessage: "Backfilled media for {n} bookmarks ({files} files, {failed} failed)",
    backfillMediaFailed: "Backfill failed",

    fetchLinksWorking: "Fetching link previews… this may take a minute.",
    fetchLinksMessage: "Link previews: {ok} ok, {failed} failed ({fetched} newly fetched, {total} total URLs)",
    fetchLinksFailed: "Link preview fetch failed",

    backfillArticlesWorking: "Fetching article contents from X… this takes ~1 API call per 100 bookmarks.",
    backfillArticlesMessage: "Articles: {a} with full text out of {u} refreshed ({calls} API call(s), {m} missing)",
    backfillArticlesFailed: "Article backfill failed",

    emptyNoBookmarks: "No bookmarks yet",
    emptyNeedSync: 'Click "Sync Bookmarks" to fetch your bookmarks from X.',
    emptyNeedAuth: 'Click "Authorize with X" to get started.',

    viewOnX: "View on X",
    uncategorized: "Uncategorized",

    all: "All",

    bookmarkDetails: "Bookmark Details",
    close: "Close",
    xArticle: "X Article",
    quotedArticle: "Quoted X Article",
    quotedTweet: "Quoted Tweet",
    externalLinks: "External Links",
    articleExcerpt: "Article Excerpt",
    localizedMedia: "Localized {local} / {total} media",
    savedOn: "Saved on {date}",
    noArticleYet: 'Only metadata — click "Backfill Articles" in the header to fetch the full text.',
    noPreview: 'No preview fetched — click "Fetch Link Previews" in the header.',

    ruleTitle: "Category Rules",
    rulePriority: "Priority: {n}",
    ruleDelete: "Delete",
    ruleNone: "No rules yet",
    ruleAddHeader: "Add New Rule",
    ruleCategoryName: "Category Name",
    ruleKeywords: "Keywords (comma separated)",
    rulePriorityHint: "Priority (higher = match first)",
    ruleAdd: "Add",
    ruleEgCategory: "e.g. Personal Finance",
    ruleEgKeywords: "e.g. stock,invest,fund,portfolio,dividend",
    ruleBuiltinHeader: "Built-in rules (hard-coded)",
    ruleCustomHeader: "Custom rules",
    ruleReadonly: "read-only",
    ruleStrong: "Strong:",
    ruleKeywordsLabel: "Keywords:",
    ruleUrlHosts: "URL hosts:",
    ruleAuthors: "Authors:",
    ruleBuiltinNote: "Built-in rules are defined in src/lib/classifier.ts. Custom rules below stack on top of them; higher priority matches first.",
  },
  zh: {
    appTitle: "X 书签管理",
    manageRules: "管理规则",
    authorize: "使用 X 授权",
    connected: "已连接",
    logout: "退出",
    toggleThemeDark: "切换到深色模式",
    toggleThemeLight: "切换到浅色模式",
    toggleLang: "EN / 中",

    sync: "同步书签",
    syncing: "同步中…",
    reclassify: "全部重新分类",
    backfillMedia: "回填媒体",
    backfillMediaHint: "将所有书签的媒体下载到本地，防止原推被删后图片失效。",
    fetchLinks: "抓取链接预览",
    fetchLinksHint: "抓取所有短链的文章标题 / 摘要 / 封面图。",
    backfillArticles: "回填文章正文",
    backfillArticlesHint: "重新从 X 拉取所有书签的文章全文（X Articles 的 plain_text）。",

    authPromptIntro: "请在已登录 X 的浏览器中打开此链接：",
    copy: "复制",
    open: "打开",
    authRedirectNote: "授权后会自动跳回本页。",
    authSuccess: "授权成功！你可以开始同步书签了。",
    authError: "授权错误：{err}",

    syncMessage: "已同步 {synced} 条新书签，调用 {apiCalls} 次 API{early}",
    syncEarly: "（已全部同步，提前结束）",
    syncFailed: "同步失败",
    networkError: "网络错误",

    reclassifyMessage: "已重新分类 {count} 条书签",

    backfillMediaWorking: "",
    backfillMediaMessage: "为 {n} 条书签回填媒体（{files} 个文件，{failed} 失败）",
    backfillMediaFailed: "媒体回填失败",

    fetchLinksWorking: "正在抓取链接预览…可能需要一分钟。",
    fetchLinksMessage: "链接预览：{ok} 成功 / {failed} 失败（新增 {fetched} 条，共 {total} 个 URL）",
    fetchLinksFailed: "链接预览抓取失败",

    backfillArticlesWorking: "正在从 X 拉取文章正文…每 100 条书签约 1 次 API 调用。",
    backfillArticlesMessage: "文章：已刷新 {u} 条，其中 {a} 条拿到全文（{calls} 次 API 调用，{m} 缺失）",
    backfillArticlesFailed: "文章回填失败",

    emptyNoBookmarks: "还没有书签",
    emptyNeedSync: "点击“同步书签”从 X 拉取。",
    emptyNeedAuth: "点击“使用 X 授权”开始。",

    viewOnX: "在 X 查看",
    uncategorized: "未分类",

    all: "全部",

    bookmarkDetails: "书签详情",
    close: "关闭",
    xArticle: "X 文章",
    quotedArticle: "引用的 X 文章",
    quotedTweet: "引用推文",
    externalLinks: "外部链接",
    articleExcerpt: "文章摘要",
    localizedMedia: "已本地化 {local} / {total} 张媒体",
    savedOn: "收藏于 {date}",
    noArticleYet: "仅元数据，正文尚未抓取。点击 Header 的“Backfill Articles”拉取全文。",
    noPreview: "未抓取预览 — 点击 Header 的“Fetch Link Previews”按钮可获取内容。",

    ruleTitle: "分类规则",
    rulePriority: "优先级：{n}",
    ruleDelete: "删除",
    ruleNone: "暂无规则",
    ruleAddHeader: "添加新规则",
    ruleCategoryName: "分类名",
    ruleKeywords: "关键词（逗号分隔）",
    rulePriorityHint: "优先级（数值越高越先匹配）",
    ruleAdd: "添加",
    ruleEgCategory: "例如：投资理财",
    ruleEgKeywords: "例如：stock,invest,fund,portfolio,dividend",
    ruleBuiltinHeader: "内建规则（硬编码）",
    ruleCustomHeader: "自定义规则",
    ruleReadonly: "只读",
    ruleStrong: "强关键词：",
    ruleKeywordsLabel: "关键词：",
    ruleUrlHosts: "URL 域名：",
    ruleAuthors: "作者：",
    ruleBuiltinNote: "内建规则定义在 src/lib/classifier.ts。下方自定义规则叠加其上，优先级高的先匹配。",
  },
} as const;

export type TKey = keyof typeof DICT["en"];

export function translate(
  lang: Lang,
  key: TKey,
  vars?: Record<string, string | number>
): string {
  const dict = DICT[lang] || DICT.en;
  let str: string = dict[key] ?? DICT.en[key] ?? String(key);
  if (vars) {
    for (const k of Object.keys(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
    }
  }
  return str;
}

const CATEGORY_LABELS_EN: Record<string, string> = {
  "技术/开发": "Tech / Dev",
  "AI/机器学习": "AI / ML",
  "设计": "Design",
  "加密货币": "Crypto",
  "出海/网络": "Global / Network",
  "金融/投资": "Finance",
  "生活/健康": "Life / Health",
  "新闻/时事": "News",
  "工具/产品": "Tools / Products",
  "uncategorized": "Uncategorized",
};

export function displayCategory(name: string, lang: Lang): string {
  if (name === "uncategorized") return lang === "en" ? "Uncategorized" : "未分类";
  if (lang === "en") return CATEGORY_LABELS_EN[name] || name;
  return name;
}
