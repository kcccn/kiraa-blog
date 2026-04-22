# ADR-004: Serverless 流量遥测系统

## Status

Accepted

## Date

2026-04-22

## Context

博客需要访客流量统计功能，用于：

1. **3D 地球热力图**：可视化展示访客地理分布
2. **UV 趋势分析**：近 14 天独立访客趋势
3. **代理识别**：区分真实用户与代理节点

### 技术约束

- **无后端架构**：博客部署在 Vercel，采用 Serverless 架构
- **隐私合规**：不得存储真实 IP（PII 风险）
- **国内可达性**：地理编码服务需考虑国内网络环境
- **成本控制**：免费额度内运行

### 此前方案的问题

- 依赖单一地理编码 API，失败时无降级
- 存储真实 IP，存在隐私风险
- 使用 Redis `KEYS` 命令，生产环境不安全
- 无熔断机制，API 限流时持续失败

## Decision

采用 **V10 架构**：多源并行仲裁引擎 + 弱指纹去重 + 双键分离聚合 + 熔断器保护。

### 系统架构

```
用户请求 → Vercel Serverless Function → 多源并行定位仲裁
                                            ↓
                                    Upstash Redis 存储
                                            ↓
                                    前端 ECharts 渲染
```

### 核心组件

#### 1. 多源并行仲裁引擎

使用 `Promise.allSettled` 并行请求多个地理编码源，1.5s 超时：

| 优先级 | 数据源 | 协议 | 说明 |
|--------|--------|------|------|
| 1 | CF Header | HTTPS | Cloudflare Managed Transforms，`cf-iplatitude/longitude` |
| 2 | ip-api.com | HTTP | 含 `as/proxy/hosting/offset` 字段，2 次重试 |
| 3 | ipapi.co | HTTPS | 补位源 |

**仲裁算法**：CF vs ip-api.com 距离 >100km 且 ip-api 返回运营商信息时，强制采用 ip-api 结果（5G 纠偏）。

#### 2. 弱指纹去重

使用 `SHA256(IP|User-Agent|Accept-Language)[:8]` 替代真实 IP 存储：

- **零 PII 风险**：无法从弱指纹反推真实 IP
- **NAT 兼容**：同一 NAT 下不同设备产生不同指纹

#### 3. 双键分离聚合

| Redis Key | 类型 | 说明 | TTL |
|-----------|------|------|-----|
| `geo:uv:{YYYY-MM-DD}` | Set | 当日独立访客弱指纹 | 无（永久保留） |
| `geo:heat:{YYYY-MM-DD}` | Hash | 当日热力数据，Field=`lon,lat:type`，Value=权重 | 无（永久保留） |
| `geo:days` | Set | 全部日期注册表 | 无（永久保留） |
| `geo:circuit_breaker` | String | 熔断器标记 | 60s |

**写入流程**：

1. `SADD geo:uv:{day} {fingerprint}` → 返回 1 表示新设备
2. `HINCRBY geo:heat:{day} {lon,lat:type} 1` → 原子累加权重
3. `SADD geo:days {day}` → 注册日期

#### 4. 熔断器

ip-api 429 触发 `geo:circuit_breaker`（60s TTL），期间跳过定位但仍返回热力数据。

### API 接口

#### `GET /api/visit`

**参数**：

- `tzOffset`：浏览器时区偏移（分钟），用于代理判定

**响应**：

```json
{
  "count": 1234,
  "coords": [[lon, lat, type, weight], ...]
}
```

**降级策略**：

- Redis 未配置 → 返回 503
- 熔断器激活 → 跳过定位，返回已有数据
- 坐标获取失败 → 跳过存储，返回已有数据

#### `GET /api/visit?stats=daily`

**响应**：

```json
{
  "daily": [
    {"date": "2026-04-15", "uv": 42},
    {"date": "2026-04-16", "uv": 38},
    ...
  ]
}
```

### 前端渲染

- **真实用户**：`rgba(0,255,136,alpha)`（赛博绿）
- **代理节点**：`rgba(255,51,102,alpha)`（警示红）
- **混合模式**：`blendMode: 'lighter'`（加色混合，越密集越亮）
- **symbolSize**：预计算，避免 ECharts-GL 函数回调兼容性问题

### 代理判定算法

仅使用时区偏差 >30h 判定代理（IP 时区 vs 浏览器时区），不使用 `proxy/hosting`/AS 关键词（误报率高）。

### 环境变量

| 变量名 | 说明 | 配置位置 |
|--------|------|----------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST 端点 | Vercel 后台 |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | Vercel 后台 |

## Consequences

### 正面影响

- **隐私合规**：弱指纹存储，零 PII 风险
- **高可用**：多源并行 + 熔断器，单源失败不影响整体
- **性能优化**：并行仲裁将延迟压缩至 1.5s
- **数据持久**：热力数据永久保留，支持历史分析
- **成本可控**：Upstash 免费额度内运行

### 负面影响

- **依赖外部服务**：ip-api.com 免费版仅 HTTP，HTTPS 环境下可能被安全策略阻止
- **精度限制**：坐标精度三位小数（约 110m），适合热力展示但不适合精确定位
- **存储增长**：永久保留策略导致 Redis 存储持续增长

### 维护约束

- 环境变量不得硬编码到代码中，必须通过 Vercel 后台配置
- 禁止使用 Redis `KEYS` 命令，必须使用 `SMEMBERS geo:days` + Pipeline
- 坐标精度必须为三位小数（`toFixed(3)`）
- 热力数据永久保留，禁止设置 TTL
- IP 获取必须优先读取 `cf-connecting-ip`
- 私有 IP 判断 `172.` 前缀必须限定 `172.16.0.0/12`
- 地理定位必须使用多源并行仲裁，禁止顺序降级
