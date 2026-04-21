﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿# AGENTS/knowledge/dev_log.md
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

### [2026-04-21] 构建 Nexus 集成页面：3D 地球 + 友链 + 留言板

- **事件类型**：功能添加
- **触发原因**：需要创建集 3D 地球、友链、留言板于一体的顶级页面
- **踩坑点**：FixIt 的 `customPartials.postContentBefore` 等 block 仅在 `posts/single.html` 中存在，`page.html` 无此 block，无法通过 customPartials 向普通页面注入内容区组件；footer partial 运行在 `partialCached` 下不可做页面级分支（S-14）；因此 Nexus 页面的地球容器必须内嵌在专用模板中；`data/friends.yml` 必须用引号包裹 URL 值，否则 Hugo YAML 解析器报错 `mapping value is not allowed in this context`；Write 工具生成的文件可能带 UTF-8 BOM，必须检查并移除（S-07）
- **解决方案**：创建 `layouts/nexus.html` 专用模板（新增文件，非同名覆盖），内嵌地球容器 `#nexus-globe`；友链数据放 `data/friends.yml` 复用 FixIt 原生 `.Site.Data.friends` 路径；在 `custom.js` 中新增 `initNexusGlobe()` 独立初始化逻辑；在 `footer-globe-head.html` 中排除 Nexus 页面避免双地球
- **对 Agent 的强制约束**：Nexus 页面地球容器 `#nexus-globe` 必须在 `layouts/nexus.html` 模板内直接输出，不得通过 customPartials 注入（page 类型无 postContentBefore block）；Nexus 页面的 `hasEcharts` Store 在模板 `define "content"` 内设置，不依赖 footer-globe-head.html；友链数据必须放 `data/friends.yml` 以复用 `.Site.Data.friends` 路径；YAML 数据文件中的 URL 值必须用双引号包裹

### [2026-04-21] 地球脚本单页化隔离：移除全局 footer 地球，echarts 仅 Nexus 页面加载

- **事件类型**：架构重构
- **触发原因**：ECharts + ECharts-GL 体积庞大，每页全局加载严重影响首屏性能（FCP）和移动端带宽；3D 地球应 100% 隔离在 `/nexus/` 单页
- **踩坑点**：`footer-globe-head.html` 和 `footer-globe.html` 两个 customPartials 曾负责全局设置 `hasEcharts` Store 和输出 `#footer-globe-config`；清空这两个 partial 后，非 Nexus 页面不再加载 echarts.min.js（`.Store.Get "hasEcharts"` 为 false），Nexus 页面通过模板内 `.Store.Set "hasEcharts" true` 独立触发；`custom.js` 中 footer 地球代码变为死代码但不影响功能（`boot()` 检测不到 DOM 元素自动跳过）
- **解决方案**：清空 `footer-globe-head.html`（仅保留注释）和 `footer-globe.html`（仅保留注释）；Nexus 页面的 echarts 加载完全由 `layouts/nexus.html` 模板内的 `.Store.Set "hasEcharts" true` 控制；地球容器改为 `width:100%; height:50vh` 响应式尺寸；友链 Grid 从 `minmax(160px)` 扩展为 `minmax(200px)`；头像从 64px 增大到 80px；正文精简为一行友链申请提示
- **对 Agent 的强制约束**：3D 地球脚本 100% 隔离在 `/nexus/` 单页，禁止恢复全局 footer 地球加载；`footer-globe-head.html` 和 `footer-globe.html` 必须保持为空（仅注释），不得恢复 `hasEcharts` Store 设置或 `#footer-globe-config` 输出；非 Nexus 页面不得加载 echarts.min.js 或 echarts-gl.min.js

### [2026-04-20] 新增 Vercel Serverless Function：访客位置收集 API

- **事件类型**：功能添加
- **触发原因**：为 3D 地球提供真实访客经纬度数据，替代纯前端模拟数据
- **踩坑点**：Vercel Serverless Function 需放在 `api/` 目录下，文件名即路由路径；`@upstash/redis` 为 HTTP-based Redis 客户端，适合 Serverless 无连接池场景；`ip-api.com` 免费额度为 45 请求/分钟，对博客场景足够
- **解决方案**：创建 `api/visit.js`，通过 `x-forwarded-for` 获取访客 IP，调用 `ip-api.com` 解析经纬度，存入 Upstash Redis Set，返回全量坐标数组；初始化 `package.json` 并安装 `@upstash/redis`；创建 `.gitignore` 排除 `node_modules/`
- **对 Agent 的强制约束**：Vercel API 路由必须放在 `api/` 目录下；环境变量（`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`）不得硬编码到代码中，必须通过 Vercel 后台配置

