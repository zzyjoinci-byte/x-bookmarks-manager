# Project Context — Single Source of Truth

## 当前版本

v0.1.0

## 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| 语言 | TypeScript |
| UI | Tailwind CSS v4 |
| 数据库 | SQLite (better-sqlite3) |
| API | X API v2 (OAuth 2.0 User Context, PKCE) |
| 运行时 | Node.js |

## 目录结构

```
x-bookmarks-manager/
├── docs/                          # 项目记忆文件（本协议）
│   ├── product-vision.md
│   ├── project-context.md         ← 你在这里
│   ├── changelog.md
│   ├── restore-context.md
│   └── session-template.md
├── data/
│   └── bookmarks.db               # SQLite 数据库（gitignore）
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 根布局
│   │   ├── page.tsx                # 主页面（书签列表 + 分类筛选 + 认证）
│   │   ├── globals.css             # Tailwind 全局样式
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts      # 生成 OAuth 2.0 授权 URL
│   │       │   ├── callback/route.ts   # OAuth 回调，换取 access_token
│   │       │   ├── status/route.ts     # 查询认证状态
│   │       │   └── logout/route.ts     # 清除 token
│   │       ├── bookmarks/route.ts      # GET 查询 / POST 同步 / PATCH 改分类
│   │       ├── categories/route.ts     # GET/POST/DELETE 分类规则 CRUD
│   │       └── classify/route.ts       # POST 重新分类全部书签
│   ├── lib/
│   │   ├── db.ts                   # SQLite 初始化 + CRUD 操作
│   │   ├── twitter.ts              # X API v2 封装（增量拉取）
│   │   ├── oauth.ts                # OAuth 2.0 PKCE 流程 + token 内存存储
│   │   └── classifier.ts           # 关键词分类引擎
│   └── components/
│       ├── TokenInput.tsx           # 认证状态组件（Connected / Login）
│       ├── BookmarkCard.tsx         # 书签卡片（含 Portal 分类下拉菜单）
│       ├── CategoryFilter.tsx       # 分类筛选栏
│       ├── CategoryManager.tsx      # 分类规则管理弹窗
│       └── SyncButton.tsx           # 同步 / 重新分类按钮
├── .env.local                      # OAuth 凭证（gitignore）
├── .env.example                    # 凭证模板
├── next.config.ts
├── package.json
└── tsconfig.json
```

## 模块职责划分

| 模块 | 职责 |
|------|------|
| `db.ts` | SQLite 连接管理、建表、迁移、书签 CRUD、分类规则 CRUD |
| `twitter.ts` | X API v2 请求封装、用户信息获取、书签增量拉取（遇旧停翻页） |
| `oauth.ts` | OAuth 2.0 PKCE 流程管理、PKCE state/verifier 存储、token 内存管理 |
| `classifier.ts` | 基于关键词的文本分类、优先级匹配、批量分类 |
| `page.tsx` | 主页面状态管理、协调认证/同步/筛选/分类修改 |

## 数据模型

### bookmarks 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 推文 ID |
| text | TEXT | 推文内容 |
| author_id | TEXT | 作者 ID |
| author_name | TEXT | 作者显示名 |
| author_username | TEXT | 作者用户名 |
| created_at | TEXT | 推文创建时间 |
| category | TEXT | 分类（默认 uncategorized） |
| media_urls | TEXT | 媒体 URL JSON 数组 |
| bookmarked_at | TEXT | 入库时间 |
| raw_json | TEXT | API 原始响应 |

### category_rules 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 ID |
| category | TEXT | 分类名 |
| keywords | TEXT | 关键词（逗号分隔） |
| priority | INTEGER | 优先级（高优先匹配） |

## 核心流程

### 认证流程

```
用户点击 "Authorize with X"
  → 前端 GET /api/auth/login → 返回授权 URL
  → 用户在已登录 X 的浏览器中打开链接
  → X 授权页面 (x.com/i/oauth2/authorize)
  → 用户点击 Authorize
  → 回调 GET /api/auth/callback?code=...&state=...
  → 服务端用 PKCE code_verifier 换取 access_token
  → token 存储在服务端内存
  → 重定向到 /?auth=success
```

### 增量同步流程

```
用户点击 "Sync Bookmarks"
  → POST /api/bookmarks
  → 从 DB 获取已有书签 ID 集合
  → 调 X API 逐页拉取书签（每页 100 条）
  → 每页检查：若整页书签都已存在 → 停止翻页
  → 新书签：关键词分类 → 入库
  → 返回结果（含 API 调用次数、是否提前停止）
```

### 分类流程

```
对每条书签文本：
  → 读取所有分类规则（按优先级降序）
  → 文本转小写 → 逐规则匹配关键词
  → 命中多个规则：取优先级最高的；同优先级取匹配词数多的
  → 无命中 → uncategorized
```

## 预置分类规则

| 分类 | 优先级 |
|------|--------|
| 技术/开发 | 10 |
| AI/机器学习 | 10 |
| 设计 | 8 |
| 加密货币 | 8 |
| 新闻/时事 | 5 |
| 工具/产品 | 5 |

## 已实现功能

| 功能 | 状态 |
|------|------|
| OAuth 2.0 PKCE 认证 | ✅ |
| 书签拉取（含媒体/图片） | ✅ |
| 增量同步（遇旧停翻页） | ✅ |
| 关键词自动分类 | ✅ |
| 本地 SQLite 持久化 | ✅ |
| 分类筛选 | ✅ |
| 手动修改书签分类（Portal 下拉菜单） | ✅ |
| 分类规则管理（添加/删除） | ✅ |
| 重新分类全部书签 | ✅ |
| 书签卡片图片展示 | ✅ |
| 启动时自动加载本地数据 | ✅ |

## 环境变量

```
X_CLIENT_ID=           # X Developer Portal OAuth 2.0 Client ID
X_REDIRECT_URI=        # OAuth 回调 URL（默认 http://localhost:3000/api/auth/callback）
X_API_KEY=             # OAuth 1.0a Consumer Key（备用，当前未使用）
X_API_KEY_SECRET=      # OAuth 1.0a Consumer Secret（备用）
X_ACCESS_TOKEN=        # OAuth 1.0a Access Token（备用）
X_ACCESS_TOKEN_SECRET= # OAuth 1.0a Access Token Secret（备用）
```

## 已知限制

- OAuth 2.0 access_token 存在服务端内存，服务重启后需重新授权
- X Bookmarks API 无 `since_id` 参数，增量通过客户端对比实现
- 关键词分类对非英语内容匹配精度有限，后续接入 OpenClaw AI 分类
