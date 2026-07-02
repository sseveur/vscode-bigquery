import * as vscode from 'vscode';
import { BigQueryClient } from './services/bigqueryClient';
import { bigQueryTreeDataProvider, QUERY_RESULTS_VIEW_TYPE, TABLE_RESULTS_VIEW_TYPE, TROUBLESHOOT_VIEW_TYPE, gcpAuthenticationTreeDataProvider, authenticationWebviewProvider, bigqueryTableSchemaService } from './extension';
// import { ResultsGridRenderRequest } from './tableResultsPanel/resultsGridRenderRequest';
import { Authentication } from './services/authentication';
import { BigqueryTreeItem, BigqueryTreeItemType } from './activitybar/bigqueryTreeItem';
import { SchemaRender } from './tableResultsPanel/schemaRender';
import { QueryGeneratorService } from './services/queryGeneratorService';
import { ResultsGridRender } from './tableResultsPanel/resultsGridRender';
import { v4 as uuidv4 } from 'uuid';
import { DownloadCsv } from './tableResultsPanel/downloadCsv';
import { QueryResultsMappingService } from './services/queryResultsMappingService';
import { QueryResultsMapping } from './services/queryResultsMapping';
// import { JobReference } from "./services/queryResultsMapping";
// import { TableReference } from './services/tableMetadata';
import { ResultsRender } from './services/resultsRender';
import { QueryResultsVisualizationType } from './services/queryResultsVisualizationType';
// import { TelemetryEventProperties } from '@vscode/extension-telemetry';
import { TroubleshootSerializer } from './activitybar/troubleshootSerializer';
import { DownloadJsonl } from './tableResultsPanel/downloadJsonl';
import { SendToPubsub } from './tableResultsPanel/sendToPubsub';
import { CopyToClipboard } from './tableResultsPanel/copyToClipboard';
// import { Job } from '@google-cloud/bigquery';
import { ResultsGridRenderRequestV2, ResultsGridRenderRequestV2Type } from './tableResultsPanel/resultsGridRenderRequestV2';
import { AuthenticationTreeItem, AuthenticationTreeItemType } from './activitybar/authenticationTreeItem';
import { Dataset, Table } from '@google-cloud/bigquery';
import { formatBigQuerySQL } from './language/bqsqlFormatter';
import { textToNotebookData } from './notebook/bqSqlNotebookSerializer';
import { QueryHistoryItem, QueryHistoryService } from './services/queryHistoryService';
import { TableIndexService } from './services/tableIndexService';
import { buildMultiQueryLineage } from './services/lineageGraph';
import { showMultiLineagePanel } from './lineage/lineageWebviewProvider';
import { runColumnProfileForTable } from './services/columnProfile';
import { showColumnProfilePanel } from './tableResultsPanel/columnProfilePanel';
import { resolveColumnAtPosition, ResolvedColumn, resolveTableAtPosition } from './services/columnResolver';

export const COMMAND_CLEAR_EXTENSION_CACHE = "vscode-bigquery.clear-extension-cache";
export const COMMAND_RUN_QUERY = "vscode-bigquery.run-query";
export const COMMAND_RUN_SELECTED_QUERY = "vscode-bigquery.run-selected-query";
export const COMMAND_PREVIEW_CTE = "vscode-bigquery.preview-cte";
export const COMMAND_PROFILE_COLUMN = "vscode-bigquery.profile-column";
export const COMMAND_PREVIEW_TABLE_AT_CURSOR = "vscode-bigquery.preview-table-at-cursor";
export const COMMAND_USER_LOGIN = "vscode-bigquery.user-login";
export const COMMAND_USER_LOGIN_WITH_DRIVE = "vscode-bigquery.user-login-drive";
export const COMMAND_USER_LOGIN_NO_LAUNCH_BROWSER = "vscode-bigquery.user-login-no-launch-browser";
export const COMMAND_USER_ACTIVATE = "vscode-bigquery.gcp-user-activate";
export const COMMAND_USER_REMOVE = "vscode-bigquery.gcp-user-remove";
export const COMMAND_GCLOUD_INIT = "vscode-bigquery.gcloud-init";
export const COMMAND_SERVICE_ACCOUNT_LOGIN = "vscode-bigquery.service-account-login";
export const COMMAND_AUTHENTICATION_REFRESH = "vscode-bigquery.authentication-refresh";
export const COMMAND_EXPLORER_REFRESH = "vscode-bigquery.explorer-refresh";
export const COMMAND_VIEW_TABLE = "vscode-bigquery.view-table";
export const COMMAND_VIEW_TABLE_SCHEMA = "vscode-bigquery.view-table-schema";
export const COMMAND_CREATE_TABLE_DEFAULT_QUERY = "vscode-bigquery.create-table-default-query";
export const COMMAND_OPEN_DDL = "vscode-bigquery.open-ddl";
export const COMMAND_SET_DEFAULT_PROJECT = "vscode-bigquery.set-default-project";
export const COMMAND_PROJECT_PIN = "vscode-bigquery.project-pin";
export const COMMAND_DOWNLOAD_CSV = "vscode-bigquery.download-csv";
export const COMMAND_DOWNLOAD_JSONL = "vscode-bigquery.download-jsonl";
export const COMMAND_SEND_PUBSUB = "vscode-bigquery.send-pubsub";
export const COMMAND_COPY_CLIPBOARD = "vscode-bigquery.copy-to-clipboard";
export const SETTING_PINNED_PROJECTS = "vscode-bigquery.pinned-projects";
export const SETTING_PROJECTS = "vscode-bigquery.projects";
export const SETTING_TABLES = "vscode-bigquery.tables";
export const SETTING_HIDDEN_PROJECTS = "vscode-bigquery.hidden-projects";
export const COMMAND_PROJECT_HIDE = "vscode-bigquery.project-hide";
export const COMMAND_SHOW_HIDDEN_PROJECTS = "vscode-bigquery.show-hidden-projects";
export const AUTHENTICATION_TROUBLESHOOT = "vscode-bigquery.troubleshoot";
export const OPEN_SETTING_PROJECTS = "vscode-bigquery.open-settings-projects";
export const OPEN_SETTING_TABLES = "vscode-bigquery.open-settings-tables";
export const COMMAND_FORMAT_QUERY = "vscode-bigquery.format-query";
export const COMMAND_HISTORY_RERUN = "vscode-bigquery.history-rerun";
export const COMMAND_HISTORY_COPY = "vscode-bigquery.history-copy";
export const COMMAND_HISTORY_CLEAR = "vscode-bigquery.history-clear";
export const COMMAND_HISTORY_SHOW = "vscode-bigquery.history-show";
export const COMMAND_HISTORY_DELETE = "vscode-bigquery.history-delete";
export const COMMAND_HISTORY_REFRESH = "vscode-bigquery.history-refresh";
export const COMMAND_SHOW_LINEAGE = "vscode-bigquery.show-lineage";
export const COMMAND_SHOW_LINEAGE_SELECTION = "vscode-bigquery.show-lineage-selection";
export const COMMAND_REFRESH_SCHEMA_CACHE = "vscode-bigquery.refresh-schema-cache";
export const COMMAND_SET_LINEAGE_EXPORT_THEME = "vscode-bigquery.set-lineage-export-theme";
export const COMMAND_REVOKE_SESSION = "vscode-bigquery.revoke-session";
export const COMMAND_PIN_TABLE = "vscode-bigquery.pin-table";
export const COMMAND_UNPIN_TABLE = "vscode-bigquery.unpin-table";
export const COMMAND_SEARCH_TABLES = "vscode-bigquery.search-tables";
export const COMMAND_CLEAR_SEARCH = "vscode-bigquery.clear-search";
export const SETTING_PINNED_TABLES = "vscode-bigquery.pinned-tables";
export const COMMAND_COPY_TABLE_PATH = "vscode-bigquery.copy-table-path";
export const COMMAND_BUILD_TABLE_INDEX = "vscode-bigquery.build-table-index";
export const COMMAND_OPEN_AS_NOTEBOOK = "vscode-bigquery.open-as-notebook";
export const COMMAND_OPEN_AS_TEXT = "vscode-bigquery.open-as-text";

