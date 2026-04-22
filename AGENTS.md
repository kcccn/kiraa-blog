# Kiraa Blog Agent 指南

本文件是仓库内 agent 的统一入口。不要把它当成所有细节的真相源；先用它完成任务路由，再进入更窄的 active memory、ADR 或代码。

## 仓库地图

- `hugo.toml`：站点配置、功能开关、评论、图片优化、永久链接规则
- `layouts/`、`assets/`、`static/`、`data/`：Hugo/FixIt 的项目侧扩展面
- `api/visit.js`：Vercel Serverless 流量遥测接口
- `docs/adr/`：正式架构决策与不可违背约束
- `docs/agents/architecture.md`：当前系统结构、子系统约束、稳定规则
- `docs/agents/taste.md`：实现品味、界面审美、反模式
- `docs/agents/runbook.md`：任务路由、验证清单、坑点索引、自动写回协议
- `docs/archive/`：历史考古材料，默认不进入工作流
- `.codex/skills/kiraa-blog-maintainer/`：repo-local skill 源码

## 真相优先级

按以下顺序判断事实：

1. 已提交代码与配置描述当前真实行为。
2. `docs/adr/` 描述已接受的架构意图与硬约束。
3. `docs/agents/*.md` 描述当前 active memory 与任务路由。
4. `docs/archive/` 只提供历史上下文，不是默认指导。

如果代码/配置与 ADR 不一致，不要擅自“帮它统一”。先指出漂移，保留当前行为，并在方案中同时引用代码与 ADR。

## 允许修改的范围

优先改项目侧扩展面：

- 主题与界面：`assets/`、`layouts/`、`static/`、`data/`、`hugo.toml`
- 流量遥测：`api/visit.js`
- 内容与内容结构：`content/`、`archetypes/`
- Agent 记忆与文档：`docs/adr/`、`docs/agents/`、`.codex/skills/`

禁止直接修改 `themes/FixIt/`。把主题视为上游依赖，只能通过项目根目录扩展或覆盖。

## 任务路由

- Hugo/FixIt 定制、UI 打磨、暗色模式回归、模板覆盖：
  先读 `docs/agents/taste.md`，再读 `docs/agents/architecture.md` 对应章节。
- `Nexus` 页面、地球、Pulse Chart、页面级 ECharts：
  先读 `docs/agents/architecture.md` 中的主题扩展与 Nexus 章节，再读 `docs/adr/ADR-002-*` 与 `docs/adr/ADR-003-*`。
- `api/visit.js`、Redis、隐私、地理仲裁：
  先读 `docs/agents/architecture.md` 中的 telemetry 章节，再读 `docs/adr/ADR-004-*`。
- 文章结构、Page Bundle、永久链接、内容与协议：
  先读 `docs/agents/architecture.md` 中的内容与许可章节。
- 流程、验证、自动写回：
  先读 `docs/agents/runbook.md`。

## 记忆写回规则

- 新的不可逆架构约束必须进入新的 ADR 草案，不能只停留在 active memory。
- 可复用的实现偏好与品味写入 `docs/agents/taste.md`。
- 重复踩坑、验证模式、任务路由经验写入 `docs/agents/runbook.md`。
- 一次性调试过程与历史叙事只保留在 `docs/archive/`。
- 任务完成后，如果产出了稳定、可复用、可溯源的 memory delta，自动维护 `docs/agents/*`。
- 写入前先检查目标文档是否已有等价规则；优先合并、收紧或补充 `Source`，不要直接追加重复条目。

不要在常规收尾阶段自动修改 `docs/adr/*` 或 `docs/archive/*`。如果任务暴露了新的正式架构决策需求，在当前总结中标记 `ADR required`，而不是静默改写正式架构边界。
