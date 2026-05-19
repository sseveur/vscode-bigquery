import { BigQuery, Job, JobResponse, Query, Table } from '@google-cloud/bigquery';
import * as vscode from 'vscode';
import { BigqueryJobError } from './bigqueryJobError';
import { BigqueryTableSchema } from './bigqueryTableSchema';
import { JobReference } from './queryResultsMapping';
import { SchemaField, TableMetadata } from './tableMetadata';

export class BigQueryClient {

	private bqclient: BigQuery;
	private locationCache: Map<string, string> = new Map();

	/**
	 *
	 */
	constructor(projId: string | undefined) {
		this.bqclient = new BigQuery({ 'projectId': projId });
	}

	getToken(): Promise<string | null> {
		return this.bqclient.authClient.getAccessToken()
			.then(value => {
				return value || null;
			});
	}
	getProjectId(): Promise<string | null> {
		return this.bqclient.getProjectId()
			.then(value => {
				return value || null;
			});
	}

	private getDefaultLocation(): string | undefined {
		const setting = vscode.workspace.getConfiguration('vscode-bigquery').get<string>('defaultLocation', '');
		const trimmed = (setting || '').trim();
		return trimmed ? trimmed : undefined;
	}

	private extractFirstDatasetRef(queryText: string): { projectId: string; datasetId: string } | null {
		const cleaned = queryText
			.replace(/--[^\n]*/g, '')
			.replace(/\/\*[\s\S]*?\*\//g, '');
		const re = /\bFROM\s+`?([A-Za-z0-9_-]+)\s*\.\s*([A-Za-z0-9_]+)\s*\.\s*[A-Za-z0-9_]+/gi;
		const m = re.exec(cleaned);
		if (m) { return { projectId: m[1], datasetId: m[2] }; }
		const re2 = /\bFROM\s+`?([A-Za-z0-9_]+)\s*\.\s*[A-Za-z0-9_]+`?/gi;
		const m2 = re2.exec(cleaned);
		if (m2) {
			return { projectId: (this.bqclient as any).projectId || '', datasetId: m2[1] };
		}
		return null;
	}

	private async detectLocation(queryText: string): Promise<string | undefined> {
		const override = this.getDefaultLocation();
		if (override) { return override; }
		const ref = this.extractFirstDatasetRef(queryText);
		if (!ref || !ref.projectId || !ref.datasetId) { return undefined; }
		const cacheKey = `${ref.projectId}.${ref.datasetId}`;
		const cached = this.locationCache.get(cacheKey);
		if (cached) { return cached; }
		try {
			const dataset = this.bqclient.dataset(ref.datasetId, { projectId: ref.projectId });
			const [meta] = await dataset.getMetadata();
			const loc: string | undefined = meta?.location;
			if (loc) { this.locationCache.set(cacheKey, loc); }
			return loc;
		} catch {
			return undefined;
		}
	}

	public async runQuery(queryText: string): Promise<Job> {

		const query: Query = {
			dryRun: false,
			query: queryText,
			useLegacySql: false,
			useQueryCache: true
		};

		const location = await this.detectLocation(queryText);
		if (location) { query.location = location; }

		const jobResponse: JobResponse = await this.bqclient.createQueryJob(query);

		const job = jobResponse[0];

		return job;
	}

	/**
	 * Runs a parameterized query to prevent SQL injection attacks.
	 * Use @paramName syntax in the query and provide values in the params object.
	 */
	public async runParameterizedQuery(queryText: string, params: Record<string, unknown>): Promise<Job> {

		const query: Query = {
			dryRun: false,
			query: queryText,
			useLegacySql: false,
			useQueryCache: true,
			params: params
		};

		const location = await this.detectLocation(queryText);
		if (location) { query.location = location; }

		const jobResponse: JobResponse = await this.bqclient.createQueryJob(query);

		const job = jobResponse[0];

		return job;

		// return new Promise((resolve, reject) => {

		// 	job.on('complete', (metadata) => {

		// 		const jobMeta = jobResponse[1];
		// 		const statementType: string = jobMeta.statistics?.query?.statementType || '';

		// 		//If the query is a 'SCRIPT', means that there's multiple jobs involved.
		// 		// Can be multiple select statements, but also declaring variables is another `job`
		// 		if (statementType === 'SCRIPT') {

		// 			const jobId = jobMeta.jobReference?.jobId || '';

		// 			// in this case, only after the parent jobs is 'DONE', it constains the list 
		// 			// of all the jobs involved.
		// 			// jobs will have id's postfixed
		// 			this.bqclient
		// 				.getJobs({ parentJobId: jobId })
		// 				.then((getJobsResponse) => {

		// 					const jobs: Job[] = getJobsResponse[0];

		// 					const sortedJobs = jobs.sort((a: Job, b: Job) => {

		// 						const id1 = a.id || '';
		// 						const id2 = b.id || '';

		// 						const n1 = Number(id1.substring(id1.lastIndexOf('_') + 1));
		// 						const n2 = Number(id2.substring(id2.lastIndexOf('_') + 1));

		// 						return n1 > n2 ? 1 : -1;
		// 					});

		// 					resolve(sortedJobs);
		// 				})
		// 				.catch((err) => { reject(err); });

		// 		} else {
		// 			resolve([job]);
		// 		}
		// 	});

		// 	job.on('error', (error) => {
		// 		reject(error);
		// 	});

		// });

	}

	public async validateQuery(queryText: string): Promise<[number | null, BigqueryJobError | null]> {

		const query: Query = {
			dryRun: true,
			query: queryText,
			useLegacySql: false,
			useQueryCache: true
		};

		const location = await this.detectLocation(queryText);
		if (location) { query.location = location; }

		let error: BigqueryJobError | null = null;

		try {
			const queryJob = await this.bqclient.createQueryJob(query);

			if (queryJob[1] && queryJob[1].statistics && queryJob[1].statistics.totalBytesProcessed) {
				const totalBytesProcessed = queryJob[1].statistics.totalBytesProcessed;
				if (Number.parseInt(totalBytesProcessed)) {
					return [Number.parseInt(totalBytesProcessed), null];
				}
			}

		} catch (err) {
			error = err as BigqueryJobError;
		}

		return [null, error];
	}

	public getTable(projectId: string, datasetId: string, tableId: string): Table {
		return this.bqclient.dataset(datasetId, { projectId: projectId }).table(tableId);
	}

	public getMetadata(projectId: string, datasetId: string, tableId: string): Promise<TableMetadata> {

		const metadataPromise = this.bqclient
			.dataset(datasetId, { projectId: projectId })
			.table(tableId)
			.getMetadata();

		// Use parameterized query to prevent SQL injection
		const fullSchema = this.runParameterizedQuery(
			`SELECT
				field_path AS fieldPath,
				collation_name AS collationName,
				description
			FROM \`${projectId}.${datasetId}\`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS
			WHERE table_name = @tableName`,
			{ tableName: tableId }
		).then(job => job.getQueryResults())
			.catch(() => [[]] as any);

		return Promise.all([metadataPromise, fullSchema])
			.then(this.onfulfilled);

	}

