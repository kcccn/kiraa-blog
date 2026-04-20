# AGENTS/knowledge/blog_specs.md
<!-- File: AGENTS/knowledge/blog_specs.md -->

# Kiraa-Blog 核心技术知识与规范

## 1. Hugo 模板覆盖优先级规则

Hugo 在加载模板和资源时遵循**项目优先**原则。当项目根目录和主题目录存在同名文件时，项目根目录的文件优先加载，主题文件被忽略。

### 1.1 资源文件覆盖

```
项目 assets/  >  主题 themes/FixIt/assets/
```

| 项目文件 | 主题文件 | 行为 |
|----------|----------|------|
| `assets/css/_custom.scss` | `themes/FixIt/assets/css/_custom.scss` | 项目文件完全替代主题文件 |
| `assets/js/custom.js` | `themes/FixIt/assets/js/custom.js` | 项目文件完全替代主题文件 |

**关键规则**：`_custom.scss` 是**替代**而非追加。项目根目录的 `assets/css/_custom.scss` 会完全替代主题中的同名文件。因此，项目自定义样式必须在该文件中完整包含所有需要的覆盖规则。

### 1.2 模板文件覆盖

```
项目 layouts/  >  主题 themes/FixIt/layouts/
```

| 项目文件 | 主题文件 | 行为 |
|----------|----------|------|
| `layouts/_default/single.html` | `themes/FixIt/layouts/_default/single.html` | 项目模板替代主题模板 |
| `layouts/_partials/header.html` | `themes/FixIt/layouts/_partials/header.html` | 项目模板替代主题模板 |
| `layouts/_shortcodes/mermaid.html` | `themes/FixIt/layouts/_shortcodes/mermaid.html` | 项目模板替代主题模板 |

**关键规则**：模板覆盖是全文件替代。如需微调，应在项目模板中引用主题基础模板并通过 `{{ block }}` / `{{ define }}` 机制扩展。

### 1.3 配置合并规则

```toml
[outputs]
  _merge = "shallow"    # 浅合并：项目值覆盖主题默认值，未指定的保留主题默认

[taxonomies]
  _merge = "shallow"    # 浅合并：同上
```

**`_merge` 策略说明**：

| 值 | 行为 |
|-----|------|
| `"none"` / 不设置 | 项目配置完全替代主题配置（默认行为） |
| `"shallow"` | 项目配置与主题配置浅合并，项目值优先 |
| `"deep"` | 项目配置与主题配置深度合并 |

**当前项目使用 `"shallow"`**，确保主题内置的输出格式（HTML、RSS 等）和分类法（tags、categories）不被丢失。

---

## 2. Vue 风格配色变量完整定义

### 2.1 CSS 变量覆盖（`--fi-*` 命名空间）

FixIt 主题的 CSS 变量使用 `--fi-` 前缀（定义于 `$rootPrefix: --fi-`）。项目通过 `:root` 块覆盖以下变量：

| 变量名 | 亮色模式值 | 用途 | 来源文件 |
|--------|-----------|------|----------|
| `--fi-global-link-color` | 主题默认 `#161209` | 全局链接颜色 | `_root.scss` |
| `--fi-global-link-hover-color` | 主题默认 `#2983bb` | 全局链接悬停颜色 | `_root.scss` |
| `--fi-primary` | 主题默认 `#1772ee` | 主题主色 | `_colors.scss` → `_root.scss` |

**注意**：当前 `_custom.scss` 中使用的 `--fixit-*` 前缀变量并非 FixIt 主题的官方 CSS 变量命名空间。FixIt v0.4.2 的官方 CSS 变量前缀为 `--fi-`。`--fixit-*` 变量可能是旧版遗留或自定义变量，需确认其是否实际生效。

### 2.2 项目自定义配色方案

项目在 `assets/css/_custom.scss` 中定义的配色：

| 用途 | 颜色值 | 色名 | 应用位置 |
|------|--------|------|----------|
| 主题色 / 链接色 | `#42b883` | Vue Green | `:root` 变量、`blockquote` 左边框、引用块背景 |
| 链接悬停色 | `#35495e` | Vue Dark Blue | `:root` 变量 |
| 行内代码色 | `#e96900` | Vue Orange | 行内 `code` 元素 |
| 行内代码背景（亮色） | `#f8f8f8` | Light Gray | 行内 `code` 元素 |
| 行内代码背景（暗色） | `rgba(233, 105, 0, 0.15)` | 半透明橙 | `[data-theme='dark']` 下的行内 `code` |
| 引用块背景 | `rgba(66, 184, 131, 0.1)` | 半透明绿 | `blockquote` 元素 |
| h2 分隔线 | `#eaecef` | Light Border | `.single .content h2` |

