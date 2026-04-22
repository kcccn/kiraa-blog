# Kiraa Blog

A personal technical blog powered by Hugo and the FixIt theme.

## 🏗️ Architecture

本项目采用架构决策记录（ADR）来记录关键技术选型和架构演进。详见 [docs/adr/](docs/adr/) 目录。

| ADR | 标题 | 摘要 |
|-----|------|------|
| [ADR-001](docs/adr/ADR-001-dual-license-strategy.md) | 双重开源协议策略 | 代码 MIT + 内容 CC BY-NC-SA 4.0 分离保护 |
| [ADR-002](docs/adr/ADR-002-nexus-hub-integration.md) | Nexus 集成页面 | 3D 地球、友链、留言板的"空间-时间-人"叙事流 |
| [ADR-003](docs/adr/ADR-003-3d-globe-stability-ux-optimization.md) | 3D 地球稳定性与 UX 优化 | 滚动劫持、FOUC、移动端上下文丢失的解决方案 |
| [ADR-004](docs/adr/ADR-004-serverless-traffic-telemetry.md) | Serverless 流量遥测系统 | 多源并行仲裁 + 弱指纹去重 + 熔断器保护 |

## 📝 License

This repository adopts a dual-license strategy:

* **Code & Infrastructure**: Released under the [MIT License](LICENSE). You are free to use, modify, and distribute the theme configurations, layouts, and custom scripts.
* **Blog Content**: All original markdown files in the `content/` directory are released under the [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans). Attribution to **kiraa** is required.
