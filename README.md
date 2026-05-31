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

## Mobile app

The current mobile app lives in `mobile/` and uses Expo React Native so the same UI code can target Android and iOS.

```bash
npm run mobile:android
```

For validation:

```bash
npm run mobile:typecheck
cd mobile && npx expo-doctor
```

## Mobile cloud backend

The repository also contains the earlier Android-native proof of concept under `android/`.
Both mobile clients use the cloud API under `/api/mobile/*`, backed by Supabase Postgres.

Setup details:

- Run `supabase/schema.sql` in Supabase.
- Deploy this Next.js app to Vercel.
- Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `X_CLIENT_ID`, `X_REDIRECT_URI`, and `MOBILE_APP_REDIRECT_URI`.
- Open `android/` in Android Studio and build with `-PAPI_BASE_URL=https://your-vercel-domain.vercel.app/`.

See `docs/mobile-cloud-setup.md`.

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