/**
 * Check if SQL is a CREATE TABLE statement
 */
function isCreateTableStatement(sql: string): boolean {
	// Regex: CREATE [OR REPLACE] [TEMP|TEMPORARY] TABLE [IF NOT EXISTS]
	return /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i.test(sql.trim());
}

/**
 * Extract the created table name from CREATE TABLE statement
 */
function extractCreatedTableName(sql: string): string | null {
	// Match table name after CREATE TABLE keywords
	const match = sql.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`\w.\-]+)/i);
	return match ? match[1] : null;
}

export const commandRunQuery = async function (this: any, ...args: any[]) {

	return commandQuery(this, RunQueryType.query);

};

export const commandRunSelectedQuery = async function (this: any, ...args: any[]) {

	return commandQuery(this, RunQueryType.selectedQuery);

};

/**
 * Runs a single CTE in isolation and shows its rows in the results grid.
 * Invoked by the CTE-preview CodeLens, which passes the already-rewritten
 * query (WITH upstream CTEs … SELECT * FROM <cte> LIMIT n) and the CTE name.
 */
export const commandPreviewCte = async function (this: any, ...args: any[]) {

	const previewSql: string = args[0];
	const cteName: string = args[1] ?? 'cte';
	if (!previewSql) { return; }

	const globalState: vscode.Memento = this.globalState;
	const queryResultsWebviewMapping: Map<string, ResultsRender> = this.queryResultsWebviewMapping;

	const textEditor = vscode.window.activeTextEditor;

	let uuid: string | undefined;
	if (textEditor) {
		uuid = QueryResultsMappingService.getQueryResultsMappingUuid(globalState, textEditor, QueryResultsVisualizationType.table);
		if (!uuid) { uuid = uuidv4().substring(0, 8); }
		QueryResultsMappingService.upsertQueryResultsMapping(globalState, uuid, textEditor, QueryResultsVisualizationType.table);
	} else {
		uuid = uuidv4().substring(0, 8);
	}

	await runQuery(globalState, queryResultsWebviewMapping, uuid, `CTE: ${cteName}`, previewSql);

};

/**
 * Profiles the column at the cursor. The SQL surrounding the cursor is parsed to
 * find which table the identifier belongs to (via FROM/JOIN clauses and any
 * `alias.column` qualifier), the column type is read from the schema cache, and
 * type-aware aggregates (COUNT, DISTINCT, NULL%, MIN/MAX, APPROX_QUANTILES, top-K)
 * are run directly against the source table. The result is rendered with charts
 * in a side panel.
 */
export const commandProfileColumn = async function (this: any, ...args: any[]) {

	const textEditor = vscode.window.activeTextEditor;
	if (!textEditor) {
		vscode.window.showWarningMessage('Open a SQL file and place the cursor on a column name to profile it.');
		return;
	}

	const document = textEditor.document;
	const sql = document.getText();
	const offset = document.offsetAt(textEditor.selection.active);

	const bqClient = await getBigQueryClient();
	const defaultProjectId = await bqClient.getProjectId();

	let resolved: ResolvedColumn | null = null;
	try {
		resolved = await resolveColumnAtPosition(bqClient, sql, offset, defaultProjectId);
	} catch (err) {
		vscode.window.showErrorMessage(`Profile column: ${(err as Error).message || err}`);
		return;
	}

	if (!resolved) {
		vscode.window.showWarningMessage('Place the cursor on a column name (or `alias.column`) before running Profile Column.');
		return;
	}

	const target = resolved;
	const subtitle = `${target.projectId}.${target.datasetId}.${target.tableId}.${target.columnName} · ${target.columnType}`;

	await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: `Profiling \`${target.columnName}\`…`, cancellable: false },
		async () => {
			try {
				const profile = await runColumnProfileForTable(
					bqClient,
					{ projectId: target.projectId, datasetId: target.datasetId, tableId: target.tableId },
					target.columnName,
					target.columnType
				);
				showColumnProfilePanel(profile, subtitle);
			} catch (err) {
				vscode.window.showErrorMessage(`Profile failed: ${(err as Error).message || err}`);
			}
		}
	);

};

/**
 * Right-click → "BigQuery: Preview Table". Resolves the table reference under the
 * cursor (fully-qualified path, dataset.table, bare name, or FROM/JOIN alias) and
 * opens the standard table preview grid — same rendering the explorer tree uses.
 */
export const commandPreviewTableAtCursor = async function (...args: any[]) {

	const textEditor = vscode.window.activeTextEditor;
	if (!textEditor) {
		vscode.window.showWarningMessage('Open a SQL file and place the cursor on a table name to preview it.');
		return;
	}

	const document = textEditor.document;
	const sql = document.getText();
	const offset = document.offsetAt(textEditor.selection.active);

	const bqClient = await getBigQueryClient();
	const defaultProjectId = await bqClient.getProjectId();

	let resolved = null;
	try {
		resolved = await resolveTableAtPosition(sql, offset, defaultProjectId);
	} catch (err) {
		vscode.window.showErrorMessage(`Preview table: ${(err as Error).message || err}`);
		return;
	}

	if (!resolved) {
		vscode.window.showWarningMessage('Place the cursor on a table name (or its alias) before running Preview Table.');
		return;
	}

	const item = new BigqueryTreeItem(
		BigqueryTreeItemType.table,
		resolved.projectId,
		resolved.datasetId,
		resolved.tableId,
		resolved.tableId,
		'',
		false,
		vscode.TreeItemCollapsibleState.None
	);
	await commandViewTable(item);
};

enum RunQueryType {
	query = 1,
	selectedQuery = 2
}

const commandQuery = async function (local: any, queryType: RunQueryType) {

	const t1 = Date.now();

	const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;

	if (activeTab === undefined) {
		return;
	}

	const textEditor = vscode.window.activeTextEditor;
	if (textEditor === undefined) {
		return;
	}

	const queryText: string = (queryType === RunQueryType.query) ? textEditor.document.getText() ?? '' : textEditor.document.getText(textEditor.selection) ?? '';

	const globalState: vscode.Memento = local.globalState;
	const queryResultsWebviewMapping: Map<string, ResultsRender> = local.queryResultsWebviewMapping;

	let uuid = QueryResultsMappingService.getQueryResultsMappingUuid(globalState, textEditor, QueryResultsVisualizationType.table);
	if (!uuid) {
		uuid = uuidv4().substring(0, 8);
	}

	QueryResultsMappingService.upsertQueryResultsMapping(globalState, uuid, textEditor, QueryResultsVisualizationType.table);

	const numberOfJobs = await runQuery(globalState, queryResultsWebviewMapping, uuid, activeTab.label, queryText);

	// getTelemetryReporter()?.sendTelemetryEvent((queryType === RunQueryType.query) ? 'commandRunQuery' : 'commandRunSelectedQuery', {}, { numberOfJobs: numberOfJobs, elapsedMs: Date.now() - t1 });

};

