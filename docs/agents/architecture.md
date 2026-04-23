# Kiraa Blog 当前架构

本文档记录稳定的系统知识。它比 archive 更精炼，比单篇 ADR 更偏向日常实现；遇到高风险变更时，仍应回到 ADR 与代码确认事实。

本文档属于 agent-maintained active memory。所有长期规则都必须使用 `Rule / Why / Scope / Source / Supersedes` 结构；新增前先合并同义规则，避免重新膨胀成历史日志。

## 阅读方式

- 先按任务所在子系统定位章节。
- 把条目当作 active memory，而不是代码的替身。
- 在进行高风险修改前，沿着 `Source` 回到 ADR、配置或实现代码核对。

## 主题扩展模型

### Rule
所有 FixIt 定制都从项目根目录扩展，禁止直接修改 `themes/FixIt/`。

### Why
主题是上游依赖。项目侧扩展比直接改子模块更稳定，也更利于未来升级。

### Scope
所有主题、布局、样式、partial 与静态资源相关改动。

### Source
- `docs/adr/ADR-002-nexus-hub-integration.md`
- `hugo.toml`
- `layouts/`
- `assets/`

### Supersedes
旧 prompt 体系里重复描述此规则的条目。

### Rule
优先选择最窄的扩展路径：配置、项目资源、`customPartials`、项目模板覆盖；只有轻量路径无法表达需求时，才使用完整模板覆盖。

### Why
这能降低与上游主题的耦合，减少未来维护成本。

### Scope
Hugo/FixIt 功能扩展、组件插入、模板与样式调整。

### Source
- `hugo.toml`
- `layouts/`
- `assets/`

### Supersedes
旧的 SOP 与 persona 中对“优先级链”的长篇重复说明。

## Nexus 页面

### Rule
高成本的交互式地球与 Pulse Chart 必须隔离在 `/nexus/` 页面，不得恢复为全站全局加载。

### Why
Nexus 是专门承载“空间-时间-人”叙事流的单页；页面级隔离可以保证站点其余页面没有额外性能负担。

### Scope
`layouts/nexus.html`、`assets/js/custom.js` 与所有挂在 Nexus 上的交互功能。

### Source
- `docs/adr/ADR-002-nexus-hub-integration.md`
- `docs/adr/ADR-003-3d-globe-stability-ux-optimization.md`
- `layouts/nexus.html`
- `assets/js/custom.js`

### Supersedes
早期 footer globe 方案及其历史遗留说明。

### Rule
`#nexus-globe` 是模板直接拥有的挂载点，不能通过 `customPartials` 间接注入。

### Why
Nexus 页面需要明确的页面级状态、资源顺序与模板控制；这类容器应显式存在于页面模板中。

### Scope
Nexus 页面结构与地球挂载容器。

### Source
- `docs/adr/ADR-002-nexus-hub-integration.md`
- `layouts/nexus.html`

### Supersedes
对普通 partial 注入路径的泛化使用。

### Rule
修改地球行为时必须保留当前稳定性契约：异步贴图预加载、优雅兜底材质、释放滚轮滚动、主题切换后的安全重建。

### Why
现有实现已经吸收了 FOUC、滚动劫持、移动端/WebGL 恢复等真实问题；删掉这些护栏通常只会重开旧 bug。

### Scope
`assets/js/custom.js` 中与 globe 生命周期有关的代码。

### Source
- `docs/adr/ADR-003-3d-globe-stability-ux-optimization.md`
- `assets/js/custom.js`

### Supersedes
按 bug 时间线展开的历史记录。

### Rule
释放 `Nexus` 地球的滚轮事件时，必须覆盖地球容器下的所有 canvas，并用 `stopImmediatePropagation()` 阻止 chart 在目标层消费滚轮；不能调用 `preventDefault()` 阻断浏览器默认页面滚动。

### Why
这个页面的预期行为是“滚轮滚动页面、拖拽旋转地球、禁止滚轮缩放”。当前地球实际会生成多个 canvas，只拦截其中一个会留下未处理的目标层监听器，悬停地球时页面仍然会卡住。

### Scope
`assets/js/custom.js` 中 `Nexus` 地球的 `wheel` 事件绑定与主题切换后的重建流程。

### Source
- `docs/adr/ADR-003-3d-globe-stability-ux-optimization.md`
- `assets/js/custom.js`

### Supersedes
与滚轮释放实现不一致的旧表述。

## 归档页面

