﻿﻿﻿﻿﻿﻿﻿﻿# AGENTS/knowledge/blog_specs.md
<!-- File: AGENTS/knowledge/blog_specs.md -->

# Kiraa-Blog 项目规约

## 1. Hugo 同名文件覆盖优先级规则

Hugo 在加载模板和资源时遵循**项目优先**原则：当项目根目录和主题目录存在同名文件时，项目根目录的文件优先加载，主题文件被忽略。

### 1.1 资源文件覆盖

```
项目 assets/  >  主题 themes/FixIt/assets/
```

| 项目文件 | 主题文件 | 行为 |
|----------|----------|------|
| `assets/css/_custom.scss` | `themes/FixIt/assets/css/_custom.scss` | 项目文件**完全替代**主题文件 |
| `assets/js/custom.js` | `themes/FixIt/assets/js/custom.js` | 项目文件**完全替代**主题文件 |

**关键规则**：`_custom.scss` 是**替代**而非追加。项目根目录的 `assets/css/_custom.scss` 会完全替代主题中的同名文件。因此，项目自定义样式必须在该文件中完整包含所有需要的覆盖规则，不可仅写增量部分。

### 1.2 模板文件覆盖

```
项目 layouts/  >  主题 themes/FixIt/layouts/
```

| 项目文件 | 主题文件 | 行为 |
|----------|----------|------|
| `layouts/_default/single.html` | `themes/FixIt/layouts/_default/single.html` | 项目模板替代主题模板 |
| `layouts/_partials/header.html` | `themes/FixIt/layouts/_partials/header.html` | 项目模板替代主题模板 |

**关键规则**：模板覆盖是全文件替代。如需微调，应在项目模板中通过 `{{ block }}` / `{{ define }}` 机制扩展。

### 1.3 配置合并规则

```toml
[outputs]
  _merge = "shallow"    # 项目值覆盖主题默认值，未指定的保留主题默认

[taxonomies]
  _merge = "shallow"    # 同上
```

| `_merge` 值 | 行为 |
|-------------|------|
| `"none"` / 不设置 | 项目配置完全替代主题配置（默认） |
| `"shallow"` | 项目配置与主题配置浅合并，项目值优先 |
| `"deep"` | 项目配置与主题配置深度合并 |

当前项目使用 `"shallow"`，确保主题内置的输出格式和分类法不被丢失。

---

## 2. FixIt customPartials 扩展机制

FixIt 主题内置 `customPartials` 配置，允许在不覆盖模板文件的前提下向特定区域注入自定义 HTML 片段。

### 2.1 配置方式

在 `hugo.toml` 中通过 `params.customPartials` 注册自定义 partial 文件路径：

```toml
[params.customPartials]
  footer = ["custom/footer-globe.html"]
```

### 2.2 可用注入点

| 注入点 | 配置键 | 说明 |
|--------|--------|------|
| `<head>` 区域 | `head` | 自定义 CSS/JS 引入 |
| 桌面导航栏 | `menuDesktop` | 桌面端菜单扩展 |
| 移动导航栏 | `menuMobile` | 移动端菜单扩展 |
| 首页个人资料 | `profile` | 首页头像区域扩展 |
| 侧边栏 | `aside` | 侧边栏组件注入 |
| 评论区 | `comment` | 自定义评论系统 |
| **页脚** | **footer** | **全局页脚组件注入** |
| 小部件 | `widgets` | 自定义小部件 |
| 底部资源 | `assets` | 页面底部 JS/CSS 注入 |
| 文章 TOC 前 | `postTocBefore` | 文章目录前插入内容 |
| 文章 TOC 后 | `postTocAfter` | 文章目录后插入内容 |
| 文章正文前 | `postContentBefore` | 文章正文前插入内容 |
| 文章正文后 | `postContentAfter` | 文章正文后插入内容 |
| 文章页脚前 | `postFooterBefore` | 文章页脚前插入内容 |
| 文章页脚后 | `postFooterAfter` | 文章页脚后插入内容 |