const runQuery = async function (globalState: vscode.Memento, queryResultsWebviewMapping: Map<string, ResultsRender>, uuid: string, mainLabel: string, queryText: string): Promise<number> {

	const queryStartTime = Date.now();

	let performLock = false;
	if (vscode.window.tabGroups.all.filter(c => c.viewColumn === vscode.ViewColumn.Two).length === 0) {
		await vscode.commands.executeCommand('workbench.action.editorLayoutTwoRows');
		performLock = true;
	}

	const label = `Visualization: ${mainLabel} | ${uuid}`;

	let resultsGridRender = QueryResultsMappingService.getQueryResultsMappingResultsGridRender(queryResultsWebviewMapping, uuid);

	if (resultsGridRender) {

		resultsGridRender.reveal(undefined, true);

	} else {

		const panel = vscode.window.createWebviewPanel(QUERY_RESULTS_VIEW_TYPE, label, { viewColumn: vscode.ViewColumn.Two, preserveFocus: true }, { enableFindWidget: true, enableScripts: true, retainContextWhenHidden: true });
		resultsGridRender = new ResultsGridRender(panel);

		//lock the tab group in vscode.ViewColumn.Two
		if (performLock) {
			panel.reveal(undefined, false);
			await vscode.commands.executeCommand('workbench.action.lockEditorGroup');
			await vscode.commands.executeCommand("workbench.action.focusPreviousGroup");
		}

		await resultsGridRender.render1();

		QueryResultsMappingService.updateQueryResultsMappingWebviewPanel(queryResultsWebviewMapping, uuid, resultsGridRender);

		//action when panel is closed
		panel.onDidDispose(e => {
			QueryResultsMappingService.deleteQueryResultsMapping(globalState, uuid);
		});
	}

	try {
		let _postMessageResult1 = await resultsGridRender.postMessage({
			requestType: ResultsGridRenderRequestV2Type.clear.toString(),
			projectId: null,
			token: null,
			job: null,
			error: null
		} as ResultsGridRenderRequestV2);

		const bqClient = await getBigQueryClient();
		const projectId = await bqClient.getProjectId();
		// console.log('projectId:', projectId);
		const token = await bqClient.getToken();
		// console.log('token:', token);
		const job = await bqClient.runQuery(queryText);

		// Persist the job reference on the editor's mapping so follow-up extension-side
		// features (Profile Column, etc.) can find the most recent job without having
		// to round-trip through the grid webview.
		try {
			const jobRefMeta = job.metadata?.jobReference;
			if (jobRefMeta?.jobId && jobRefMeta?.projectId) {
				await QueryResultsMappingService.updateQueryResultsMapping(globalState, uuid, {
					jobReferences: [{
						projectId: jobRefMeta.projectId,
						jobId: jobRefMeta.jobId,
						location: jobRefMeta.location ?? ''
					}],
					jobIndex: 0
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any);
			}
		} catch { /* non-fatal */ }


		let _postMessageResult2 = await resultsGridRender.postMessage({
			requestType: ResultsGridRenderRequestV2Type.executeQuery.toString(),
			projectId: projectId,
			token: token,
			job: job.metadata,
			error: null
		} as ResultsGridRenderRequestV2);

		// Add to query history on success
		if (queryHistoryService) {
			const bytesProcessed = job.metadata?.statistics?.totalBytesProcessed || 0;
			await queryHistoryService.addEntry({
				query: queryText,
				timestamp: queryStartTime,
				bytesProcessed: parseInt(bytesProcessed.toString(), 10),
				durationMs: Date.now() - queryStartTime,
				projectId: projectId || 'unknown',
				status: 'success'
			});
		}

		// Check if auto-preview setting is enabled and this is CREATE TABLE
		const config = vscode.workspace.getConfiguration('vscode-bigquery');
		const autoPreview = config.get('autoPreviewCreatedTables', false);
		console.log('[Auto-Preview] Setting enabled:', autoPreview);

		const isCreateTable = isCreateTableStatement(queryText);
		console.log('[Auto-Preview] Is CREATE TABLE:', isCreateTable);

		// Don't check job state here - the job may still be running
		// If we got here without throwing, the query was submitted successfully
		// The webview will handle fetching results asynchronously
		if (autoPreview && isCreateTable) {
			const createdTable = extractCreatedTableName(queryText);

			if (createdTable) {
				// Wait briefly for table to be available
				await new Promise(resolve => setTimeout(resolve, 500));

				// Run SELECT * LIMIT 100 on created table
				const previewQuery = `SELECT * FROM ${createdTable} LIMIT 100`;

				try {
					console.log('[Auto-Preview] Running preview query:', previewQuery);
					const previewJob = await bqClient.runQuery(previewQuery);
					console.log('[Auto-Preview] Preview job succeeded:', previewJob.metadata?.statistics);

					// Send preview results to same webview panel
					await resultsGridRender.postMessage({
						requestType: ResultsGridRenderRequestV2Type.executeQuery.toString(),
						projectId: projectId,
						token: token,
						job: previewJob.metadata,
						error: null
					} as ResultsGridRenderRequestV2);

					const rowCount = previewJob.metadata?.statistics?.query?.totalBytesProcessed || 'unknown';
					console.log('[Auto-Preview] Posted preview results to webview');
					vscode.window.showInformationMessage(
						`Table created successfully. Showing preview (first 100 rows).`
					);
				} catch (previewError) {
					console.error('[Auto-Preview] Failed to preview created table:', previewError);
					vscode.window.showWarningMessage(
						`Table created successfully, but preview failed: ${(previewError as any).message}`
					);
				}
			}
		}

	} catch (errorx) {
		// resultsGridRender.renderException(error);
		const error =
		{
			message: (errorx as any).message || 'undefined message',
			reason: ''
		};

		let _postMessageResult3 = await resultsGridRender.postMessage({
			requestType: ResultsGridRenderRequestV2Type.error.toString(),
			projectId: null,
			token: null,
			job: null,
			error: error
		} as ResultsGridRenderRequestV2);

		// Add to query history on error
		if (queryHistoryService) {
			let errorProjectId = 'unknown';
			try {
				const bqClient = await getBigQueryClient();
				errorProjectId = await bqClient.getProjectId() || 'unknown';
			} catch { }
			await queryHistoryService.addEntry({
				query: queryText,
				timestamp: queryStartTime,
				bytesProcessed: 0,
				durationMs: Date.now() - queryStartTime,
				projectId: errorProjectId,
				status: 'error',
				errorMessage: error.message
			});
		}
	}

	return 0;
};

export const commandUserLogin = function (...args: any[]) {

	resetBigQueryClient();

	Authentication.userLogin()
		.then(result => {
			if (result.valid) {
				vscode.window.showInformationMessage('Bigquery: User login - successful');
				vscode.commands.executeCommand(COMMAND_AUTHENTICATION_REFRESH);
			} else {
				vscode.window.showErrorMessage('Bigquery: User login - had invalid response');
				// getTelemetryReporter()?.sendTelemetryErrorEvent('commandUserLogin', { error: 'Bigquery: User login - had invalid response' });
			}

			resetBigQueryClient();

		});

	// getTelemetryReporter()?.sendTelemetryEvent('commandUserLogin', {});
};

export const commandUserLoginWithDrive = function (...args: any[]) {

	resetBigQueryClient();

	Authentication.userLoginWithDrive()
		.then(result => {
			if (result.valid) {
				vscode.window.showInformationMessage('Bigquery: User login - successful');
				vscode.commands.executeCommand(COMMAND_AUTHENTICATION_REFRESH);
			} else {
				vscode.window.showErrorMessage('Bigquery: User login - had invalid response');
				// getTelemetryReporter()?.sendTelemetryErrorEvent('commandUserLoginWithDrive', { error: 'Bigquery: User login - had invalid response' });
			}

			resetBigQueryClient();

		});

	// getTelemetryReporter()?.sendTelemetryEvent('commandUserLoginWithDrive', {});
};

export const commandUserLoginNoLaunchBrowser = function (...args: any[]) {

	// getTelemetryReporter()?.sendTelemetryEvent('commandUserLoginNoLaunchBrowser', {});

	resetBigQueryClient();

	const terminal = vscode.window.createTerminal("gcloud");

	terminal.show();

	terminal.sendText('gcloud auth login --update-adc --add-quota-project-to-adc --quiet --verbosity warning --no-launch-browser');
};

export const commandServiceAccountLogin = async function (...args: any[]) {

	resetBigQueryClient();

	const showOpenDialogResult = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectMany: false, canSelectFolders: false });

	if (showOpenDialogResult) {

		let fileUri = showOpenDialogResult[0];
		const serviceAccountLoginResult = await Authentication.serviceAccountLogin(fileUri);

		if (serviceAccountLoginResult.valid) {
			vscode.window.showInformationMessage('Bigquery: Service account login - successful');
			vscode.commands.executeCommand(COMMAND_AUTHENTICATION_REFRESH);
		} else {
			vscode.window.showErrorMessage('Bigquery: Service account login - had invalid response');
			// getTelemetryReporter()?.sendTelemetryErrorEvent('commandUserLogin', { error: 'Bigquery: Service account login - had invalid response' });
		}

		resetBigQueryClient();
	}

	// getTelemetryReporter()?.sendTelemetryEvent('commandServiceAccountLogin', {});

};

