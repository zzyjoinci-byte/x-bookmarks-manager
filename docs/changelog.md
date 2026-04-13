# Changelog

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