	public async getTableSchema(projectId: string, datasetName: string, tableName: string): Promise<BigqueryTableSchema[]> {

		// Use parameterized query to prevent SQL injection
		const query = `
SELECT DISTINCT
	colums.table_catalog AS project_id,
	colums.table_schema AS dataset_name,
	colums.table_name,
	colums.column_name,
	colums.ordinal_position,
	colums.data_type,
	colums.is_partitioning_column,
	paths.description,
FROM \`${projectId}.${datasetName}\`.INFORMATION_SCHEMA.COLUMNS colums
  LEFT JOIN \`${projectId}.${datasetName}\`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS paths USING(table_catalog, table_schema, table_name, column_name)
WHERE table_name = @tableName AND is_hidden = 'NO'
`;

		try {
			const q = await this.runParameterizedQuery(query, { tableName: tableName });
			const results = await q.getQueryResults();
			return results[0].map(c => c as BigqueryTableSchema);
		} catch {
			return this.getTableSchemaFromMetadata(projectId, datasetName, tableName);
		}

	}

	private async getTableSchemaFromMetadata(projectId: string, datasetName: string, tableName: string): Promise<BigqueryTableSchema[]> {
		try {
			const [metadata] = await this.bqclient
				.dataset(datasetName, { projectId: projectId })
				.table(tableName)
				.getMetadata();
			const fields = (metadata?.schema?.fields ?? []) as Array<{ name: string, type: string, description?: string }>;
			return fields.map((f, i) => ({
				project_id: projectId,
				dataset_name: datasetName,
				table_name: tableName,
				column_name: f.name,
				ordinal_position: String(i + 1),
				data_type: f.type,
				is_partitioning_column: 'NO',
				description: f.description ?? ''
			}));
		} catch {
			return [];
		}
	}

	public getJob(jobReference: JobReference): Job {
		return this.bqclient.job(jobReference.jobId, { location: jobReference.location, projectId: jobReference.projectId });
	}

	private onfulfilled(value: [any, any]): TableMetadata {

		const metadata = value[0][0] as TableMetadata;

		const extraInformation = value[1][0] as [{ fieldPath: string, collationName: string, description: string }];

		const fields = BigQueryClient.schemaEnrich(null, metadata.schema.fields, extraInformation);

		metadata.schema = { fields: fields };

		return metadata;
	}

	private static schemaEnrich(prefix: string | null, schemaItems: SchemaField[], extraInformation: [{ fieldPath: string, collationName: string, description: string }]): SchemaField[] {

		const newSchemaItems: SchemaField[] = [];

		for (let schemaItemIndex = 0; schemaItemIndex < schemaItems.length; schemaItemIndex++) {

			const schemaItem = schemaItems[schemaItemIndex];

			const fieldPath = `${prefix ? prefix : ''}${prefix ? '.' : ''}${schemaItem.name}`;
			const extra = extraInformation.find(c => c.fieldPath === fieldPath);
			if (extra) {
				schemaItem.collation = extra.collationName === 'NULL' ? '' : extra.collationName;
				schemaItem.description = extra.description;
			}

			if (schemaItem.fields && schemaItem.fields.length > 0) {
				schemaItem.fields = this.schemaEnrich(fieldPath, schemaItem.fields, extraInformation);
			}

			newSchemaItems.push(schemaItem);
		}

		return newSchemaItems;
	}

	//GET https://bigquery.googleapis.com/bigquery/v2/projects
	public async getProjects(): Promise<gapi.client.bigquery.ProjectList> {

		const request = this.bqclient.makeAuthenticatedRequest({ uri: 'https://bigquery.googleapis.com/bigquery/v2/projects', method: 'GET' });

		return new Promise((resolve, reject) => {

			let responseBody: Uint8Array[] = [];

			request.on('data', (chunk) => {
				responseBody.push(chunk);
			});

			request.on('end', () => {
				const responseBodyString = Buffer.concat(responseBody).toString('utf-8');
				resolve(JSON.parse(responseBodyString) as gapi.client.bigquery.ProjectList);
			});

			request.on('error', (error) => {
				// Removed console.log to prevent sensitive data leakage
				reject(error);
			});

		});

	}

}