export const commandGcpUserActivate = async function (...args: any[]) {

	resetBigQueryClient();

	const item = args[0] as AuthenticationTreeItem;

	Authentication.activate(item.label)
		.then(result => {
			vscode.commands.executeCommand(COMMAND_AUTHENTICATION_REFRESH);
		});

	// getTelemetryReporter()?.sendTelemetryEvent('commandGcpUserActivate', {});
};

export const commandGcpUserRemove = async function (...args: any[]) {

	resetBigQueryClient();

	const item = args[0] as AuthenticationTreeItem;

	Authentication.revoke(item.label)
		.then(result => {
			vscode.commands.executeCommand(COMMAND_AUTHENTICATION_REFRESH);
		});

	// getTelemetryReporter()?.sendTelemetryEvent('commandGcpUserRemove', {});
};

export const commandGCloudInit = function (...args: any[]) {

	// getTelemetryReporter()?.sendTelemetryEvent('commandGCloudInit', {});

	resetBigQueryClient();

	const terminal = vscode.window.createTerminal("gcloud");

	terminal.show();

	terminal.sendText('gcloud init');

};

export const commandAuthenticationRefresh = function (...args: any[]) {

	const t1 = Date.now();

	resetBigQueryClient();

	gcpAuthenticationTreeDataProvider.refresh();
	authenticationWebviewProvider.refresh();

	// getTelemetryReporter()?.sendTelemetryEvent('commandAuthenticationRefresh', {}, { elapsedMs: Date.now() - t1 });
};

export const commandExplorerRefresh = function (...args: any[]) {

	const t1 = Date.now();

	bigQueryTreeDataProvider.refresh();

	// getTelemetryReporter()?.sendTelemetryEvent('commandExplorerRefresh', {}, { elapsedMs: Date.now() - t1 });
};

export const commandViewTable = async function (...args: any[]) {

	const t1 = Date.now();

	const item = args[0] as BigqueryTreeItem;

	const title = `${item.projectId}.${item.datasetId}.${item.tableId}`;

	if (item.projectId === null || item.datasetId === null || item.tableId === null) {
		return;
	}

	if (item.treeItemType === BigqueryTreeItemType.tableView) {

		await openQueryEditor(item);

	} else {

		const bqClient = await getBigQueryClient();

		const table = bqClient.getTable(item.projectId, item.datasetId, item.tableId);
		const metadata = await table.getMetadata();

		// VIEW catches table refs resolved from the editor (no tree item type available);
		// tabledata.list doesn't work on views/external tables, so open a SELECT instead.
		if (metadata[0].type === 'EXTERNAL' || metadata[0].type === 'VIEW') {
			await openQueryEditor(item);
		} else {

			let panel: vscode.WebviewPanel;
			if (args.length > 1 && args[1] && args[1].viewType === TABLE_RESULTS_VIEW_TYPE) {
				panel = args[1];
			} else {
				panel = vscode.window.createWebviewPanel(TABLE_RESULTS_VIEW_TYPE, title, { viewColumn: vscode.ViewColumn.Active }, { enableFindWidget: true, enableScripts: true, retainContextWhenHidden: true });
			}

			const resultsGridRender = new ResultsGridRender(panel);

			await resultsGridRender.render1();

			// 	const request = {
			// 		tableReference: { projectId: item.projectId, datasetId: item.datasetId, tableId: item.tableId } as TableReference,
			// 		startIndex: 0,
			// 		maxResults: 50,
			// 		jobIndex: 0,
			// 		openInTabVisible: false
			// 	} as ResultsGridRenderRequest;

			// 	newresultsGridRender.render(request);

			try {
				let _postMessageResult1 = await resultsGridRender.postMessage({
					requestType: ResultsGridRenderRequestV2Type.clear.toString(),
					projectId: null,
					token: null,
					job: null,
					error: null
				} as ResultsGridRenderRequestV2);

				const bqClient = await getBigQueryClient();
				// const projectId = await bqClient.getProjectId();
				// console.log('projectId:', projectId);
				const token = await bqClient.getToken();
				// console.log('token:', token);
				// const job = await bqClient.runQuery(queryText);
				const projectId = item.projectId;
				const datasetId = item.datasetId;
				const tableId = item.tableId;

				// const jobReferences = job.map(c => { return { jobId: c.id, projectId: c.projectId, location: c.location } as JobReference; });

				let _postMessageResult2 = await resultsGridRender.postMessage({
					requestType: ResultsGridRenderRequestV2Type.previewTable.toString(),
					projectId: projectId,
					datasetId: datasetId,
					tableId: tableId,
					token: token,
					job: null,
					error: null
				} as ResultsGridRenderRequestV2);

			} catch (errorx) {
				// resultsGridRender.renderException(error);
				const error =
				{
					message: (errorx as any).message || 'undefined message',
					reason: ''
				};

				let _postMessageResult3 = await resultsGridRender.postMessage({
					requestType: ResultsGridRenderRequestV2Type.error.toString(),
					projectId: null,
					token: null,
					job: null,
					error: error
				} as ResultsGridRenderRequestV2);
			}
		}
	}

	// getTelemetryReporter()?.sendTelemetryEvent('commandViewTable', {}, { elapsedMs: Date.now() - t1 });
};

async function openQueryEditor(item: BigqueryTreeItem) {
	const query = `SELECT * \nFROM \`${item.projectId}.${item.datasetId}.${item.tableId}\``;

	const doc = await vscode.workspace.openTextDocument({
		language: 'bqsql',
		content: query
	});

	doc.positionAt(7);
}

