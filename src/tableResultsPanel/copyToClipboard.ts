import * as vscode from 'vscode';
import * as csv_writer from 'csv-writer';
import { ObjectCsvStringifierParams } from 'csv-writer/src/lib/csv-stringifier-factory';
import { JobReference } from '../services/queryResultsMapping';
import { BigQueryClient } from '../services/bigqueryClient';
import { Table, TableSchema } from '@google-cloud/bigquery';

export class CopyToClipboard {

    static async copyTable(bigqueryClient: BigQueryClient, table: Table) {
        try {
            const config = vscode.workspace.getConfiguration('vscode-bigquery');
            const limitKb = config.get<number>('clipboardSizeLimitKb', 1024);
            const limitBytes = limitKb * 1024;

            const createCsvStringifier = csv_writer.createObjectCsvStringifier;

            const metadata = await table.getMetadata();
            const schema = metadata[0].schema as TableSchema;
            const totalRows = Number(metadata[0].numRows || 0);

            const columnNames = schema?.fields?.filter(c => c.name && c.name.length > 0).map(c => { return { id: c.name as string, title: c.name as string }; });
            const csvStringifier = createCsvStringifier({ header: columnNames } as ObjectCsvStringifierParams);

            let csvString = csvStringifier.getHeaderString() || '';
            let currentSize = Buffer.byteLength(csvString, 'utf8');
            let totalCopiedRows = 0;
            let startIndex = 0;
            let truncated = false;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                cancellable: true,
                title: 'Copying to clipboard...'
            }, async (progress, token) => {

                while (!token.isCancellationRequested) {
                    const rows = (await table.getRows({ startIndex: startIndex.toString(), maxResults: 10000 }))[0];

                    if (rows.length === 0) {
                        break;
                    }

                    let adjustedRecords = CopyToClipboard.objectsToString(rows);
                    const recordsString = csvStringifier.stringifyRecords(adjustedRecords);
                    const recordsSize = Buffer.byteLength(recordsString, 'utf8');

                    if (currentSize + recordsSize > limitBytes) {
                        // Would exceed limit - add records one by one until we hit the limit
                        for (const record of adjustedRecords) {
                            const singleRecordString = csvStringifier.stringifyRecords([record]);
                            const singleRecordSize = Buffer.byteLength(singleRecordString, 'utf8');

                            if (currentSize + singleRecordSize > limitBytes) {
                                truncated = true;
                                break;
                            }

                            csvString += singleRecordString;
                            currentSize += singleRecordSize;
                            totalCopiedRows++;
                        }

                        if (truncated) {
                            break;
                        }
                    } else {
                        csvString += recordsString;
                        currentSize += recordsSize;
                        totalCopiedRows += rows.length;
                    }

                    if (totalCopiedRows >= totalRows) {
                        break;
                    }

                    startIndex += 10000;
                    const increment = Math.min(100, (totalCopiedRows / totalRows) * 100);
                    progress.report({ increment: increment });
                }

                if (token.isCancellationRequested) {
                    return;
                }
            });

            if (truncated) {
                const choice = await vscode.window.showWarningMessage(
                    `Data exceeds ${limitKb}KB limit (${totalCopiedRows} of ${totalRows} rows). Copy truncated data or cancel?`,
                    'Copy Truncated',
                    'Cancel'
                );

                if (choice !== 'Copy Truncated') {
                    return;
                }
            }

            await vscode.env.clipboard.writeText(csvString);
            vscode.window.showInformationMessage(`Copied ${totalCopiedRows} rows to clipboard as CSV`);

        } catch (error: any) {
            vscode.window.showErrorMessage(`Unexpected error!\n${error.message}`);
        }
    }

    public static async copy(bigqueryClient: BigQueryClient, jobReference: JobReference) {
        try {
            const config = vscode.workspace.getConfiguration('vscode-bigquery');
            const limitKb = config.get<number>('clipboardSizeLimitKb', 1024);
            const limitBytes = limitKb * 1024;

            const job = bigqueryClient.getJob(jobReference);
            const createCsvStringifier = csv_writer.createObjectCsvStringifier;

            let queryResults = await job.getQueryResults({ autoPaginate: true, maxResults: 1000 });
            const totalRows = Number.parseInt(queryResults[2]?.totalRows as string);

            const columnNames = queryResults[2]?.schema?.fields?.filter(c => c.name && c.name.length > 0).map(c => { return { id: c.name as string, title: c.name as string }; });
            const csvStringifier = createCsvStringifier({ header: columnNames } as ObjectCsvStringifierParams);

            let csvString = csvStringifier.getHeaderString() || '';
            let currentSize = Buffer.byteLength(csvString, 'utf8');
            let totalCopiedRows = 0;
            let truncated = false;
            let records = queryResults[0];

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                cancellable: true,
                title: 'Copying to clipboard...'
            }, async (progress, token) => {

                while (!token.isCancellationRequested) {
                    let adjustedRecords = CopyToClipboard.objectsToString(records);
                    const recordsString = csvStringifier.stringifyRecords(adjustedRecords);
                    const recordsSize = Buffer.byteLength(recordsString, 'utf8');

                    if (currentSize + recordsSize > limitBytes) {
                        // Would exceed limit - add records one by one until we hit the limit
                        for (const record of adjustedRecords) {
                            const singleRecordString = csvStringifier.stringifyRecords([record]);
                            const singleRecordSize = Buffer.byteLength(singleRecordString, 'utf8');

                            if (currentSize + singleRecordSize > limitBytes) {
                                truncated = true;
                                break;
                            }

                            csvString += singleRecordString;
                            currentSize += singleRecordSize;
                            totalCopiedRows++;
                        }

                        if (truncated) {
                            break;
                        }
                    } else {
                        csvString += recordsString;
                        currentSize += recordsSize;
                        totalCopiedRows += records.length;
                    }

                    const pageToken = queryResults[1]?.pageToken;
                    if (totalCopiedRows >= totalRows || !pageToken) {
                        break;
                    }

                    queryResults = await job.getQueryResults({ autoPaginate: true, maxResults: 10000, pageToken: pageToken });
                    records = queryResults[0];

                    const increment = Math.min(100, (totalCopiedRows / totalRows) * 100);
                    progress.report({ increment: increment });
                }

                if (token.isCancellationRequested) {
                    return;
                }
            });

            if (truncated) {
                const choice = await vscode.window.showWarningMessage(
                    `Data exceeds ${limitKb}KB limit (${totalCopiedRows} of ${totalRows} rows). Copy truncated data or cancel?`,
                    'Copy Truncated',
                    'Cancel'
                );

                if (choice !== 'Copy Truncated') {
                    return;
                }
            }

            await vscode.env.clipboard.writeText(csvString);
            vscode.window.showInformationMessage(`Copied ${totalCopiedRows} rows to clipboard as CSV`);

        } catch (error: any) {
            vscode.window.showErrorMessage(`Unexpected error!\n${error.message}`);
        }
    }

    private static objectsToString(records: any[]): any[] {
        let adjustedRecords = [];

        for (let i = 0; i < records.length; i++) {
            const iItem = records[i];
            let newItem: any = {};
            for (const [key, value] of Object.entries(iItem)) {
                if (value && (value as any).value) {
                    newItem[key] = (value as any).value;
                } else {
                    if (value && typeof (value) === 'object') {
                        newItem[key] = (value as Buffer).toString('base64');
                    } else {
                        newItem[key] = value;
                    }
                }
            }
            adjustedRecords.push(newItem);
        }

        return adjustedRecords;
    }
}
