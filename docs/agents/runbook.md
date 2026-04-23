# Kiraa Blog Runbook

本文档记录任务路由、验证清单、重复坑点与 active memory 自动写回协议。它服务日常协作，不承担完整的历史叙事。

## 任务路由

- 主题/UI 调整：
  先读 `docs/agents/taste.md`，再到 `docs/agents/architecture.md` 定位对应子系统。
- `Nexus` 页面、地球或 Pulse Chart：
  先读 `docs/agents/architecture.md` 中的主题扩展与 Nexus 章节，再读 `docs/adr/ADR-002-*` 与 `docs/adr/ADR-003-*`。
- telemetry 或 `api/visit.js`：
  先读 `docs/agents/architecture.md` 中的 telemetry 章节，再读 `docs/adr/ADR-004-*`。
- 内容结构、Page Bundle、许可：
  先读 `docs/agents/architecture.md` 中的内容与许可章节。
- active memory 无法解释当前行为时：
  先查 git 历史；仍需追溯设计演进时，再读 `docs/archive/dev-log.md`。

## 验证清单

### 主题与 UI

- 确认改动仍落在项目侧文件中。
- 同时检查亮色与暗色模式。
- 确认影响范围只落在目标页面或目标组件。
- 如果涉及模板、样式或内容渲染，重新用 Hugo 预览或构建验证。

### Nexus 与 Globe

- 确认功能仍只存在于 `/nexus/`。
- 验证滚轮滚动没有被劫持。
- 验证 loading、fallback 与重建逻辑仍有效。
- 确认其他页面没有开始加载 ECharts/ECharts-GL。

### Telemetry

- 保留弱指纹模型，不引入原始 IP 存储。
- 保留多源仲裁与熔断机制。
- 确认环境变量仍外置在部署环境中。
- 检查降级路径是否仍然返回可用结果，而不是让页面直接报错。

### 服务卡片橱窗与滚动交互

- 验证两排卡片同步滚动，无错位。
- 快速拖拽测试：往左、往右拖拽，观察边界过渡是否平滑。
- 验证无缝循环：滚动到末尾时无空缺、无闪烁、无跳变。
- 验证鼠标悬停暂停功能。
- 验证拖拽后链接拦截：拖拽时不触发链接跳转，点击时正常跳转。
- 验证触摸设备兼容性。
- 同时检查亮色与暗色模式。
- 验证性能：使用 DevTools Performance 确认 60fps，无卡顿。

### 内容与许可

- 保持实现层资产与原创内容的 License 边界不变。
- 保留 `content/posts/` 结构与当前 permalink 行为。
- 只要任务本质是编辑性需求，就优先改内容/数据/配置，而不是先改模板逻辑。

## 坑点索引

### Rule
不要把 archive 当作默认说明书。

### Why
archive 里的内容有历史价值，但也混杂了已过时流程、重复规则与一次性叙事；默认加载它会给当前工作流引入噪音。

### Scope
任何一上来就搜索 `docs/` 的任务。

### Source
- `docs/archive/dev-log.md`
- `AGENTS.md`

### Supersedes
把旧 prompt 大文件当作一线记忆的做法。

### Rule
在“简化” `assets/js/custom.js` 或 `api/visit.js` 之前，先确认你没有删掉已解决问题的复杂度。

### Why
这两个文件里有不少逻辑是由真实生命周期、可用性、隐私与降级问题沉淀出来的；变短不等于变好。

### Scope
globe、图表、visit API、telemetry 状态与 fallback 行为。

### Source
- `docs/adr/ADR-003-3d-globe-stability-ux-optimization.md`
- `docs/adr/ADR-004-serverless-traffic-telemetry.md`
- `assets/js/custom.js`
- `api/visit.js`

### Supersedes
按时间线记录 bug 的旧日志风格。

### Rule
修改 `hugo.toml` 时要把它视为高杠杆改动，顺手复查相邻配置。

### Why
它控制评论、数学公式、图片优化、自定义 partial、永久链接等关键行为；一个小改动可能带来广泛影响。

### Scope
任何 `hugo.toml` 改动。

### Source
- `hugo.toml`
- `README.md`
- `docs/adr/`

### Supersedes
散落在旧 persona 与 SOP 文档中的配置提醒。

### Rule
两排同步滚动时，不要共享同一个 position 状态。

### Why
两排卡片数量不同时，scrollWidth 不同，共享 position 会导致边界检测不同步，出现一排正常、另一排跳变的情况。

### Scope
服务卡片橱窗、友链滚动、任何需要多排同步滚动的组件。

### Source
- `assets/js/custom.js` - `initServiceCarousel()`

### Supersedes
单排滚动或共享状态的旧实现。

### Rule
无缝循环滚动克隆卡片时，确保克隆后的总宽度至少是容器宽度的 3 倍。

### Why
克隆太少会导致快速拖拽时出现空缺；容器宽度 * 3 可以确保无缝循环时有足够的卡片填满视口。

### Scope
无缝循环滚动、首尾克隆法。

### Source
- `assets/js/custom.js` - `initServiceCarousel()`

### Supersedes
只克隆一次的旧实现。

## 自动写回协议

任务收尾时，如果本次工作产生了稳定的 memory delta，就自动维护 `docs/agents/*`。

### 何时必须自动写回

- 本次任务已经落地到代码、配置或 active docs，并形成了可复用结论。
- 这个结论对未来任务有帮助，而不只是解释一次性事故。
- 写回内容能给出明确的 `Source`，例如代码、配置、ADR 或本次变更涉及的 active docs。
- 该结论可以自然落入 `architecture.md`、`taste.md` 或 `runbook.md`，而不会改写正式架构边界。

### 何时禁止自动写回

- 只是临时迁移、一次性调试故事或本地环境噪音。
- 结论仍是猜测，缺乏具体来源支撑。
- 这实际上是新的不可逆架构决策，应走 ADR 流程。
- 目标文件里已经有等价规则，而且无需实质性补强。

### 写到哪里

- `docs/agents/taste.md`：
  可复用实现偏好、UI/UX 审美、代码品味、反模式。
- `docs/agents/architecture.md`：
  `Nexus`、telemetry、内容/许可、主题扩展模型等稳定系统约束。
- `docs/agents/runbook.md`：
  验证清单、路由优化、重复坑点与流程经验。
- `docs/adr/*`：
  不属于默认自动写回范围；需要时只在任务总结中标记 `ADR required`。

### 如何保持幂等

- 写入前先检查目标文件中是否已有等价规则。
- 如果已有等价规则，优先补充 `Source`、收紧表述或更新 `Supersedes`，而不是追加一个新条目。
- 只有当结论确实是新的稳定规则时，才新增条目。
- 所有长期规则都保持 `Rule / Why / Scope / Source / Supersedes` 结构。

## 何时写入哪类记忆

- ADR：
  新的不可逆架构、隐私、存储、渲染或部署约束。
- Taste：
  能跨多个未来任务复用的实现偏好。
- Runbook：
  重复出现的坑点、验证模式与任务路由经验。
- Archive：
  一次性调试故事、临时迁移过程与完整历史时间线。