### 2.3 自定义 partial 文件位置

自定义 partial 文件必须放在项目 `layouts/_partials/` 目录下，配置中填写相对于 `layouts/_partials/` 的路径：

```
layouts/_partials/custom/revolvermaps.html  →  配置值: "custom/revolvermaps.html"
```

### 2.4 优先级与局限性

`customPartials` 机制**优先于**模板覆盖。当只需向特定区域注入内容时，应优先使用 `customPartials` 而非覆盖整个模板文件，以减少对主题升级的影响。

**局限性**：`customPartials` 依赖主题模板中对应的 `{{ block }}` 钩子才能生效。如果主题的某个模板未包含对应钩子，则 `customPartials` 注入的内容不会被渲染。当 `customPartials` 不满足需求时，需降级为同名模板覆盖方案（路径 D）。

**额外注意**：FixIt 的 `custom-footer` 运行在 `partialCached "footer.html"` 路径下。也就是说，页脚 custom partial 内不适合放“依赖当前页面上下文变化”的逻辑，例如：

- 在 footer partial 内按页面类型做条件分支
- 在 footer partial 内调用 `.Store.Set "hasEcharts" true`
- 在 footer partial 内直接输出只应出现在特定页面的动态 DOM

这类页面级逻辑应前移到 `customPartials.head` 或后移到 `assets/js/custom.js`。

### 2.5 脚本顺序约束

FixIt 的 `custom-assets` block 位于 `theme.js` **之后**。因此，凡是要求“在主题初始化前就必须存在”的库，不应通过 `customPartials.assets` 注入，而应采用以下路径：

```
customPartials.head 设置页面级 Store / 开关
        +
customPartials.footer 输出稳定的配置节点
        +
assets/js/custom.js 负责运行时注入 DOM 与初始化
        +
assets/ 本地资源提供 JS / 图片
```

### 2.6 Footer 3D 地球集成规范

页脚 3D 地球的标准集成方式为：

1. 在 `hugo.toml` 中注册 `params.customPartials.head` 与 `params.customPartials.footer`
2. 在 `layouts/_partials/custom/footer-globe-head.html` 中做页面级判定，并调用 `.Store.Set "hasEcharts" true`
3. 在 `layouts/_partials/custom/footer-globe.html` 中仅输出稳定的资源配置节点，不在该 partial 中放页面级分支
4. 在 `assets/js/custom.js` 中复用 FixIt 注入的 `echarts` 核心与 theme-switch / resize 生命周期，并在允许运行的页面动态插入地球 DOM
5. 将 `echarts-gl` 与底图纹理放入项目 `assets/`，禁止依赖远程纹理 URL

### 2.7 3D 地球视觉与数据规范

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 渲染组件 | `globe` | `map3D` 不支持叠加 `scatter3D` |
| 背景透明 | `backgroundColor: 'transparent'` + `environment: ''` | `''` 彻底禁用星空黑框，`'transparent'` 无效 |
| 贴图 | `bathymetry_bw_composite_4k.jpg`（CDN） | 深色灰度地图，赛博风格 |
| 材质 | `shading: 'color'` | 无光影，纯色暗化，配合发光大气层 |
| 大气层颜色 | `#42b883`（Vue Green） | ADR-003 合规 |
| 散点系列 | `scatter3D` + `blendMode: 'lighter'` | 加色混合，越密集越亮 |
| 散点颜色 | `#42b883` | ADR-003 合规 |
| 散点大小 | `symbolSize: 3` | 精致感 |
| 散点海拔 | 第三维必须为 `0` | 非零值导致点脱离地球表面 |
| 自动旋转 | `autoRotate: true` | 持续动态 |
| 禁用缩放 | `zoomSensitivity: 0` | 防裁切 |
| 数据源 | `/api/visit`（真实） → `FALLBACK_COORDS`（降级） | API 失败时自动降级 |

