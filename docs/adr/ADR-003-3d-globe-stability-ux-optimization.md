# ADR-003: 3D 地球稳定性与用户体验优化

## Status

Accepted

## Date

2026-04-22

## Context

Nexus 页面的 3D 地球组件在开发过程中遇到以下问题：

1. **滚动劫持**：鼠标悬停在地球上时，滚轮事件被 canvas 拦截，无法向下滚动页面
2. **白屏闪烁（FOUC）**：ECharts-GL 异步加载高分辨率贴图时，canvas 显示白屏
3. **移动端上下文丢失**：移动端页面滚动导致 WebGL 上下文丢失后，贴图无法恢复
4. **贴图加载失败无兜底**：远程贴图 URL 失效时，地球完全空白
5. **主题切换不协调**：Loading 动画颜色与当前主题不匹配

### 问题根因分析

| 问题 | 根因 |
|------|------|
| 滚动劫持 | `zoomSensitivity: 0` 仅禁止缩放逻辑，canvas 仍通过 zrender 消费 `wheel` 事件 |
| 白屏闪烁 | ECharts-GL 在 `setOption` 时同步启动贴图异步加载，期间 canvas 无内容 |
| 移动端上下文丢失 | WebGL 上下文丢失后，ECharts-GL 无法从 Image/Canvas 对象恢复贴图，只能从 URL 字符串重新加载 |
| 贴图加载失败 | 无降级机制，远程资源失效时无兜底 |
| 主题不协调 | Loading 颜色硬编码，未感知当前主题 |

## Decision

采用以下技术方案解决上述问题：

### 1. 滚动劫持修复

- **配置层**：`viewControl.zoomSensitivity: 0` 禁止缩放，`rotateSensitivity: 1` 保留拖拽旋转
- **事件层**：通过 zrender API 移除 wheel 事件处理器，并对地球容器下的所有 canvas 在 capture 阶段添加 wheel 监听器调用 `e.stopImmediatePropagation()`；禁止使用 `e.preventDefault()` 阻断浏览器默认滚动
- **生命周期**：主题切换时 chart 重建后必须重新绑定 wheel 监听器

```javascript
function bindWheelStopPropagation(chart) {
  const canvases = chart.getDom().querySelectorAll('canvas');
  if (!canvases.length) return;
  
  const zr = chart.getZr();
  if (zr && zr.off) {
    zr.off('wheel');
  }
  
  canvases.forEach((canvas) => {
    canvas.addEventListener('wheel', (e) => {
      e.stopImmediatePropagation();
    }, { capture: true, passive: true });
  });
}
```

### 2. 白屏闪烁修复

采用异步预加载模式：

```
echarts.init → 宿主容器进入 loading 态 → new Image() 预加载贴图 → onload: setOption + reveal → onerror: 降级处理 + reveal
```

- **Loading 呈现**：`Nexus` 页面不再依赖 ECharts `showLoading()` overlay；由宿主容器提供主题感知的静默 loading 背景，禁止出现居中文字提示
- **贴图预加载**：`new Image()` 异步预加载，`onload` 后调用 `setOption`
- **容器显现**：地球宿主容器默认保持未就绪态；仅在 `setOption` 完成后的下一帧切换到 ready，通过背景占位 + canvas 延后淡入的 reveal 过渡显现，避免 WebGL 画面硬切出来

### 3. 移动端上下文恢复

修改 `baseTexture` 传值策略：

- **成功时**：传递 URL 字符串（利用浏览器 Memory Cache 秒开，允许 ECharts 在 WebGL 上下文恢复后自动重新加载）
- **失败时**：传递 `fallbackCanvas.toDataURL()`（Base64 字符串），确保兜底材质同样可恢复

**关键约束**：`buildOption` 的 `baseTexture` 必须传递 URL/Base64 字符串，禁止传递 Image/Canvas 对象。

### 4. 贴图加载失败降级

创建主题感知的 4×4 兜底 Canvas：

```javascript
function getThemeContext() {
  const isDark = window.fixit?.isDark ?? true;
  return {
    loadingColor: isDark ? '#00ff88' : '#009955',
    fallbackBg: isDark ? '#0a0f14' : '#f5f7fa'
  };
}

// 创建兜底 Canvas
const fallbackCanvas = document.createElement('canvas');
fallbackCanvas.width = 4;
fallbackCanvas.height = 4;
const ctx = fallbackCanvas.getContext('2d');
ctx.fillStyle = getThemeContext().fallbackBg;
ctx.fillRect(0, 0, 4, 4);
```

### 5. 视觉配置规范

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 渲染组件 | `globe` | `map3D` 不支持叠加 `scatter3D` |
| 背景透明 | `backgroundColor: 'transparent'` + `environment: ''` | `''` 彻底禁用星空黑框 |
| 贴图 | `assets/images/echarts/world.jpg`（本地 Hugo 管道） | 深色灰度地图，赛博风格 |
| 材质 | `shading: 'color'` | 无光影，纯色暗化 |
| 大气层颜色 | `#42b883`（Vue Green） | 符合 ADR-003 配色体系 |
| 散点颜色 | `#42b883` | 符合 ADR-003 配色体系 |
| 散点大小 | `symbolSize: 3` | 精致感 |
| 散点海拔 | 第三维必须为 `0` | 非零值导致点脱离地球表面 |
| 自动旋转 | `autoRotate: true` | 持续动态 |
| 禁用缩放 | `zoomSensitivity: 0` | 防裁切 + 防滚动劫持 |
| 拖拽旋转 | `rotateSensitivity: 1` | 允许左键拖拽旋转 |
| 散点混合 | `blendMode: 'lighter'` | 加色混合，越密集越亮 |

## Consequences

### 正面影响

- **滚动体验**：用户可自由滚动页面，地球不再劫持滚轮事件
- **视觉稳定**：贴图加载期间显示 Loading 动画，消除白屏闪烁
- **移动端兼容**：WebGL 上下文丢失后贴图可自动恢复
- **降级优雅**：贴图加载失败时显示主题协调的纯色球体
- **主题协调**：Loading 动画颜色与当前主题匹配

### 负面影响

- **代码复杂度**：异步预加载模式增加了初始化逻辑复杂度
- **首次加载延迟**：贴图预加载需要额外等待时间（约 100-300ms）

### 维护约束

- ECharts-GL canvas 的 `wheel` 事件必须通过 zrender API 移除 + 对所有 canvas 在 capture 阶段调用 `stopImmediatePropagation()` 的方式释放给浏览器，禁止调用 `preventDefault()` 阻断页面默认滚动
- chart dispose 后重建时必须重新绑定 wheel 监听器
- `buildOption` 的 `baseTexture` 必须由调用方显式传入，禁止在函数内部硬编码远程 URL
- `Nexus` 地球初始化必须使用“宿主容器 loading 态 → Image 预加载 → `setOption` → reveal”的异步模式，不得重新引入 ECharts 居中 loading 文案
- `Nexus` 地球容器必须在资源 ready 后再 reveal，不得在 `setOption` 前直接完全显示
- 暗色模式下不得出现白色方形 loading 爆闪或亮底
- 贴图加载失败时必须提供主题感知的兜底 Canvas
- Loading 动画颜色必须通过 `getThemeContext()` 动态获取
- `buildOption` 的 `baseTexture` 必须传递 URL/Base64 字符串，禁止传递 Image/Canvas 对象