### 2.3 FixIt 主题 SCSS 变量参考

以下为 `themes/FixIt/assets/css/_variables.scss` 中的关键默认值，覆盖时需参考：

| SCSS 变量 | 默认值（亮色） | 默认值（暗色） | 用途 |
|-----------|---------------|---------------|------|
| `$global-background-color` | `#ffffff` | `#292a2e` | 页面背景 |
| `$global-font-color` | `#161209` | `#b1b1ba` | 正文颜色 |
| `$global-link-color` | `#161209` | `#b1b1ba` | 全局链接颜色 |
| `$global-link-hover-color` | `#2983bb` | `#fff` | 全局链接悬停颜色 |
| `$single-link-color` | `#2376b7` | `#1781b5` | 文章内链接颜色 |
| `$single-link-hover-color` | `#ea517f` | `#cc5595` | 文章内链接悬停颜色 |
| `$code-color` | `#24292f` | `#adbac7` | 代码颜色 |
| `$code-background-color` | `#f4f6f8` | `#2d333b` | 代码块背景 |
| `$blockquote-color` | `#697681` | `#9ba3aa` | 引用块文字颜色 |
| `$primary` | `#1772ee` | — | 主题主色（映射到 `--fi-primary`） |

---

## 3. Page Bundle 文章组织规范

### 3.1 目录结构

```
content/post/<article-name>/
├── index.md              # 文章正文（必需）
└── img/                  # 文章图片资源（可选）
    ├── cover.jpg         # 封面图（Front Matter 中 featuredImage 引用）
    └── *.png/svg/jpg     # 文中插图（Markdown 中相对路径引用）
```

### 3.2 Front Matter 必需字段

```yaml
---
title: "文章标题"              # 必需，字符串
date: 2026-01-30              # 必需，日期格式 YYYY-MM-DD
draft: false                  # 必需，true 为草稿不发布
tags: [标签1, 标签2]          # 必需，数组，对应 Hugo taxonomies
math: true                    # 条件必需，包含数学公式时必须设为 true
featuredImage: "img/cover.jpg" # 可选，封面图相对路径
---
```

### 3.3 图片引用规则

| 引用方式 | 语法 | 说明 |
|----------|------|------|
| 文中插图 | `![alt](img/filename.png)` | 相对于 `index.md` 的相对路径 |
| 封面图 | Front Matter `featuredImage: "img/cover.jpg"` | 相对于 Page Bundle 根目录 |
| 外部图片 | `<figure>` HTML 标签 | 需 `markup.goldmark.renderer.unsafe = true` |

### 3.4 命名规范

- 文章目录名：`learning-<topic>` 或 `<descriptive-name>`，使用小写字母和连字符
- 图片文件名：小写字母、数字、连字符，避免空格和特殊字符
- 封面图统一命名为 `cover.jpg`

---

## 4. 数学公式渲染配置

### 4.1 渲染引擎

- **引擎**：KaTeX（配置于 `hugo.toml` → `params.page.math.type = "katex"`）
- **启用方式**：文章 Front Matter 中设置 `math: true`
- **库文件**：`themes/FixIt/assets/lib/katex/katex.min.css` + `copy-tex.min.js`

### 4.2 LaTeX 分隔符配置

```toml
[markup.goldmark.extensions.passthrough]
  enable = true
  auto = true
  [markup.goldmark.extensions.passthrough.delimiters]
    block = [['\[', '\]'], ['$$', '$$']]
    inline = [['\(', '\)'], ['$', '$']]
```

| 语法 | 用途 | 示例 |
|------|------|------|
| `\[ ... \]` | 块级公式 | `\[ E = mc^2 \]` |
| `$$ ... $$` | 块级公式 | `$$E = mc^2$$` |
| `\( ... \)` | 行内公式 | `计算 \(x^2\)` |
| `$ ... $` | 行内公式 | `计算 $x^2$` |

### 4.3 公式样式规范

```scss
/* 确保公式颜色继承正文，防止暗色模式下颜色过浅 */
.katex {
    color: inherit !important;
}
```

**关键约束**：

- 不得在 `markup.goldmark.extensions` 中添加 `passthrough = false`
- 块级公式前后必须保留空行，否则 Markdown 渲染异常
- 行内公式中 `$` 与内容之间不得有空格

---

## 5. 代码块样式标准

### 5.1 Hugo 配置

