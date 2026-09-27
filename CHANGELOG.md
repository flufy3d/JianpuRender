[![npm version](https://img.shields.io/npm/v/jianpurender.svg)](https://www.npmjs.com/package/jianpurender)

# 更新日志

本项目的所有显著变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [1.8.0] - 2026-09-27

### 新增

- `config.onNoteClick(note, element)` 音符点击回调（基于 SVG 根节点单监听器的事件委托实现）。

## [1.7.0] - 2026-09-27

### 新增

- `toSVGString(includeOverlay = true)` 导出独立 SVG 字符串（白底、含签名 overlay；快照含当前高亮状态）。
- `downloadSVG(filename)` 将当前乐谱下载为 `.svg` 文件。

## [1.6.0] - 2026-09-27

### 新增

- `config.showTempoMarking` 速度标记（♩=qpm，默认关闭）：曲首、谱中变速处与滚动 overlay 同步显示。

## [1.5.0] - 2026-09-27

### 新增

- `config.showBarNumbers` 小节号显示（默认关闭）。

## [1.4.0] - 2026-09-27

### 新增

- 歌词支持：`JianpuInfo.lyrics?: LyricInfo[]`。歌词按时间点附加到实际发声音符（和弦取第一个音符、休止缝隙忽略、切分后跟随前段），渲染在音符下方，宽于音符时自动让位。

## [1.3.0] - 2026-09-27

### 新增

- `destroy()`：移除 scroll 监听、停止动画、清理 DOM；销毁后 `clear()`/`redraw()` 安全空转。

### 变更

- 音符/块组热路径缓存，播放高亮不再每次全树 `querySelector`。
- README 增加 npm 徽章。

## [1.2.4] - 2026-09-27

### 修复

- `config.fontFamily` 之前被 `drawSVGText` 硬编码的 sans-serif 覆盖，现在会传入全部文本。
- 高亮现在同时作用于 stroke 元素（时长下划线、dash、小节线）。

## [1.2.3] - 2026-09-27

### 变更

- 模型层测试从 10 断言加固到 411（`mapMidiToJianpu` 全 12 调、附点、tie 链、和弦、变拍号、乱序输入等）。

### 修复

- final rest 长度误含 1e-6 处理缓冲，导致出现幽灵休止符块。

## [1.2.2] - 2026-09-27

### 性能

- `MeasuresInfo` 从按 1/16 网格逐点建 chunk 重构为稀疏分段 + 二分查找，chunk 数与谱长解耦（50000 四分音符谱：80 万 chunk → 2 段）。公共 API 不变。

### 修复

- 网格正中的变化点被静默丢弃。
- 同一时间点重复声明卡住队列。

[Unreleased]: https://github.com/flufy3d/JianpuRender/compare/v1.8.0...HEAD
[1.8.0]: https://github.com/flufy3d/JianpuRender/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/flufy3d/JianpuRender/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/flufy3d/JianpuRender/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/flufy3d/JianpuRender/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/flufy3d/JianpuRender/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/flufy3d/JianpuRender/compare/v1.2.4...v1.3.0
[1.2.4]: https://github.com/flufy3d/JianpuRender/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/flufy3d/JianpuRender/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/flufy3d/JianpuRender/compare/v1.2.1...v1.2.2