### 2.8 Favicon 规范

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 源图 | `logo.jpg`（项目根目录，不纳入 git） | 一次性转换源 |
| 生成脚本 | `scripts/gen_favicon.py`（不纳入 git） | Python Pillow 自动生成 |
| `favicon.ico` | `static/favicon.ico`（16×16 + 32×32） | 桌面浏览器标签图标 |
| `favicon-32x32.png` | `static/favicon-32x32.png` | 标准 PNG 图标 |
| `favicon-16x16.png` | `static/favicon-16x16.png` | 小尺寸 PNG 图标 |
| `apple-touch-icon.png` | `static/apple-touch-icon.png`（180×180） | iOS 桌面快捷方式 |
| `iconColor` | `#42b883` | Safari mask-icon 颜色（ADR-003） |
| `tileColor` | `#42b883` | Windows 磁贴颜色（ADR-003） |
| `themeColor` | `#42b883`（亮色/暗色） | 移动端状态栏颜色（ADR-003） |

**覆盖机制**：项目 `static/` 下同名文件自动覆盖 `themes/FixIt/static/`，无需修改模板（S-25）。

---

## 3. 同名模板覆盖实操规范

### 3.1 操作步骤

1. 从 `themes/FixIt/layouts/` 中复制目标模板到项目 `layouts/` 下，保持相同相对路径
2. 在复制后的文件中进行修改
3. Hugo 构建时自动优先加载项目模板，主题模板被忽略

### 3.2 当前覆盖文件

当前项目**无**主题模板覆盖文件。新增页脚组件时已回归 `customPartials.footer`，避免 fork 整个 `footer.html`。

### 3.3 维护风险

模板覆盖为**全文件替代**，主题升级时必须手动同步更新覆盖文件，否则会丢失主题的新功能或修复。每次 FixIt 主题升级后，必须对比覆盖文件与新版主题文件的差异并手动合并。

---

## 4. Vercel Serverless API 规范

### 4.1 API 路由

Vercel Serverless Function 放置在项目根目录 `api/` 下，文件名即路由路径。

| 文件 | 路由 | 说明 |
|------|------|------|
| `api/visit.js` | `GET /api/visit` | 收集访客 IP 经纬度，返回全量坐标数组 |

### 4.2 `/api/visit` 接口

- **架构版本**：V7.1（弱指纹 + 双键分离聚合 + 熔断器）
- **定位架构**：多源并行仲裁引擎（`Promise.allSettled`，1.5s 超时，ip-api 2 次重试）
- **仲裁源**：CF Header（`cf-iplatitude/longitude`） + ip-api.com（含 `as/proxy/hosting/offset` 字段） + ipapi.co（补位）
- **仲裁算法**：CF vs ip-api.com 距离 >100km 且 ip-api 返回运营商信息时，强制采用 ip-api 结果（5G 纠偏）
- **IP 获取**：候选列表遍历（`cf-connecting-ip` > `x-real-ip` > `x-forwarded-for` > `remoteAddress`），过滤私有 IP 和 Vercel 网关 IP
- **弱指纹**：`SHA256(IP|User-Agent|Accept-Language)[:8]`，替代真实 IP 存储，零 PII 风险
- **去重机制**：`geo:uv:{YYYY-MM-DD}`（Set），`SADD` 返回 1 表示新设备，TTL 7 天
- **聚合存储**：`geo:heat:{YYYY-MM-DD}`（Hash），Field=`lon,lat:type`，Value=权重，`HINCRBY` 原子累加，TTL 31 天
- **坐标精度**：三位小数（`toFixed(3)`，约 110m）
- **类型判定**：`computeType()` 仅使用时区偏差 >30h 判定代理（IP 时区 vs 浏览器时区），不使用 `proxy/hosting`/AS 关键词
- **熔断器**：ip-api 429 触发 `geo:circuit_breaker`（60s TTL），期间跳过定位但仍返回热力数据
- **多日读取**：30 天固定日期列表 + Pipeline `HGETALL`，禁止使用 `KEYS` 命令
- **前端参数**：`GET /api/visit?tzOffset={minutes}` 传递浏览器时区偏移
- **响应格式**：`{ count: number, coords: [[lon, lat, type, weight], ...] }`
- **前端渲染**：预计算 symbolSize + RGBA 颜色；真实用户 `rgba(0,255,136,alpha)`；代理节点 `rgba(255,51,102,alpha)`；`blendMode: 'lighter'`
- **降级策略**：Redis 未配置返回 503；熔断器激活时跳过定位；坐标获取失败跳过存储但仍返回已有数据
- **旧数据迁移**：`migrateOldFormat()` 一次性清除旧架构 key（`kiraa:visit:*`），迁移标记 `kiraa:visit:migrated_v7`

