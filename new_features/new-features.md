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

## ~~Fix 1: Autocomplete column adds a comma after completion~~ DONE (v1.8.0)

~~When autocompleting a column name based on the table, the features adds a comma.~~

~~E.g.: User types "SELECT s. from [table_name] s", he autocomplete with the column name. It now gives "SELECT s.[column_name], from [table_name] s".~~
~~We do not want this extra comma.~~

## ~~Feature 7: Compact whole query~~ DONE (v1.8.0)

~~You can compact sections of code in Visual Studio Code. I would like to compact the whole query.~~

~~E.g: "
CREATE TABLE AS XXX
SELECT *
FROM toto
inner join tata
    on toto.id = tata.id
;"~~

~~This would result in: "
CREATE TABLE AS XXX
;
" with the code being hidden using the vertical > between the row number and code.~~


## ~~Fix 2: Autocomplete doesn't return anything if missing alias~~ DONE (v1.8.0)

~~When writing some SQL queries, the autocomplete does not always works.~~

~~If we are typing a SELECT statement with a FROM clause already filled-in, we should see the list of columns. If multiple tables are listed but no alias/table/input, the concatenation of all tables' columns available should be presented.~~


## ~~Feature 8: Running a create table should also run a SELECT * LIMIT 100~~ DONE (v1.8.0)

~~Everytime a user is creating a table, the webview shows the table structure. Add the preview of the first 100 rows there too.~~

~~As this is not an expected behaviour, this feature should have an option that is disabled by default but correctly mentionned in the extension documentation to guide the user.~~ 