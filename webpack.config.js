//@ts-check

'use strict';

const { copyFileSync, mkdirSync, existsSync } = require('fs');
const path = require('path');
const webpack = require('webpack');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node',
  mode: 'none',

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      },
      {
        exclude: [
          path.resolve(__dirname, '.github'),
          path.resolve(__dirname, 'bqsql_parser'),
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  plugins: [
    (a, b) => {
      const distDir = path.join(__dirname, 'dist');
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
      }
      copyFileSync(
        require('path').join(__dirname, 'bqsql_parser', 'pkg', 'bqsql_parser_bg.wasm'),
        require('path').join(__dirname, 'dist', 'bqsql_parser_bg.wasm')
      );
      copyFileSync(
        require('path').join(__dirname, 'bqsql_parser', 'pkg', 'bqsql_parser.js'),
        require('path').join(__dirname, 'dist', 'bqsql_parser.js')
      );
    },
  ],
  infrastructureLogging: {
    level: "log",
  },
};

/** @type WebpackConfig */
const gridV2Config = {
  target: 'web',
  mode: 'none',
  entry: './src/tableResultsPanel/grid/index.tsx',
  output: {
    path: path.resolve(__dirname, 'resources'),
    filename: 'grid-v2.js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              onlyCompileBundledFiles: true,
              compilerOptions: {
                module: 'esnext',
                moduleResolution: 'node',
                target: 'ES2020',
                jsx: 'react-jsx',
                jsxImportSource: 'preact',
                rootDir: './src',
                lib: ['ES2020', 'DOM'],
              },
            },
          },
        ],
      },
    ],
  },
  devtool: 'nosources-source-map',
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': JSON.stringify({ NODE_ENV: 'production' }),
    }),
  ],
};

/** @type WebpackConfig */
const notebookRendererConfig = {
  target: 'web',
  mode: 'none',
  // ES module: VS Code loads a notebook renderer entrypoint as a module and calls its
  // exported activate(). Reuses the Preact BqTable from the grid so notebook cells render
  // identically to the results panel.
  entry: './src/notebook/renderer/index.tsx',
  output: {
    path: path.resolve(__dirname, 'resources'),
    filename: 'notebook-renderer.js',
    library: { type: 'module' },
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              onlyCompileBundledFiles: true,
              compilerOptions: {
                module: 'esnext',
                moduleResolution: 'node',
                target: 'ES2020',
                jsx: 'react-jsx',
                jsxImportSource: 'preact',
                rootDir: './src',
                lib: ['ES2020', 'DOM'],
              },
            },
          },
        ],
      },
      {
        // Bundle grid-v2.css as a raw string so the renderer can inject it into the cell context.
        test: /grid-v2\.css$/,
        type: 'asset/source',
      },
    ],
  },
  devtool: 'nosources-source-map',
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': JSON.stringify({ NODE_ENV: 'production' }),
    }),
  ],
};

module.exports = [extensionConfig, gridV2Config, notebookRendererConfig];