export const commandViewTableSchema = async function (...args: any[]) {

	const item = args[0] as BigqueryTreeItem;

	const title = `Schema: ${item.projectId}.${item.datasetId}.${item.tableId}`;

	if (item.projectId === null || item.datasetId === null || item.tableId === null) {
		return;
	}
	const bqClient = await getBigQueryClient();

	const metadataPromise = bqClient.getMetadata(item.projectId, item.datasetId, item.tableId);
	const panel = vscode.window.createWebviewPanel("vscode-bigquery-table-schema", title, { viewColumn: vscode.ViewColumn.Active }, { enableFindWidget: true, enableScripts: true, retainContextWhenHidden: true });
	const schemaRender = new SchemaRender(panel.webview);

	schemaRender.render(metadataPromise);

};

export const commandCreateTableDefaultQuery = async function (...args: any[]) {

	const t1 = Date.now();

	const item = args[0] as BigqueryTreeItem;

	if (item.projectId === null || item.datasetId === null || item.tableId === null) {
		return;
	}

	let query = QueryGeneratorService.generateSelectQuerySimple(item.projectId, item.datasetId, item.tableId);
	try {
		const bqClient = await getBigQueryClient();
		const metadata = await bqClient.getMetadata(item.projectId, item.datasetId, item.tableId);
		query = QueryGeneratorService.generateSelectQuery(metadata);
	} catch (error) { }

	const doc = await vscode.workspace.openTextDocument({
		language: 'bqsql',
		content: query
	});

	await vscode.commands.executeCommand<vscode.TextDocumentShowOptions>("vscode.open", doc.uri);

	// getTelemetryReporter()?.sendTelemetryEvent('commandCreateTableDefaultQuery', {}, { elapsedMs: Date.now() - t1 });

};

export const commandOpenDdl = async function (...args: any[]) {

	const t1 = Date.now();

	const item = args[0] as BigqueryTreeItem;

	if (item.projectId === null || item.datasetId === null || item.tableId === null) {
		return;
	}

	try {

		let query = QueryGeneratorService.generateDdlQuery(item);
		const bqClient = await getBigQueryClient();

		const queryRun = await bqClient.runQuery(query);
		const queryResult = await queryRun.getQueryResults();
		const ddl = queryResult[0][0].ddl;

		const doc = await vscode.workspace.openTextDocument({
			language: 'bqsql',
			content: ddl
		});

		await vscode.commands.executeCommand<vscode.TextDocumentShowOptions>("vscode.open", doc.uri);

	} catch (error) {
		vscode.window.showErrorMessage(JSON.stringify(error));
	}

	// getTelemetryReporter()?.sendTelemetryEvent('commandOpenDdl', {}, { elapsedMs: Date.now() - t1 });

};

export const commandSetDefaultProject = function (...args: any[]) {

	resetBigQueryClient();

	const item = args[0] as BigqueryTreeItem;

	Authentication.setDefaultProjectId(item.projectId || 'xxx')
		.then(result => {
			vscode.commands.executeCommand(COMMAND_EXPLORER_REFRESH);

			resetBigQueryClient();
		});

	// getTelemetryReporter()?.sendTelemetryEvent('setDefaultProjectId', {});
};

export const commandDownloadCsv = async function (this: any, ...args: any[]) {

	if (args.length > 0) {

		let data = args[0];
		if (data.command === "download_csv") {

			if (data.jobReference || data.tableReference) {

				const bqClient = await getBigQueryClient();

				if (data.jobReference) {
					let jobReference = data.jobReference;
					await DownloadCsv.download(bqClient, jobReference);
				} else {
					let tableReference = data.tableReference;

					const table = bqClient.getTable(tableReference.projectId, tableReference.datasetId, tableReference.tableId);


					await DownloadCsv.downloadTable(bqClient, table);
				}
			}

		}

	}

	// const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;

	// if (activeTab === undefined || activeTab.input === undefined) {
	// 	return;
	// }
	// const bqClient = await getBigQueryClient();

	// const viewType = ((activeTab.input as any).viewType as string);
	// if (viewType?.endsWith('-bigquery-query-results')) {

	// 	const uuid = activeTab.label.substring(activeTab.label.length - 8);

	// 	const globalState: vscode.Memento = this.globalState;
	// 	let queryResultsMapping: QueryResultsMapping[] | undefined = globalState.get('queryResultsMapping');
	// 	if (queryResultsMapping) {

	// 		const item = queryResultsMapping.find(c => c.uuid === uuid);
	// 		if (item && item.jobReferences && item.jobIndex !== undefined) {
	// 			await DownloadCsv.download(bqClient, item.jobReferences[item.jobIndex]);
	// 		}
	// 	}
	// } else {
	// 	if (viewType?.endsWith('-bigquery-table-results')) {

	// 		const tableId = activeTab.label.split('.');
	// 		const table = bqClient.getTable(tableId[0], tableId[1], tableId[2]);

	// 		await DownloadCsv.downloadTable(bqClient, table);

	// 	}
	// }

	// const telemetryProperties: TelemetryEventProperties = {
	// 	"button": (args.length > 0 && typeof (args[0]) === "string" ? args[0] : 'webViewPanel')
	// };

	// getTelemetryReporter()?.sendTelemetryEvent('commandDownloadCsv', telemetryProperties);
};

export const commandDownloadJsonl = async function (this: any, ...args: any[]) {

	if (args.length > 0) {

		let data = args[0];
		if (data.command === "download_jsonl") {

			if (data.jobReference || data.tableReference) {

				const bqClient = await getBigQueryClient();

				if (data.jobReference) {
					let jobReference = data.jobReference;
					await DownloadJsonl.download(bqClient, jobReference);
				} else {
					let tableReference = data.tableReference;

					const table = bqClient.getTable(tableReference.projectId, tableReference.datasetId, tableReference.tableId);


					await DownloadJsonl.downloadTable(bqClient, table);
				}
			}


			// const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;

			// if (activeTab === undefined || activeTab.input === undefined) {
			// 	return;
			// }

			// const viewType = ((activeTab.input as any).viewType as string);
			// const bqClient = await getBigQueryClient();

			// if (viewType?.endsWith('-bigquery-query-results')) {

			// 	const uuid = activeTab.label.substring(activeTab.label.length - 8);

			// 	const globalState: vscode.Memento = this.globalState;
			// 	let queryResultsMapping: QueryResultsMapping[] | undefined = globalState.get('queryResultsMapping');
			// 	if (queryResultsMapping) {

			// 		const item = queryResultsMapping.find(c => c.uuid === uuid);
			// 		if (item && item.jobReferences && item.jobIndex !== undefined) {
			// 			await DownloadJsonl.download(bqClient, item.jobReferences[item.jobIndex]);
			// 		}
			// 	}
			// } else {
			// 	if (viewType?.endsWith('-bigquery-table-results')) {

			// 		const tableId = activeTab.label.split('.');
			// 		const table = bqClient.getTable(tableId[0], tableId[1], tableId[2]);

			// 		await DownloadJsonl.downloadTable(bqClient, table);

			// 	}
			// }

			// const telemetryProperties: TelemetryEventProperties = {
			// 	"button": (args.length > 0 && typeof (args[0]) === "string" ? args[0] : 'webViewPanel')
			// };
			// getTelemetryReporter()?.sendTelemetryEvent('commandDownloadJsonl', telemetryProperties);
		}
	}
};

