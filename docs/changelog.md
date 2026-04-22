# Changelog

## v0.4.0 — X Articles 全文 / 黑暗模式 / 中英切换 / 规则面板拆分（2026-04-22）

### 新增功能

**X Articles 全文抓取**
- `tweet.fields=article` 请求，返回结构含 `title` / `preview_text` / `plain_text`（完整正文，X 已拆好，不需要解 Draft.js blocks）
- 新接口 `POST /api/bookmarks/backfill-articles`：两遍抓取
  - **Pass 1**：100/批调 `/2/tweets?ids=...` 拉所有书签本体，`expansions=author_id,referenced_tweets.id,referenced_tweets.id.author_id` 把 quote tweet 和其作者一并拿回
  - **Pass 2**：扫描每条书签的 `entities.urls` 里的 `x.com/user/status/ID` 模式，补拉尚未捕获的引用 tweet（解决评论别人文章加 t.co 的情况）
- 每条书签的 `raw_json` 追加 `_referenced[]` 存引用 tweet 数据（含文章 / 作者）
- 详情面板：本体或引用若命中 article，渲染琥珀色文章卡片（标题 + 完整 plain_text + 作者归属）
- 实测 337 条书签 → 5 次 API 调用 → 32 条本体文章 + 23 条引用文章
- 文件：`src/app/api/bookmarks/backfill-articles/route.ts`, `src/lib/twitter.ts`, `src/lib/bookmark-shape.ts`, `src/components/BookmarkDetail.tsx`

**全宽布局 + 固定宽卡片**
- 去掉 `max-w-6xl`，Header / Main 改 `w-full px-6`
- 卡片网格改为 `grid-cols-[repeat(auto-fill,400px)]` + `justify-start`：固定 400px 宽，每行数量随窗口宽度自适应
- 详情抽屉改为**无遮罩、无 body 锁滚**的固定右栏，抽屉打开时书签网格通过 `md:pr-[520px] lg:pr-[580px]` 动画推左，实现双栏并行浏览

**黑暗模式**
- `@custom-variant dark (&:where(.dark, .dark *));` + `:root` / `.dark` 自定义变量
- Header 月亮/太阳图标按钮切换，localStorage 持久化
- `layout.tsx` inline script 在 React 渲染前读 localStorage/`prefers-color-scheme`，给 `<html>` 打 `.dark` class，无 FOUC
- `color-scheme: dark` 让原生输入框 / 滚动条同步
- 全组件补 dark variant：页面 / 卡片 / Drawer / 下拉 / 分类标签（9 个预设分类都有深色配色）

**中英切换 (i18n)**
- 新文件 `src/lib/i18n.ts` 集中 dict（en / zh）+ `translate(lang, key, vars)` 支持 `{name}` 占位符
- `src/lib/language-context.tsx` 提供 `useT()` hook，暴露 `t` / `lang` / `setLang` / `categoryLabel`
- Header `中 / EN` 按钮切换，`navigator.language` 首次默认，localStorage 持久化，inline script 在 SSR 前打 `data-lang` 防 FOUC
- 日期格式跟随语言（`zh-CN` / `en-US`）
- 预设分类显示时走 `displayCategory(name, lang)` 映射（Tech/Dev、AI/ML、Design...），用户自建分类保留原名

**Manage Rules 面板拆分**
- 之前只显示 DB 的 6 条种子规则，但分类真正靠 `classifier.ts` 里的 9 条 `BUILTIN_RULES`，导致面板和实际分类对不上
- `/api/categories` 同时返回 `rules`（自定义）+ `builtins`（内建）
- `CategoryManager` 分两区：**Built-in rules (read-only)** 显示 9 条内建规则的 strong / keywords / urlKeywords / authorKeywords 四类信号词，**Custom rules** 显示可增删的用户规则

### Bug 修复

