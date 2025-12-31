import { suggest } from '@bstruct/bqsql-parser';
import * as vscode from 'vscode';
import { CompletionItemProvider, CompletionItem, CancellationToken, CompletionContext, CompletionList, Position, ProviderResult, TextDocument, CompletionItemKind, MarkdownString } from 'vscode';
import { bigqueryTableSchemaService } from '../extension';
import { BqsqlSuggestion } from './bqsqlSuggestion';
import { isBigQueryLanguage } from '../services/languageUtils';
import { extractCteColumns, getCteNames, CteColumn } from '../services/cteExtractor';


export class BqsqlCompletionItemProvider implements CompletionItemProvider<CompletionItem> {

    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): vscode.CompletionList<vscode.CompletionItem> | vscode.CompletionItem[] | null | undefined {

        if (!isBigQueryLanguage(document.languageId)) { return null; }


        const suggestions = suggest(document.getText(), position.line, position.character) as BqsqlSuggestion[];

        const list = this.getBaseCompletionList();

        function pad(num: number | string) {
            var s = "0000" + num;
            return s.substring(s.length - 4);
        }

        if (suggestions.length > 0) {
            for (let index0 = 0; index0 < suggestions.length; index0++) {
                const element = suggestions[index0];

                if (element.suggestion_type === 'TableColumns') {

                    const bqsql = document.getText();

                    let schema = bigqueryTableSchemaService.getSchemaFromCache(bqsql, element.table_identifier);
                    let columns = schema.filter((element, position) => {
                        return schema.findIndex(e => e.column_name === element.column_name) === position;
                    });

                    for (let index1 = 0; index1 < columns.length; index1++) {
                        const element = columns[index1];
                        let c1 = new CompletionItem(element.column_name, CompletionItemKind.Field);
                        c1.insertText = `${element.column_name},`;
                        c1.detail = `${element.data_type}${element.is_partitioning_column === 'YES' ? " - PARTITION COLUMN" : ""}\n\n${element.description ? element.description : ""}`;
                        // c1.command = {
                        //     command: "editor.action.triggerSuggest"
                        // } as vscode.Command;
                        // Use "0_" prefix to prioritize columns over functions/keywords
                        c1.sortText = "0_" + pad(index0) + pad(element.ordinal_position);

                        list.items.push(c1);
                    }
                }

                // if (element.suggestion_type === 'Function') {
                //     for (let j = 0; j < element.snippets.length; j++) {
                //         const func = element.snippets[j];

                //         const fn = new CompletionItem(func.name, CompletionItemKind.Function);

                //         fn.insertText = new vscode.SnippetString(func.snippet);
                //         // fn.documentation = new MarkdownString('#### Description\nReturns a random universally unique identifier (UUID) as a `STRING`.\nThe returned STRING consists of 32 hexadecimal digits in five groups separated by hyphens in the form 8-4-4-4-12. The hexadecimal digits represent 122 random bits and 6 fixed bits, in compliance with [RFC 4122 section 4.4](https://tools.ietf.org/html/rfc4122#section-4.4). The returned STRING is lowercase.\n#### Return Data Type\nSTRING');
                //         list.items.push(fn);
                //     }

                // }

            }
        }

        // Fallback: Check if user typed "alias." or "cteName." and suggest CTE columns
        const cteColumns = this.getCteColumnsAtPosition(document, position);
        if (cteColumns.length > 0) {
            for (let i = 0; i < cteColumns.length; i++) {
                const col = cteColumns[i];
                let c1 = new CompletionItem(col.name, CompletionItemKind.Field);
                c1.insertText = `${col.name},`;
                c1.detail = 'CTE Column';
                // Use "0_" prefix to prioritize columns over functions/keywords
                c1.sortText = "0_" + pad(0) + pad(i);
                list.items.push(c1);
            }
        }

        return list;
    }

    getBaseCompletionList(): CompletionList<CompletionItem> {

        return new CompletionList<CompletionItem>(
            [

                this.getCompletionItem("COALESCE", CompletionItemKind.Function),
                this.getCompletionItem("IF", CompletionItemKind.Function),
                this.getCompletionItem("IFNULL", CompletionItemKind.Function),
                this.getCompletionItem("NULLIF", CompletionItemKind.Function),
                this.getCompletionItem("ANY_VALUE", CompletionItemKind.Function),
                this.getCompletionItem("ARRAY_AGG", CompletionItemKind.Function),
                this.getCompletionItem("ARRAY_CONCAT_AGG", CompletionItemKind.Function),
                this.getCompletionItem("AVG", CompletionItemKind.Function),
                this.getCompletionItem("BIT_AND", CompletionItemKind.Function),
                this.getCompletionItem("BIT_OR", CompletionItemKind.Function),
                this.getCompletionItem("BIT_XOR", CompletionItemKind.Function),
                this.getCompletionItem("COUNT", CompletionItemKind.Function),
                this.getCompletionItem("COUNTIF", CompletionItemKind.Function),
                this.getCompletionItem("LOGICAL_AND", CompletionItemKind.Function),
                this.getCompletionItem("LOGICAL_OR", CompletionItemKind.Function),
                this.getCompletionItem("MAX", CompletionItemKind.Function),
                this.getCompletionItem("MIN", CompletionItemKind.Function),
                this.getCompletionItem("STRING_AGG", CompletionItemKind.Function),
                this.getCompletionItem("SUM", CompletionItemKind.Function),
                this.getCompletionItem("CORR", CompletionItemKind.Function),
                this.getCompletionItem("COVAR_POP", CompletionItemKind.Function),
                this.getCompletionItem("COVAR_SAMP", CompletionItemKind.Function),
                this.getCompletionItem("STDDEV_POP", CompletionItemKind.Function),
                this.getCompletionItem("STDDEV_SAMP", CompletionItemKind.Function),
                this.getCompletionItem("STDDEV", CompletionItemKind.Function),
                this.getCompletionItem("VAR_POP", CompletionItemKind.Function),
                this.getCompletionItem("VAR_SAMP", CompletionItemKind.Function),
                this.getCompletionItem("VARIANCE", CompletionItemKind.Function),
                this.getCompletionItem("APPROX_COUNT_DISTINCT", CompletionItemKind.Function),
                this.getCompletionItem("APPROX_QUANTILES", CompletionItemKind.Function),
                this.getCompletionItem("APPROX_TOP_COUNT", CompletionItemKind.Function),
                this.getCompletionItem("APPROX_TOP_SUM", CompletionItemKind.Function),
                this.getCompletionItem("HLL_COUNT.INIT", CompletionItemKind.Function),
                this.getCompletionItem("HLL_COUNT.MERGE", CompletionItemKind.Function),
                this.getCompletionItem("HLL_COUNT.MERGE_PARTIAL", CompletionItemKind.Function),
                this.getCompletionItem("HLL_COUNT.EXTRACT", CompletionItemKind.Function),
                this.getCompletionItem("RANK", CompletionItemKind.Function),
                this.getCompletionItem("DENSE_RANK", CompletionItemKind.Function),
                this.getCompletionItem("PERCENT_RANK", CompletionItemKind.Function),
                this.getCompletionItem("CUME_DIST", CompletionItemKind.Function),
                this.getCompletionItem("NTILE", CompletionItemKind.Function),
                this.getCompletionItem("ROW_NUMBER", CompletionItemKind.Function),
                this.getCompletionItem("BIT_COUNT", CompletionItemKind.Function),
                this.getCompletionItem("CAST", CompletionItemKind.Function),
                this.getCompletionItem("PARSE_BIGNUMERIC", CompletionItemKind.Function),
                this.getCompletionItem("PARSE_NUMERIC", CompletionItemKind.Function),
                this.getCompletionItem("SAFE_CAST", CompletionItemKind.Function),
                this.getCompletionItem("ABS", CompletionItemKind.Function),
                this.getCompletionItem("SIGN", CompletionItemKind.Function),
                this.getCompletionItem("IS_INF", CompletionItemKind.Function),
                this.getCompletionItem("IS_NAN", CompletionItemKind.Function),
                this.getCompletionItem("IEEE_DIVIDE", CompletionItemKind.Function),
                this.getCompletionItem("RAND", CompletionItemKind.Function),
                this.getCompletionItem("SQRT", CompletionItemKind.Function),
                this.getCompletionItem("POW", CompletionItemKind.Function),
                this.getCompletionItem("POWER", CompletionItemKind.Function),
                this.getCompletionItem("EXP", CompletionItemKind.Function),
                this.getCompletionItem("LN", CompletionItemKind.Function),
                this.getCompletionItem("LOG", CompletionItemKind.Function),
                this.getCompletionItem("LOG10", CompletionItemKind.Function),
                this.getCompletionItem("GREATEST", CompletionItemKind.Function),
                this.getCompletionItem("LEAST", CompletionItemKind.Function),
                this.getCompletionItem("DIV", CompletionItemKind.Function),
                this.getCompletionItem("SAFE_DIVIDE", CompletionItemKind.Function),
                this.getCompletionItem("SAFE_MULTIPLY", CompletionItemKind.Function),
                this.getCompletionItem("SAFE_NEGATE", CompletionItemKind.Function),
                this.getCompletionItem("SAFE_ADD", CompletionItemKind.Function),
                this.getCompletionItem("SAFE_SUBTRACT", CompletionItemKind.Function),
                this.getCompletionItem("MOD", CompletionItemKind.Function),
                this.getCompletionItem("ROUND", CompletionItemKind.Function),
                this.getCompletionItem("TRUNC", CompletionItemKind.Function),
                this.getCompletionItem("CEIL", CompletionItemKind.Function),
                this.getCompletionItem("CEILING", CompletionItemKind.Function),
                this.getCompletionItem("FLOOR", CompletionItemKind.Function),
                this.getCompletionItem("COS", CompletionItemKind.Function),
                this.getCompletionItem("COSH", CompletionItemKind.Function),
                this.getCompletionItem("ACOS", CompletionItemKind.Function),
                this.getCompletionItem("ACOSH", CompletionItemKind.Function),
                this.getCompletionItem("COT", CompletionItemKind.Function),
                this.getCompletionItem("COTH", CompletionItemKind.Function),
                this.getCompletionItem("CSC", CompletionItemKind.Function),
                this.getCompletionItem("CSCH", CompletionItemKind.Function),
                this.getCompletionItem("SEC", CompletionItemKind.Function),
                this.getCompletionItem("SECH", CompletionItemKind.Function),
                this.getCompletionItem("SIN", CompletionItemKind.Function),
                this.getCompletionItem("SINH", CompletionItemKind.Function),
                this.getCompletionItem("ASIN", CompletionItemKind.Function),
                this.getCompletionItem("ASINH", CompletionItemKind.Function),
                this.getCompletionItem("TAN", CompletionItemKind.Function),
                this.getCompletionItem("TANH", CompletionItemKind.Function),
                this.getCompletionItem("ATAN", CompletionItemKind.Function),
                this.getCompletionItem("ATANH", CompletionItemKind.Function),
                this.getCompletionItem("ATAN2", CompletionItemKind.Function),
                this.getCompletionItem("CBRT", CompletionItemKind.Function),
                this.getCompletionItem("RANGE_BUCKET", CompletionItemKind.Function),
                this.getCompletionItem("FIRST_VALUE", CompletionItemKind.Function),
                this.getCompletionItem("LAST_VALUE", CompletionItemKind.Function),
                this.getCompletionItem("NTH_VALUE", CompletionItemKind.Function),
                this.getCompletionItem("LEAD", CompletionItemKind.Function),
                this.getCompletionItem("LAG", CompletionItemKind.Function),
                this.getCompletionItem("PERCENTILE_CONT", CompletionItemKind.Function),
                this.getCompletionItem("PERCENTILE_DISC", CompletionItemKind.Function),
                this.getCompletionItem("FARM_FINGERPRINT", CompletionItemKind.Function),
                this.getCompletionItem("MD5", CompletionItemKind.Function),
                this.getCompletionItem("SHA1", CompletionItemKind.Function),
                this.getCompletionItem("SHA256", CompletionItemKind.Function),
                this.getCompletionItem("SHA512", CompletionItemKind.Function),
                this.getCompletionItem("ASCII", CompletionItemKind.Function),
                this.getCompletionItem("BYTE_LENGTH", CompletionItemKind.Function),
                this.getCompletionItem("CHAR_LENGTH", CompletionItemKind.Function),
                this.getCompletionItem("CHARACTER_LENGTH", CompletionItemKind.Function),
                this.getCompletionItem("CHR", CompletionItemKind.Function),
                this.getCompletionItem("CODE_POINTS_TO_BYTES", CompletionItemKind.Function),
                this.getCompletionItem("CODE_POINTS_TO_STRING", CompletionItemKind.Function),
                this.getCompletionItem("COLLATE", CompletionItemKind.Function),
                this.getCompletionItem("CONCAT", CompletionItemKind.Function),
                this.getCompletionItem("CONTAINS_SUBSTR", CompletionItemKind.Function),
                this.getCompletionItem("ENDS_WITH", CompletionItemKind.Function),
                this.getCompletionItem("FORMAT", CompletionItemKind.Function),
                this.getCompletionItem("FROM_BASE32", CompletionItemKind.Function),
                this.getCompletionItem("FROM_BASE64", CompletionItemKind.Function),
                this.getCompletionItem("FROM_HEX", CompletionItemKind.Function),
                this.getCompletionItem("INITCAP", CompletionItemKind.Function),
                this.getCompletionItem("INSTR", CompletionItemKind.Function),
                this.getCompletionItem("LEFT", CompletionItemKind.Function),
                this.getCompletionItem("LENGTH", CompletionItemKind.Function),
                this.getCompletionItem("LPAD", CompletionItemKind.Function),
                this.getCompletionItem("LOWER", CompletionItemKind.Function),
                this.getCompletionItem("LTRIM", CompletionItemKind.Function),
                this.getCompletionItem("NORMALIZE", CompletionItemKind.Function),
                this.getCompletionItem("NORMALIZE_AND_CASEFOLD", CompletionItemKind.Function),
                this.getCompletionItem("OCTET_LENGTH", CompletionItemKind.Function),
                this.getCompletionItem("REGEXP_CONTAINS", CompletionItemKind.Function),
                this.getCompletionItem("REGEXP_EXTRACT", CompletionItemKind.Function),
                this.getCompletionItem("REGEXP_EXTRACT_ALL", CompletionItemKind.Function),
                this.getCompletionItem("REGEXP_INSTR", CompletionItemKind.Function),
                this.getCompletionItem("REGEXP_REPLACE", CompletionItemKind.Function),
                this.getCompletionItem("REGEXP_SUBSTR", CompletionItemKind.Function),
                this.getCompletionItem("REPLACE", CompletionItemKind.Function),
                this.getCompletionItem("REPEAT", CompletionItemKind.Function),
                this.getCompletionItem("REVERSE", CompletionItemKind.Function),
                this.getCompletionItem("RIGHT", CompletionItemKind.Function),
                this.getCompletionItem("RPAD", CompletionItemKind.Function),
                this.getCompletionItem("RTRIM", CompletionItemKind.Function),
                this.getCompletionItem("SAFE_CONVERT_BYTES_TO_STRING", CompletionItemKind.Function),
                this.getCompletionItem("SOUNDEX", CompletionItemKind.Function),
                this.getCompletionItem("SPLIT", CompletionItemKind.Function),
                this.getCompletionItem("STARTS_WITH", CompletionItemKind.Function),
                this.getCompletionItem("STRPOS", CompletionItemKind.Function),
                this.getCompletionItem("SUBSTR", CompletionItemKind.Function),
                this.getCompletionItem("SUBSTRING", CompletionItemKind.Function),
                this.getCompletionItem("TO_BASE32", CompletionItemKind.Function),
                this.getCompletionItem("TO_BASE64", CompletionItemKind.Function),
                this.getCompletionItem("TO_CODE_POINTS", CompletionItemKind.Function),
                this.getCompletionItem("TO_HEX", CompletionItemKind.Function),
                this.getCompletionItem("TRANSLATE", CompletionItemKind.Function),
                this.getCompletionItem("TRIM", CompletionItemKind.Function),
                this.getCompletionItem("UNICODE", CompletionItemKind.Function),
                this.getCompletionItem("UPPER", CompletionItemKind.Function),
                this.getCompletionItem("JSON_EXTRACT", CompletionItemKind.Function),
                this.getCompletionItem("JSON_QUERY", CompletionItemKind.Function),
                this.getCompletionItem("JSON_EXTRACT_SCALAR", CompletionItemKind.Function),
                this.getCompletionItem("JSON_VALUE", CompletionItemKind.Function),
                this.getCompletionItem("JSON_EXTRACT_ARRAY", CompletionItemKind.Function),
                this.getCompletionItem("JSON_QUERY_ARRAY", CompletionItemKind.Function),
                this.getCompletionItem("JSON_EXTRACT_STRING_ARRAY", CompletionItemKind.Function),
                this.getCompletionItem("JSON_VALUE_ARRAY", CompletionItemKind.Function),
                this.getCompletionItem("PARSE_JSON", CompletionItemKind.Function),
                this.getCompletionItem("TO_JSON", CompletionItemKind.Function),
                this.getCompletionItem("TO_JSON_STRING", CompletionItemKind.Function),
                this.getCompletionItem("STRING", CompletionItemKind.Function),
                this.getCompletionItem("BOOL", CompletionItemKind.Function),
                this.getCompletionItem("INT64", CompletionItemKind.Function),
                this.getCompletionItem("FLOAT64", CompletionItemKind.Function),
                this.getCompletionItem("JSON_TYPE", CompletionItemKind.Function),
                this.getCompletionItem("ARRAY", CompletionItemKind.Function),
                this.getCompletionItem("ARRAY_CONCAT", CompletionItemKind.Function),
                this.getCompletionItem("ARRAY_LENGTH", CompletionItemKind.Function),
                this.getCompletionItem("ARRAY_TO_STRING", CompletionItemKind.Function),
                this.getCompletionItem("GENERATE_ARRAY", CompletionItemKind.Function),
                this.getCompletionItem("GENERATE_DATE_ARRAY", CompletionItemKind.Function),
                this.getCompletionItem("GENERATE_TIMESTAMP_ARRAY", CompletionItemKind.Function),
                this.getCompletionItem("ARRAY_REVERSE", CompletionItemKind.Function),
                this.getCompletionItem("CURRENT_DATE", CompletionItemKind.Function),
                this.getCompletionItem("EXTRACT", CompletionItemKind.Function),
                this.getCompletionItem("DATE", CompletionItemKind.Function),
                this.getCompletionItem("DATE_ADD", CompletionItemKind.Function),
                this.getCompletionItem("DATE_SUB", CompletionItemKind.Function),
                this.getCompletionItem("DATE_DIFF", CompletionItemKind.Function),
                this.getCompletionItem("DATE_TRUNC", CompletionItemKind.Function),
                this.getCompletionItem("DATE_FROM_UNIX_DATE", CompletionItemKind.Function),
                this.getCompletionItem("FORMAT_DATE", CompletionItemKind.Function),
                this.getCompletionItem("LAST_DAY", CompletionItemKind.Function),
                this.getCompletionItem("PARSE_DATE", CompletionItemKind.Function),
                this.getCompletionItem("UNIX_DATE", CompletionItemKind.Function),
                this.getCompletionItem("CURRENT_DATETIME", CompletionItemKind.Function),
                this.getCompletionItem("DATETIME", CompletionItemKind.Function),
                this.getCompletionItem("EXTRACT", CompletionItemKind.Function),
                this.getCompletionItem("DATETIME_ADD", CompletionItemKind.Function),
                this.getCompletionItem("DATETIME_SUB", CompletionItemKind.Function),
                this.getCompletionItem("DATETIME_DIFF", CompletionItemKind.Function),
                this.getCompletionItem("DATETIME_TRUNC", CompletionItemKind.Function),
                this.getCompletionItem("FORMAT_DATETIME", CompletionItemKind.Function),
                this.getCompletionItem("LAST_DAY", CompletionItemKind.Function),
                this.getCompletionItem("PARSE_DATETIME", CompletionItemKind.Function),
                this.getCompletionItem("CURRENT_TIME", CompletionItemKind.Function),
                this.getCompletionItem("TIME", CompletionItemKind.Function),
                this.getCompletionItem("EXTRACT", CompletionItemKind.Function),
                this.getCompletionItem("TIME_ADD", CompletionItemKind.Function),
                this.getCompletionItem("TIME_SUB", CompletionItemKind.Function),
                this.getCompletionItem("TIME_DIFF", CompletionItemKind.Function),
                this.getCompletionItem("TIME_TRUNC", CompletionItemKind.Function),
                this.getCompletionItem("FORMAT_TIME", CompletionItemKind.Function),
                this.getCompletionItem("PARSE_TIME", CompletionItemKind.Function),
                this.getCompletionItem("CURRENT_TIMESTAMP", CompletionItemKind.Function),
                this.getCompletionItem("EXTRACT", CompletionItemKind.Function),
                this.getCompletionItem("STRING", CompletionItemKind.Function),
                this.getCompletionItem("TIMESTAMP", CompletionItemKind.Function),
                this.getCompletionItem("TIMESTAMP_ADD", CompletionItemKind.Function),
                this.getCompletionItem("TIMESTAMP_SUB", CompletionItemKind.Function),
                this.getCompletionItem("TIMESTAMP_DIFF", CompletionItemKind.Function),
                this.getCompletionItem("TIMESTAMP_TRUNC", CompletionItemKind.Function),
                this.getCompletionItem("FORMAT_TIMESTAMP", CompletionItemKind.Function),
                this.getCompletionItem("PARSE_TIMESTAMP", CompletionItemKind.Function),
                this.getCompletionItem("TIMESTAMP_SECONDS", CompletionItemKind.Function),
                this.getCompletionItem("TIMESTAMP_MILLIS", CompletionItemKind.Function),
                this.getCompletionItem("TIMESTAMP_MICROS", CompletionItemKind.Function),
                this.getCompletionItem("UNIX_SECONDS", CompletionItemKind.Function),
                this.getCompletionItem("UNIX_MILLIS", CompletionItemKind.Function),
                this.getCompletionItem("UNIX_MICROS", CompletionItemKind.Function),
                this.getCompletionItem("MAKE_INTERVAL", CompletionItemKind.Function),
                this.getCompletionItem("EXTRACT", CompletionItemKind.Function),
                this.getCompletionItem("JUSTIFY_DAYS", CompletionItemKind.Function),
                this.getCompletionItem("JUSTIFY_HOURS", CompletionItemKind.Function),
                this.getCompletionItem("JUSTIFY_INTERVAL", CompletionItemKind.Function),
                this.getCompletionItem("S2_CELLIDFROMPOINT", CompletionItemKind.Function),
                this.getCompletionItem("S2_COVERINGCELLIDS", CompletionItemKind.Function),
                this.getCompletionItem("ST_ANGLE", CompletionItemKind.Function),
                this.getCompletionItem("ST_AREA", CompletionItemKind.Function),
                this.getCompletionItem("ST_ASBINARY", CompletionItemKind.Function),
                this.getCompletionItem("ST_ASGEOJSON", CompletionItemKind.Function),
                this.getCompletionItem("ST_ASTEXT", CompletionItemKind.Function),
                this.getCompletionItem("ST_AZIMUTH", CompletionItemKind.Function),
                this.getCompletionItem("ST_BOUNDARY", CompletionItemKind.Function),
                this.getCompletionItem("ST_BOUNDINGBOX", CompletionItemKind.Function),
                this.getCompletionItem("ST_BUFFER", CompletionItemKind.Function),
                this.getCompletionItem("ST_BUFFERWITHTOLERANCE", CompletionItemKind.Function),
                this.getCompletionItem("ST_CENTROID", CompletionItemKind.Function),
                this.getCompletionItem("ST_CENTROID_AGG", CompletionItemKind.Function),
                this.getCompletionItem("ST_CLOSESTPOINT", CompletionItemKind.Function),
                this.getCompletionItem("ST_CLUSTERDBSCAN", CompletionItemKind.Function),
                this.getCompletionItem("ST_CONTAINS", CompletionItemKind.Function),
                this.getCompletionItem("ST_CONVEXHULL", CompletionItemKind.Function),
                this.getCompletionItem("ST_COVEREDBY", CompletionItemKind.Function),
                this.getCompletionItem("ST_COVERS", CompletionItemKind.Function),
                this.getCompletionItem("ST_DIFFERENCE", CompletionItemKind.Function),
                this.getCompletionItem("ST_DIMENSION", CompletionItemKind.Function),
                this.getCompletionItem("ST_DISJOINT", CompletionItemKind.Function),
                this.getCompletionItem("ST_DISTANCE", CompletionItemKind.Function),
                this.getCompletionItem("ST_DUMP", CompletionItemKind.Function),
                this.getCompletionItem("ST_DWITHIN", CompletionItemKind.Function),
                this.getCompletionItem("ST_ENDPOINT", CompletionItemKind.Function),
                this.getCompletionItem("ST_EQUALS", CompletionItemKind.Function),
                this.getCompletionItem("ST_EXTENT", CompletionItemKind.Function),
                this.getCompletionItem("ST_EXTERIORRING", CompletionItemKind.Function),
                this.getCompletionItem("ST_GEOGFROM", CompletionItemKind.Function),
                this.getCompletionItem("ST_GEOGFROMGEOJSON", CompletionItemKind.Function),
                this.getCompletionItem("ST_GEOGFROMTEXT", CompletionItemKind.Function),
                this.getCompletionItem("ST_GEOGFROMWKB", CompletionItemKind.Function),
                this.getCompletionItem("ST_GEOGPOINT", CompletionItemKind.Function),
                this.getCompletionItem("ST_GEOGPOINTFROMGEOHASH", CompletionItemKind.Function),
                this.getCompletionItem("ST_GEOHASH", CompletionItemKind.Function),
                this.getCompletionItem("ST_GEOMETRYTYPE", CompletionItemKind.Function),
                this.getCompletionItem("ST_INTERIORRINGS", CompletionItemKind.Function),
                this.getCompletionItem("ST_INTERSECTION", CompletionItemKind.Function),
                this.getCompletionItem("ST_INTERSECTS", CompletionItemKind.Function),
                this.getCompletionItem("ST_INTERSECTSBOX", CompletionItemKind.Function),
                this.getCompletionItem("ST_ISCLOSED", CompletionItemKind.Function),
                this.getCompletionItem("ST_ISCOLLECTION", CompletionItemKind.Function),
                this.getCompletionItem("ST_ISEMPTY", CompletionItemKind.Function),
                this.getCompletionItem("ST_ISRING", CompletionItemKind.Function),
                this.getCompletionItem("ST_LENGTH", CompletionItemKind.Function),
                this.getCompletionItem("ST_MAKELINE", CompletionItemKind.Function),
                this.getCompletionItem("ST_MAKEPOLYGON", CompletionItemKind.Function),
                this.getCompletionItem("ST_MAKEPOLYGONORIENTED", CompletionItemKind.Function),
                this.getCompletionItem("ST_MAXDISTANCE", CompletionItemKind.Function),
                this.getCompletionItem("ST_NPOINTS", CompletionItemKind.Function),
                this.getCompletionItem("ST_NUMGEOMETRIES", CompletionItemKind.Function),
                this.getCompletionItem("ST_NUMPOINTS", CompletionItemKind.Function),
                this.getCompletionItem("ST_PERIMETER", CompletionItemKind.Function),
                this.getCompletionItem("ST_POINTN", CompletionItemKind.Function),
                this.getCompletionItem("ST_SIMPLIFY", CompletionItemKind.Function),
                this.getCompletionItem("ST_SNAPTOGRID", CompletionItemKind.Function),
                this.getCompletionItem("ST_STARTPOINT", CompletionItemKind.Function),
                this.getCompletionItem("ST_TOUCHES", CompletionItemKind.Function),
                this.getCompletionItem("ST_UNION", CompletionItemKind.Function),
                this.getCompletionItem("ST_UNION_AGG", CompletionItemKind.Function),
                this.getCompletionItem("ST_WITHIN", CompletionItemKind.Function),
                this.getCompletionItem("ST_X", CompletionItemKind.Function),
                this.getCompletionItem("ST_Y", CompletionItemKind.Function),
                this.getCompletionItem("SESSION_USER", CompletionItemKind.Function),
                this.getCompletionItem("GENERATE_UUID", CompletionItemKind.Function),
                this.getCompletionItem("NET.IP_FROM_STRING", CompletionItemKind.Function),
                this.getCompletionItem("NET.SAFE_IP_FROM_STRING", CompletionItemKind.Function),
                this.getCompletionItem("NET.IP_TO_STRING", CompletionItemKind.Function),
                this.getCompletionItem("NET.IP_NET_MASK", CompletionItemKind.Function),
                this.getCompletionItem("NET.IP_TRUNC", CompletionItemKind.Function),
                this.getCompletionItem("NET.IPV4_FROM_INT64", CompletionItemKind.Function),
                this.getCompletionItem("NET.IPV4_TO_INT64", CompletionItemKind.Function),
                this.getCompletionItem("NET.HOST", CompletionItemKind.Function),
                this.getCompletionItem("NET.PUBLIC_SUFFIX", CompletionItemKind.Function),
                this.getCompletionItem("NET.REG_DOMAIN", CompletionItemKind.Function),
                this.getCompletionItem("ERROR", CompletionItemKind.Function),
                this.getCompletionItem("KEYS.NEW_KEYSET", CompletionItemKind.Function),
                this.getCompletionItem("KEYS.NEW_WRAPPED_KEYSET", CompletionItemKind.Function),
                this.getCompletionItem("KEYS.REWRAP_KEYSET", CompletionItemKind.Function),
                this.getCompletionItem("KEYS.ADD_KEY_FROM_RAW_BYTES", CompletionItemKind.Function),
                this.getCompletionItem("AEAD.DECRYPT_BYTES", CompletionItemKind.Function),
                this.getCompletionItem("AEAD.DECRYPT_STRING", CompletionItemKind.Function),
                this.getCompletionItem("AEAD.ENCRYPT", CompletionItemKind.Function),
                this.getCompletionItem("DETERMINISTIC_DECRYPT_BYTES", CompletionItemKind.Function),
                this.getCompletionItem("DETERMINISTIC_DECRYPT_STRING", CompletionItemKind.Function),
                this.getCompletionItem("DETERMINISTIC_ENCRYPT", CompletionItemKind.Function),
                this.getCompletionItem("KEYS.KEYSET_CHAIN", CompletionItemKind.Function),
                this.getCompletionItem("KEYS.KEYSET_FROM_JSON", CompletionItemKind.Function),
                this.getCompletionItem("KEYS.KEYSET_TO_JSON", CompletionItemKind.Function),
                this.getCompletionItem("KEYS.ROTATE_KEYSET", CompletionItemKind.Function),
                this.getCompletionItem("KEYS.ROTATE_WRAPPED_KEYSET", CompletionItemKind.Function),
                this.getCompletionItem("KEYS.KEYSET_LENGTH", CompletionItemKind.Function),
                this.getCompletionItem("EXTERNAL_OBJECT_TRANSFORM", CompletionItemKind.Function),

                // SQL Keywords - JOIN types
                this.getKeywordCompletionItem("INNER JOIN"),
                this.getKeywordCompletionItem("LEFT JOIN"),
                this.getKeywordCompletionItem("RIGHT JOIN"),
                this.getKeywordCompletionItem("FULL JOIN"),
                this.getKeywordCompletionItem("FULL OUTER JOIN"),
                this.getKeywordCompletionItem("CROSS JOIN"),
                this.getKeywordCompletionItem("LEFT OUTER JOIN"),
                this.getKeywordCompletionItem("RIGHT OUTER JOIN"),

                // SQL Keywords - DDL statements
                this.getKeywordCompletionItem("CREATE TABLE"),
                this.getKeywordCompletionItem("CREATE VIEW"),
                this.getKeywordCompletionItem("CREATE OR REPLACE VIEW"),
                this.getKeywordCompletionItem("CREATE OR REPLACE TABLE"),
                this.getKeywordCompletionItem("CREATE TEMP TABLE"),
                this.getKeywordCompletionItem("CREATE TEMPORARY TABLE"),
                this.getKeywordCompletionItem("CREATE SCHEMA"),
                this.getKeywordCompletionItem("CREATE FUNCTION"),
                this.getKeywordCompletionItem("DROP TABLE"),
                this.getKeywordCompletionItem("DROP VIEW"),
                this.getKeywordCompletionItem("DROP SCHEMA"),
                this.getKeywordCompletionItem("ALTER TABLE"),

                // SQL Keywords - DML statements
                this.getKeywordCompletionItem("INSERT INTO"),
                this.getKeywordCompletionItem("DELETE FROM"),
                this.getKeywordCompletionItem("MERGE INTO"),
                this.getKeywordCompletionItem("TRUNCATE TABLE"),

                // SQL Keywords - Query clauses
                this.getKeywordCompletionItem("SELECT"),
                this.getKeywordCompletionItem("FROM"),
                this.getKeywordCompletionItem("WHERE"),
                this.getKeywordCompletionItem("GROUP BY"),
                this.getKeywordCompletionItem("ORDER BY"),
                this.getKeywordCompletionItem("HAVING"),
                this.getKeywordCompletionItem("LIMIT"),
                this.getKeywordCompletionItem("OFFSET"),
                this.getKeywordCompletionItem("WITH"),

                // SQL Keywords - Modifiers
                this.getKeywordCompletionItem("DISTINCT"),
                this.getKeywordCompletionItem("AS"),
                this.getKeywordCompletionItem("ASC"),
                this.getKeywordCompletionItem("DESC"),
                this.getKeywordCompletionItem("NULLS FIRST"),
                this.getKeywordCompletionItem("NULLS LAST"),

                // SQL Keywords - Operators
                this.getKeywordCompletionItem("AND"),
                this.getKeywordCompletionItem("OR"),
                this.getKeywordCompletionItem("NOT"),
                this.getKeywordCompletionItem("IN"),
                this.getKeywordCompletionItem("BETWEEN"),
                this.getKeywordCompletionItem("LIKE"),
                this.getKeywordCompletionItem("EXISTS"),
                this.getKeywordCompletionItem("IS NULL"),
                this.getKeywordCompletionItem("IS NOT NULL"),

                // SQL Keywords - Conditionals
                this.getKeywordCompletionItem("CASE"),
                this.getKeywordCompletionItem("WHEN"),
                this.getKeywordCompletionItem("THEN"),
                this.getKeywordCompletionItem("ELSE"),
                this.getKeywordCompletionItem("END"),

                // SQL Keywords - Set operations
                this.getKeywordCompletionItem("UNION"),
                this.getKeywordCompletionItem("UNION ALL"),
                this.getKeywordCompletionItem("INTERSECT"),
                this.getKeywordCompletionItem("EXCEPT"),
                this.getKeywordCompletionItem("EXCEPT DISTINCT"),

                // SQL Keywords - Window clauses
                this.getKeywordCompletionItem("OVER"),
                this.getKeywordCompletionItem("PARTITION BY"),
                this.getKeywordCompletionItem("ROWS BETWEEN"),
                this.getKeywordCompletionItem("RANGE BETWEEN"),

                // SQL Keywords - Table operations
                this.getKeywordCompletionItem("UNNEST"),
                this.getKeywordCompletionItem("PIVOT"),
                this.getKeywordCompletionItem("UNPIVOT"),
                this.getKeywordCompletionItem("TABLESAMPLE"),

                // SQL Keywords - BigQuery-specific
                this.getKeywordCompletionItem("QUALIFY"),
                this.getKeywordCompletionItem("OPTIONS"),
                this.getKeywordCompletionItem("ON")

            ]
        );

    }

    getCompletionItem(label: string, kind?: CompletionItemKind): CompletionItem {

        let completionItem = new CompletionItem(label, kind);

        const anchor = label.toLocaleLowerCase().replace('.', '');
        completionItem.documentation = new vscode.MarkdownString('Bigquery official [documentation](https://cloud.google.com/bigquery/docs/reference/standard-sql/functions-and-operators#'.concat(anchor.concat(')')));
        const alias = label.toLocaleLowerCase().replace('.', '_');
        completionItem.insertText = new vscode.SnippetString(`${label}($1)`);
        // Use "1_" prefix to make functions lower priority than columns (which use "0_")
        completionItem.sortText = "1_" + label;

        return completionItem;
    }

    getKeywordCompletionItem(label: string): CompletionItem {
        let completionItem = new CompletionItem(label, CompletionItemKind.Keyword);
        completionItem.insertText = `${label} `;
        // Use "2_" prefix to make keywords lowest priority (after columns "0_" and functions "1_")
        completionItem.sortText = "2_" + label;
        return completionItem;
    }

    /**
     * Check if user is typing after "alias." or "cteName." and return CTE columns
     */
    getCteColumnsAtPosition(document: TextDocument, position: Position): CteColumn[] {
        // Get text from start of line up to cursor position
        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.substring(0, position.character);

        // Check if there's a "word." or "`table`." pattern before the cursor
        // Pattern 1: Simple identifier: word.column or word.
        // Pattern 2: Backtick-quoted: `project.dataset.table`.column or `project.dataset.table`.
        let aliasOrCteName: string | null = null;
        let isBacktickQuoted = false;

        // Try backtick-quoted pattern first: `...`.
        const backtickMatch = textBeforeCursor.match(/`([^`]+)`\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)?$/);
        if (backtickMatch) {
            aliasOrCteName = backtickMatch[1];
            isBacktickQuoted = true;
        } else {
            // Try simple identifier pattern: word.
            const match = textBeforeCursor.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\.\s*([a-zA-Z_][a-zA-Z0-9_]*)?$/);
            if (match) {
                aliasOrCteName = match[1];
            }
        }

        if (!aliasOrCteName) {
            return [];
        }
        const tableName = aliasOrCteName; // TypeScript now knows this is non-null
        const sql = document.getText();

        // If backtick-quoted, it's a direct table reference - look up schema directly
        if (isBacktickQuoted) {
            const tableSchema = this.getPhysicalTableColumns(tableName);
            if (tableSchema.length > 0) {
                return tableSchema;
            }
            return [];
        }

        // Check if this is a CTE name
        const cteNames = getCteNames(sql);
        const matchedCte = cteNames.find(name => name.toLowerCase() === tableName.toLowerCase());
        if (matchedCte) {
            const cols = extractCteColumns(sql, matchedCte);
            return cols;
        }

        // Check if this is a table alias - find what table it refers to
        const tableForAlias = this.findTableForAlias(sql, tableName);
        if (tableForAlias) {
            // Check if it's a CTE
            const cteName = cteNames.find(name => name.toLowerCase() === tableForAlias.toLowerCase());
            if (cteName) {
                const cols = extractCteColumns(sql, cteName);
                return cols;
            }

            // Not a CTE - it's a physical table, try to get schema from cache
            const tableSchema = this.getPhysicalTableColumns(tableForAlias);
            if (tableSchema.length > 0) {
                return tableSchema;
            }
        }

        return [];
    }

    /**
     * Find the table name for a given alias in the SQL
     * Handles patterns like: FROM table_name alias, FROM table_name AS alias
     * Searches from the main query (after WITH block) to avoid matching aliases inside CTEs
     */
    findTableForAlias(sql: string, alias: string): string | null {
        // Find the main query part (after the WITH block if present)
        // Look for the last SELECT/INSERT/UPDATE/DELETE/MERGE that's not inside CTEs
        let mainQuery = sql;

        // Find where CTEs end by looking for the pattern ") SELECT" or similar
        const mainQueryMatch = sql.match(/\)\s*(SELECT|INSERT|UPDATE|DELETE|MERGE)\s/i);
        if (mainQueryMatch && mainQueryMatch.index !== undefined) {
            mainQuery = sql.substring(mainQueryMatch.index);
        }

        // Pattern: FROM/JOIN table_name AS alias or FROM/JOIN table_name alias
        // Also handles: project.dataset.table AS alias
        const patterns = [
            // FROM table AS alias or FROM table alias (without AS)
            new RegExp(`\\bFROM\\s+([a-zA-Z0-9_\`.\\-]+)\\s+(?:AS\\s+)?${this.escapeRegex(alias)}\\b`, 'gi'),
            // JOIN table AS alias or JOIN table alias (without AS)
            new RegExp(`\\bJOIN\\s+([a-zA-Z0-9_\`.\\-]+)\\s+(?:AS\\s+)?${this.escapeRegex(alias)}\\b`, 'gi'),
            // Comma-separated: , table AS alias or , table alias
            new RegExp(`,\\s*([a-zA-Z0-9_\`.\\-]+)\\s+(?:AS\\s+)?${this.escapeRegex(alias)}\\b`, 'gi')
        ];

        for (const pattern of patterns) {
            const match = pattern.exec(mainQuery);
            if (match && match[1]) {
                // Clean up the table name (remove backticks)
                return match[1].replace(/`/g, '');
            }
        }

        return null;
    }

    escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Get columns for a physical BigQuery table from the schema cache
     * Table name format: project.dataset.table or dataset.table
     */
    getPhysicalTableColumns(tableName: string): CteColumn[] {
        // Parse the table name into parts
        const parts = tableName.replace(/`/g, '').split('.');

        if (parts.length < 2) {
            return [];
        }

        // Get all cached schemas and find matching table
        // The schema service stores schemas by project_id, dataset_name, table_name
        const allSchemas = (bigqueryTableSchemaService as any).schemas as any[] || [];

        // Try to find matching schema
        let matchingSchemas: any[] = [];

        if (parts.length === 3) {
            // project.dataset.table
            const [projectId, datasetName, tableNamePart] = parts;
            matchingSchemas = allSchemas.filter(
                s => s.project_id === projectId &&
                     s.dataset_name === datasetName &&
                     s.table_name === tableNamePart
            );
        } else if (parts.length === 2) {
            // dataset.table - match any project
            const [datasetName, tableNamePart] = parts;
            matchingSchemas = allSchemas.filter(
                s => s.dataset_name === datasetName &&
                     s.table_name === tableNamePart
            );
        }


        if (matchingSchemas.length === 0) {
            return [];
        }

        // Convert to CteColumn format (just need the name)
        const columns: CteColumn[] = [];
        const seen = new Set<string>();

        for (const schema of matchingSchemas) {
            if (!seen.has(schema.column_name)) {
                seen.add(schema.column_name);
                columns.push({ name: schema.column_name });
            }
        }

        return columns;
    }

}
