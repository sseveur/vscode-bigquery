import { CancellationToken, Event, InlayHint, InlayHintsProvider, Position, ProviderResult, Range, TextDocument } from "vscode";
import { isBigQueryLanguage } from "../services/languageUtils";


export class BqsqlInlayHintsProvider implements InlayHintsProvider<InlayHint>{

    onDidChangeInlayHints?: Event<void> | undefined;
    provideInlayHints(document: TextDocument, range: Range, token: CancellationToken): ProviderResult<InlayHint[]> {
        if (!isBigQueryLanguage(document.languageId)) { return []; }
        return [];
        //     {
        //     label: "label123",
        //     position: new Position(0, 33),

        // } as InlayHint
    }

}