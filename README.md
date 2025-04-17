# jianpurender
A plain vanilla TypeScrip library to render music score in browsers

It has been created to support Tensorflow/Magenta-JS staff visualizer, but it could be used standalone.

From version 1.0.0 on, it offers access to its internal data structure `StaffModel` to process scores and hold musical blocks without visual representation. This structure will be subject to changes up to version 2.0.0 where all musical features will be achieved.

This is a **work in process** project, who has some to do list, like triplets, quintuplets and shorter-than-quarter notes aggregation into beams (instead individual note flags), but it is fully operative. It will keep on growing and evolving. Some stand alone demos will be offered (currently focused on magenta-js consumption demos), but you can watch it in action building and serving the `./test` directory on local deployment.

## Usage
- `npm install jianpurender`

## Reference
- Latest version: `1.0.0`
- Documentation: [Staffrender Homepage](https://flufy3d.github.io/jianpurender/)
- Features: [Musical capabilities](https://flufy3d.github.io/jianpurender/demo/features.html)
- Advanced usage: [Squeezing mm.StaffSVGVisualizer](https://flufy3d.github.io/jianpurender/demo/index.html)

## Development
- Clone the repo
- Go to root directory (where README.md is located)
- Run `yarn install` to set up dependencies
- Run `yarn build` to preprocess typescript and create package
- Run `yarn test` to verify unitary tests of current features
- Go to `./demo` to run `yarn build`and `yarn serve` to visually and acustically test the code on local server
- Run `yarn docs` to compile typedoc documentation and serve it to verify content on local server
- Run `yarn prepublish` to verify new version standard before any contribution
- Admin only:
  - Update version
  - Run `npm publish`

## 简谱开发路线
- [ ] 1. 实现基本数字符号渲染（1-7）
- [ ] 2. 添加高低音点符号（数字上下方点）
- [ ] 3. 绘制增时线（音符右侧短横线） 
- [ ] 4. 实现减时线（数字下方单横线）
- [ ] 5. 添加小节线渲染
- [ ] 6. 支持连音线（延音线和圆滑线）
- [ ] 7. 实现调号标记（1=XX格式）
- [ ] 8. 添加临时升降记号（#/b符号）
- [ ] 9. 添加拍号显示（如4/4拍）
- [ ] 10. 添加反复记号（D.C.等）
- [ ] 11. 实现装饰音标记
- [ ] 12. 支持多声部纵向排列
