import { DocumentStrategy } from '../strategies/interfaces';
import { SpecStrategy } from '../strategies/SpecStrategy';
import { ReportStrategy } from '../strategies/ReportStrategy';

export class DocumentStrategyFactory {
    // We now switch based on the "document type" (e.g. "specification", "previous_report")
    // rather than file MIME type, since all are assumed to be .docx
    public getStrategy(docType: string): DocumentStrategy {
        switch (docType) {
            case 'specification':
                // Structured documents -> Use Headings
                return new SpecStrategy();
            
            case 'previous_report':
                return new ReportStrategy();
            case 'other':
            default:
                // Unstructured/Flat documents -> Simple text chunking
                return new SpecStrategy();
        }
    }
}
