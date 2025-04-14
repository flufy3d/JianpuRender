import * as path from 'path';
import * as webpack from 'webpack';

export const baseConfig = {
  module: {
    rules: [{
      test: /\.ts$/,
      exclude: /node_modules/,
      use: { loader: 'ts-loader', options: { configFile: 'tsconfig.es5.json' } }
    }],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      "fs": false,
      "path": require.resolve("path-browserify")
    }
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(
      /\/core\/compat\/global\.ts/,
      path.resolve(__dirname, '../src/core/compat/global_browser.ts')),
  ]
};
