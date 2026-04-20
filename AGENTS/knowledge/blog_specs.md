# AGENTS/knowledge/blog_specs.md
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

## 2. Page Bundle 文章组织规范

### 2.1 目录结构

所有文章位于 `content/post/` 目录下，采用 **Page Bundle** 形式组织：

```
content/post/<article-name>/
├── index.md              # 文章正文（必需）
└── img/                  # 文章图片资源（可选，与 index.md 同级）
    ├── cover.jpg         # 封面图
    └── *.png/svg/jpg     # 文中插图
```

**核心规则**：`index.md` 与 `img/` 目录必须同级，构成一个完整的 Page Bundle。图片资源放在 `img/` 子目录中，通过相对路径引用。

### 2.2 Front Matter 必需字段

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

### 2.3 图片引用规则

| 引用方式 | 语法 | 说明 |
|----------|------|------|
| 文中插图 | `![alt](img/filename.png)` | 相对于 `index.md` 的相对路径 |
| 封面图 | `featuredImage: "img/cover.jpg"` | 相对于 Page Bundle 根目录 |
| 外部图片 | `<figure>` HTML 标签 | 需 `markup.goldmark.renderer.unsafe = true` |

### 2.4 命名规范

- 文章目录名：`learning-<topic>` 或 `<descriptive-name>`，小写字母 + 连字符
- 图片文件名：小写字母、数字、连字符，禁止空格和特殊字符
- 封面图统一命名为 `cover.jpg`
