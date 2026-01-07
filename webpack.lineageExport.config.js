//@ts-check
'use strict';

const path = require('path');

/** @type {import('webpack').Configuration} */
const lineageExportConfig = {
    target: 'web', // Browser context for webview
    mode: 'production',

    entry: './src/lineage/browser/lineageExportBrowser.ts',
    output: {
        path: path.resolve(__dirname, 'resources'),
        filename: 'lineageExport.js',
        library: {
            name: 'LineageExport',
            type: 'umd',
            export: 'default'
        },
        globalObject: 'this',
        asyncChunks: false
    },
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            // Browser polyfills for Node.js modules used by dependencies
            "stream": false,
            "buffer": false,
            "util": false,
            "assert": false,
            "fs": false,
            "path": false,
            "os": false,
            "crypto": false
        }
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                // Only include the browser module
                include: path.resolve(__dirname, 'src/lineage/browser'),
                use: [{
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        compilerOptions: {
                            module: 'ESNext',
                            moduleResolution: 'node',
                            target: 'ES2020',
                            lib: ['ES2020', 'DOM']
                        }
                    }
                }]
            }
        ]
    },
    optimization: {
        minimize: true,
        splitChunks: false,
        runtimeChunk: false
    },
    performance: {
        hints: false
    }
};

module.exports = lineageExportConfig;
