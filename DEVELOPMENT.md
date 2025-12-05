# Development Guide

This document covers how to build, test, and debug the BigQuery VS Code extension.

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

---

## macOS Setup

### Prerequisites (macOS)

- **Node.js** 16+ ([nodejs.org](https://nodejs.org/))
- **Rust** 1.70+ ([rustup.rs](https://rustup.rs/))
- **wasm-pack** ([rustwasm.github.io/wasm-pack](https://rustwasm.github.io/wasm-pack/installer/))

### Installing Prerequisites (macOS)

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

### First-Time Setup (macOS)

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

### Build Commands (macOS)

```bash
# Development build
npm run compile

# Watch mode (auto-rebuild on changes)
npm run watch

# Production build
npm run package

# Linting
npm run lint

# Run tests
npm run pretest && npm run test
```

### Packaging the Extension (macOS)

```bash
# Ensure dist folder exists
mkdir -p dist

# Create .vsix package
npx @vscode/vsce package
```

This creates a file like `vscode-bigquery-x.x.x.vsix`.

### Installing Locally (macOS)

**Option 1: Command Line**
```bash
code --install-extension vscode-bigquery-x.x.x.vsix --force
```

**Option 2: VS Code UI**
1. Open VS Code
2. Press `Cmd+Shift+X` (Extensions panel)
3. Click the `...` menu at the top
4. Select "Install from VSIX..."
5. Select the `.vsix` file

**Reload After Installing:**
Press `Cmd+Shift+P` → "Developer: Reload Window"

### Quick Build and Install (macOS)

To quickly rebuild and install after making changes:

```bash
# Package and install in one go
npx @vscode/vsce package && code --install-extension vscode-bigquery-*.vsix --force
npx @vscode/vsce package && code --install-extension vscode-bigquery-v2-0.2.6.vsix --force
```

Then reload VS Code: `Cmd+Shift+P` → "Developer: Reload Window"

### Rebuilding After Rust Changes (macOS)

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

### Keyboard Shortcuts (macOS)

| Action | Shortcut |
|--------|----------|
| Open Command Palette | `Cmd+Shift+P` |
| Open Developer Tools | `Cmd+Shift+P` → "Developer: Toggle Developer Tools" |
| Reload Window | `Cmd+Shift+P` → "Developer: Reload Window" |
| Open Extensions | `Cmd+Shift+X` |
| Open Output Panel | `Cmd+Shift+U` |

---

## Windows Setup

### Prerequisites (Windows)

- **Node.js** 16+ ([nodejs.org](https://nodejs.org/))
- **Rust** 1.70+ ([rustup.rs](https://rustup.rs/))
- **wasm-pack** ([rustwasm.github.io/wasm-pack](https://rustwasm.github.io/wasm-pack/installer/))
- **Visual Studio Build Tools** (required for Rust compilation)

### Installing Prerequisites (Windows)

**1. Install Node.js**
- Download from [nodejs.org](https://nodejs.org/)
- Run the installer and follow the prompts
- Restart your terminal after installation

**2. Install Visual Studio Build Tools**
- Download from [Visual Studio Downloads](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
- Run the installer
- Select "Desktop development with C++" workload
- This is required for compiling native Rust dependencies

**3. Install Rust**
- Download `rustup-init.exe` from [rustup.rs](https://rustup.rs/)
- Run the installer and follow the prompts
- Restart your terminal after installation
- Verify installation:
  ```powershell
  rustc --version
  cargo --version
  ```

**4. Install wasm-pack**
```powershell
# Using cargo
cargo install wasm-pack

# Or download from GitHub releases:
# https://github.com/nickel-lang/nickel/releases
```

### First-Time Setup (Windows)

**Using PowerShell:**
```powershell
# Install Node.js dependencies
npm install

# Build the grid_render WASM module
cd grid_render
wasm-pack build --release --target web
cd ..

# Build the bqsql_parser WASM module
cd bqsql_parser
wasm-pack build --target nodejs
cd ..

# Re-install to link the WASM packages
npm install
```

**Using Command Prompt:**
```cmd
rem Install Node.js dependencies
npm install

rem Build the grid_render WASM module
cd grid_render
wasm-pack build --release --target web
cd ..

rem Build the bqsql_parser WASM module
cd bqsql_parser
wasm-pack build --target nodejs
cd ..

rem Re-install to link the WASM packages
npm install
```

### Build Commands (Windows)

```powershell
# Development build
npm run compile

# Watch mode (auto-rebuild on changes)
npm run watch

# Production build
npm run package

# Linting
npm run lint

# Run tests
npm run pretest; npm run test
```

### Packaging the Extension (Windows)

**PowerShell:**
```powershell
# Ensure dist folder exists
New-Item -ItemType Directory -Force -Path dist

# Create .vsix package
npx @vscode/vsce package
```

**Command Prompt:**
```cmd
rem Ensure dist folder exists
if not exist dist mkdir dist

rem Create .vsix package
npx @vscode/vsce package
```

This creates a file like `vscode-bigquery-x.x.x.vsix`.

### Installing Locally (Windows)

**Option 1: Command Line**
```powershell
code --install-extension vscode-bigquery-x.x.x.vsix --force
```

**Option 2: VS Code UI**
1. Open VS Code
2. Press `Ctrl+Shift+X` (Extensions panel)
3. Click the `...` menu at the top
4. Select "Install from VSIX..."
5. Select the `.vsix` file

**Reload After Installing:**
Press `Ctrl+Shift+P` → "Developer: Reload Window"

### Quick Build and Install (Windows)

To quickly rebuild and install after making changes:

**PowerShell:**
```powershell
# Package and install in one go
npx @vscode/vsce package; code --install-extension (Get-Item vscode-bigquery-*.vsix).Name --force
```

**Command Prompt:**
```cmd
npx @vscode/vsce package && for %f in (vscode-bigquery-*.vsix) do code --install-extension %f --force
```

Then reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"

### Rebuilding After Rust Changes (Windows)

**PowerShell:**
```powershell
# Rebuild grid_render
cd grid_render
wasm-pack build --release --target web
cd ..

# Or rebuild bqsql_parser
cd bqsql_parser
wasm-pack build --target nodejs
cd ..

# Re-link packages
npm install

# Repackage extension
npx @vscode/vsce package
```

### Keyboard Shortcuts (Windows)

| Action | Shortcut |
|--------|----------|
| Open Command Palette | `Ctrl+Shift+P` |
| Open Developer Tools | `Ctrl+Shift+P` → "Developer: Toggle Developer Tools" |
| Reload Window | `Ctrl+Shift+P` → "Developer: Reload Window" |
| Open Extensions | `Ctrl+Shift+X` |
| Open Output Panel | `Ctrl+Shift+U` |

---

## Debugging

### Method 1: Extension Development Host (Recommended)

1. Open the project in VS Code
2. Press `F5` to launch a new VS Code window with the extension loaded
3. This "Extension Development Host" window runs your extension in debug mode
4. Set breakpoints in TypeScript files and they will be hit

### Method 2: Developer Tools Console

To debug runtime issues or see console logs:

1. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows)
2. Type "Developer: Toggle Developer Tools" and press Enter
3. Click the **Console** tab to see logs and errors
4. Click the **Network** tab to inspect API requests

### Debugging WASM Modules

The Rust WASM modules (`grid_render`, `bqsql_parser`) log to the browser console. To see these logs:

1. Open Developer Tools (Command Palette → "Developer: Toggle Developer Tools")
2. Go to the **Console** tab
3. Look for messages from `grid_render.js` or `bqsql_parser.js`

To add debug logging in Rust code:
```rust
use web_sys::console;
use wasm_bindgen::JsValue;

console::log_1(&JsValue::from_str("Debug message here"));
```

---

## Common Issues

### WASM files not found during build

**macOS:**
```bash
mkdir -p dist
npm install
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Force -Path dist
npm install
```

### Extension not activating
- Check that you have a `.bqsql` or `.sql` file open
- Check the Output panel for errors (`Cmd+Shift+U` on macOS, `Ctrl+Shift+U` on Windows)

### API returning 404 errors
- Open Developer Tools → Network tab
- Check that `location` parameter is included in BigQuery API URLs
- Verify authentication is working (check for `Authorization` header)

### Rust compilation fails on Windows
- Ensure Visual Studio Build Tools are installed with "Desktop development with C++" workload
- Restart your terminal after installing Rust
- Try running `rustup update` to ensure you have the latest toolchain

### wasm-pack not found
**macOS:**
```bash
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

**Windows:**
```powershell
cargo install wasm-pack
```

### Concurrent versions 

VS Code caching issue. Try these steps:

  1. Close VS Code completely
  2. Uninstall the extension:
  code --uninstall-extension sseveur.vscode-bigquery-v2
  3. Reinstall:
  code --install-extension vscode-bigquery-v2-0.2.6.vsix --force
  4. Restart VS Code

Or try running this:

   1. List the different applications in VS Code 
   code --list-extensions | grep -i bigquery
   2. Uninstall the original one:
   ⏺ Bash(code --uninstall-extension bstruct.vscode-bigquery)
   ⎿  Uninstalling bstruct.vscode-bigquery


---

## Publishing

### First-Time Setup: Create a Publisher Account

1. **Create a Microsoft Account** (if you don't have one):
   - Go to https://account.microsoft.com and sign up

2. **Create a Publisher on VS Code Marketplace**:
   - Go to https://marketplace.visualstudio.com/manage
   - Sign in with your Microsoft account
   - Click "Create publisher"
   - Enter your publisher ID (must match `"publisher"` in package.json)
   - Fill in display name and other details
   - Click "Create"

3. **Create a Personal Access Token (PAT)**:
   - Go to https://dev.azure.com
   - Sign in with the same Microsoft account
   - Click your profile icon (top right) → "Personal access tokens"
   - Click "New Token"
   - Configure the token:
     - **Name**: `vscode-marketplace` (or any name you prefer)
     - **Organization**: Select "All accessible organizations"
     - **Expiration**: Choose your preferred duration
     - **Scopes**: Click "Custom defined", then scroll down to "Marketplace" and check **Manage**
   - Click "Create"
   - **Copy the token immediately** (you won't be able to see it again)

4. **Login with vsce**:
   ```bash
   npx @vscode/vsce login YOUR_PUBLISHER_ID
   # Paste your PAT when prompted
   ```

### Publishing Commands

```bash
# Publish to VS Code Marketplace (requires authentication)
npm run deploy

# Create pre-release package
npm run package-dev
```

### Updating an Existing Extension

After making changes:

```bash
# 1. Update version in package.json (e.g., 0.2.6 -> 0.2.7)

# 2. Package and publish
npx @vscode/vsce publish
```

Alternatively, auto-increment version:

```bash
# Increment patch version (0.2.6 -> 0.2.7) and publish
npx @vscode/vsce publish patch

# Increment minor version (0.2.6 -> 0.3.0) and publish
npx @vscode/vsce publish minor

# Increment major version (0.2.6 -> 1.0.0) and publish
npx @vscode/vsce publish major
```
