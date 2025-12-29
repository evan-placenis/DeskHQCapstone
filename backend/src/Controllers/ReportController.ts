// src/controllers/ReportController.ts
import { Request, Response } from 'express';
import { reportService } from '../config/container';


export class ReportController {


    // POST /api/reports/generate
    static async generateReport(req: Request, res: Response) {
        try {
            const { projectId, ...options } = req.body;
            
            // Delegate to Service
            const report = await reportService.generateNewReport(
                projectId, 
                options
            );
            
            res.json(report);
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    }

    // PATCH /api/reports/:id/sections
    static async updateSection(req: Request, res: Response) {
        try {
            const { reportId } = req.params;
            const { sectionTitle, content, projectId } = req.body;

            await reportService.updateSectionContent(
                projectId, 
                reportId, 
                sectionTitle, 
                content
            );

            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: (error as Error).message});
        }
    }
}

