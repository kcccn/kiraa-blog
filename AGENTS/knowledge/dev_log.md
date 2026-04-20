﻿﻿﻿﻿﻿﻿﻿﻿﻿# AGENTS/knowledge/dev_log.md
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
