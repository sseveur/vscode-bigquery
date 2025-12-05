import * as vscode from 'vscode';

/**
 * Checks if a language ID is a BigQuery SQL language.
 * Returns true for 'bqsql' (always) and 'sql' (if the setting is enabled).
 */
export function isBigQueryLanguage(languageId: string): boolean {
    if (languageId === 'bqsql') {
        return true;
    }
    if (languageId === 'sql') {
        const config = vscode.workspace.getConfiguration('vscode-bigquery');
        return config.get<boolean>('associateSqlFiles', false);
    }
    return false;
}
