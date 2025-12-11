//@ts-check

'use strict';

const path = require('path');

/** @type {import('webpack').Configuration} */
const morphchartsConfig = {
  target: 'web', // webviews run in browser context
  mode: 'production',

  entry: './src/charts/morphcharts-bundle.ts',
  output: {
    path: path.resolve(__dirname, 'resources'),
    filename: 'morphcharts.bundle.js',
    library: {
      type: 'module',
    },
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.morphcharts.json',
              onlyCompileBundledFiles: true,
            },
          },
        ],
      },
    ],
  },
  optimization: {
    minimize: true,
  },
};

module.exports = morphchartsConfig;