### [2026-04-20] 重构 3D 地球：添加 scatter3D 发光热力散点 + 对接 /api/visit

- **事件类型**：功能重构
- **触发原因**：为地球添加真实访客分布可视化，实现坐标点越密集越亮的赛博朋克发光效果
- **踩坑点**：`map3D` 不支持叠加 `scatter3D`，必须使用 `globe` 组件；`blendMode: 'lighter'` 是实现加色混合发光的关键配置，重叠点亮度指数级增加；前端 API 调用失败时必须降级到本地模拟数据以保证美观
- **解决方案**：在 `assets/js/custom.js` 中重构 `buildOption()`，添加 `scatter3D` 系列（`blendMode: 'lighter'`、`symbolSize: 3`、颜色 `#42b883`）；新增 `fetchVisitCoords()` 对接 `/api/visit`；新增 `FALLBACK_COORDS`（15 个全球区域 ~258 个模拟坐标）作为降级数据；设置 `environment: 'transparent'` 和 `zoomSensitivity: 0`
- **对 Agent 的强制约束**：`scatter3D` 必须配合 `globe` 组件使用，不可用于 `map3D`；外部 API 调用必须提供降级数据，不得因后端不可用导致地球空白；`blendMode: 'lighter'` 为发光效果核心配置，不得移除

### [2026-04-20] 修复 3D 地球 4 个致命 Bug：黑框、写实贴图、散点乱飞、API 确认

- **事件类型**：Bug 修复
- **触发原因**：地球出现黑色背景框、仍为写实卫星图风格、散点脱离地球表面乱飞
- **踩坑点**：`environment: 'transparent'` 在 ECharts-GL 中不等于无背景，WebGL canvas 仍保留黑色底色，必须设为 `''`（空字符串）彻底禁用星空；`shading: 'lambert'` 产生真实光影不适合赛博风格，必须切换为 `shading: 'color'`；scatter3D 数据格式 `[lon, lat, value]` 中第三个参数被解释为海拔高度，`1` 表示地球半径的 1 倍导致点飞出表面，必须为 `0`；`api/visit.js` 已包含完整后端逻辑无需重写
- **解决方案**：`environment: 'transparent'` → `environment: ''`；`baseTexture` 从本地 `world.jpg` 切换为 ECharts 官方深色灰度地图 CDN（bathymetry_bw_composite_4k.jpg）；`shading: 'lambert'` → `shading: 'color'`；所有散点数据第三维从 `1` 改为 `0`；降低光照强度（main: 0.6, ambient: 0.15）让地球更暗突出大气层发光
- **对 Agent 的强制约束**：ECharts-GL `globe.environment` 必须设为 `''`（空字符串）而非 `'transparent'` 以消除黑框；scatter3D 数据第三维（海拔）必须为 `0`，非零值会导致点脱离地球表面；赛博风格地球必须使用 `shading: 'color'` 而非 `'lambert'`

### [2026-04-20] 从单张 JPG 全自动生成并替换网站 Favicon

- **事件类型**：功能添加
- **触发原因**：替换 FixIt 主题默认图标为自定义品牌图标
- **踩坑点**：FixIt 主题 `link.html` 硬编码引用 `/favicon.ico`、`/favicon-32x32.png`、`/favicon-16x16.png`、`/apple-touch-icon.png`，只需在项目 `static/` 下放置同名文件即可覆盖，无需修改模板；`tileColor`（Windows 磁贴颜色）默认为 `#da532c`，需显式配置为 `#42b883`；转换脚本和源图不应纳入 git 追踪
- **解决方案**：编写 Python Pillow 脚本 `scripts/gen_favicon.py` 从 `logo.jpg` 自动生成 4 个标准尺寸图标到 `static/`；在 `hugo.toml` 中设置 `iconColor`、`tileColor` 为 `#42b883`，`themeColor` 亮色/暗色均为 `#42b883`；在 `.gitignore` 中排除 `logo.jpg` 和 `scripts/`
- **对 Agent 的强制约束**：针对图标等无需编译的静态资源替换，必须放置在项目根目录的 `static/` 下进行静默覆盖，禁止修改 `themes/FixIt/static/` 下的文件

### [2026-04-20] 修复 Cloudflare + Vercel 架构下 IP 解析与地理编码失败

