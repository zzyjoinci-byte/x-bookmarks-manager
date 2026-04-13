# X Bookmarks Manager

基于 X API 的个人书签管理工具，自动抓取并智能归类用户的 X 书签内容。

## 启动项目

```bash
# 安装依赖
npm install

# 启动开发服务器（默认端口 3000）
npm run dev
```

浏览器打开 http://localhost:3000 即可使用。

## 关闭项目

### 方式一：终端中直接关闭

在运行 `npm run dev` 的终端中按 `Ctrl + C`。

### 方式二：终端已关闭，进程仍在后台运行

如果关闭了终端但进程没有退出（端口仍被占用），手动查杀：

```bash
# 查看占用端口 3000 的进程
lsof -i :3000 -P

# 根据输出的 PID 杀掉进程
kill <PID>

# 如果 kill 无效，强制终止
kill -9 <PID>
```

## 环境变量

复制 `.env.example` 为 `.env.local`，填入 X Developer Portal 的 OAuth 凭证：

```
X_CLIENT_ID=你的 Client ID
X_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

## 技术栈

- Next.js 16 (App Router, Turbopack)
- TypeScript
- Tailwind CSS v4
- SQLite (better-sqlite3)
- X API v2 (OAuth 2.0 PKCE)

详细架构和功能说明见 `docs/` 目录。
