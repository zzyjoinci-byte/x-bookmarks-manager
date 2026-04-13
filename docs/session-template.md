# Session Template — 任务执行规范

## 新会话必须读取的文件

1. `docs/restore-context.md`
2. `docs/project-context.md`
3. `docs/changelog.md`（最新 3 个版本）

## 输出结构要求

- 代码修改：说明改了哪些文件、为什么改
- 新功能：描述行为逻辑，不只是代码
- Bug 修复：必须写清原因和修复方式

## 禁止行为

- 禁止不读 context 直接编码
- 禁止修改数据模型但不更新 `project-context.md`
- 禁止用对话替代 changelog 记录
- 禁止扫描整个代码库来理解架构

## 是否允许写代码

是。当前已进入实现阶段。

## 任务完成后必须执行

1. 若修改了架构/数据模型 → 更新 `project-context.md`
2. 若新增/修改了功能 → 更新 `changelog.md`
3. 若产品方向变化 → 更新 `product-vision.md`

## Token 优化目标

- 通过 `project-context.md` 恢复架构，不重复扫描源码
- 精准定位需要修改的文件，避免全局搜索
- 增量更新文档，不重写已有内容
