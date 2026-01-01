# NEW FEATURES

---

## ~~Feature 1: Documentation - Invalid Query Lineage Warning~~ DONE (v1.4.0)

~~Add documentation explaining that if the SQL query contains syntax errors or is invalid, the lineage feature will not work properly.~~

- ~~Update README.md with a note about this limitation~~
- Consider adding a warning/notification when lineage cannot be generated due to query errors (optional enhancement)

---

## ~~Feature 2: Lineage for Highlighted Query Only (Context Menu)~~ DONE (v1.4.0)

~~Build lineage for only the highlighted/selected query instead of the entire file.~~

- ~~Add a right-click context menu option: "Build Lineage for Selection"~~
- ~~This option should be configurable (can be enabled/disabled in extension settings)~~
- ~~Only show the option when text is selected~~

---

## ~~Feature 3: Fix Lineage Not Showing with Multiple Queries~~ DONE (v1.1.0)

~~Lineage panel fails to display or displays incorrectly when multiple queries are present in the same file.~~

- ~~Investigate query separator detection~~
- ~~Ensure each query gets its own lineage visualization~~
- ~~Handle edge cases with CTEs spanning queries~~

---

## ~~Feature 4: BigQuery Keyword Highlighting - Missing Keywords~~ DONE (v1.1.0)

~~Several BigQuery-specific SQL keywords are not highlighted properly:~~
- ~~`OPTIONS`~~
- ~~`ALL`~~
- ~~`ANY`~~
- ~~Other BQ-specific keywords~~

~~Update the syntax highlighting grammar to include these missing keywords.~~

---

## ~~Feature 5: Autocomplete Shows Functions Instead of Table Columns~~ DONE (v1.4.0)

~~When pressing `Ctrl+Space` for autocomplete, the suggestions show BigQuery function names (ABS, ACOS, etc.) instead of columns from the referenced tables.~~

- ~~Autocomplete should prioritize columns from tables/CTEs already referenced in the query~~
- ~~Parse the FROM/JOIN clauses to identify available columns for the current context~~

---

## ~~Feature 6: Table schema outdated on-hover - refresh option~~ DONE (v1.5.0)

~~When hovering over a table name, the schema from the table can be outdated and is not possible to refresh. Create an option in the Palette that refreshes the metadata.~~

- ~~Added `BigQuery: Refresh Schema Cache` command in Command Palette~~
- ~~Clears all cached table schemas so fresh data is fetched on next hover~~

---
