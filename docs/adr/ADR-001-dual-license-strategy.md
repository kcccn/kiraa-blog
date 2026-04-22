# ADR-001: 双重开源协议策略

## Status

Accepted

## Date

2026-04-21

## Context

本仓库包含两类不同性质的资产：

1. **代码与基础设施**：Hugo 主题配置、布局模板、自定义脚本（如 3D 地球组件、Vercel Serverless Functions）
2. **博客内容**：`content/` 目录下所有原创 Markdown 文章

两类资产的创作成本、使用场景和保护需求存在本质差异：

- 代码资产可复用性强，适合宽松协议促进传播
- 内容资产凝聚作者智力劳动，需限制商业使用并要求署名

此前项目未明确区分两类资产的协议，存在以下风险：

- 代码被误认为 CC 协议，阻碍技术复用
- 内容被商业抓取或未署名转载，损害作者权益
- 协议声明散落在多处，维护困难

## Decision

采用**双重开源协议策略**，分离保护代码资产与内容资产：

| 资产类型 | 协议 | 配置位置 | 说明 |
|----------|------|----------|------|
| 代码 & 基础设施 | MIT License | 根目录 `LICENSE` 文件 | 主题配置、布局模板、自定义脚本 |
| 博客内容 | CC BY-NC-SA 4.0 | `hugo.toml` → `[params.page].license` | `content/` 目录下所有原创 Markdown 文件，署名 **kiraa** |

### 协议渲染机制

- **文章级 CC 协议**：通过 `[params.page].license` 配置注入，FixIt 主题在 `single/footer.html` 的 `post-info-license` div 中渲染，位于文章底部更新日期右侧。仅文章页显示，首页/归档页/Nexus 页不受影响
- **页脚保持纯洁**：`[params.footer]` 仅配置 `since = 2026`，不注入 license HTML
- **GitHub 声明**：根目录 `README.md` 包含双重 License 声明段落

### 当前配置

```toml
[params.page]
  license = '<a rel="license external nofollow noopener noreferrer" href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans" target="_blank">CC BY-NC-SA 4.0</a>'

[params.footer]
  enable = true
  since = 2026
```

## Consequences

### 正面影响

- **法律清晰**：代码与内容协议分离，使用者明确知晓权利边界
- **促进复用**：MIT 协议允许代码自由使用、修改和分发
- **保护创作**：CC BY-NC-SA 4.0 禁止商业使用，要求署名和相同方式共享
- **维护便捷**：协议声明集中在 `LICENSE` 和 `hugo.toml`，无需修改模板

### 负面影响

- **理解成本**：双重协议对使用者有一定认知门槛，需在 README 中清晰说明
- **协议兼容**：混合使用时需注意不同协议的适用范围

### 维护约束

- 不得在 `[params.footer]` 中添加 license HTML，保持页脚纯洁
- CC 链接指向 `deed.zh-hans`（中文版），与 `languageCode = 'zh-cn'` 一致
- MIT 协议年份为 2026，版权人为 kiraa
