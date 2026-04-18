# Changelog

All notable changes to the BigQuery Studio extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.11.1] - 2026-04-18

### Fixed

- **Lineage export on Windows** - Fixed "Failed to export PNGs: t is not a constructor" error when exporting lineage as PNG or PDF on Windows (and other platforms using the published extension). SVG→PNG conversion now runs in the webview using the browser's Canvas API instead of the native `@resvg/resvg-js` module, eliminating the platform-specific binary dependency. The dark/light export theme toggle now updates in real-time without needing to re-run lineage analysis.

## [1.11.0] - 2026-04-08

### Added

- **Page Number Picker** - Navigate directly to a specific page in query results and table previews. Type a page number in the input between the Previous/Next buttons and press Enter. Shows current page and total pages count.

## [1.10.0] - 2026-04-08

### Added

- **Logical Operator Style** - New `formatLogicalOperatorStyle` formatter setting with three options: `keywordAligned` (default, current behavior), `contentAligned` (AND/OR/ON align with parent clause content), and `indented` (AND/OR/ON indented under parent keyword). Also splits inline ON from JOIN lines for cleaner formatting. Works with all indent styles.

## [1.9.0] - 2026-02-11

### Added

- **Table Search** - Search tables across all projects and datasets via the explorer title bar search icon. Uses a local cached index for instant results.
- **Build Table Index** - New command `BigQuery: Build Table Index` crawls all projects/datasets/tables and caches them locally in VS Code globalState. Required before search works. Cancellable with per-project progress.
- **Pinned Tables** - Pin frequently-used tables to a "Pinned Tables" folder at the top of the explorer tree. Pin/unpin via inline icons on table context menus.
- **Pinned Table Visual Feedback** - Tables that are already pinned show a filled pin icon in the normal tree, making it easy to see which tables are pinned at a glance.
- **Copy Table Path** - Right-click any table to copy its full qualified path (`project.dataset.table`) to clipboard.
- **Pinned Tables Setting** - New setting `vscode-bigquery.pinned-tables` to manage pinned tables. Format: `project.dataset.table`.

## [1.8.8] - 2026-01-07

### Fixed

- **Auth Panel Loading State** - Auth panel now shows loading spinner immediately instead of blank panel while fetching accounts from gcloud
- **PDF Export** - Bundled `jspdf` and `svg2pdf.js` so lineage PDF export works in published extension

## [1.8.7] - 2026-01-07

### Fixed

- **Windows Extension Activation** - Fixed extension failing to activate on Windows. Native modules (`@resvg/resvg-js`, `jspdf`) were imported at top level causing crash on startup. Changed to lazy/dynamic imports so they only load when user exports lineage charts.

## [1.8.5] - 2026-01-07

### Fixed

- **Windows Authentication** - Restored EXACT v1.3.3 authentication code (execFile with array args, shell:true on Windows)

## [1.8.4] - 2026-01-07

### Fixed

- **Windows Authentication** - Reverted to simple cp.exec() method from v1.3.3 for maximum compatibility

## [1.8.3] - 2026-01-07

### Fixed

- **Windows Authentication** - Properly fixed Windows authentication using `cp.execFile()` with array arguments and `shell: true` on Windows only. This allows PATH resolution of `gcloud.cmd` while maintaining security (no shell injection). Added helpful error message when gcloud CLI is not found.

## [1.8.1] - 2026-01-07

### Added

- **Revoke Session Command** - New command `BigQuery: Revoke Session` in Command Palette to sign out from authenticated Google accounts
- **Command Palette Documentation** - README now includes full list of all 27 available commands organized by category

### Fixed

- **Command Naming** - Fixed typo "BigueryView" to "BigQuery" in all command titles for consistent naming
- **Missing Commands** - Added missing commands to package.json: User Login with Google Drive, Initialize gcloud, Copy to Clipboard

### Changed

- **Standardized Command Titles** - All command palette commands now use consistent "BigQuery:" prefix and proper Title Case

## [1.8.0] - 2026-01-03

### Added

- **Hierarchical SQL Query Folding** - Multi-level code folding for better navigation of complex queries:
  - **Top-level statements** - Collapse entire queries (CREATE/SELECT to semicolon)
  - **CTE definitions** - Collapse each CTE independently (WITH cte_name AS (...))
  - **SELECT clauses** - Collapse column lists (SELECT ... FROM)
  - **FROM clauses** - Collapse entire FROM blocks with all JOINs
  - **Individual JOINs** - Collapse each JOIN and its ON/USING conditions separately
  - Supports nested folding: collapse parent to hide all children, or collapse children individually
