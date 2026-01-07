//Adapter Pattern - report serializer to transform the report data into markdown or json
// lib/report/report-serializer.ts

import { ReportSection, Report } from '../../domain/reports/report.types'; // Your types

export class ReportSerializer {

    /**
     * SERIALIZE (Object -> String)
     * Converts the database object into the format the AI needs (Markdown).
     */
    static serialize(section: ReportSection): string {
        // Since ReportSection.content is already Markdown, we just return it.
        // We can optionally append image references if they are stored separately.
        let markdown = section.content || "";
        
        if (section.images && section.images.length > 0) {
            markdown += "\n\n<!-- Referenced Images -->\n";
            section.images.forEach(img => {
                markdown += `![${img.caption || 'Image'}](${img.imageId})\n`;
            });
        }
        
        return markdown;
    }

    /**
     * DESERIALIZE (String -> Object)
     * Parses the AI's text output back into a data object.
     */
    static deserialize(originalSection: ReportSection, aiOutput: string): Partial<ReportSection> {
        // For now, we assume the AI output IS the new content.
        // In the future, we could parse out image tags to update the 'images' array.
        
        return {
            ...originalSection,
            content: aiOutput.trim()
        };
    }

    // STEP 3: THE SERIALIZER (Deterministic Code)
    static serializeReport(report: Report): string {
        let markdown = `# ${report.title}\n\n`;
    
        // Loop through sections
        for (const section of report.sections) {
            markdown += `## ${section.sectionTitle}\n`;
            markdown += `${section.content}\n\n`;
            
            // Append images if present
            if (section.images && section.images.length > 0) {
                section.images.forEach(img => {
                    markdown += `![${img.caption}](${img.imageId})\n`;
                });
                markdown += "\n";
            }
        }
        return markdown;
    }
}