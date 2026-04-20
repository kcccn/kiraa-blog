﻿﻿# AGENTS/knowledge/dev_log.md
<!-- File: AGENTS/knowledge/dev_log.md -->

# 长期记忆与决策库

## 第一部分：核心架构决策（ADR）

### ADR-001：严禁修改 themes/FixIt/ 源码

- **决策**：所有主题定制必须通过项目级文件覆盖实现，绝对禁止直接修改 `themes/FixIt/` 目录下的任何文件
- **原因**：FixIt 以 Git Submodule 引入，直接修改会导致子模块污染，升级时产生不可合并的冲突
- **合规路径**：
  - 样式定制 → `assets/css/_custom.scss`
  - 配置调整 → `hugo.toml`（使用 `_merge = "shallow"`）
  - 模板覆盖 → 项目根目录 `layouts/` 下创建同名模板
- **违反后果**：子模块脏状态，`git submodule update` 会丢失所有修改

### ADR-002：强制使用 KaTeX 公式引擎

- **决策**：数学公式渲染统一使用 KaTeX，不得切换为 MathJax
- **原因**：KaTeX 渲染速度远快于 MathJax，适合博客场景；项目已围绕 KaTeX 配置了 Goldmark passthrough 分隔符
- **合规路径**：`hugo.toml` → `params.page.math.type = "katex"`
- **禁止操作**：
  - 不得在 `markup.goldmark.extensions` 中添加 `passthrough = false`
  - 不得删除 `markup.goldmark.renderer.unsafe = true`（文章中 `<figure>` 标签依赖此配置）

### ADR-003：严格遵守 Vue 风格配色

- **决策**：博客视觉风格统一为 Vue 配色方案，所有颜色变更必须在此体系内协调
- **核心色值**：

| 用途 | 色值 | 色名 |
|------|------|------|
| 主题色 / 链接色 | `#42b883` | Vue Green |
| 链接悬停色 | `#35495e` | Vue Dark Blue |
| 行内代码色 | `#e96900` | Vue Orange |
| 行内代码背景（亮色） | `#f8f8f8` | Light Gray |
| 行内代码背景（暗色） | `rgba(233, 105, 0, 0.15)` | 半透明橙 |
| 引用块左边框 | `#42b883` | Vue Green |
| 引用块背景 | `rgba(66, 184, 131, 0.1)` | 半透明绿 |

- **约束**：引入新颜色前必须确认与上述色值的视觉协调性

### ADR-004：样式覆盖优先级

- **决策**：样式定制必须按以下优先级选择实现方式
- **优先级链**：CSS 变量覆盖（`:root`） > SCSS 选择器覆盖（`.single .content`） > hugo.toml 配置调整 > 模板覆盖
- **原因**：CSS 变量覆盖对主题升级兼容性最好，模板覆盖风险最高

### ADR-005：暗色模式为强制验证项

- **决策**：所有样式修改必须同时验证亮色和暗色模式，缺一不可
- **原因**：FixIt 主题支持暗色模式切换，未适配暗色模式的修改会导致内容不可读
- **适配方式**：使用 `[data-theme='dark'] &` 嵌套选择器

---

## 第二部分：踩坑与日常维护记录

> 以下为日志模板。每次解决问题后，Agent 必须按此格式输出日志条目，由用户确认后追加到本文件。

### 日志条目格式

```markdown
### [YYYY-MM-DD] <事件简述>

- **事件类型**：样式修复 / 功能添加 / 配置调整 / Bug 排查 / 其他
- **触发原因**：<用户需求或问题描述>
- **踩坑点**：<遇到的关键问题，如"某 CSS 变量不生效"、"暗色模式下对比度不足"等>
- **解决方案**：<最终采用的解决方式>
- **对 Agent 的强制约束**：<基于本次踩坑总结的规则，后续必须遵守>
```

### 日志记录

### [2026-04-20] 添加 RevolverMaps 3D 访客地球到全局页脚

- **事件类型**：功能添加
- **触发原因**：需要在博客中展示站点访问者地理来源
- **踩坑点**：FixIt 主题提供了 `customPartials.footer` 扩展机制，无需覆盖整个 footer.html 模板；hugo.toml 文件存在 UTF-8 BOM 导致构建失败，需移除
- **解决方案**：通过 `customPartials.footer` 注册自定义 partial，在 `_custom.scss` 中添加居中样式，地球颜色使用 `#42b883`（ADR-003 合规）
- **对 Agent 的强制约束**：添加页脚/页头等组件时优先使用 `customPartials` 机制而非覆盖整个模板；修改 hugo.toml 前必须检查文件是否包含 UTF-8 BOM（`ef bb bf`），如有则必须移除

### [2026-04-20] 修复 RevolverMaps 地球组件未显示：从 customPartials 切换到模板覆盖

