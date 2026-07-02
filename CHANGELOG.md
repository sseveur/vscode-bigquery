# Changelog

All notable changes to the BigQuery Studio extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.0] - 2026-07-03

### Added

- **Chart tab in the results grid** - Results | Schema | **Chart**, in the results panel and notebook cells alike. Bar, line, or scatter; X is any scalar column (categories, numbers, or dates/timestamps with a time axis); Y is a row count or any numeric column with Sum/Avg/Min/Max per category. Instant hover tooltips, compact axis numbers (1.2K, 2.5M), colors from the editor theme's chart palette (light and dark both correct). Charts up to 1,000 rows and the top 30 categories — a note in the toolbar says so whenever anything is capped or skipped.
- **Color by column** - Split the chart into one series per value of a categorical column: up to six series with fixed theme hues and a legend; smaller values fold into a neutral "Other" (aggregated correctly). Grouped bars per category, per-series lines and scatter points.

### Removed

- **Dead charting internals** - The old MorphCharts-based chart code had been unreachable for many releases (its command and panel registrations were disabled) while still shipping an 808 KB bundle in every install and running an extra compile pass on every build. All of it is gone: the extension is smaller, builds are faster, and the description's charting claim is true again.

## [2.6.3] - 2026-07-03

### Fixed

- **"Open as Notebook" on unsaved files** - Running the command on an untitled buffer produced an empty notebook (the serializer reads from disk, and unsaved buffers have none). Untitled buffers are now converted directly from the editor text — same `-- %%` marker and statement-split rules — and open as an untitled notebook you can run immediately and save later.

## [2.6.2] - 2026-07-03

### Fixed

- **Tabular formatter mangled function-call arguments** - In `tabularLeft`/`tabularRight`, arguments of calls like `LOGICAL_OR(…)` / `STRING_AGG(… ORDER BY …)` were scattered: `AND`/`OR` landed in the clause keyword gutter, `ORDER BY` inside aggregates got keyword padding, and nested parens drifted. Parens are now classified character-by-character (`OVER (` window · `IDENT(` function call · otherwise clause scope): function arguments indent one tab per nesting level under the line that opened the call, and OVER-window internals move as one block with their opener instead of with unrelated scopes at the same paren depth.
- **Compound statement heads split** - `CREATE    TEMP TABLE` (and other `CREATE`/`INSERT INTO`/`MERGE INTO`-style heads) are re-joined the same way compound JOINs are.

### Changed

- **CTE and subquery bodies sit one tab in** - Tabular styles previously started a CTE body at the `WITH` content column (~10 columns deep). Bodies are now re-based to one `tabWidth` per nesting depth, with the closing `)` and follow-up `, name AS (` aligned at the parent keyword column.

## [2.6.1] - 2026-06-18

### Fixed

- **Notebook SCRIPT cells with no final SELECT** - Scripts ending in DML now show the affected-row banner (e.g. `INSERT · 2 inserted`); pure `DECLARE`/DDL scripts show a text summary (statement count, types, bytes, duration) instead of an empty, columnless grid. Under the hood the script child-job picker was effectively dead — `jobs.list`'s default projection strips the fields it matched on — so `getChildJobs` now requests `projection=full`, the picker matches the newest non-DDL child with a destination table, and a completion barrier runs before listing children.
- **Horizontal scrollbar covered the last row** - The results table now keeps clearance below the last row so the overlay scrollbar floats in empty space (results panel + notebook cells).

### Changed

- **Notebook cell output height is dynamic** - Short results hug their rows; long pages cap at 460px and scroll inside the grid. DML-only results collapse to just the banner.
- **Notebook exports unified into the grid** - The CSV/JSONL/Pub/Sub/Copy buttons inside the grid now work in notebook cells (routed to the extension host over renderer messaging — same export flows as the results panel). The redundant cell status-bar export buttons are removed; only VS Code's language indicator remains below cells.

