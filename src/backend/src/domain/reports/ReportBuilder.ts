// src/domain/reports/ReportBuilder.ts

import { Report, MainSectionBlueprint } from "./report.types";
import { v4 as uuidv4 } from 'uuid'; 

export class ReportBuilder {
    
    // Internal state: We use Partial because we fill it in step-by-step
    private reportData: Partial<Report> = {
        reportContent: [],
        history: [],
        versionNumber: 1
    };

    constructor(projectId: string, userId: string) { 
        this.reportData.reportId = uuidv4();
        this.reportData.projectId = projectId;
        this.reportData.createdBy = userId;
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
     * Adds a complete Main Section to the report using the new Blueprint structure.
     */
    public addMainSection(section: MainSectionBlueprint): ReportBuilder {
        if (!this.reportData.reportContent) {
            this.reportData.reportContent = [];
        }
        
        // Ensure order is set if missing
        if (!section.order) {
            section.order = this.reportData.reportContent.length + 1;
        }

        // 🟢 Ensure ID is present
        if (!section.id) {
            section.id = uuidv4();
        }

        this.reportData.reportContent.push(section);
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