- **事件类型**：Bug 修复
- **触发原因**：域名切换后 Vercel Logs 为空（前端请求未到达后端），北京 IP 识别失败（合肥点亮但北京不亮）
- **踩坑点**：Cloudflare 代理下 `x-forwarded-for` 第一个 IP 可能是 CF 节点而非真实用户 IP，必须优先读取 `cf-connecting-ip`；`172.` 前缀过滤过宽，`172.16.0.0/12` 才是私有 IP 范围（172.16-172.31），原代码过滤了所有 `172.*` 导致部分公网 IP 被误判为内网；`ip-api.com` 免费版仅支持 HTTP 不支持 HTTPS，在 HTTPS 环境下可能被安全策略阻止；Vercel Logs 无任何调试输出无法定位问题
- **解决方案**：`getClientIP()` 优先级改为 `cf-connecting-ip` > `x-real-ip` > `x-forwarded-for` > `remoteAddress`；`isPrivateIP()` 精确过滤 `172.16.0.0/12`（仅 172.16-172.31）；地理编码主服务切换为 `ipapi.co`（支持 HTTPS），`ip-api.com` 降级为备用；handler 中添加 `console.log` 输出 IP 和 Header 信息；前端 `fetchVisitCoords()` 添加状态码和错误日志
- **对 Agent 的强制约束**：Cloudflare 代理架构下 IP 获取必须优先读取 `cf-connecting-ip`；私有 IP 判断 `172.` 前缀必须限定 `172.16.0.0/12` 范围，不得过滤所有 `172.*`；地理编码服务必须优先使用支持 HTTPS 的 API（如 `ipapi.co`），HTTP-only 服务仅作降级备用；后端 API 必须包含调试日志以便 Vercel Logs 排查

### [2026-04-20] 升级访客坐标系统：Vercel Header 优先 + 日期后缀 + 三位小数

- **事件类型**：功能升级
- **触发原因**：同一坐标重复访问不叠加（Set 去重），无法实现热力效果；外部 API 调用延迟高且有限额；坐标精度不足
- **踩坑点**：Vercel 原生提供 `x-vercel-ip-latitude` / `x-vercel-ip-longitude` Header，零延迟零外部调用，但之前未使用；Set 成员格式 `"lon,lat"` 导致同一坐标去重无法叠加；两位小数精度约 1.1km，三位小数约 110m 更精确；短时间大量访问会冲爆数据库，需天级精度防刷
- **解决方案**：坐标获取优先级改为 Vercel Header > ipapi.co > ip-api.com；Set 成员格式改为 `"lon,lat,YYYY-MM-DD"`（三位小数 + 日期后缀），同一坐标不同天产生不同成员实现叠加发光；`migrateOldFormat()` 自动检测并清空旧格式数据；前端 `fetchVisitCoords()` 将 `[lon, lat, day]` 映射为 `[lon, lat, 0]`（海拔 0，S-23）
- **对 Agent 的强制约束**：坐标获取必须优先读取 Vercel Header（`x-vercel-ip-latitude`/`x-vercel-ip-longitude`），外部 API 仅作降级；坐标精度必须为三位小数（`toFixed(3)`）；Set 成员必须追加日期后缀（`YYYY-MM-DD`）实现同坐标多天叠加

### [2026-04-20] 接入 CF Managed Transforms，修复双重代理定位偏移

- **事件类型**：功能重构
- **触发原因**：Vercel Header 在 CF 代理下返回机房坐标而非用户位置，导致定位偏移
- **踩坑点**：CF → Vercel 双重代理下 `x-vercel-ip-*` 返回 Vercel 入口机房坐标（如 Washington DC）；CF Managed Transforms 提供 `cf-iplatitude`/`cf-iplongitude` 标头，直接反映用户真实位置；Vercel Header 仅在无 CF 代理时可信，需通过 `cf-connecting-ip` 存在性判断
- **解决方案**：坐标获取优先级改为 `cf-iplatitude/longitude` > `x-vercel-ip-*`（仅无 CF 代理时） > `ipapi.co` > `ip-api.com`；新增 `geoLocateFromCFHeader()` 读取 CF 标头；`geoLocate()` 中通过 `cf-connecting-ip` 存在性条件化使用 Vercel Header
- **对 Agent 的强制约束**：坐标获取必须优先校验 `cf-iplatitude`/`cf-iplongitude`（CF Managed Transforms）；Vercel Header 仅在无 `cf-connecting-ip` 时使用，双重代理下会返回机房坐标