### 4.3 环境变量

| 变量名 | 说明 | 配置位置 |
|--------|------|----------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST 端点 | Vercel 后台 → Settings → Environment Variables |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | 同上 |

**约束**：环境变量不得硬编码到代码中，必须通过 Vercel 后台配置。

---

## 5. 评论系统配置规范

### 5.1 当前方案：Giscus（基于 GitHub Discussions）

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 系统 | Giscus | 零后端运维，数据存储在 GitHub Discussions |
| 配置路径 | `params.page.comment.giscus` | FixIt 原生支持，仅修改 `hugo.toml` |
| `mapping` | `pathname` | 以文章路径作为 Discussion 唯一标识 |
| `lang` | `zh-CN` | 中文界面 |
| 暗色/亮色切换 | FixIt 原生 `preferred_color_scheme` | 自动跟随主题切换 |

### 5.2 选型决策记录

- **Giscus vs Waline**：Giscus 零后端运维，与当前无后端 Vercel 部署架构完美契合；Waline 需独立维护数据库，维护成本更高
- **国内可达性**：Giscus 脚本从 `giscus.app` 加载，国内偶有波动，但 AI/ML 技术受众几乎 100% 有 GitHub 账号且网络环境可访问
- **受众匹配**：AI/ML 开发者 GitHub 登录零摩擦

### 5.3 维护约束

- `repoId` 和 `categoryId` 为敏感配置，不得以占位符形式 push 到远程仓库
- `mapping` 值一旦确定不得随意更改，否则会导致已有评论与文章脱钩
- 评论系统配置仅修改 `hugo.toml`，不得覆写 `layouts` 模板

---

## 6. Page Bundle 文章组织规范

### 6.1 目录结构

所有文章位于 `content/post/` 目录下，采用 **Page Bundle** 形式组织：

```
content/post/<article-name>/
├── index.md              # 文章正文（必需）
└── img/                  # 文章图片资源（可选，与 index.md 同级）
    ├── cover.jpg         # 封面图
    └── *.png/svg/jpg     # 文中插图
```

**核心规则**：`index.md` 与 `img/` 目录必须同级，构成一个完整的 Page Bundle。图片资源放在 `img/` 子目录中，通过相对路径引用。

### 6.2 Front Matter 必需字段

```yaml
---
title: "文章标题"              # 必需
date: 2026-01-30              # 必需，YYYY-MM-DD
draft: false                  # 必需，true 为草稿不发布
tags: [标签1, 标签2]          # 必需，对应 Hugo taxonomies
math: true                    # 包含数学公式时必须设为 true
featuredImage: "img/cover.jpg" # 可选，封面图相对路径
---
```

### 6.3 图片引用规则

| 引用方式 | 语法 | 说明 |
|----------|------|------|
| 文中插图 | `![alt](img/filename.png)` | 相对于 `index.md` 的相对路径 |
| 封面图 | `featuredImage: "img/cover.jpg"` | 相对于 Page Bundle 根目录 |
| 外部图片 | `<figure>` HTML 标签 | 需 `markup.goldmark.renderer.unsafe = true` |

### 6.4 命名规范

- 文章目录名：`learning-<topic>` 或 `<descriptive-name>`，小写字母 + 连字符
- 图片文件名：小写字母、数字、连字符，禁止空格和特殊字符
- 封面图统一命名为 `cover.jpg`
