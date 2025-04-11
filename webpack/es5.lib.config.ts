import * as path from 'path';

import {baseConfig} from './es5.base.config';

module.exports = {
  ...baseConfig,
  mode: 'production',
  entry: {
    jianpurender: './src/lib.ts',
  },
  output:
      {filename: 'jianpurender.js', path: path.resolve(__dirname, '../dist')},
  optimization: {minimize: true},
};
