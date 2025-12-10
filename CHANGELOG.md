# Changelog

All notable changes to the BigQuery Data View v2 extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
