# Restore Context — 会话恢复指引

## 必读文件顺序

1. `docs/product-vision.md` — 理解产品定位和边界
2. `docs/project-context.md` — 恢复完整架构、数据模型、流程
3. `docs/changelog.md` — 了解已实现功能和历史决策
4. `docs/session-template.md` — 确认本次任务的执行规范

## 当前版本

v0.1.0

## 当前阶段

核心功能已完成，处于稳定使用阶段。下一步计划接入 OpenClaw 替换关键词分类引擎。

## 行为限制

- 不扫描代码库恢复架构，只通过 `project-context.md`
- 不在对话中重复解释已有架构
- 修改数据模型前必须先更新 `project-context.md`
- 新增/修改功能后必须更新 `changelog.md`

## 关键注意事项

- OAuth 2.0 token 存服务端内存，重启需重新授权
- 授权 URL 必须用 `x.com` 域名，不能用 `twitter.com`
- Bookmarks API 仅支持 OAuth 2.0 User Context，不支持 App-Only 或 OAuth 1.0a
- `.env.local` 中保留了 OAuth 1.0a 凭证（备用，当前未使用）