- **事件类型**：Bug 修复
- **触发原因**：RevolverMaps 3D 地球组件在前端未渲染
- **踩坑点**：`customPartials.footer` 机制经构建验证实际已成功注入 HTML 到页脚，但用户反馈前端未显示地球。根因可能是 RevolverMaps 服务 ID 无效（`5m8e0a7z6m9` 为占位值）或外部 JS 加载失败，而非 Hugo 模板层面的问题。按用户要求切换到同名模板覆盖方案（路径 D），将主题 `footer.html` 完整复制到项目 `layouts/_partials/footer.html` 并内嵌脚本
- **解决方案**：废弃 `customPartials.footer` 配置和独立 partial 文件，改用同名模板覆盖 `layouts/_partials/footer.html`，在 `footer-container` 闭合前注入 RevolverMaps 脚本
- **对 Agent 的强制约束**：使用第三方外部 JS 服务时，必须先验证服务 ID 的有效性，不得使用占位值；模板覆盖方案（路径 D）需完整复制主题源码再修改，主题升级时必须手动同步更新覆盖文件

### [2026-04-20] 废弃 RevolverMaps，切换为 ECharts 3D 地球

- **事件类型**：功能替换
- **触发原因**：RevolverMaps 在国内网络环境下加载阻塞，严重影响首屏渲染速度
- **踩坑点**：依赖特定外网通信的第三方追踪脚本在国内不可用；ECharts 地球组件需设置 `backgroundColor: 'transparent'` 和 `environment: 'transparent'` 才能兼容 FixIt 主题的亮色/暗色模式切换
- **解决方案**：在 `layouts/_partials/footer.html` 中移除 RevolverMaps 脚本，替换为 ECharts + ECharts-GL 3D 地球，通过 jsDelivr CDN 引入依赖，大气层颜色设为 `#42b883`（ADR-003），包含防报错逻辑和 resize 自适应
- **对 Agent 的强制约束**：禁止依赖特定外网通信的第三方追踪脚本，优先选用国内可达的 CDN（如 jsDelivr）；ECharts 组件必须设置透明背景以兼容主题暗色/亮色模式切换

### [2026-04-20] 修复 footer 3D 地球回归问题：恢复 customPartials 并改用本地资源

- **事件类型**：Bug 修复
- **触发原因**：review 发现 footer 3D 地球存在纹理 404、整份模板覆盖和绕过 FixIt 生命周期等风险
- **踩坑点**：此前问题根因不是 `customPartials.footer` 缺少主题钩子；FixIt 的 `custom-footer` block 实际可用。真正的问题是远程 `world.jpg` 失效、远程 `echarts-gl` 不稳定，以及 FixIt 原生 `initEcharts()` 固定使用 `renderer: 'svg'`，无法直接承载 `echarts-gl` 的 WebGL globe
- **解决方案**：删除 `layouts/_partials/footer.html` 覆盖文件，恢复 `params.customPartials.head` + `params.customPartials.footer`；在 `footer-globe-head.html` 中做页面级 `hasEcharts` 开关，在 `footer-globe.html` 中仅输出稳定的资源配置节点；在 `assets/js/custom.js` 中以 `renderer: 'canvas'` 动态插入并初始化 footer globe，并接入 FixIt 的 theme-switch / resize 事件；将 `echarts-gl` 和 `world.jpg` 固化到项目 `assets/`
- **对 Agent 的强制约束**：`customPartials.footer` 可作为页脚组件的主路径，不得因第三方资源失效误判为主题钩子失效；但由于 FixIt footer 运行在 `partialCached` 路径下，页面级分支和 `.Store.Set` 必须放在 `customPartials.head` 或 `assets/js/custom.js` 中；涉及 `echarts-gl` / WebGL 的场景，必须走项目侧 `assets/js/custom.js` 挂接 FixIt 生命周期，不得复用 FixIt 默认的 SVG ECharts 初始化路径；地球纹理和运行库优先固化到仓库本地资源，禁止依赖远程纹理 URL

### [2026-04-20] 启用 Giscus 评论系统

- **事件类型**：功能添加
- **触发原因**：为博客文章页面添加评论互动能力
- **踩坑点**：选择评论系统时需重点评估国内网络连通性（S-10 约束）；Giscus 脚本从 `giscus.app` 加载，国内偶有波动但对 AI/ML 技术受众无障碍；Waline 虽国内可达性更优，但需独立维护数据库，与当前零后端架构不匹配
- **解决方案**：在 `hugo.toml` 中启用 FixIt 原生 `params.page.comment.giscus` 配置，选择 Giscus（基于 GitHub Discussions），零后端运维，FixIt 原生支持暗色/亮色主题切换
- **对 Agent 的强制约束**：评论系统配置仅修改 `hugo.toml`，不得覆写 `layouts` 模板；Giscus 的 `repoId` 和 `categoryId` 为敏感配置，不得以占位符形式 push 到远程仓库；`mapping` 值一旦确定不得随意更改，否则会导致已有评论与文章脱钩

### [2026-04-20] 完善 Giscus 评论系统：填入真实 repoId 和 categoryId

- **事件类型**：配置完善
- **触发原因**：用户从 giscus.app 获取了真实的 `repoId`（`R_kgDORC3Ygw`）和 `categoryId`（`DIC_kwDORC3Yg84C7PuG`），替换 hugo.toml 中的占位符
- **踩坑点**：无
- **解决方案**：将 `hugo.toml` 中 `<YOUR_REPO_ID>` 替换为 `R_kgDORC3Ygw`，`<YOUR_CATEGORY_ID>` 替换为 `DIC_kwDORC3Yg84C7PuG`，构建验证通过
- **对 Agent 的强制约束**：无新增约束