export const commandSendPubsub = async function (this: any, ...args: any[]) {

	if (args.length > 0) {

		let data = args[0];
		if (data.command === "send_pubsub") {
			if (data.jobReference) {
				const bqClient = await getBigQueryClient();

				let jobReference = data.jobReference;
				await SendToPubsub.sendJobResult(bqClient, jobReference);
			}

			// const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;

			// if (activeTab === undefined || activeTab.input === undefined) {
			// 	return;
			// }

			// const viewType = ((activeTab.input as any).viewType as string);
			// if (viewType?.endsWith('-bigquery-query-results')) {

			// 	const uuid = activeTab.label.substring(activeTab.label.length - 8);

			// 	const globalState: vscode.Memento = this.globalState;
			// 	let queryResultsMapping: QueryResultsMapping[] | undefined = globalState.get('queryResultsMapping');
			// 	if (queryResultsMapping) {

			// 		const item = queryResultsMapping.find(c => c.uuid === uuid);
			// 		if (item && item.jobReferences && item.jobIndex !== undefined) {
			// 			const bqClient = await getBigQueryClient();
			// 			await SendToPubsub.sendJobResult(bqClient, item.jobReferences[item.jobIndex]);
			// 		}
			// 	}
			// }
			// //  else {
			// // 	if (viewType?.endsWith('-bigquery-table-results')) {

			// // 		const tableId = activeTab.label.split('.');
			// // 		const table = getBigQueryClient().getTable(tableId[0], tableId[1], tableId[2]);

			// // 		await DownloadJsonl.downloadTable(getBigQueryClient(), table);

			// // 	}
			// // }

			// const telemetryProperties: TelemetryEventProperties = {
			// 	"button": (args.length > 0 && typeof (args[0]) === "string" ? args[0] : 'webViewPanel')
			// };

			// getTelemetryReporter()?.sendTelemetryEvent('commandSendPubsub', telemetryProperties);
		}
	}
};

export const commandCopyToClipboard = async function (this: any, ...args: any[]) {

	if (args.length > 0) {

		let data = args[0];
		if (data.command === "copy_to_clipboard") {

			if (data.jobReference || data.tableReference) {

				const bqClient = await getBigQueryClient();

				if (data.jobReference) {
					let jobReference = data.jobReference;
					await CopyToClipboard.copy(bqClient, jobReference);
				} else {
					let tableReference = data.tableReference;

					const table = bqClient.getTable(tableReference.projectId, tableReference.datasetId, tableReference.tableId);

					await CopyToClipboard.copyTable(bqClient, table);
				}
			}
		}
	}
};

export const commandPinOrUnpinProject = async function (...args: any[]) {

	const item = args[0] as BigqueryTreeItem;
	const projectId = item.projectId || 'xxx';

	const current = (vscode.workspace
		.getConfiguration()
		.get(SETTING_PINNED_PROJECTS) as string[]) || [];

	let pinnedProjects: string[];
	let action: 'pinned' | 'unpinned';
	if (current.indexOf(projectId) >= 0) {
		pinnedProjects = current.filter(c => c && c !== projectId);
		action = 'unpinned';
	} else {
		pinnedProjects = [...current, projectId];
		action = 'pinned';
	}

	try {
		await vscode.workspace
			.getConfiguration()
			.update(SETTING_PINNED_PROJECTS, pinnedProjects, vscode.ConfigurationTarget.Global);
		vscode.window.showInformationMessage(`Project "${projectId}" ${action}.`);
		vscode.commands.executeCommand(COMMAND_EXPLORER_REFRESH);
	} catch (err) {
		vscode.window.showErrorMessage(`Failed to ${action === 'pinned' ? 'pin' : 'unpin'} project: ${(err as any)?.message || err}`);
	}
};

export const commandHideProject = async function (...args: any[]) {

	const item = args[0] as BigqueryTreeItem;
	const projectId = item.projectId || 'xxx';

	const current = (vscode.workspace
		.getConfiguration()
		.get(SETTING_HIDDEN_PROJECTS) as string[]) || [];

	const hiddenProjects = current.indexOf(projectId) < 0
		? [...current, projectId]
		: current;

	try {
		await vscode.workspace
			.getConfiguration()
			.update(SETTING_HIDDEN_PROJECTS, hiddenProjects, vscode.ConfigurationTarget.Global);
		vscode.commands.executeCommand(COMMAND_EXPLORER_REFRESH);
		vscode.window.showInformationMessage(`Project "${projectId}" hidden. Use "BigQuery: Show Hidden Projects" command to unhide.`);
	} catch (err) {
		vscode.window.showErrorMessage(`Failed to hide project: ${(err as any)?.message || err}`);
	}
};

export const commandShowHiddenProjects = async function () {

	const hiddenProjects = vscode.workspace
		.getConfiguration()
		.get(SETTING_HIDDEN_PROJECTS) as string[] || [];

	if (hiddenProjects.length === 0) {
		vscode.window.showInformationMessage('No hidden projects');
		return;
	}

	const selected = await vscode.window.showQuickPick(
		hiddenProjects.map(projectId => ({
			label: projectId,
			description: 'Click to unhide'
		})),
		{
			placeHolder: 'Select a project to unhide',
			canPickMany: false
		}
	);

	if (selected) {
		const updatedHiddenProjects = hiddenProjects.filter(c => c !== selected.label);

		await vscode.workspace
			.getConfiguration()
			.update(SETTING_HIDDEN_PROJECTS, updatedHiddenProjects, vscode.ConfigurationTarget.Global);

		vscode.commands.executeCommand(COMMAND_EXPLORER_REFRESH);

		vscode.window.showInformationMessage(`Project "${selected.label}" is now visible`);
	}
};

export const commandAuthenticationTroubleshoot = async function (this: any, ...args: any[]) {

	const t1 = Date.now();

	const panel = vscode.window.createWebviewPanel(
		TROUBLESHOOT_VIEW_TYPE,
		'Troubleshoot',
		vscode.ViewColumn.One,
		{ retainContextWhenHidden: true }
	);

	panel.webview.html = TroubleshootSerializer.getTroubleshootHtml(panel);

	// getTelemetryReporter()?.sendTelemetryEvent('commandAuthenticationTroubleshoot', {}, { elapsedMs: Date.now() - t1 });

};

export const commandOpenSettingProjects = async function (this: any, ...args: any[]) {

	const t1 = Date.now();

	vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', 'vscode-bigquery.projects');

	// getTelemetryReporter()?.sendTelemetryEvent('commandOpenSettingProjects', {}, { elapsedMs: Date.now() - t1 });

};

export const commandOpenSettingTables = async function (this: any, ...args: any[]) {

	const t1 = Date.now();

	vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', 'vscode-bigquery.tables');

	// getTelemetryReporter()?.sendTelemetryEvent('commandOpenSettingTables', {}, { elapsedMs: Date.now() - t1 });

};



let bigQueryClient: BigQueryClient | null;

export const getBigQueryClient = async function (): Promise<BigQueryClient> {
	if (!bigQueryClient) {
		const t1 = Date.now();
		const projectId = await Authentication.getDefaultProjectId();
		bigQueryClient = new BigQueryClient(projectId);
		// getTelemetryReporter()?.sendTelemetryEvent('CreateBigQueryClient', {}, { elapsedMs: Date.now() - t1 });
	}

	return bigQueryClient;
};

const resetBigQueryClient = function () {
	bigQueryClient = null;
};

