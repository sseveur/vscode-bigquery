# Planned Features for BigQuery VS Code Extension

## Features Overview

| # | Feature | Complexity | Priority | Status |
|---|---------|------------|----------|--------|
| 1 | Cost Estimator | Easy | High | Done |
| 2 | Table Schema Preview (Hover) | Easy | High | Pending |
| 3 | Format SQL | Easy-Medium | Medium | Pending |
| 4 | Keyboard Shortcuts | Easy | Low | Pending |
| 5 | Query History | Medium | High | Pending |
| 6 | Data Lineage | Hard | Low | Pending |

---

## Feature 1: Cost Estimator

### Overview
Show estimated $ cost in status bar based on bytes processed from dry-run.

### Implementation

**Modified Files:**
- `src/language/bqsqlDiagnostics.ts` - Add cost calculation to status bar

**Logic:**
```typescript
// BigQuery on-demand pricing: $5 per TB after first 1TB free per month
// For simplicity, show cost per query (user tracks monthly usage)
const tb = totalBytesProcessed / (1024 ** 4);
const cost = Math.max(0, tb * 5); // $5 per TB

// Format display
if (cost === 0) {
  statusBarInfo.text = `${mb} MB (< $0.01)`;
} else if (cost < 0.01) {
  statusBarInfo.text = `${mb} MB (~$${cost.toFixed(4)})`;
} else {
  statusBarInfo.text = `${mb} MB (~$${cost.toFixed(2)})`;
}
```

**Enhancement:** Add tooltip with breakdown:
```typescript
statusBarInfo.tooltip = `Bytes: ${bytesProcessed}\nEstimated cost: $${cost.toFixed(4)}\nPricing: $5/TB (on-demand)`;
```

---

## Feature 2: Table Schema Preview (Hover)

### Overview
Hover over table name to see columns and types.

### Implementation

**Modified Files:**
- `src/language/bqsqlHoverProvider.ts` - Implement hover logic (currently placeholder)
- `src/extension.ts` - Uncomment/register hover provider

**Existing Infrastructure:**
- `bigqueryTableSchemaService` already caches schemas
- Parser identifies `TableIdentifier` items with position ranges
- `getSchemaFromCache()` retrieves column info

**Logic Flow:**
1. Get cursor position from hover event
2. Parse document to find `TableIdentifier` at position
3. Extract project/dataset/table from identifier
4. Lookup schema in cache (or fetch if not cached)
5. Format as markdown hover content

**Hover Content Format:**
```markdown
**`project.dataset.table`**

| Column | Type | Description |
|--------|------|-------------|
| id | INT64 | Primary key |
| name | STRING | User name |
| created_at | TIMESTAMP | |

*3 columns*
```

---

## Feature 3: Format SQL

### Overview
Auto-format/prettify SQL queries with a command.

### Implementation

**Recommended Approach:** Use `sql-formatter` npm package

**New Files:**
- `src/language/bqsqlFormatter.ts` - Formatter wrapper

**Modified Files:**
- `src/extension.ts` - Register format command
- `src/extensionCommands.ts` - Add format handler
- `package.json` - Add command and keybinding

**Command:** `vscode-bigquery.format-query`
**Keybinding:** `Shift+Alt+F` (standard VS Code format shortcut)

**Implementation:**
```typescript
import { format } from 'sql-formatter';

export function formatBigQuerySQL(sql: string): string {
  return format(sql, {
    language: 'bigquery',
    tabWidth: 2,
    keywordCase: 'upper',
    linesBetweenQueries: 2,
  });
}
```

---

## Feature 4: Keyboard Shortcuts

### Overview
Add more keyboard shortcuts for common actions.

### Implementation

**Modified Files:**
- `package.json` - Add keybindings

**Current Shortcuts:**
- `Ctrl+Enter` - Run query
- `Ctrl+E` - Run selected query

**Proposed Additions:**
```json
{
  "keybindings": [
    {
      "command": "vscode-bigquery.format-query",
      "key": "shift+alt+f",
      "when": "editorLangId == bqsql || editorLangId == sql"
    }
  ]
}
```

---

## Feature 5: Query History

### Overview
Save executed queries with timestamps, bytes processed, and allow re-running from history.

### Implementation

**New Files:**
- `src/services/queryHistoryService.ts` - Storage and retrieval logic
- `src/activitybar/queryHistoryTreeDataProvider.ts` - Tree view provider
- `src/activitybar/queryHistoryTreeItem.ts` - Tree item class

**Modified Files:**
- `src/extension.ts` - Register tree view and commands
- `src/extensionCommands.ts` - Add history after query execution
- `package.json` - Add view, commands, icons

**Data Structure:**
```typescript
interface QueryHistoryItem {
  id: string;                    // UUID
  query: string;                 // SQL text
  timestamp: Date;               // When executed
  bytesProcessed: number;        // From job metadata
  durationMs: number;            // Execution time
  projectId: string;             // Project used
  status: 'success' | 'error';   // Result status
  errorMessage?: string;         // If failed
}
```

**Storage:** Use `globalState.update('queryHistory', items)` - persists across sessions

**UI:** New tree view in BigQuery activity bar:
```
▼ QUERY HISTORY
  ▼ Today
    SELECT * FROM users... (2.3 MB, 1.2s)
    SELECT count(*) FROM... (0 MB, cached)
  ▼ Yesterday
    ...
```

**Commands:**
- `vscode-bigquery.history-rerun` - Re-run selected query
- `vscode-bigquery.history-copy` - Copy query to clipboard
- `vscode-bigquery.history-clear` - Clear all history

---

## Feature 6: Data Lineage

### Overview
Visualize which tables a query reads from and writes to.

### Implementation

**Approach:**

1. **Parse Query for Table References**
   - Use existing parser to find all `TableIdentifier` items
   - Categorize as SOURCE (FROM, JOIN) or TARGET (INSERT, MERGE, CREATE)

2. **Build Lineage Graph**
   ```typescript
   interface LineageNode {
     type: 'source' | 'target' | 'query';
     identifier: string;  // project.dataset.table or "Current Query"
   }
   interface LineageEdge {
     from: string;
     to: string;
   }
   ```

3. **Visualize in Webview**
   - Use simple HTML/CSS for diagram
   - Show sources on left, query in middle, targets on right

**New Files:**
- `src/services/lineageService.ts` - Parse and build lineage
- `src/lineage/lineageWebviewProvider.ts` - Webview panel
- `resources/lineage.css` - Styling

**Modified Files:**
- `src/extension.ts` - Register command and webview
- `src/extensionCommands.ts` - Add lineage command
- `package.json` - Add command

**Command:** `vscode-bigquery.show-lineage`

**UI Mockup:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ users       │────▶│             │────▶│ user_stats  │
└─────────────┘     │   Query     │     └─────────────┘
┌─────────────┐     │             │
│ orders      │────▶│             │
└─────────────┘     └─────────────┘
```

**Limitations:**
- Only analyzes current query (not cross-query dependencies)
- Cannot trace views to underlying tables without additional API calls
- Complex subqueries may not parse perfectly

---

## Files Summary

### New Files
- `src/services/queryHistoryService.ts`
- `src/activitybar/queryHistoryTreeDataProvider.ts`
- `src/activitybar/queryHistoryTreeItem.ts`
- `src/language/bqsqlFormatter.ts`
- `src/services/lineageService.ts`
- `src/lineage/lineageWebviewProvider.ts`

### Modified Files
- `src/extension.ts`
- `src/extensionCommands.ts`
- `src/language/bqsqlDiagnostics.ts`
- `src/language/bqsqlHoverProvider.ts`
- `package.json`
