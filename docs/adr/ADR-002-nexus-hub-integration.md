# ADR-002: Nexus 集成页面

## Status

Accepted

## Date

2026-04-21

## Context

博客需要展示以下交互式内容：

1. **3D 访客地球**：可视化展示全球访客地理分布
2. **友链系统**：展示友情链接，支持友链申请
3. **留言板**：访客互动区域
4. **流量趋势**：近 14 天 UV 趋势可视化

此前这些功能分散在不同位置：

- 3D 地球曾尝试放在全局页脚，但 ECharts + ECharts-GL 体积庞大（~1MB），严重影响首屏性能
- 友链数据与展示逻辑耦合
- 缺乏统一的"空间-时间-人"叙事流

## Decision

创建 **Nexus 单页**，采用"空间-时间-人"的视觉叙事流，整合所有交互组件。

### 页面结构

| 区域 | 实现 | 说明 |
|------|------|------|
| Header | 模板 `layouts/nexus.html` | 渲染 title + subtitle |
| 3D 地球 | `#nexus-globe` 容器 + `custom.js` `initNexusGlobe()` | 页面内专属地球，独立于 footer 全局地球 |
| 赛博脉搏 | `#pulse-chart` 容器 + `custom.js` `initPulseChart()` | 近 14 天 UV 趋势折线图，SVG renderer |
| 友链 | `.Site.Data.friends` → CSS Grid 赛博卡片 | 数据源 `data/friends.yml` |
| 留言板 | FixIt 原生 `single/comment.html`（Giscus） | `comment: true` 触发 |
| Markdown 正文 | `.Content` | 支持友链申请格式说明等 |

### 数据格式

友链数据文件：`data/friends.yml`，字段：`nickname`/`avatar`/`url`/`description`。URL 值必须用双引号包裹。

### 地球隔离规则

- **全局隔离**：3D 地球脚本 100% 隔离在 `/nexus/` 单页，非 Nexus 页面不加载 echarts.min.js / echarts-gl.min.js
- `footer-globe-head.html` 和 `footer-globe.html` 已清空（仅保留注释），不得恢复
- Nexus 页面：`#nexus-globe` 页面内地球，由 `initNexusGlobe()` 初始化，`hasEcharts` 由模板内 `.Store.Set` 触发
- 非 Nexus 页面：无地球，无 echarts 加载，零性能开销

### 模板架构

`layouts/nexus.html` 为项目新增模板（非同名覆盖），主题升级无需同步。与同名模板覆盖（需手动同步）区分。

## Consequences

### 正面影响

- **首屏性能**：ECharts 仅在 Nexus 页面加载，其他页面零额外开销
- **叙事清晰**："空间（地球）→ 时间（趋势）→ 人（友链+留言）"的视觉流
- **维护便捷**：友链数据与展示逻辑分离，修改 `data/friends.yml` 即可更新
- **主题兼容**：新增模板不影响主题升级

### 负面影响

- **Nexus 页面体积**：ECharts + ECharts-GL 约 1MB，需在 Nexus 页面加载
- **模板维护**：`layouts/nexus.html` 需随 FixIt 主题基础模板变化手动同步（概率低）

### 维护约束

- Nexus 页面地球容器 `#nexus-globe` 必须在 `layouts/nexus.html` 模板内直接输出，不得通过 customPartials 注入
- 友链数据必须放 `data/friends.yml`，复用 `.Site.Data.friends` 路径
- YAML 数据文件中的 URL 值必须用双引号包裹
- `footer-globe-head.html` 和 `footer-globe.html` 必须保持为空（仅注释），禁止恢复全局 footer 地球