export const commandFormatQuery = async function () {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	const document = editor.document;
	const text = document.getText();

	try {
		const formatted = formatBigQuerySQL(text);

		// Replace entire document with formatted text
		const fullRange = new vscode.Range(
			document.positionAt(0),
			document.positionAt(text.length)
		);

		await editor.edit(editBuilder => {
			editBuilder.replace(fullRange, formatted);
		});
	} catch (error: any) {
		vscode.window.showErrorMessage(`Failed to format SQL: ${error.message}`);
	}
};

// Table Index
let tableIndexService: TableIndexService | null = null;

export function initTableIndexService(globalState: vscode.Memento): TableIndexService {
	if (!tableIndexService) {
		tableIndexService = new TableIndexService(globalState);
	}
	return tableIndexService;
}

export function getTableIndexService(): TableIndexService | null {
	return tableIndexService;
}

// Query History
let queryHistoryService: QueryHistoryService | null = null;

export function initQueryHistoryService(globalState: vscode.Memento): QueryHistoryService {
	if (!queryHistoryService) {
		queryHistoryService = new QueryHistoryService(globalState);
	}
	return queryHistoryService;
}

export function getQueryHistoryService(): QueryHistoryService | null {
	return queryHistoryService;
}

// Helper to extract QueryHistoryItem from either direct item or TreeItem
function extractHistoryItem(arg: any): QueryHistoryItem | null {
	if (!arg) {return null;}
	// If it's a TreeItem with historyItem property
	if (arg.historyItem) {return arg.historyItem;}
	// If it's the QueryHistoryItem directly
	if (arg.query && arg.timestamp) {return arg;}
	return null;
}

export const commandHistoryRerun = async function (arg: any) {
	const item = extractHistoryItem(arg);
	if (!item || !item.query) {
		return;
	}

	// Create a new untitled document with the query
	const doc = await vscode.workspace.openTextDocument({
		language: 'bqsql',
		content: item.query
	});
	await vscode.window.showTextDocument(doc);

	// Run the query
	vscode.commands.executeCommand(COMMAND_RUN_QUERY);
};

export const commandHistoryCopy = async function (arg: any) {
	const item = extractHistoryItem(arg);
	if (!item || !item.query) {
		return;
	}
	await vscode.env.clipboard.writeText(item.query);
	vscode.window.showInformationMessage('Query copied to clipboard');
};

export const commandHistoryShow = async function (arg: any) {
	const item = extractHistoryItem(arg);
	if (!item || !item.query) {
		return;
	}

	// Create a new untitled document with the query (read-only preview)
	const doc = await vscode.workspace.openTextDocument({
		language: 'bqsql',
		content: item.query
	});
	await vscode.window.showTextDocument(doc, { preview: true });
};

export const commandHistoryDelete = async function (arg: any) {
	const item = extractHistoryItem(arg);
	if (!item || !item.id || !queryHistoryService) {
		return;
	}
	await queryHistoryService.removeEntry(item.id);
};

export const commandHistoryClear = async function () {
	if (!queryHistoryService) {
		return;
	}

	const confirm = await vscode.window.showWarningMessage(
		'Clear all query history?',
		{ modal: true },
		'Clear'
	);

	if (confirm === 'Clear') {
		await queryHistoryService.clearHistory();
		vscode.window.showInformationMessage('Query history cleared');
	}
};

// Data Lineage
export const commandShowLineage = function (context: vscode.ExtensionContext) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No active editor with SQL query');
		return;
	}

	const text = editor.document.getText();
	if (!text.trim()) {
		vscode.window.showErrorMessage('No SQL query in the active editor');
		return;
	}

	try {
		const result = buildMultiQueryLineage(text);
		const queriesWithLineage = result.queries.filter(q => q.graph.nodes.length > 0);

		if (queriesWithLineage.length === 0) {
			vscode.window.showInformationMessage('No table references found in any queries');
			return;
		}

		showMultiLineagePanel(result, context);
	} catch (error: any) {
		vscode.window.showErrorMessage(`Failed to analyze lineage: ${error.message}`);
	}
};

// Data Lineage for Selection
export const commandShowLineageSelection = function (context: vscode.ExtensionContext) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No active editor with SQL query');
		return;
	}

	if (editor.selection.isEmpty) {
		vscode.window.showErrorMessage('No text selected. Please select a SQL query.');
		return;
	}

	const text = editor.document.getText(editor.selection);
	if (!text.trim()) {
		vscode.window.showErrorMessage('Selected text is empty');
		return;
	}

	try {
		const result = buildMultiQueryLineage(text);
		const queriesWithLineage = result.queries.filter(q => q.graph.nodes.length > 0);

		if (queriesWithLineage.length === 0) {
			vscode.window.showInformationMessage('No table references found in selection');
			return;
		}

		showMultiLineagePanel(result, context);
	} catch (error: any) {
		vscode.window.showErrorMessage(`Failed to analyze lineage: ${error.message}`);
	}
};

// Refresh Schema Cache
export const commandRefreshSchemaCache = function (...args: any[]) {
	const cachedCount = bigqueryTableSchemaService.getCachedTableCount();
	bigqueryTableSchemaService.clearCache();

	if (cachedCount > 0) {
		vscode.window.showInformationMessage(`BigQuery: Schema cache cleared (${cachedCount} table${cachedCount === 1 ? '' : 's'} removed)`);
	} else {
		vscode.window.showInformationMessage('BigQuery: Schema cache was already empty');
	}
};

// Open current SQL file as a BigQuery notebook (inline results)
export const commandOpenAsNotebook = async function (uri?: vscode.Uri) {
	const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
	if (!targetUri) {
		vscode.window.showWarningMessage('Open a .sql or .bqsql file first.');
		return;
	}

	// Unsaved (untitled) buffers have no file for the notebook serializer to read —
	// vscode.openWith would yield an empty notebook. Build the notebook directly from the
	// text buffer and open it as an untitled notebook instead.
	if (targetUri.scheme === 'untitled') {
		if (typeof vscode.window.showNotebookDocument !== 'function') {
			vscode.window.showWarningMessage('Save the file first to open it as a notebook (this VS Code version cannot convert unsaved buffers).');
			return;
		}
		const textDoc = vscode.workspace.textDocuments.find(d => d.uri.toString() === targetUri.toString());
		const notebook = await vscode.workspace.openNotebookDocument(
			'bigquery-sql-notebook',
			textToNotebookData(textDoc?.getText() ?? '')
		);
		await vscode.window.showNotebookDocument(notebook);
		return;
	}

	await vscode.commands.executeCommand('vscode.openWith', targetUri, 'bigquery-sql-notebook');
};

// Open current notebook as a plain text editor
export const commandOpenAsText = async function (uri?: vscode.Uri) {
	const targetUri = uri || vscode.window.activeNotebookEditor?.notebook.uri;
	if (!targetUri) {
		vscode.window.showWarningMessage('No notebook is currently active.');
		return;
	}

	// Close the specific notebook tab (not the active editor) so reopening
	// the same URI switches from notebook to text instead of revealing.
	const uriStr = targetUri.toString();
	const notebookTabs = vscode.window.tabGroups.all
		.flatMap(g => g.tabs)
		.filter(t => t.input instanceof vscode.TabInputNotebook && t.input.uri.toString() === uriStr);

	for (const tab of notebookTabs) {
		await vscode.window.tabGroups.close(tab);
	}

	const doc = await vscode.workspace.openTextDocument(targetUri);
	await vscode.window.showTextDocument(doc, { preview: false });
};