### [2026-04-20] 全域高精度地理仲裁引擎：多源并行仲裁 + IP 深度清洗 + 5G 纠偏

- **事件类型**：架构重构
- **触发原因**：5G 异地出口导致 CF Header 返回大区出口坐标（如上海）而非物理位置（如合肥）；代理 IP 识别错误；ipapi.co 被 CF 安全验证拦截；顺序降级延迟过高
- **踩坑点**：5G 运营商出口 IP 的 CF 定位偏移可达数百公里；`ip-api.com` 的 `as` 字段包含运营商信息（如 China Mobile），可用于纠偏；顺序降级最坏情况需等待 3 个 API 超时（4.5s）；Vercel 内部网关 IP（35.241.x 等）不应作为访客 IP
- **解决方案**：`getClientIP()` 改为候选列表遍历 + 私有 IP/网关 IP 过滤；`geoLocate()` 改为 `Promise.allSettled` 并行请求 CF Header + ip-api.com + ipapi.co（1.5s 超时）；`arbitrate()` 仲裁算法：CF vs ip-api.com 距离 >100km 且 ip-api 返回运营商信息时强制采用 ip-api 结果；`haversineKm()` 球面距离计算；`isCarrierIP()` 运营商关键词匹配；`migrateOldFormat()` 强制清空旧数据；`getAllCoords()` 增加非法坐标过滤（经度 >180、纬度 >90）
- **对 Agent 的强制约束**：地理定位必须使用多源并行仲裁（`Promise.allSettled`），禁止顺序降级；`ip-api.com` 必须获取 `as` 字段用于运营商纠偏；IP 获取必须过滤 Vercel 内部网关 IP；部署后需将 `migrateOldFormat()` 恢复为仅格式检测（当前为强制清空）

### [2026-04-20] VPN/机房节点识别与数据染色系统

- **事件类型**：功能升级
- **触发原因**：VPN/代理/云机房访问产生的坐标不代表真实访客位置，需自动识别并差异化展示
- **踩坑点**：`ip-api.com` 提供 `proxy` 和 `hosting` 字段可直接判断代理/机房 IP；云厂商 AS 字段（如 AWS、Azure）可作为补充判断依据；CF Header 和 ipapi.co 无法提供 proxy 信息，需从并行的 ip-api 结果中继承 `isProxy` 标记
- **解决方案**：`geoLocateFromIPAPIFull()` 扩展 `fields` 增加 `proxy,hosting`；新增 `CLOUD_KEYWORDS` 常量和 `isCloudProvider()` 函数；新增 `computeIsProxy()` 联合判定（`proxy || hosting || isCloudProvider(as)`）；`arbitrate()` 所有返回路径携带 `isProxy` 字段，CF 胜出时仍从 ip-api 继承 `isProxy`；`storeCoord()` 格式升级为 `lon,lat,YYYY-MM-DD,isProxy`；`getAllCoords()` 兼容三段/四段解析；前端 `buildOption()` 拆分双 series（真实用户 `#42b883` + 代理节点 `#ff6b6b` 幽灵红半透明）；迁移 key 升级为 `v4`
- **对 Agent 的强制约束**：`isProxy` 标记必须从 ip-api.com 的 `proxy/hosting` 字段及 AS 云厂商关键词联合判定；存储格式必须为四段式 `lon,lat,YYYY-MM-DD,isProxy`；前端必须拆分双 series 差异化显示

### [2026-04-20] V7.1 架构升级：弱指纹 + 双键分离聚合 + 熔断器

- **事件类型**：架构重构
- **触发原因**：NAT 下多设备共享 IP 导致坐标丢失；单 Set 架构无法实现权重聚合；ip-api 429 限流无保护；真实 IP 存储存在 PII 风险
- **踩坑点**：NAT 网关下数百用户共享同一出口 IP，单 IP 去重导致只记录一次；Redis `KEYS` 命令是 O(N) 阻塞扫描，生产环境严禁使用；ECharts-GL scatter3D 的 `symbolSize`/`opacity` 函数回调兼容性不稳定，需预计算
- **解决方案**：弱指纹 `SHA256(IP|UA|Lang)[:8]` 替代 IP 去重；双键分离 `geo:uv:{day}`（Set 去重）+ `geo:heat:{day}`（Hash 聚合）；`SADD` 返回值判断新设备；`HINCRBY` 原子累加权重；30 天固定日期 Pipeline 读取（禁止 `KEYS`）；ip-api 429 触发 60s 熔断器；时区偏差 >30h 判定代理；前端预计算 symbolSize + RGBA 颜色
- **对 Agent 的强制约束**：禁止存储真实 IP，必须使用弱指纹；去重与聚合必须使用双键分离；禁止使用 Redis `KEYS` 命令；ip-api 429 必须触发熔断器；前端视觉属性必须预计算，禁止依赖 ECharts-GL 函数回调