**卡片分类下拉菜单滚动失效**
- 原因：`window.addEventListener("scroll", ..., true)` capture 模式捕获了 dropdown 内部滚动事件，触发 `setShowDropdown(false)` 自关闭；拖拽滚动条也一样
- 修复：`handleScroll` 检查 `e.target` 是否在 `dropdownRef.current` 内，是则忽略

### 数据模型变更
- 无新表 / 新列；`raw_json` 内部多一个 `_referenced` 字段（前端约定，后端不感知）

## v0.3.0 — 短链预览 / 全宽布局 / 双栏浏览（2026-04-22）

### 新增功能

**短链内容预览**
- 新表 `link_previews(url, final_url, title, description, image, site_name, excerpt, status, fetched_at)`
- 抓取器 `src/lib/link-preview.ts`：获取页面 OG / twitter / `<title>` / `<meta>` + 正文摘要，支持多编码、1.5 MB 上限、12 s 超时
- **t.co 特殊处理**：t.co 对浏览器 UA 返回 JS 跳转页（非 301），先用空 UA + `redirect: manual` 读 Location 解析目标，再用 Chrome UA 抓目标页 OG。覆盖 t.co / bit.ly / tinyurl / goo.gl / buff.ly / ift.tt / ow.ly / lnkd.in / dlvr.it
- 短链文本抽取 fallback：旧 `raw_json` 未保存 `entities` 的情况下（284/311 命中），从推文文本正则抽 t.co URL 再解析
- 新接口 `POST /api/links/backfill`：遍历所有书签收集唯一外链 → 跳过已缓存 → 并发 4 抓取 → 入库
- `GET /api/bookmarks` / `POST /api/bookmarks` / `POST /api/classify` 响应附带 `linkPreviews` 映射表
- Header 新增 `Fetch Link Previews` 按钮（幂等，只抓未缓存的 URL）
- 文件：`src/lib/link-preview.ts`, `src/lib/bookmark-shape.ts`, `src/app/api/links/backfill/route.ts`

**详情面板增强**
- 文本中的 t.co 链接自动替换为真实域名 + 超链接到解析后的目标（文本渲染用 `buildShortLinkMap`）
- 外部链接卡片：站点名 / 标题 / 描述 / 封面图 / 折叠展开的"文章摘要"
- `extractExternalLinks` 支持 entities.urls + text-extracted t.co 双来源

**全宽布局 + 双栏浏览**
- 去掉 `max-w-6xl`，Header / Main 改 `w-full px-6`
- 网格扩展到 `sm:2 · lg:3 · xl:4 · 2xl:5` 列，大显示器铺满
- 详情抽屉改为**无背景遮罩**的固定右栏（`border-l` 代替 `bg-black/30`）
- 抽屉打开时 Header / Main 动画加右内边距（`md:pr-[520px] lg:pr-[580px]`），卡片自动重排到左侧不被遮挡
- 取消 body overflow 锁定，左侧卡片列表可滚动；关闭方式：ESC / 右上角 ×

### 数据模型变更
- 新表 `link_previews`

## v0.2.0 — 原文保留 / 详情面板 / 授权持久化（2026-04-22）

### 新增功能

**授权持久化 + refresh token**
- OAuth token 从内存改为 SQLite 持久化（新表 `auth_tokens`），服务重启不丢失授权
- 新增 `getValidAccessToken()`：检测过期并自动用 `refresh_token` 刷新
- 文件：`src/lib/oauth.ts`, `src/lib/db.ts`, `src/app/api/bookmarks/route.ts`

**原始内容保留**
- 同步时自动下载媒体到 `data/media/<bookmarkId>/`，存本地路径到 `local_media` 列
- 新增 `/api/media/[...path]` 静态路由，带路径穿越防御
- 卡片/详情面板优先用本地路径 (`resolveImageSrc`)，回退到原 URL
- API 请求字段扩展：`note_tweet`（完整长文本）、`public_metrics`、`alt_text`、头像
- 新增 `/api/bookmarks/backfill-media`：为历史书签一次性补下载媒体
- 文件：`src/lib/media.ts`, `src/lib/twitter.ts`, `src/app/api/media/*`, `src/app/api/bookmarks/backfill-media/route.ts`