- **Smart Column Autocomplete Without Alias** - When typing in SELECT clause, autocomplete now shows all columns from all tables in FROM/JOIN clauses, even without typing a table prefix. Columns are deduplicated and work with CTEs.
- **Auto-Preview CREATE TABLE Results** - Optionally show first 100 rows automatically after CREATE TABLE completes. Enable in settings: `vscode-bigquery.autoPreviewCreatedTables` (disabled by default).

### Fixed

- **Column Autocomplete Comma** - Column autocomplete no longer automatically adds trailing comma after column name insertion.

## [1.7.0] - 2026-01-02

### Added

- **Lineage Chart Export** - Export data lineage visualizations as PNG or PDF images:
  - **PNG export** - High-quality raster images (2x resolution) ideal for documentation and wikis
  - **PDF export** - Vector PDFs that scale perfectly, ideal for printing and sharing
  - **Single-query export** - Download individual lineage chart from header buttons (↓ PNG / ↓ PDF)
  - **Multi-query individual export** - Download each query's lineage separately using per-section PNG/PDF buttons
  - **Multi-query bulk export** - Download all lineages at once:
    - "↓ All PNG" creates separate files (lineage_query1.png, lineage_query2.png, etc.)
    - "↓ All PDF" creates single multi-page document with all queries
  - **Smart file naming** - Files automatically named with query info, line ranges, and timestamps (e.g., `lineage_query1_lines1-15_20260102_143052.png`)
  - **Theme switching** - Toggle between dark (default) and light export themes via Command Palette (`BigQuery: Toggle Lineage Export Theme`) or settings
  - Export buttons appear in lineage panel header and per-query sections
  - Uses resvg-js for PNG conversion and jsPDF for PDF generation

## [1.6.3] - 2026-01-02

### Fixed

- **Windows Query Results Display** - Fixed blank results panel on Windows by removing Content Security Policy (CSP) from results webview. The CSP added in v1.4.0 was blocking WebAssembly module loading on Windows, preventing query results from rendering. Results now display correctly on all platforms.

## [1.6.2] - 2026-01-02

### Fixed

- **Lineage Panel Layout** - Fixed data lineage panel display to show each query section with uniform height (500px max) and proper scrolling. Users can now scroll through all lineages instead of having them all visible at once, making it easier to navigate files with many queries.
- **Lineage Arrow Alignment** - Fixed arrowhead markers to properly align with curve direction. Arrowheads now rotate to match the exact angle of the Bezier curve at their endpoint, making them parallel to the line.
- **Lineage Vertical Centering** - Graphs are now vertically centered based on output nodes (TARGET/RESULT) rather than all nodes, making the output the visual focal point.

## [1.6.1] - 2026-01-02

### Fixed

- **Lineage Query Splitting** - Fixed data lineage visualization to properly split SQL files into multiple queries instead of treating the entire file as a single query. The `sql-parser-cst` library didn't support `NULLS LAST/FIRST` syntax, causing parsing to fail. Implemented preprocessing that replaces unsupported syntax with spaces (maintaining offset alignment) before parsing, then extracts from the original SQL to preserve all syntax.

## [1.6.0] - 2026-01-01

### Added

- **Hide Project Feature** - Hide GCP projects from the explorer tree to reduce clutter:
  - Right-click on any project and click the "Hide" button (eye-closed icon)
  - Use `BigQuery: Show Hidden Projects` command from the Command Palette to unhide projects via QuickPick selection
  - Hidden projects can also be managed directly in settings via `vscode-bigquery.hidden-projects`

## [1.5.0] - 2026-01-01

### Added

- **Schema Refresh Command** - New command `BigQuery: Refresh Schema Cache` to clear cached table schemas when they become outdated. Access via Command Palette (`Ctrl+Shift+P`) when hovering over tables shows stale schema information.

## [1.4.0] - 2025-12-31

### Added

- **Smart Column Autocomplete** - When typing after a table alias or CTE name followed by `.`, the extension now suggests columns from that table or CTE:
  - **CTE columns** - Type `cte_name.` or `alias.` to see columns defined in the CTE's SELECT clause
  - **Physical table columns** - Type `alias.` or `` `project.dataset.table`. `` to see columns from BigQuery tables (schema must be cached first via hover)
  - **Alias resolution** - Automatically resolves table aliases to their source CTE or physical table
  - Works during active typing with incomplete SQL (regex fallback when parser fails)

