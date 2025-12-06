# BigQuery Data View v2 for Visual Studio Code

[![Version 1.0.0](https://img.shields.io/badge/version-1.0.0-blue)](https://marketplace.visualstudio.com/items?itemName=sseveur.vscode-bigquery-v2)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/sseveur.vscode-bigquery-v2?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=sseveur.vscode-bigquery-v2)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/sseveur.vscode-bigquery-v2)](https://marketplace.visualstudio.com/items?itemName=sseveur.vscode-bigquery-v2)

A powerful Visual Studio Code extension for Google BigQuery. Browse datasets and tables, run queries with real-time validation, view results, format SQL, track query history, estimate costs, and visualize data lineage.

<!-- TODO: Add hero screenshot showing the extension in action -->
<!-- ![Extension Overview](documentation/hero_screenshot.png) -->

## Features

- **Authentication** - User login, GDrive access, and service account support via gcloud CLI
- **Project Explorer** - Browse projects, datasets, tables, views, functions, and ML models
- **Query Execution** - Run queries with `Ctrl+Enter`, real-time error highlighting, and byte estimation
- **SQL Intellisense** - Autocomplete for SQL keywords and BigQuery functions
- **Syntax Highlighting** - Full support for `.bqsql` files with grammar injection for `.sql` files
- **SQL Formatting** - Format queries with configurable style options
- **Query History** - Track all executed queries with re-run and copy capabilities
- **Cost Estimation** - Real-time cost estimates based on bytes processed
- **Table Schema Hover** - Hover over table names to see schema details
- **Data Lineage** - Visualize data flow with CTE support
- **Export Options** - Download results as CSV or JSONL, copy to clipboard
- **Pub/Sub Integration** - Publish query results directly to Google Cloud Pub/Sub

## Installation

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "BigQuery Data View v2"
4. Click Install

Or install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=sseveur.vscode-bigquery-v2).

## Requirements

- [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install) must be installed
- Valid Google Cloud authentication with BigQuery permissions

## Quick Start

1. Install the gcloud CLI and authenticate: `gcloud auth login`
2. Open the BigQuery panel from the Activity Bar
3. Create a new `.bqsql` file and write your query
4. Press `Ctrl+Enter` to run

## Keyboard Shortcuts

| Shortcut | Icon | Command | Description |
|----------|------|---------|-------------|
| `Ctrl+Enter` | <img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/icon_run_query.png" alt="run" width="16"/> | Run Query | Execute the entire query in the editor |
| `Ctrl+E` | <img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/icon_run_selected.png" alt="run selected" width="16"/> | Run Selected Query | Execute only the selected text |
| `Shift+Alt+F` | | Format SQL | Format the current SQL document |

## Authentication

The extension uses the [gcloud CLI](https://cloud.google.com/sdk/docs/install) for authentication. Three authentication methods are supported:

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/authentication_panel.png" alt="authentication panel" width="300"/>

- **User login** - Opens browser for Google Cloud authentication
- **User login + GDrive** - Same as above, with Google Drive access for Drive-based tables
- **Service account** - Select a service account key file (JSON format)

When there's a valid account active with BigQuery permissions, the extension is ready to use.

Additional functionality:
- Activate/switch between multiple accounts
- Revoke authentication

Refresh the authentication screen with the command `BigQuery: Authentication refresh`.

## Projects, Datasets, and Tables Explorer

The BigQuery side panel displays a tree of projects, datasets, tables, views, functions, and ML models.

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/explorer_tree.png" alt="explorer tree" width="600"/>

Refresh the explorer with the command `BigQuery: Explorer refresh`.

You can set a default project that queries will run against by right-clicking on a project.

### Context Menu Actions

Right-click on tables and views to access:

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/explorer_tree_menu.png" alt="explorer tree menu" width="400"/>

- **Create query** - Opens a new editor with a basic `SELECT * FROM` statement
- **Open DDL** - Opens the DDL (Data Definition Language) statement for the object
- **Preview** - Opens a preview of the table data (runs `SELECT *` for views and external tables)
- **Preview schema** - Opens the table/view schema information

### Table Preview

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/explorer_tree_table.png" alt="table preview" width="600"/>

### Schema View

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/preview_schema.png" alt="schema view" width="900"/>

## Run Queries

The extension activates for `.bqsql` files. Run queries using:

- **Keyboard**: `Ctrl+Enter` (run all) or `Ctrl+E` (run selected)
- **Command Palette**: `BigQuery: Run Query` or `BigQuery: Run Selected Query`
- **Editor Toolbar**: Click the run buttons

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/file_explorer_query_result.png" alt="query results" width="900"/>

Query results appear in the bottom panel under `Bigquery: Query results`. You can open results in a separate tab for side-by-side comparisons.

### Syntax Highlighting & Intellisense

The extension provides:
- Syntax highlighting for SQL keywords (SELECT, FROM, WHERE, JOIN, CASE, WHEN, etc.)
- Intellisense/autocomplete for SQL keywords and BigQuery functions
- Grammar injection for `.sql` files (syntax highlighting works automatically)

### Real-time Query Validation

Queries are validated as you type. Errors are underlined in the editor:

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/query_error.png" alt="query error" width="600"/>

Valid queries show the estimated bytes in the status bar:

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/query_size_evaluation.png" alt="query size evaluation" width="600"/>

## Query History

All executed queries are saved to the History panel in the BigQuery sidebar.

Each history entry shows:
- Query preview text
- Execution timestamp
- Bytes processed and duration
- Success/error status

Right-click actions:
- **Re-run** - Execute the query again
- **Copy** - Copy query text to clipboard
- **Delete** - Remove from history

Use the clear button to remove all history entries.

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/query_history.png" alt="query_history"/>

## Cost Estimator

The status bar shows real-time cost estimates based on BigQuery's dry-run feature:
- Estimated bytes to be processed
- Estimated cost in USD (configurable, default $6.25/TB)

Configure the cost per TB in settings via `vscode-bigquery.costPerTB`. Set to 0 to hide cost estimates:

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/cost_estimate.png" alt="cost_estimator" />

## Table Schema Hover

Hover over any table name in your SQL query to see schema information:
- Column names and data types
- Column descriptions (if available)
- Partitioning and clustering information

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/table_hover_schema.png" alt="table_hover_schema" />

The schema is cached after first fetch for faster subsequent lookups.

### Supported Locations

Schema hover works for tables in:
- `FROM` clauses - `FROM project.dataset.table`
- `JOIN` clauses - `JOIN project.dataset.table`, `LEFT JOIN`, `RIGHT JOIN`, `INNER JOIN`, `CROSS JOIN`, `FULL JOIN`
- **CTE references** - When you reference a CTE name (e.g., `FROM my_cte`), the hover shows the columns defined in that CTE's SELECT clause

## Data Lineage

Visualize data flow in your queries. Click the lineage button <img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/button_lineage.png" alt="lineage" width="16"/> in the editor title bar or run `BigQuery: Show Data Lineage`.

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/data_lineage.png" alt="data lineage"/>

The lineage graph shows:
- **Source tables** (blue) - Tables your query reads from
- **CTEs** (purple) - Common Table Expressions as intermediate nodes
- **Target tables** (green) - Tables your query writes to (INSERT, CREATE, MERGE, etc.)

Features:
- CTE Support - CTEs are shown as intermediate nodes between sources and targets
- Layered DAG Layout - Nodes are arranged left-to-right based on data flow
- Curved Connections - Bezier curves show relationships between nodes
- Statement Type Badges - Target nodes show the operation type

## Format SQL

Format your BigQuery SQL queries with `Shift+Alt+F` or by running `BigQuery: Format SQL`.

Configuration options:
- **Keyword Case** (`vscode-bigquery.formatKeywordCase`): `upper`, `lower`, or `preserve`
- **Indent Style** (`vscode-bigquery.formatIndentStyle`): `standard`, `tabularLeft`, or `tabularRight`
- **Leading Commas** (`vscode-bigquery.formatLeadingCommas`): Enable/disable leading comma style

## Export Options

### Download CSV

After running a query, download results as CSV from the result grid toolbar.

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/download_csv.png" alt="download csv" width="200"/>

- Supports multiline content
- No row limit (be mindful of large result sets)
- Does not support nested complex objects

### Copy to Clipboard

Copy results in CSV format with a configurable size limit (default 1MB). Configure via `vscode-bigquery.clipboardSizeLimitKb`.

### Download JSONL

Download results in [JSONL](https://jsonlines.org/) format from the result grid toolbar.

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/download_jsonl.png" alt="download jsonl" width="200"/>

## Send to Pub/Sub

Publish query results to Google Cloud Pub/Sub (one message per row).

Requirements:
- A column named `data` of type `STRING` or `JSON`
- Optional: A column named `attributes` of type `RECORD`

Example query:
```sql
SELECT
    (
    SELECT AS STRUCT
        "my test test" AS test,
        "amazing data type" AS data_type
    ) AS attributes,

    TO_JSON(t) AS data

FROM `dataset.table` t
```

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/send_to_pubsub.png" alt="send to Pub/Sub" width="200"/>

Enter the topic name in the format: `projects/<project_id>/topics/<topic_name>`

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/send_to_pubsub_topic_name.png" alt="Pub/Sub topic name" width="200"/>

## Settings

### Pin a Project

Pin projects to keep them at the top of the explorer tree.

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/project_set_default.png" alt="set default project" width="600"/>

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/pin_unpin_project.png" alt="pin/unpin project" width="600"/>

Pinned projects are stored in settings:

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/settings_file.png" alt="settings file" width="600"/>

### Add GCP Projects

For cases where you only have read permissions at the dataset level (not project level), force a project to be listed:

Setting: `vscode-bigquery.projects`

### Add BigQuery Tables

When permission is granted only at the table level:

Setting: `vscode-bigquery.tables`

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/setting_add_table.png" alt="add table" width="600"/>

### Associate .sql Files

Enable BigQuery features for all `.sql` files:

Setting: `vscode-bigquery.associateSqlFiles`

## Configuration Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `vscode-bigquery.pinned-projects` | array | `[]` | Pinned GCP project IDs |
| `vscode-bigquery.projects` | array | `[]` | Additional GCP project IDs to list |
| `vscode-bigquery.tables` | array | `[]` | Table IDs to list directly |
| `vscode-bigquery.associateSqlFiles` | boolean | `false` | Treat .sql files as BigQuery SQL |
| `vscode-bigquery.clipboardSizeLimitKb` | number | `1024` | Clipboard copy size limit (KB) |
| `vscode-bigquery.costPerTB` | number | `6.25` | Cost per TB for estimates ($) |
| `vscode-bigquery.formatKeywordCase` | string | `upper` | Keyword case: upper, lower, preserve |
| `vscode-bigquery.formatIndentStyle` | string | `standard` | Indent style: standard, tabularLeft, tabularRight |
| `vscode-bigquery.formatLeadingCommas` | boolean | `true` | Use leading comma style |

Access settings via:

<img src="https://raw.githubusercontent.com/sseveur/vscode-bigquery/main/documentation/settings_menu.png" alt="settings menu" width="900"/>

## Troubleshooting

### Query results panel not opening

Sometimes after installation, the `BigQuery: Run query` command doesn't open the results panel. Restart VS Code to resolve this.

### Authentication issues

Ensure the gcloud CLI is properly installed and you've run `gcloud auth login` successfully.

### Missing projects or datasets

If you have limited permissions, add projects or tables manually via settings.

## Report a Bug

Please file an issue with as much detail as possible at [GitHub Issues](https://github.com/sseveur/vscode-bigquery/issues).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is a fork of [bstruct/vscode-bigquery](https://github.com/bstruct/vscode-bigquery).
