---
name: kiraa-blog-maintainer
description: 维护并演进 Kiraa Blog 的 Hugo/FixIt 仓库。处理 Hugo 或 FixIt 定制、Nexus 页面行为、`api/visit.js` 流量遥测、博客内容结构、主题兼容性修复，以及任何要求在不破坏仓库架构前提下提升实现品味的任务时使用。
---

# Kiraa Blog 维护技能

这个 skill 只是仓库内的路由层，不重复大段 reference 正文。只读取完成当前任务所需的最小上下文。

## 起步顺序

1. 先读 `AGENTS.md`。
2. 识别任务所属类型。
3. 读取匹配的 reference 文件。
4. 在提出结构性改动前先检查代码。
5. 任务结束时判断是否产生了稳定的 active-memory delta，并自动写回 `docs/agents/*` 中的正确目标。

## 任务路由

### Hugo 或 FixIt 定制

- 先读 `docs/agents/taste.md`。
- 再读 `docs/agents/architecture.md` 中的相关章节。
- 优先使用 `assets/`、`layouts/`、`static/`、`data/` 与 `hugo.toml` 这些项目侧扩展面。
- 不得修改 `themes/FixIt/`。

### Nexus 页面、Globe 或 Pulse Chart

- 先读 `docs/agents/architecture.md` 中的主题扩展与 Nexus 章节。
- 再读 `docs/adr/ADR-002-nexus-hub-integration.md`。
- 再读 `docs/adr/ADR-003-3d-globe-stability-ux-optimization.md`。
- 保留页面隔离、生命周期护栏与优雅降级行为。

### Visit API 或 Telemetry

- 先读 `docs/agents/architecture.md` 中的 telemetry 章节。
- 再读 `docs/adr/ADR-004-serverless-traffic-telemetry.md`。
- 保留弱指纹、多源仲裁、熔断保护与外置密钥策略。

### 内容结构、Page Bundle 或 License

- 先读 `docs/agents/architecture.md` 中的内容与许可章节。
- 当任务触及许可或发布边界时，再读 `docs/adr/ADR-001-dual-license-strategy.md`。

### 流程、验证或记忆维护

- 先读 `docs/agents/runbook.md`。
- 按其中的自动写回协议判断应写入 `architecture.md`、`taste.md` 还是 `runbook.md`。

## 操作规则

- 把 `docs/adr/` 视为正式架构护栏。
- 把 `docs/agents/` 视为当前 active memory 与任务路由层。
- 把 `docs/archive/` 视为历史考古材料，只有 active memory 不足以解释现状时才读取。
- 不要把一次性调试细节提升为长期记忆。
- 对于产生稳定、可溯源结论的任务，自动维护 `docs/agents/*`。
- 不要自动更新 `docs/adr/*` 或 `docs/archive/*`；如果需要新的正式决策，在总结中标记 `ADR required`。
- 不要在 skill 内擅自重解释或覆盖 ADR；确有必要时，应新增 ADR。
