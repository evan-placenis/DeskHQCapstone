// src/domain/reports/ReportBuilder.ts

import { Report, ReportSection, ReportImageReference } from "./report.types";
import { v4 as uuidv4 } from 'uuid'; 

export class ReportBuilder {
    
    // Internal state: We use Partial because we fill it in step-by-step
    private reportData: Partial<Report> = {
        sections: [],
        history: [],
        versionNumber: 1
    };

    constructor(projectId: string, userId: string) { // We could use userId for 'createdBy' if you add it later
        this.reportData.reportId = uuidv4();
        this.reportData.projectId = projectId;
        this.reportData.createdAt = new Date();
        this.reportData.updatedAt = new Date();
        this.reportData.status = 'DRAFT'; 
    }

    // --- Fluent Setters ---

    public setTitle(title: string): ReportBuilder {
        this.reportData.title = title;
        return this;
    }

    public setStatus(status: 'DRAFT' | 'REVIEW' | 'FINAL'): ReportBuilder {
        this.reportData.status = status;
        return this;
    }

    public setTemplate(templateId: string): ReportBuilder {
        this.reportData.templateId = templateId;
        return this;
    }

    public setVersion(version: number): ReportBuilder {
        this.reportData.versionNumber = version;
        return this;
    }

    // --- The Section Logic ---
    
    /**
     * Adds a section to the report.
     * Automatically converts simple Image IDs (from AI) into rich Image References.
     */
    public addSection(
        title: string, 
        contentMd: string, 
        imageIds: string[] = []
    ): ReportBuilder {
        
        // 1. Convert simple strings into your Domain's Image Reference objects
        const imageReferences: ReportImageReference[] = imageIds.map((id, index) => ({
            imageId: id,
            caption: `Figure ${index + 1}`, // Default caption (User can edit later)
            orderIndex: index
        }));

        // 2. Create the Section Object
        const newSection: ReportSection = {
            id: uuidv4(),
            sectionTitle: title,    // Matches your interface
            content: contentMd,     // Matches your interface
            isReviewRequired: true, // Default to true so humans check AI work
            order: (this.reportData.sections?.length || 0) + 1,
            images: imageReferences
        };

        // 3. Push to state
        if (this.reportData.sections) {
            this.reportData.sections.push(newSection);
        } else {
            this.reportData.sections = [newSection];
        }

        return this;
    }

    // --- Final Build ---

    public build(): Report {
        // Validation: Ensure minimum viable data exists
        if (!this.reportData.projectId) throw new Error("Builder Error: Missing Project ID");
        if (!this.reportData.title) throw new Error("Builder Error: Missing Title");
        if (!this.reportData.templateId) {
             // Fallback if no template was selected
            this.reportData.templateId = "default-observation"; 
        }

        return this.reportData as Report;
    }
}