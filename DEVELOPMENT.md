# Development Guide

This document covers how to build, test, and debug the BigQuery VS Code extension.

## Prerequisites

- **Node.js** 16+ ([nodejs.org](https://nodejs.org/))
- **Rust** 1.70+ ([rustup.rs](https://rustup.rs/))
- **wasm-pack** ([rustwasm.github.io/wasm-pack](https://rustwasm.github.io/wasm-pack/installer/))

### Installing Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

## Project Structure

```
vscode-bigquery/
├── src/                    # TypeScript extension code
│   ├── extension.ts        # Extension entry point
│   ├── extensionCommands.ts # Command implementations
│   ├── language/           # Language features (diagnostics, completion, etc.)
│   ├── services/           # BigQuery client and utilities
│   └── tableResultsPanel/  # Results rendering
├── grid_render/            # Rust WASM module for rendering query results
│   └── src/
│       ├── bigquery/       # BigQuery API interactions
│       └── custom_elements/ # Web components for results display
├── bqsql_parser/           # Rust WASM module for SQL parsing
├── resources/language/     # Language configuration and grammar
└── dist/                   # Compiled output (generated)
```

## Build Commands

### First-Time Setup

```bash
# Install Node.js dependencies
npm install

# Build the grid_render WASM module
cd grid_render && wasm-pack build --release --target web && cd ..

# Build the bqsql_parser WASM module
cd bqsql_parser && wasm-pack build --target nodejs && cd ..

# Re-install to link the WASM packages
npm install
```

### Development Build

```bash
npm run compile
```

### Watch Mode (auto-rebuild on changes)

```bash
npm run watch
```

### Production Build

```bash
npm run package
```

### Linting

```bash
npm run lint
```

### Run Tests

```bash
npm run pretest && npm run test
```

## Packaging the Extension

```bash
# Ensure dist folder exists
mkdir -p dist

# Create .vsix package
npx @vscode/vsce package
```

This creates a file like `vscode-bigquery-x.x.x.vsix`.

## Installing Locally

### Option 1: Command Line

```bash
code --install-extension vscode-bigquery-x.x.x.vsix
```

### Option 2: VS Code UI

1. Open VS Code
2. Press `Cmd+Shift+X` (Extensions panel)
3. Click the `...` menu at the top
4. Select "Install from VSIX..."
5. Select the `.vsix` file

### Reload After Installing

Press `Cmd+Shift+P` → "Developer: Reload Window"

## Debugging

### Method 1: Extension Development Host (Recommended)

1. Open the project in VS Code
2. Press `F5` to launch a new VS Code window with the extension loaded
3. This "Extension Development Host" window runs your extension in debug mode
4. Set breakpoints in TypeScript files and they will be hit

### Method 2: Developer Tools Console

To debug runtime issues or see console logs:

1. Press `Cmd+Shift+P` to open the Command Palette
2. Type "Developer: Toggle Developer Tools" and press Enter
3. Click the **Console** tab to see logs and errors
4. Click the **Network** tab to inspect API requests

**Useful shortcuts:**
| Action | Shortcut |
|--------|----------|
| Open Command Palette | `Cmd+Shift+P` |
| Open Developer Tools | `Cmd+Shift+P` → "Developer: Toggle Developer Tools" |
| Reload Window | `Cmd+Shift+P` → "Developer: Reload Window" |
| Open Extensions | `Cmd+Shift+X` |

### Debugging WASM Modules

The Rust WASM modules (`grid_render`, `bqsql_parser`) log to the browser console. To see these logs:

1. Open Developer Tools (`Cmd+Shift+P` → "Developer: Toggle Developer Tools")
2. Go to the **Console** tab
3. Look for messages from `grid_render.js` or `bqsql_parser.js`

To add debug logging in Rust code:
```rust
use web_sys::console;
use wasm_bindgen::JsValue;

console::log_1(&JsValue::from_str("Debug message here"));
```

### Common Issues

**WASM files not found during build:**
```bash
mkdir -p dist
npm install
```

**Extension not activating:**
- Check that you have a `.bqsql` or `.sql` file open
- Check the Output panel (`Cmd+Shift+U`) for errors

**API returning 404 errors:**
- Open Developer Tools → Network tab
- Check that `location` parameter is included in BigQuery API URLs
- Verify authentication is working (check for `Authorization` header)

## Rebuilding After Rust Changes

If you modify the Rust code in `grid_render/` or `bqsql_parser/`:

```bash
# Rebuild the modified WASM module
cd grid_render && wasm-pack build --release --target web && cd ..
# or
cd bqsql_parser && wasm-pack build --target nodejs && cd ..

# Re-link packages
npm install

# Repackage extension
npx @vscode/vsce package
```

## Publishing

```bash
# Publish to VS Code Marketplace (requires authentication)
npm run deploy

# Create pre-release package
npm run package-dev
```