```toml
[markup.highlight]
  codeFences = true       # 启用 ``` 代码围栏
  guessSyntax = true      # 自动猜测语言
  lineNos = true          # 显示行号
  noClasses = false       # 使用外部 CSS 类（允许主题自定义样式）
  style = "monokai"       # Chroma 高亮主题
```

### 5.2 代码块功能配置

```toml
[params.page.code]
  maxShownLines = 50      # 超过 50 行自动折叠
  copy = true             # 显示复制按钮
```

### 5.3 行内代码样式

```scss
:not(pre) > code {
    color: #e96900 !important;                          /* Vue 橙色 */
    background-color: #f8f8f8 !important;               /* 亮色背景 */
    [data-theme='dark'] & {
        background-color: rgba(233, 105, 0, 0.15) !important;  /* 暗色背景 */
    }
    font-family: "JetBrains Mono", Consolas, monospace; /* 等宽字体 */
    padding: 0.1rem 0.3rem !important;                  /* 内边距 */
    border-radius: 4px !important;                      /* 圆角 */
}
```

**关键约束**：

- 行内代码必须使用 `!important` 覆盖主题和 Chroma 的默认样式
- 暗色模式必须单独适配，使用 `[data-theme='dark'] &` 嵌套选择器
- 代码块（`<pre><code>`）样式由 Chroma 主题控制，行内代码样式由 `_custom.scss` 控制

### 5.4 代码块与行内代码的区分

| 类型 | HTML 结构 | 样式来源 | 颜色控制 |
|------|-----------|----------|----------|
| 代码块 | `<pre><code class="language-xxx">` | Chroma `monokai` 主题 | Chroma token 类 |
| 行内代码 | `<code>`（不在 `<pre>` 内） | `_custom.scss` | `#e96900`（Vue 橙） |

---

## 6. 排版规范

### 6.1 正文排版

| 属性 | 值 | 选择器 |
|------|-----|--------|
| 行高 | `1.8` | `.single .content p, .single .content li` |
| 字号 | `1.05rem` | `.single .content p, .single .content li` |
| 字体 | `JetBrains Mono, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` | `params.app.fontFamily` |

### 6.2 标题排版

| 级别 | 样式 |
|------|------|
| h2 | 底部 1px 实线边框（`#eaecef`），底部内边距 `0.3em`，顶部外边距 `2em` |
| h3+ | 主题默认样式 |

### 6.3 引用块排版

| 属性 | 值 |
|------|-----|
| 左边框 | `0.25rem solid #42b883` |
| 背景 | `rgba(66, 184, 131, 0.1)` |

---

## 7. 暗色模式适配规范

### 7.1 切换机制

FixIt 主题通过 `<html data-theme="dark">` 属性切换暗色模式。CSS 中使用以下选择器适配：

```scss
[data-theme='dark'] & {
    /* 暗色模式样式 */
}
```

### 7.2 必须适配暗色模式的元素

| 元素 | 适配要求 |
|------|----------|
| 行内代码 | 背景色切换为半透明橙色 |
| 引用块 | 背景色自动适配（基于 rgba 透明度） |
| 数学公式 | 颜色继承正文（`color: inherit`） |
| 链接 | 确保与暗色背景对比度 ≥ 4.5:1 |
| 自定义背景色 | 必须提供暗色模式对应值 |

### 7.3 CSS 变量暗色覆写

FixIt 主题在 `[data-theme=dark]` 下覆写以下 CSS 变量（定义于 `_root.scss`）：

```
--fi-global-background-color
--fi-global-font-color
--fi-global-font-secondary-color
--fi-global-border-color
--fi-global-link-color
--fi-global-link-hover-color
--fi-code-inline-background-color
--fi-code-block-background-color
--fi-code-header-color
--fi-code-header-background-color
--fi-code-highlight-color
--fi-primary (darken 5%)
```

项目自定义的暗色适配必须与上述变量体系协同工作，不得产生冲突。

---

## 8. 构建与缓存管理

### 8.1 Hugo 资源缓存

SCSS 编译产物缓存于 `resources/_gen/` 目录。修改 `_custom.scss` 后若样式未更新，需清理缓存：

```bash
# 清理资源缓存
rm -rf resources/_gen/

# 清理构建产物
rm -rf public/

# 启动开发服务器（禁用缓存）
hugo server --disableFastRender --ignoreCache
```

### 8.2 生产构建

```bash
hugo --minify
```

输出至 `public/` 目录，Vercel 部署时自动执行此命令。

### 8.3 浏览器缓存

样式更新后浏览器可能缓存旧版 CSS。验证时使用：
- Chrome: `Ctrl + Shift + R`（硬刷新）
- DevTools: Network 面板勾选 "Disable cache"