### [2026-04-20] 红绿仲裁简化：仅保留时区偏差判定

- **事件类型**：逻辑简化
- **触发原因**：`isProxy`/`hosting`/`cloudProvider` 判定过于激进，大量正常用户被误标为红色基建节点；时区偏差是最可靠的代理检测信号
- **踩坑点**：`proxy/hosting` 字段误报率高（企业专线、CDN 节点均被标记）；云厂商 AS 关键词匹配过于宽泛（阿里云/腾讯云国内用户大量命中）
- **解决方案**：`computeType()` 移除 `isProxy`/`hosting`/`cloudProvider` 判定，仅保留时区偏差 >30h 判定；迁移 key 升级为 `v8`，一次性清空 60 天 `geo:uv:*` + `geo:heat:*` 数据；地球容器从 250px 放大至 500px
- **对 Agent 的强制约束**：红绿仲裁仅使用时区偏差判定，禁止引入 `proxy/hosting`/AS 关键词等其他信号

### [2026-04-21] 去除 30 天数据清除机制，数据永久保留

- **事件类型**：架构重构
- **触发原因**：30 天 TTL 导致历史访客热力数据自动清除，无法展示长期访问趋势
- **踩坑点**：原架构使用固定 30 天日期列表读取数据，移除 TTL 后需改为动态日期注册表（`geo:days` Set）才能读取全量历史数据；`geo:days` 注册表需在每次写入热力数据时同步维护，否则会出现数据存在但无法被读取的不一致问题
- **解决方案**：移除 `geo:uv:{day}` 的 7 天 TTL 和 `geo:heat:{day}` 的 31 天 TTL；新增 `geo:days` 全局日期注册表 Set，写入热力数据时 `SADD` 当天日期；`getHeatmapData()` 从 `SMEMBERS geo:days` 动态获取全部日期替代固定 30 天窗口；迁移 key 升级为 `v10`，迁移时回填最近 365 天的 `geo:heat:*` 日期到 `geo:days` 并 `PERSIST` 移除旧 TTL，保留全部历史数据
- **对 Agent 的强制约束**：热力数据永久保留，禁止设置 TTL；写入热力数据时必须同步注册日期到 `geo:days` Set；多日读取必须使用 `SMEMBERS geo:days` + Pipeline，禁止使用固定日期列表或 `KEYS` 命令

### [2026-04-21] 地球散点重构：分桶图层叠加渲染，权重驱动半径 + 径向渐变模拟

- **事件类型**：功能重构
- **触发原因**：需要根据累计访问次数动态调整散点半径，并实现中心亮边缘暗的渐变效果
- **踩坑点**：ECharts-GL `scatter3D` 基于 WebGL 渲染管线，不支持 `symbolSize` 和 `itemStyle.color` 的函数回调，也不支持 `RadialGradient`；必须通过预计算分桶 + 多层 series 叠加 + `blendMode: 'lighter'` 加色混合来近似实现
- **解决方案**：将坐标数据按权重分 4 桶（S:1 / M:2-5 / L:6-15 / XL:16+），每桶拆为核心层（小尺寸高透明度）和外晕层（大尺寸低透明度），共最多 16 个 series；`blendMode: 'lighter'` 使重叠区域自然更亮，模拟径向渐变；半径保底 3px 确保单次访问可见
- **对 Agent 的强制约束**：WebGL `scatter3D` 环境下绝对禁止使用函数回调配置 size 和 color，必须采用分桶图层生成独立 series 的静态策略；散点半径保底 `symbolSize ≥ 3`

### [2026-04-21] 回归单点模式，移除大小累计与渐变

- **事件类型**：功能回退
- **触发原因**：分桶图层叠加渲染效果不符合预期，回归简洁统一小圆点
- **踩坑点**：无新增
- **解决方案**：回退 `buildOption()` 为 2 series 固定 symbolSize 模式，丢弃 weight 维度
- **对 Agent 的强制约束**：无新增约束