**右侧详情面板 BookmarkDetail**
- 点击卡片打开右侧 Drawer（宽 520–580px），ESC / 点外部 / 关闭按钮关闭
- 完整长文本（`note_tweet.text`）+ URL 自动 linkify
- 所有图片铺开展示（不截断），点击打开原图
- `entities.urls` 提取外链卡片：标题 / 描述 / 缩略图
- 分类编辑、`public_metrics` 互动数据、收藏时间
- 文件：`src/components/BookmarkDetail.tsx`, `src/lib/bookmark-shape.ts`, `src/lib/category-colors.ts`

### 数据模型变更
- `bookmarks` 新增 `local_media TEXT DEFAULT '[]'`
- 新表 `auth_tokens(id=1, access_token, refresh_token, expires_at, user_id, username)`

## v0.1.0 — 核心功能完成（2026-02-27）

### 新增功能

**OAuth 2.0 认证**
- 实现 OAuth 2.0 PKCE 授权流程
- 授权 URL 改用 `x.com` 域名（解决 `twitter.com` 与 `x.com` cookie 不共享问题）
- 授权链接可复制/手动打开，适配已登录浏览器
- 认证状态、登出功能
- 文件：`src/lib/oauth.ts`, `src/app/api/auth/*/route.ts`

**书签同步**
- X API v2 书签拉取，含推文文本、作者信息、媒体附件
- 请求 `attachments.media_keys` + `media.fields` 获取图片
- 增量同步：传入已有 ID 集合，遇整页旧书签停止翻页，最小化 API 调用
- 文件：`src/lib/twitter.ts`, `src/app/api/bookmarks/route.ts`

**关键词分类引擎**
- 基于规则表的关键词匹配，不区分大小写
- 优先级机制：高优先级规则优先；同级取匹配词数多的
- 预置 6 个分类规则
- 文件：`src/lib/classifier.ts`

**数据持久化**
- SQLite 自动建表 + 迁移（media_urls 列）
- 书签 upsert、分类 CRUD、增量更新
- 启动时自动加载本地数据，无需每次调 API
- 文件：`src/lib/db.ts`

**前端界面**
- 书签卡片展示：作者、内容、时间、图片、分类标签
- 分类筛选栏：彩色圆点 + 计数
- 分类下拉菜单：Portal 渲染到 body 层，自动上下定位，解决 overflow 裁剪问题
- 分类规则管理弹窗：查看/添加/删除规则
- 同步按钮显示 API 调用次数和增量状态
- 文件：`src/components/*.tsx`, `src/app/page.tsx`

### Bug 修复

**认证方式问题**
- 原因：初始使用 App-Only Bearer Token，Bookmarks 端点返回 403
- 修复：改为 OAuth 2.0 User Context (PKCE)
- 中间尝试 OAuth 1.0a 同样被拒（该端点仅支持 OAuth 2.0）

**授权页面要求重新登录**
- 原因：授权 URL 使用 `twitter.com` 域名，用户 cookie 在 `x.com`
- 修复：将 `TWITTER_AUTH_URL` 改为 `https://x.com/i/oauth2/authorize`

**授权后 Sync 按钮不显示**
- 原因：OAuth 回调后 `checkAuth()` 异步竞态，`authenticated` 未及时更新
- 修复：检测 `?auth=success` URL 参数时直接 `setAuthenticated(true)`

**分类下拉菜单被卡片裁剪**
- 原因：卡片 `overflow-hidden` 裁剪了 relative 定位的下拉菜单
- 修复：改用 `createPortal` 渲染到 `document.body`，`z-index: 9999`，自动检测上下空间
