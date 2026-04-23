# Kiraa Blog 实现品味指南

本文档只记录可复用的实现品味，不收录一次性技巧。它关注的是“什么样的改动更像这个仓库的代码”，而不是泛泛的前端空话。

本文档属于 agent-maintained active memory。所有长期规则都必须使用 `Rule / Why / Scope / Source / Supersedes` 结构；遇到同义结论时优先合并，不要重复堆条目。

## 使用方式

- 处理主题/UI 任务，或用户要求“更有 taste”“更干净”“更稳”时先读它。
- 读完后结合 `docs/agents/architecture.md` 的相关章节再动手。
- 只有当某种偏好跨越多个任务仍然成立时，才值得写进这里。

## 高信号规则

### Rule
优先选择项目侧扩展，而不是 theme fork。

### Why
这个仓库里的“好改动”首先意味着改动面最小、最耐维护；一个干净的项目侧覆盖，优于对上游主题内部做聪明但脆弱的补丁。

### Scope
Hugo/FixIt 定制、样式覆盖、模板扩展、partial 插入。

### Source
- `docs/adr/ADR-002-nexus-hub-integration.md`
- `layouts/`
- `assets/`

### Supersedes
旧 persona 文件里对同一原则的冗长描述。

### Rule
高成本 JavaScript 默认保持页面级隔离，除非功能本身确实属于全局体验。

### Why
站点默认应当安静、快速；像 ECharts-GL 这样的重交互库，只有在确实需要的页面上才值得承受体积与生命周期复杂度。

### Scope
交互图表、3D 地球、大型运行库、页面级视觉效果。

### Source
- `docs/adr/ADR-002-nexus-hub-integration.md`
- `docs/adr/ADR-003-3d-globe-stability-ux-optimization.md`
- `assets/js/custom.js`

### Supersedes
围绕 footer globe 试验产生的早期实现偏好。

### Rule
优先本地资源与优雅降级，避免脆弱的第三方运行时依赖。

### Why
一个能稳定显示兜底效果的页面，优于一个偶尔惊艳、偶尔彻底失效的页面。

### Scope
贴图、图标、运行库、外部视觉依赖与动态数据入口。

### Source
- `docs/adr/ADR-003-3d-globe-stability-ux-optimization.md`
- `docs/adr/ADR-004-serverless-traffic-telemetry.md`
- `assets/js/custom.js`

### Supersedes
对单个外部服务失效事件的历史总结。

### Rule
亮色与暗色模式同时正确，才算实现完成。

### Why
在这个仓库里，单主题下看起来正常不等于真正完成；主题切换后的对比度、加载态、交互态同样属于交付质量。

### Scope
CSS、图表、loading 状态、hover 状态、代码与正文可读性。

### Source
- `hugo.toml`
- `assets/js/custom.js`
- `assets/css/`

### Supersedes
把暗色模式当作后置验收项的旧做法。

### Rule
保持 data、config、render 三层职责分离。

### Why
当数据文件保持朴素、配置保持声明式、渲染逻辑留在可控生命周期中时，代码会更干净，也更容易维护。

### Scope
友链、评论、流量配置、页面元数据、Nexus 页面组装。

### Source
- `data/friends.yml`
- `hugo.toml`
- `layouts/nexus.html`
- `api/visit.js`

### Supersedes
过去把数据结构与模板行为混写在同一份文档中的习惯。

### Rule
不要轻易“简化掉”已经解决过真实问题的稳定性护栏，除非你能证明这些护栏已经过时。

### Why
这个仓库里一些看起来复杂的代码，是由真实线上问题换来的；单纯为了让 diff 更短而删除它们，通常会带来回归。

### Scope
globe 生命周期、telemetry 仲裁、图片优化、内容渲染边界。

### Source
- `docs/adr/ADR-003-3d-globe-stability-ux-optimization.md`
- `docs/adr/ADR-004-serverless-traffic-telemetry.md`
- `assets/js/custom.js`
- `api/visit.js`

### Supersedes
按事件拆散记录的历史踩坑笔记。

### Rule
高成本 WebGL 组件在资源 ready 前保持宿主容器未就绪态，ready 后再 reveal，避免把最终画面直接硬切到页面上。

### Why
对这类组件来说，稳定感不仅来自正确渲染，还来自正确显现。先完成资源预加载，再由宿主容器接管渐显，能避免白闪和生硬跳变。

### Scope
`Nexus` 地球这类依赖贴图预加载、WebGL 初始化或 fallback 路径的重视觉组件。

### Source
- `docs/adr/ADR-003-3d-globe-stability-ux-optimization.md`
- `assets/js/custom.js`
- `assets/css/_custom.scss`

### Supersedes
只关注资源 ready、忽略容器 reveal 节奏的旧实现。

### Rule
高成本 WebGL 组件的 loading 态应由宿主容器控制，而不是直接把第三方默认 overlay 暴露给最终 UI。

### Why
第三方默认 loading 层通常不理解当前主题、页面气质与最终动效节奏，尤其在暗色模式下容易产生白块、方形爆闪和突兀文案。

### Scope
`Nexus` 地球这类带贴图预加载、fallback 和主题切换重建的 WebGL 视觉组件。

### Source
- `docs/adr/ADR-003-3d-globe-stability-ux-optimization.md`
- `assets/js/custom.js`
- `assets/css/_custom.scss`

### Supersedes
把第三方默认 loading overlay 直接交给用户看的旧做法。

### Rule
无缝循环滚动使用首尾克隆法，两排同步滚动需要独立状态管理。

### Why
两排卡片数量不同时，scrollWidth 不同，共享同一个 position 会导致边界检测不同步；独立状态管理确保每排都能正确处理边界，同时保持同步滚动。

### Scope
服务卡片橱窗、友链滚动、任何需要多排同步滚动的组件。

### Source
- `assets/js/custom.js` - `initServiceCarousel()`
- `layouts/nexus.html`

### Supersedes
单排滚动或共享状态的旧实现。

### Rule
拖拽交互使用 Pointer Events 统一处理鼠标和触摸，避免分别绑定 mouse 和 touch 事件。

### Why
Pointer Events API 提供统一的接口，自动处理鼠标、触摸和笔输入，减少代码复杂度和事件冲突。

### Scope
可拖拽容器、滚动区域、任何需要同时支持鼠标和触摸的交互组件。

### Source
- `assets/js/custom.js` - `initServiceCarousel()`

### Supersedes
分别绑定 mousedown/mousemove/mouseup 和 touchstart/touchmove/touchend 的旧做法。

### Rule
滚动动画中避免频繁位置规范化，只在显示时计算规范化位置，保持实际位置累积。

### Why
频繁修改实际位置会导致跳变和卡顿；分离显示位置和实际位置，延迟边界检测，可以确保平滑过渡。

### Scope
无缝循环滚动、拖拽交互、任何需要边界检测的动画。

### Source
- `assets/js/custom.js` - `normalizePosition()`, `updateAllCarousels()`

### Supersedes
每次更新都规范化位置的旧实现。

## 反模式

- 直接修改 `themes/FixIt/`，而不是通过项目侧覆盖实现
- 让页面级实验变成全站必须支付的运行时成本
- 用远程运行时依赖替换本地资源，但又没有兜底策略
- 只修亮色或只修暗色，留下另一套主题破损
- 明明可以靠数据文件或配置解决，却把内容结构硬耦合进模板内部
- 因为本地 happy path 可用，就删除 `assets/js/custom.js` 或 `api/visit.js` 中的稳定性护栏
