# Changelog

All notable changes to the BigQuery Studio extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
