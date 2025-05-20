# JianpuRender

专业的浏览器端简谱渲染库，基于TypeScript和SVG技术实现音乐符号精准绘制。支持动态交互与多端适配。

## 核心功能

✅ 完整简谱符号体系支持
- 音符/休止符（全音符至64分音符）
- 升降记号（#/b）与附点音符
- 12种调号支持（含5个升号调与6个降号调）
- 复杂节拍组合（2/4, 3/8, 5/16等）

🎛 交互特性
- 音符高亮反馈
- 实时音频同步播放
- SVG动画效果支持

🔧 开发者工具
- 类型安全的API设计
- 模块化SVG绘图工具集
- 自动化测试覆盖率85%+

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
import { createRenderer } from 'jianpurender';

const renderer = createRenderer({
  container: '#score-container',
  width: 800,
  fontSize: 16
});

renderer.render('1=C4/4 1 2 3 4 | 5 6 7 i');
```

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

![测试覆盖率](https://img.shields.io/badge/coverage-85%25-brightgreen)


