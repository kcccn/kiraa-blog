# Kiraa Blog

一个基于 Hugo 与 FixIt 主题构建的个人技术博客。

## 架构

本仓库使用架构决策记录（ADR）管理关键技术选型与架构演进，详见 [docs/adr/](docs/adr/)。

| ADR | 标题 | 摘要 |
|-----|------|------|
| [ADR-001](docs/adr/ADR-001-dual-license-strategy.md) | 双重开源协议策略 | 代码采用 MIT，内容采用 CC BY-NC-SA 4.0 |
| [ADR-002](docs/adr/ADR-002-nexus-hub-integration.md) | Nexus 集成页面 | 通过“空间-时间-人”的叙事流整合 3D 地球、友链与留言板 |
| [ADR-003](docs/adr/ADR-003-3d-globe-stability-ux-optimization.md) | 3D 地球稳定性与 UX 优化 | 解决滚动劫持、FOUC、移动端上下文丢失等问题 |
| [ADR-004](docs/adr/ADR-004-serverless-traffic-telemetry.md) | Serverless 流量遥测系统 | 采用多源并行仲裁、弱指纹去重与熔断保护 |

## License

本仓库采用双重授权策略：

- **代码与基础设施**：使用 [MIT License](LICENSE)。主题配置、模板、自定义脚本等实现层资产可自由使用、修改与分发。
- **博客内容**：`content/` 目录下的原创 Markdown 内容使用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans)。转载需署名 **kiraa**，并遵守非商用与相同方式共享约束。