## [2.6.0] - 2026-06-18

### Added

- **Notebook cells render through the grid-v2 grid** - BigQuery notebook output now uses the same Preact grid as the results panel instead of a separate vanilla-HTML table. Cells get the full grid: per-type cell colors (honoring the `vscode-bigquery.gridColors` setting), STRUCT/ARRAY expansion, CSV/JSONL/clipboard export, and **load-more pagination beyond the first page** — the renderer requests further pages from the extension host over notebook messaging, so results no longer cap at the initially loaded rows. Multi-statement SCRIPT results source rows and schema from one raw `/queries` response so previously-empty cells now populate.
- **Fast unit test suite** (`npm run test:unit`) - Headless mocha (no Extension Host, no network, no auth) covering the deterministic logic: BigQuery wire-format decode, the formatter fixes (CTE gutter, window frames), and result pagination. 40 tests, ~30 ms.

### Changed

- **BigQuery SDK 7.9.0 → 7.9.3** - Stays on the node>=14 release line, so the `^1.63.0` engine is unaffected. Picks up upstream fixes: `jobs.query` timeout-error propagation, no schema-field mutation when passing `selectedFields`, and `selectedFields` forwarded to `tabledata.list` (the table-preview path). The 8.x line was evaluated and declined — it requires node>=18 (conflicts with the engine) and adds only features this extension doesn't use.
- `tsconfig.json` now sets `skipLibCheck` so `tsc -p .` / `pretest` build cleanly against third-party bundled type definitions.

## [2.5.2] - 2026-06-13

### Fixed

- **Tabular formatter broke inside CTEs** - In `tabularLeft`/`tabularRight` indent styles, `ON`/`AND` inside a CTE (and any subquery/derived table) were dumped at column 0 instead of the keyword gutter, because the realign pass only handled top-level (depth-0) clauses. The realign is now depth-aware: each parenthesized scope (CTE body, subquery) computes its own gutter, every clause keyword and `ON`/`AND`/`OR` is re-padded into it, and continuation lines shift with their governing clause. `FROM` now aligns with `INNER JOIN` (gutter widens to the longest keyword), and content lines up on one column within each scope.
- **Window frames mangled** - `ROWS`/`RANGE BETWEEN … PRECEDING AND … ` analytic frames were split across lines with the frame's `AND` mistaken for a logical operator, a spurious comma inserted, and an orphan comma turned into a blank line. New `normalizeWindowFrames` pass moves a trailing frame onto its own line and rejoins a split `AND <upper bound>`; the realign skips `OVER(…)` window internals; `collapseKeyClauses` no longer slurps the frame into the window `ORDER BY`; and the leading-comma pass drops orphan-comma blank lines.

### Changed

- **Default `formatLogicalOperatorStyle` is now `indented`** - `AND`/`OR` indent one level under their parent clause while `ON` stays at the keyword gutter — the most common BigQuery layout. Set the value explicitly to `keywordAligned` or `contentAligned` to keep the previous behavior.

## [2.5.1] - 2026-06-10

### Changed

- **README overhaul** - Onboarding-first structure (Features → Install → Quick Start → visual tour, reference tables after), fresh screenshots (hero editor + results grid, grid closeup, tabular formatter example), Pub/Sub merged into Export Options, fork notice moved to Project History. Docs-only release to refresh the Marketplace page.

## [2.5.0] - 2026-06-10

### Added