- **Column Priority in Autocomplete** - Columns now appear before functions and keywords in the autocomplete list, making it easier to find the columns you need

- **Dot Trigger for Completions** - The `.` character now triggers the autocomplete popup automatically when typing after table names or aliases

- **Query Result Node** - SELECT-only queries now show an orange "Query Result" node in the lineage graph, making the data flow destination visible

- **Show Data Lineage for Selection** - Right-click on selected SQL text to generate lineage for just that portion of code (available in `.bqsql` and `.sql` files when text is selected)

- **Collapsible Query Sections** - Multi-query lineage views now have collapse/expand toggles for each query section, with chevron icons for better navigation

### Fixed

- **Lineage Edge Visibility** - Fixed an issue where edges between source tables and multiple CTEs were not visible when they overlapped. Edges that skip layers now curve to remain visible

- **CTE Source Table Extraction** - Fixed extraction of source tables from CTEs that use table aliases (e.g., `FROM table_name alias`)

- **Alias Resolution in Main Query** - Fixed alias resolution to correctly find aliases defined in the main query rather than matching aliases inside CTE definitions

### Security

- **XSS Prevention** - HTML escaping and data attributes in authentication UI
- **Content Security Policy** - Nonce-based CSP for all webviews
- **Script Injection Prevention** - JSON escaping for embedded data in script tags
- **Service Account Validation** - Validate JSON structure before accepting key files
- **Error Sanitization** - Prevent credential exposure in error logs

## [1.3.3] - 2025-12-29

### Added

- **Block Comment Support** - Added `/* */` block comment syntax highlighting and folding

## [1.1.0] - 2025-12-10

### Added

- **Multi-Query Lineage Support** - When a SQL file contains multiple queries (separated by semicolons), the lineage view now shows each query's lineage diagram stacked vertically in a scrollable view. Each section displays:
  - Query number and line range
  - Query preview text
  - Node statistics (sources, CTEs, targets)
  - Individual zoom controls per graph
  - Click query header to jump to that query in the editor

- **Data Lineage Click-to-Navigate** - Click on any node in the lineage graph to navigate directly to its location in the SQL source code. The table or CTE reference will be highlighted in the editor.

- **Lineage Node Tooltips** - Hover over nodes in the lineage graph to see the full qualified table name (project.dataset.table).

- **New SQL Formatting Options** - Extended formatting configuration with 7 new settings:
  - `formatExpressionWidth` - Control maximum expression width before line breaks
  - `formatFunctionCase` - Set case for function names (upper/lower/preserve)
  - `formatIdentifierCase` - Set case for identifiers (upper/lower/preserve)
  - `formatDataTypeCase` - Set case for data types (upper/lower/preserve)
  - `formatDenseOperators` - Pack operators without spaces (e.g., `1+1`)
  - `formatLogicalOperatorNewline` - Control newline position for AND/OR (before/after)
  - `formatNewlineBeforeSemicolon` - Place semicolon on separate line

- **Auto-Reveal Results Setting** - New `autoRevealResults` setting to control whether the results panel automatically reveals when switching to a BigQuery SQL file. Disable to prevent unwanted focus switches.

- **Results Panel Persistence** - Query results are now preserved when switching between tabs or moving the results panel, using VS Code's `retainContextWhenHidden` option.

- **Syntax Highlighting for ALL, ANY, SOME** - Added syntax highlighting for the `ALL`, `ANY`, and `SOME` SQL operators.

### Changed

- Improved SQL parser integration for better table reference extraction with position tracking
- Enhanced lineage graph rendering with clickable interactive nodes

### Fixed

- Query results no longer disappear when switching editor tabs
- Lineage navigation now correctly tracks source document even when webview has focus

## [1.0.2] - Previous Release

- Initial stable release with core features:
  - Authentication via gcloud CLI
  - Project/Dataset/Table explorer
  - Query execution with real-time validation
  - SQL Intellisense and syntax highlighting
  - SQL formatting
  - Query history
  - Cost estimation
  - Table schema hover
  - Data lineage visualization
  - CSV/JSONL export
  - Pub/Sub integration
