# JianpuRender

[![npm version](https://img.shields.io/npm/v/jianpurender.svg)](https://www.npmjs.com/package/jianpurender)
[![npm downloads](https://img.shields.io/npm/dm/jianpurender.svg)](https://www.npmjs.com/package/jianpurender)
[![license](https://img.shields.io/npm/l/jianpurender.svg)](https://www.npmjs.com/package/jianpurender)
[![CI](https://github.com/flufy3d/JianpuRender/actions/workflows/ci.yml/badge.svg)](https://github.com/flufy3d/JianpuRender/actions/workflows/ci.yml)

专业的浏览器端简谱渲染库，基于TypeScript和SVG技术实现音乐符号精准绘制。支持动态交互与多端适配。

> npm 包主页：https://www.npmjs.com/package/jianpurender

## 核心功能

✅ 完整简谱符号体系支持
- 音符/休止符（全音符至64分音符）
- 升降记号（#/b）与附点音符
- 12种调号支持（含5个升号调与6个降号调）
- 复杂节拍组合（2/4, 3/8, 5/16等）
- 歌词支持（按时间点对齐到实际发声音符）
- 小节号显示（可选）
- 速度标记 ♩=qpm（可选，曲首与谱中变速处同步）

🎛 交互特性
- 音符高亮反馈
- 实时音频同步播放
- SVG动画效果支持
- 音符点击回调 `onNoteClick`
- 独立 SVG 导出（`toSVGString()` / `downloadSVG()`）

🔧 开发者工具
- 类型安全的API设计
- 模块化SVG绘图工具集
- 480+ 断言模型层测试

## 在线演示

[基础符号演示](https://flufy3d.github.io/JianpuRender/basic_symbols.html)  
[动态音符演示](https://flufy3d.github.io/JianpuRender/active_notes.html)  
[SVG工具测试](https://flufy3d.github.io/JianpuRender/svg_tools_test.html)

## 快速开始

```bash
npm install jianpurender
# 或
pnpm add jianpurender
```

```typescript
import { JianpuSVGRender } from 'jianpurender';

// 初始化容器
const container = document.getElementById('score-container')! as HTMLDivElement;

// 创建渲染实例
const renderer = new JianpuSVGRender(
  {
    notes: [
      { start: 0, length: 1, pitch: 60 },
      { start: 1, length: 1, pitch: 62 },
      { start: 2, length: 1, pitch: 64 },
      { start: 3, length: 1, pitch: 65 },
      { start: 4, length: 1, pitch: 67 },
      { start: 5, length: 1, pitch: 69 },
      { start: 6, length: 1, pitch: 71 },
      { start: 7, length: 1, pitch: 72 }
    ],
    keySignatures: [{ start: 0, key: 0 }],
    timeSignatures: [{ start: 0, numerator: 4, denominator: 4 }]
  },
  { noteHeight: 24 },
  container
);
```

## 歌词

在 `JianpuInfo` 中传入可选的 `lyrics` 数组即可为乐谱配歌词。歌词按时间点附加到实际发声音符上（和弦取第一个音符、休止缝隙忽略、切分后跟随前段），渲染在音符下方；当歌词比音符宽时会自动让位，不会互相重叠。

```typescript
const renderer = new JianpuSVGRender(
  {
    notes: [
      { start: 0, length: 1, pitch: 60 },
      { start: 1, length: 1, pitch: 62 },
      { start: 2, length: 1, pitch: 64 }
    ],
    lyrics: [
      { start: 0, text: 'do' },
      { start: 1, text: 're' },
      { start: 2, text: 'mi' }
    ],
    keySignatures: [{ start: 0, key: 0 }],
    timeSignatures: [{ start: 0, numerator: 4, denominator: 4 }]
  },
  { noteHeight: 24 },
  container
);
```

## 配置项

第二个构造参数 `JianpuSVGRenderConfig` 的完整配置项如下：

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `noteHeight` | `number` | `20` | 标准音符数字的基准高度（像素），控制整体缩放 |
| `noteSpacingFactor` | `number` | `1.5` | COMPACT 模式下的水平间距系数（音符宽度的倍数） |
| `pixelsPerTimeStep` | `number` | `0` | PROPORTIONAL 模式下每个四分音符的像素宽度；`0` 表示使用 COMPACT 紧凑模式 |
| `noteColor` | `string` | `'black'` | 普通音符/符号颜色（RGB 字符串或 CSS 颜色名） |
| `activeNoteColor` | `string` | `'red'` | 播放高亮时音符的颜色 |
| `defaultKey` | `number` | `0` | 默认调号（0=C，1=C#/Db，……，11=B），当 `JianpuInfo` 未在 0 时刻指定调号时生效 |
| `scrollType` | `ScrollType` | `ScrollType.PAGE` | 播放时的滚动方式，取值见下方 `ScrollType` 枚举说明 |
| `fontFamily` | `string` | `'sans-serif'` | 音符数字与文本的字体族 |
| `width` | `number` | `0`（自动） | 显式设置 SVG 容器宽度 |
| `height` | `number` | `0`（自动） | 显式设置 SVG 容器高度 |
| `showBarNumbers` | `boolean` | `false` | 是否在每个小节起始小节线上方居中显示小节号 |
| `showTempoMarking` | `boolean` | `false` | 是否显示速度标记（♩=qpm）：曲首、谱中变速处与滚动 overlay 同步 |
| `onNoteClick` | `(note: JianpuNote, element: SVGGElement) => void` | 无 | 音符被点击时的回调，接收音符数据与其 SVG `<g>` 元素 |

`scrollType` 取值（`ScrollType` 枚举）：

| 取值 | 说明 |
| --- | --- |
| `ScrollType.PAGE` | 按页滚动 |
| `ScrollType.NOTE` | 高亮音符始终居中 |
| `ScrollType.BAR` | 高亮到某小节第一个音符时，滚动居中到该小节开头 |

## 交互与导出

### 音符点击

通过 `onNoteClick` 可以在用户点击音符时拿到音符数据与对应的 SVG 元素，实现自定义交互（如弹奏反馈、歌词联动等）：

```typescript
const renderer = new JianpuSVGRender(
  score,
  {
    noteHeight: 24,
    onNoteClick: (note, element) => {
      console.log(`点击了音符 pitch=${note.pitch}`, element);
    }
  },
  container
);
```

内部基于 SVG 根节点的单个事件监听器做事件委托，不会为每个音符单独绑定监听器。

### SVG 导出

```typescript
// 导出当前乐谱的独立 SVG 字符串（白底、含调号/拍号等签名 overlay）
const svgString = renderer.toSVGString();

// 直接下载为 .svg 文件
renderer.downloadSVG('score.svg');
```

导出的快照包含当前时刻的高亮状态；`toSVGString(includeOverlay)` 可通过传 `false` 不含 overlay。

### 释放资源

```typescript
// 移除 scroll 监听、停止动画并清理 DOM；
// 销毁后 clear()/redraw() 会安全空转，不会复活已释放的资源
renderer.destroy();
```

页面卸载或组件卸载时调用 `destroy()` 释放监听器与元素缓存，避免内存泄漏。

## 开发指南

```bash
git clone https://github.com/flufy3d/jianpurender.git
cd jianpurender

# 安装依赖
yarn install

# 构建项目
yarn build

# 运行测试
yarn test

# 启动本地演示
yarn demo:serve
```

## 贡献规范

1. 提交前运行完整测试套件：
   ```bash
   yarn test-and-build
   ```
2. 新功能开发需配套测试用例
3. API变更需更新`/node/index.d.ts`文件
4. 文档更新同步至`/docs/`目录

## 技术栈

- SVG绘图引擎：`src/svg_tools.ts`
- 乐谱解析器：`src/jianpu_model.ts`
- 渲染管线：`src/jianpu_svg_render.ts`