// Toggle Lineage Export Theme
export const commandSetLineageExportTheme = async function (...args: any[]) {
	const config = vscode.workspace.getConfiguration('vscode-bigquery');
	const currentTheme = config.get<string>('lineageExportTheme', 'dark');

	// Toggle between dark and light
	const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

	await config.update('lineageExportTheme', newTheme, vscode.ConfigurationTarget.Global);

	const themeDescription = newTheme === 'dark'
		? 'dark background with light text'
		: 'white background with dark text';

	vscode.window.showInformationMessage(`BigQuery: Lineage export theme switched to ${newTheme} (${themeDescription})`);
};

// Revoke Session (via Command Palette)
export const commandRevokeSession = async function (...args: any[]) {
	try {
		const accounts = await Authentication.list(false);

		if (accounts.length === 0) {
			vscode.window.showInformationMessage('No authenticated accounts found');
			return;
		}

		const items = accounts.map(account => ({
			label: account.account,
			description: account.status === 'ACTIVE' ? '(Active)' : ''
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select account to revoke',
			title: 'Revoke Authentication'
		});

		if (selected) {
			resetBigQueryClient();

			await Authentication.revoke(selected.label);
			vscode.window.showInformationMessage(`Revoked authentication for ${selected.label}`);
			vscode.commands.executeCommand(COMMAND_AUTHENTICATION_REFRESH);
		}
	} catch (error: any) {
		vscode.window.showErrorMessage(`Failed to revoke session: ${error.message || error}`);
	}
};

// Pin Table
export const commandPinTable = async function (...args: any[]) {

	const item = args[0] as BigqueryTreeItem;

	if (!item.projectId || !item.datasetId || !item.tableId) {
		return;
	}

	const tableRef = `${item.projectId}.${item.datasetId}.${item.tableId}`;

	const current = (vscode.workspace
		.getConfiguration()
		.get(SETTING_PINNED_TABLES) as string[]) || [];

	// Case-insensitive dedupe — a previously stored entry with different casing
	// must not produce a duplicate pin.
	const exists = current.some(c => c.trim().toLowerCase() === tableRef.toLowerCase());
	const pinnedTables = exists ? current : [...current, tableRef];

	try {
		await vscode.workspace
			.getConfiguration()
			.update(SETTING_PINNED_TABLES, pinnedTables, vscode.ConfigurationTarget.Global);
		vscode.commands.executeCommand(COMMAND_EXPLORER_REFRESH);
	} catch (err) {
		vscode.window.showErrorMessage(`Failed to pin table: ${(err as any)?.message || err}`);
	}
};

// Unpin Table
export const commandUnpinTable = async function (...args: any[]) {

	const item = args[0] as BigqueryTreeItem;

	if (!item.projectId || !item.datasetId || !item.tableId) {
		return;
	}

	const tableRef = `${item.projectId}.${item.datasetId}.${item.tableId}`;

	const current = (vscode.workspace
		.getConfiguration()
		.get(SETTING_PINNED_TABLES) as string[]) || [];

	const pinnedTables = current.filter(c => c.trim().toLowerCase() !== tableRef.toLowerCase());

	try {
		await vscode.workspace
			.getConfiguration()
			.update(SETTING_PINNED_TABLES, pinnedTables, vscode.ConfigurationTarget.Global);
		vscode.commands.executeCommand(COMMAND_EXPLORER_REFRESH);
	} catch (err) {
		vscode.window.showErrorMessage(`Failed to unpin table: ${(err as any)?.message || err}`);
	}
};

// Search Tables (uses local index from globalState)
export const commandSearchTables = async function (...args: any[]) {

	const tableIndexService = getTableIndexService();
	if (!tableIndexService) { return; }

	const index = tableIndexService.getIndex();
	if (index.length === 0) {
		const action = await vscode.window.showWarningMessage(
			'No table index found. Build the index first to enable search.',
			'Build Index'
		);
		if (action === 'Build Index') {
			vscode.commands.executeCommand(COMMAND_BUILD_TABLE_INDEX);
		}
		return;
	}

	const term = await vscode.window.showInputBox({
		prompt: `Search ${index.length} indexed tables`,
		placeHolder: 'Table name...'
	});

	if (term === undefined) {
		return;
	}

	if (term === '') {
		bigQueryTreeDataProvider.setSearchTerm(null);
		return;
	}

	bigQueryTreeDataProvider.setSearchTerm(term);
};

// Clear Search
export const commandClearSearch = function (...args: any[]) {
	bigQueryTreeDataProvider.setSearchTerm(null);
};

// Build Table Index
export const commandBuildTableIndex = async function (...args: any[]) {

	const tableIndexService = getTableIndexService();
	if (!tableIndexService) { return; }

	const count = await tableIndexService.buildIndex();
	vscode.window.showInformationMessage(`Table index built: ${count} tables indexed`);
};

// Copy Table Path
export const commandCopyTablePath = async function (...args: any[]) {

	const item = args[0] as BigqueryTreeItem;

	if (!item.projectId || !item.datasetId || !item.tableId) {
		return;
	}

	const withBackticks = vscode.workspace
		.getConfiguration('vscode-bigquery')
		.get<boolean>('copyTablePathBackticks', true);

	const raw = `${item.projectId}.${item.datasetId}.${item.tableId}`;
	const tablePath = withBackticks ? `\`${raw}\`` : raw;
	await vscode.env.clipboard.writeText(tablePath);
	vscode.window.showInformationMessage(`Copied: ${tablePath}`);
};

/**
 * Scans globalState, reports each key's size, and offers to wipe.
 * Falls back to a known-keys list when Memento.keys() is empty/unsupported.
 */
const KNOWN_GLOBAL_STATE_KEYS = [
	'bqsql-notebook-cells',
	'bigquery-table-index',
	'queryResultsMapping',
	'queryResultsChartMapping',
	'bigquery-query-history',
];

export const commandClearExtensionCache = function (globalState: vscode.Memento) {
	return async function () {
		try {
			let keys: readonly string[] = [];
			try { keys = globalState.keys() || []; } catch { keys = []; }
			if (!keys.length) { keys = KNOWN_GLOBAL_STATE_KEYS; }
			const merged = Array.from(new Set([...keys, ...KNOWN_GLOBAL_STATE_KEYS]));

			const sizes: Array<{ key: string; bytes: number }> = [];
			for (const key of merged) {
				try {
					const value = globalState.get(key);
					if (value === undefined) { continue; }
					sizes.push({ key, bytes: JSON.stringify(value).length });
				} catch { /* skip */ }
			}
			sizes.sort((a, b) => b.bytes - a.bytes);
			const report = sizes.length
				? sizes.map(s => `${s.key}: ${(s.bytes / 1024 / 1024).toFixed(2)} MB`).join('\n')
				: '(no enumerable keys found)';
			const total = sizes.reduce((acc, s) => acc + s.bytes, 0);
			const choice = await vscode.window.showWarningMessage(
				`BigQuery extension globalState: ${(total / 1024 / 1024).toFixed(1)} MB across ${sizes.length} enumerable keys.\n\n${report}\n\nWipe ALL ${sizes.length} keys?`,
				{ modal: true },
				'Wipe All', 'Cancel'
			);
			if (choice === 'Wipe All') {
				for (const entry of sizes) {
					await globalState.update(entry.key, undefined);
				}
				vscode.window.showInformationMessage(`Cleared ${sizes.length} key(s), ${(total / 1024 / 1024).toFixed(1)} MB freed. Reload window.`);
			}
		} catch (err) {
			vscode.window.showErrorMessage(`Clear cache failed: ${(err as any)?.message || err}`);
		}
	};
};