### Rule
归档页面热力图必须保持页面级隔离，ECharts 仅在归档页面加载。

### Why
热力图是归档页面专属功能，其他页面不应承担 ECharts 的体积与运行时成本；页面级隔离保证站点整体性能。

### Scope
`layouts/home.archives.html`、`assets/js/custom.js` - `initArchiveHeatmap()`。

### Source
- `layouts/home.archives.html`
- `assets/js/custom.js`

### Supersedes
无（新增规则）。

### Rule
归档页面必须手动加载 ECharts，因为 FixIt 主题默认在归档页面排除 ECharts 加载。

### Why
主题的 `assets.html` 中有 `$isArchivesOrOffline` 判断，会跳过 `hasEcharts` 标记；归档页面需要通过 `partial "store/script.html"` 手动注入 ECharts 脚本。

### Scope
归档页面模板、任何需要在归档页面使用 ECharts 的场景。

### Source
- `themes/FixIt/layouts/_partials/assets.html`
- `layouts/home.archives.html`

### Supersedes
无（新增规则）。

### Rule
热力图数据聚合仅统计 `posts` 目录下的非草稿页面，保证数据纯度。

### Why
热力图展示的是"内容创作者"的产出，而非"代码维护者"的 commit；通过 `where .Site.RegularPages "Section" "posts"` 和 `if not .Draft` 精准过滤，排除工程代码和草稿。

### Scope
归档页面热力图数据聚合、任何需要统计博客产出的场景。

### Source
- `layouts/home.archives.html`

### Supersedes
无（新增规则）。

## 流量遥测

### Rule
保留当前隐私模型：不得存储原始 IP，只能用弱指纹做去重，并将 UV 与热力聚合分开存储。

### Why
遥测系统的目标是支撑可视化与趋势分析，而不是把博客变成 PII 存储系统。

### Scope
`api/visit.js`、Redis 数据结构、任何 telemetry 重构。

### Source
- `docs/adr/ADR-004-serverless-traffic-telemetry.md`
- `api/visit.js`

### Supersedes
旧版 visit API 的迁移叙事。

### Rule
地理定位必须保留多源并行仲裁与熔断机制，不能退回到单一供应商或顺序降级链。

### Why
当前架构是在 serverless、延迟、可用性与粗粒度精度之间取得的平衡。

### Scope
`api/visit.js` 中的定位来源、请求流程、重试与限流保护。

### Source
- `docs/adr/ADR-004-serverless-traffic-telemetry.md`
- `api/visit.js`

### Supersedes
对单个地理定位供应商的历史 workaround。

### Rule
环境变量与敏感端点必须继续保留在部署环境中，禁止硬编码进仓库。

### Why
遥测链路依赖 Redis 凭据，仓库必须保持可公开安全。

### Scope
Serverless 配置与密钥处理。

### Source
- `docs/adr/ADR-004-serverless-traffic-telemetry.md`
- `api/visit.js`

### Supersedes
早期文档中对密钥安全的重复提醒。

## 内容、结构与许可

### Rule
实现层资产与原创内容必须继续被视为两类不同资产，并遵守不同 License 边界。

### Why
本仓库刻意将 MIT 覆盖的实现层与 CC BY-NC-SA 4.0 覆盖的内容层分离管理。

### Scope
README、站点配置、文章模板与发布流程。

### Source
- `docs/adr/ADR-001-dual-license-strategy.md`
- `README.md`
- `hugo.toml`

### Supersedes
archive 中重复解释 License 的旧说明。

### Rule
文章内容继续放在 `content/posts/`，永久链接继续使用基于 `:contentbasename` 的当前策略。

### Why
现有仓库已经围绕 page bundle 与当前 Hugo/FixIt 约定完成对齐，不应再回退到旧目录组织。

### Scope
内容组织、archetype、永久链接与 Front Matter 相关调整。

### Source
- `hugo.toml`
- `content/posts/`
- `archetypes/`

### Supersedes
旧 prompt 中围绕目录迁移的历史说明。

### Rule
优先保持 data/config/render 分离：结构化内容放在 `content/` 或 `data/`，站点行为放在配置中，渲染与生命周期留在模板与资源层。

### Why
这样能让内容编辑、配置调整与渲染实现各自稳定，减少模板层的杂糅。

### Scope
友链、评论、内容元数据渲染、页面组装。

### Source
- `data/friends.yml`
- `hugo.toml`
- `layouts/nexus.html`

### Supersedes
过去把数据格式、展示方式与流程绑在一起的混合说明。