- **Preview Table from the editor** - Right-click a table name in a SQL file and pick "BigQuery: Preview Table". The reference under the cursor is resolved — fully-qualified `project.dataset.table` (backticked or hyphenated), `dataset.table`, a bare table name, or a FROM/JOIN alias — and the standard preview grid opens, exactly like clicking the table in the explorer. Views and external tables open a `SELECT *` editor instead (they can't be read via `tabledata.list`). New resolver: `resolveTableAtPosition` in `src/services/columnResolver.ts`.

### Fixed

- **ON/AND misaligned in tabular indent styles** - Two formatter bugs in `tabularLeft`/`tabularRight` modes: sql-formatter split compound JOIN keywords (`INNER     JOIN`, treating INNER as the alignment keyword), and ON/AND/OR sat at a flat 4-space indent instead of the keyword gutter. Each statement is now realigned as a whole: compound JOINs are re-joined, the keyword gutter widens to fit the longest keyword (`INNER JOIN` → 11, `LEFT OUTER JOIN` → 16), every clause keyword and ON/AND/OR is re-padded into it, and continuation lines shift with it — so all content sits on one column. `keywordAligned` puts ON/AND in the gutter, `indented` keeps AND/OR one tab in (content still aligned), `contentAligned` is unchanged; ON always reads as a clause keyword. `standard` indent style is untouched.
- **Pinned tables not updating (Windows)** - Pin-state matching was exact-string, so entries whose casing differed from the API-returned ids (hand-edited settings, Settings Sync across machines) never matched: tables kept showing the pin icon, pinning again silently duplicated, and unpin left stale entries. Matching/dedupe is now trimmed and case-insensitive, and the explorer refreshes automatically whenever the pinned/projects/tables settings change from any source (Settings Sync, manual settings.json edits).

## [2.4.0] - 2026-06-02

### Added

- **Column Profile: duplicate metrics** - The profile panel now surfaces duplication for numeric and orderable columns: **Unique** (Yes/No — whether every non-null value is distinct, a quick key-candidate check), **Duplicate values** (how many distinct values appear more than once), and **Duplicate rows** (total rows belonging to a duplicated value, with percentage of the result set). Computed from the existing `counts` CTE in `buildProfileSql`; opaque types (ARRAY/STRUCT/JSON/GEOGRAPHY) leave these `null`.
- **Setting: `vscode-bigquery.formatInlineKeyClauses`** (default `false`) - When enabled, `GROUP BY` and `ORDER BY` item lists are kept on a single line if they fit within `formatExpressionWidth`, wrapping at comma boundaries only when they exceed it. `SELECT` stays expanded. A clause containing a line comment is left expanded. Implemented as a post-pass (`collapseKeyClauses`) in `bqsqlFormatter.ts`.

### Changed

- **Settings UI grouped into sections** - The extension's settings are now organised into themed sections in the Settings UI (General, Explorer, Results & Clipboard, CTE Preview, Formatting, Lineage) instead of one flat list. Setting keys are unchanged, so existing configurations keep working.

### Fixed

- **Copy to clipboard added a blank row in Excel** - The clipboard payload ended with a trailing newline, which Excel/Sheets pasted as an extra empty row. The trailing newline is now stripped before writing.
- **SQL Notebook returned nothing for temp-table scripts** - A multi-statement script (`DECLARE` / `CREATE TEMP TABLE` / `SELECT`) runs as a SCRIPT parent job that carries no result rows of its own, so notebook cells rendered empty. The controller now detects SCRIPT jobs, resolves the final result-bearing child job (shared `selectFinalResultChildJob` helper), and renders its rows.

## [2.3.0] - 2026-05-30

### Added

- **Column Profile (right-click)** - Place the cursor on a column name in a SQL file, right-click, and pick "BigQuery: Profile Column". The surrounding statement is parsed to find tables in scope (FROM/JOIN, aliases, CTEs), the column word at the cursor is matched against their schemas — supports unqualified columns and `alias.column` references — and a type-aware aggregate query (`COUNT`, `COUNT(DISTINCT)`, `NULL%`, `MIN`, `MAX`, `APPROX_QUANTILES(20)`, top-20 values) runs directly against the source table. Results render in a side panel with a quantile-derived density histogram + box plot for numeric/temporal columns and a top-values bar chart for categorical columns. The distribution chart has a Linear/Log tab toggle (CSS-only, no scripts) using signed-log (`sign(x)·log10(1+|x|)`) so heavy-tailed distributions stay readable and negatives don't crash. All sections (Stats, Distribution, Quantiles, Top values, Source SQL) are collapsible via native `<details>`. New files: `src/services/columnResolver.ts`, charts in `src/tableResultsPanel/columnProfilePanel.ts`.

## [2.2.1] - 2026-05-29

### Fixed

- **Preview CTE missed preceding DECLARE/SET** - The rewrite started at the `WITH` keyword, so any `DECLARE` or `SET` statement above the WITH was dropped from the preview. When a CTE referenced a declared variable, the preview query failed with "Unrecognized name". `extractCtePreviews` now collects every top-level `declare_stmt` / `set_stmt` that appears before the target WITH in the same script and prepends them (with semicolons) to the rewritten query.

## [2.2.0] - 2026-05-28

### Added

- **Preview CTE** - A clickable "▷ Preview CTE" CodeLens now appears above each CTE in a top-level `WITH` clause (like the dbt Power User extension). Clicking runs that CTE in isolation and shows the rows in the results grid. The rewrite keeps every CTE from the start of the `WITH` through the target one, so all of the CTE's dependencies are included automatically (SQL forbids forward CTE references, so everything it needs is already above it). `RECURSIVE`, comments, and formatting are preserved verbatim. Powered by `sql-parser-cst` CTE ranges (`src/services/ctePreview.ts`).
- **Setting: `vscode-bigquery.enableCtePreviewCodeLens`** (default `true`) - Toggle the Preview CTE CodeLens.
- **Setting: `vscode-bigquery.ctePreviewRowLimit`** (default `100`) - Row limit appended to the preview query.

## [2.1.0] - 2026-05-27

### Added

- **Persistent notebook cell layout** - When you merge or split cells in SQL notebook mode, the layout now survives save/reload. On save, if your cell boundaries differ from the parser's auto-split, Jupytext-style `-- %%` marker lines are written between cells; on load, those markers drive the split. Files whose layout already matches auto-split stay marker-free (clean diff). `-- %%` is a valid SQL comment, so the file remains runnable in any tool.
- **Setting: `vscode-bigquery.gcloudPath`** - Optional full path to the gcloud executable. Leave empty to auto-detect.

### Fixed

- **gcloud not found when VS Code launched from Dock/Finder** - macOS/Linux GUI launches inherit a minimal PATH (no `/opt/homebrew/bin`, `/usr/local/bin`, …), so authentication failed with "gcloud CLI not found" even when gcloud worked in a terminal. `runGcloudCommand` now resolves the binary from the `gcloudPath` setting and common SDK install locations, and augments the child process PATH. The ENOENT message now names the searched locations and the setting.
- **Notebook cell errors showing "BigQueryError: [object Object]"** - The cell execution catch block used `err.message || String(err)`, but BigQuery API errors carry an empty top-level `message` (the detail lives in `err.errors[].message`), so the object stringified to `[object Object]`. New `extractBigQueryErrorMessage` helper digs through `errors[]`, nested `response.data.error`, `message`, then JSON as fallbacks.

## [2.0.2] - 2026-04-19

### Fixed

- **Grid "No results yet" on first open** - Fixed race between Preact listener mount (async via `useEffect`) and the sync `load_complete` postMessage. Listener attaches first now; extension's follow-up `execute_query` / `preview_table` / `clear` messages reach the grid reliably. Preview was stuck on idle for fresh panels; query worked only because BQ job completion gave `useEffect` time to run.
- **REPEATED RECORD wire format** - `extractRowValue` + `decodeBqValue` now peel BigQuery's `{f:[{v:…}]}` wrapper recursively, so `ARRAY<STRUCT<...>>` columns render as clean JSON arrays of objects instead of raw `[{"v":{"f":[{"v":"ap21_card"},…]}}]`. Fix applies to REPEATED STRING / INT / etc. too.
- **CSP blocking source-map fetch** - Added `${cspSource}` to `connect-src` so webview doesn't log a CSP violation when the devtools auto-fetches `grid-v2.js.map`.
- **Pinned projects disappear** - Pinned project IDs missing from live `getProjects` + the `vscode-bigquery.projects` setting are now explicitly added to the explorer. Pinned takes precedence over hidden — pinning un-hides.
- **Settings writes failing "no workspace opened"** - All `vscode.workspace.getConfiguration().update(...)` calls for pinned/hidden project IDs, pinned table IDs, and lineage theme now pass `vscode.ConfigurationTarget.Global` explicitly. Previously VS Code defaulted the target to Workspace when no workspace was open, which threw and silently broke pinning.
- **Large notebook cell globalState** - v2.0.x and earlier persisted full rendered HTML per notebook cell (up to ~200 cells × notebooks). New `v2.0.2` migration on activate strips `outputHtml` from persisted notebook metadata and (as a defensive sweep) clears any globalState key over 5 MB. Notebook cell output is no longer persisted — re-run the cell to regenerate. Exports / load-more on restored cells still work (metadata is still persisted).

### Added

- **STRING cell JSON detection** - String cells whose value starts with `{` or `[` and parses as valid JSON open the resizable side drawer with pretty-printed output on click. Click-to-copy still copies the raw string.
- **Row right-click → Copy row (JSON)** - Context menu now offers JSON alongside TSV / Markdown. JSON is a pretty-printed array of objects keyed by column label.
- **Multi-row copy in context menu** - Right-clicking a row that is part of a multi-selection (label shows `N rows`) copies all selected rows; right-clicking outside the selection copies just that single row. Clear-selection entry appears in multi mode.
- **Toolbar JSON button** - `JSON` button appears alongside `TSV` / `MD` when rows are selected, covering the same copy paths from the toolbar.
- **Command: `BigQuery: Clear Extension State Cache`** - Shows every enumerable globalState key with its size (MB), total, and offers to wipe all. Escape hatch if storage ever grows unexpectedly. Uses `Memento.keys()` with a known-keys fallback for older VS Code versions.

### Changed

- `CellRegistry.persist()` no longer takes an `outputHtml` argument; signature simplified. `restoreOutput` helper on the notebook controller was removed — cells must be re-executed to show results after a window reload.
- `registerNotebookPersistence` no longer depends on `BqSqlNotebookController` (hydration is metadata-only).

## [2.0.1] - 2026-04-18

### Fixed

- **Marketplace badges** - Replaced retired `shields.io/visual-studio-marketplace/*` badges with `vsmarketplacebadges.dev` (version, installs, rating). Added rating badge.

### Changed

- **VSIX size reduction** - Excluded `logo.psd` (481 KB), `previous_packages/` (312 KB), `new_features/` (171 KB), `call.txt`, and `documentation/Untitled.png` from the published extension via `.vscodeignore`. No functional change.

## [2.0.0] - 2026-04-18

> **Major release.** The legacy WASM (Rust→WebAssembly) results renderer has been removed and fully replaced by a new Preact-based grid. All query results, table previews, and multi-statement scripts render through the new grid. The old `vscode-bigquery.experimentalGrid` toggle is gone — the new grid is the only path.

### Breaking Changes

- **Removed WASM grid renderer** - The `grid_render` Rust crate (~6,772 LoC, 442 KB WASM + JS glue per webview load) has been deleted. All rendering now goes through `resources/grid-v2.js` (≈64 KB, ≈12 KB gzipped — ~7× smaller bundle, ~35× smaller gzipped).
- **Removed setting `vscode-bigquery.experimentalGrid`** - The opt-in flag no longer exists. New grid is always used.
- **Removed npm script `compile-grid_render`** - No more `wasm-pack build` step for the results renderer. The `bqsql_parser` WASM module (used for language features) is unaffected.
- **Removed `grid_render` npm dependency** - `file://.//grid_render/pkg` link is gone.

### Added

- **Modern Results Grid (default)** - Preact-based grid with first-class VS Code theming. Features:
  - **Tabs** - Results / Schema tabs. Schema pane lists every column with type and mode.
  - **Multi-column sort** - Click a header for single sort. Shift-click additional headers to stack secondary keys. Rank badge shown next to the sort arrow when more than one column is active.
  - **Find-in-table** - `Find…` box in the toolbar filters the current page. Matches highlighted inline with hit count.
  - **Density toggle** - Three-button compact / cozy / comfy switcher adjusts row height live via CSS variables.
  - **Cell drawer** - Click any STRUCT, ARRAY, RECORD, or JSON cell to open a resizable right-side drawer with pretty-printed, copyable content.
  - **Click-to-copy scalar cells** - Click a scalar cell to copy its raw value. Toast confirms the copy.
  - **Column drag-resize** - Grab the right edge of a column header and drag. Per-column widths are remembered for the session.
  - **Row selection** - Click a row-number cell to select a row. Shift-click selects a range; Cmd/Ctrl-click toggles individual rows.
  - **Copy selected rows** - `TSV` / `MD` / `JSON` buttons appear in the toolbar when rows are selected. Ready-to-paste tab-separated values, GitHub-flavored Markdown table, or pretty-printed JSON array.
  - **Row right-click menu** - Right-click any row for a context menu. Respects current selection: if multiple rows are selected and the right-clicked row is one of them, menu operates on **all selected rows**; otherwise it auto-selects the clicked row. Copy row(s) as TSV / Markdown / JSON. Right-clicking a specific cell also offers **Copy cell value** and **Copy column name**. Menu closes on click-outside, scroll, resize, or any keypress.
  - **Row number gutter** - Sticky-left numbered gutter that highlights on hover and turns accent-colored when the row is selected.
  - **Type-aware syntax colors** - Cell text tinted per BigQuery type (number / boolean / timestamp / struct / bytes / string / null) using VS Code theme CSS vars with tasteful defaults.
  - **Pagination** - First / prev / next / last buttons plus page-number input and rows-per-page selector (25 / 50 / 100 / 250 / 1000). Pagination uses the BigQuery `getQueryResults` REST API with `startIndex` + `maxResults`.
  - **Script multi-result view** - Multi-statement scripts render as a vertical stack of tables, one per child job. Each titled `Statement N · <statementType>`. Powered by `jobs.list?parentJobId=…`.
  - **DML summary banner** - `INSERT` / `UPDATE` / `DELETE` / `MERGE` jobs show a summary banner above the grid with the statement type and affected row counts (inserted · updated · deleted). Covers single-job queries and script child jobs.
  - **Table preview** - Right-click → Preview renders through the same grid, backed by `tables.get` (schema + row count) + `tabledata.list` (rows).
- **Setting: `vscode-bigquery.gridColors`** - Object that overrides per-type cell text colors. Keys: `number`, `boolean`, `timestamp`, `struct`, `bytes`, `string`, `null`. Values accept any CSS color (hex, `rgb()`, `hsl()`, `var(--vscode-…)`, `color-mix(…)`, named). Values sanitized at HTML inject time against an allowlist regex + 80-char cap.
- **Setting: `vscode-bigquery.defaultLocation`** - BigQuery processing location (e.g. `US`, `EU`, `australia-southeast1`, `asia-east1`). When empty, location is auto-detected from the first FROM clause via `datasets.get` (cached per dataset). Set explicitly to override detection or for unqualified / CTE-only queries.
- **Setting: `vscode-bigquery.copyTablePathBackticks`** (default `true`) - `Copy Table Path` now wraps the result in backticks by default so it pastes directly into a BigQuery FROM clause. Disable to get the raw `project.dataset.table` string.
- **Syntax highlighting for logical keywords** - `AND`, `OR`, `NOT`, `IN`, `BETWEEN`, `LIKE`, `EXISTS`, `IS`, `ALL`, `ANY`, `SOME` now render as keywords (not dimmed operators) via the semantic token provider — theme colors apply consistently. `NULL`, `TRUE`, `FALSE` moved to `constant.language` for distinct coloring.
- **Automatic query location detection** - `BigQueryClient.runQuery` / `runParameterizedQuery` / `validateQuery` now inspect the first FROM clause for a fully-qualified `project.dataset.table`, call `datasets.get`, and pass the resulting `location` to `createQueryJob`. Eliminates "Dataset not found in location us-central1" errors for datasets outside the project's default region. Cache hits subsequent queries on the same dataset.
- **Content Security Policy on results webview** - `grid-v2` HTML now carries a strict CSP meta tag: `default-src 'none'; style-src ${cspSource} 'nonce-…'; script-src ${cspSource}; connect-src https://bigquery.googleapis.com; img-src ${cspSource} data:; font-src ${cspSource}`. Color overrides are emitted inside a `<style nonce="…">` block.

### Removed

- `grid_render/` — Rust crate (lib.rs, custom elements for `bq-query`, `bq-table`, `bq-script`, message handler, BQ REST clients).
- `resources/grid.js`, `resources/grid.css`, `resources/grid_render.js`, `resources/grid_render_bg.wasm` — legacy bundle + WASM artifact.
- `resources/grid-v2-palette-preview.html` — orphan dev artifact from the palette design phase.
- `dist/grid_render.js`, `dist/grid_render_bg.wasm` — webpack-copied artifacts.
- `webpack.config.js` WASM copy plugins + `syncWebAssembly` experiment.
- `.vscode/settings.json` `rust-analyzer.linkedProjects`, `.vscodeignore` `grid_render/**`, `.gitignore` `grid_render/Cargo.lock`.
- Setting `vscode-bigquery.experimentalGrid`.
- npm script `compile-grid_render`.
- npm dependency `grid_render`.

### Migration

No user action required. All existing features — exports (CSV / JSONL / Pub/Sub / Copy), sidebar panels, notebook output, persistence across VS Code restarts, keyboard shortcuts — are unchanged. If you had `vscode-bigquery.experimentalGrid: true` in settings, remove it (it will be silently ignored).

If you hit "Dataset not found in location …" errors, either:
1. Fully-qualify `FROM \`project.dataset.table\`` (auto-detect picks up the dataset's real location), or
2. Set `vscode-bigquery.defaultLocation` to your BQ region (e.g. `australia-southeast1`).

## [1.12.0] - 2026-04-18

### Added

- **Notebook mode for SQL files** - Open any `.sql`/`.bqsql` file as a BigQuery notebook from the editor title bar or the `BigQuery: Open as Notebook` command. Each query becomes its own cell. Running a cell shows results inline below it. A matching icon in the notebook title bar switches back to the text editor. The file on disk stays plain SQL and can be opened in either editor.
- **Interactive cell output** - Tabbed Results/Schema view with client-side column sort, pagination controls including a page-number input, configurable page size (25/50/100/250/1000), and a stats line showing rows / bytes processed / duration.
- **Exports from notebook cells** - CSV, JSONL, Pub/Sub, and Copy-as-Markdown buttons appear in each executed cell's status bar, reusing the same services as the side panel.
- **Cancel mid-query from the cell** - The notebook cancel button now calls `job.cancel()` on the BigQuery side so long-running queries can be aborted.
- **Cell output persistence** - Executed cell outputs are saved to `globalState` keyed by notebook URI and SHA1 of the cell's SQL text, and restored on notebook open so results survive VS Code restarts. Exports still work on restored cells as long as the underlying BigQuery job is still queryable.

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
