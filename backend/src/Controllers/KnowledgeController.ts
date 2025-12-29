//npm install multer npm install --save-dev @types/multer
// acts as the bridge between the HTTP request (the file upload) and your KnowledgeService (the RAG logic).

import { Request, Response } from 'express';
import multer from 'multer';

// Services & Repositories (The "Plumbing")
import { PostgresKnowledgeRepository } from '../infrastructure/repositories/postgres_repository/PostgresKnowledgeRepository';
import { knowledgeService } from '../config/container';

// Configure Multer (Simple memory storage for now)
// This keeps the file in RAM so we can process it immediately.
const upload = multer({ storage: multer.memoryStorage() });

export class KnowledgeController {


    /**
     * POST /api/knowledge/upload
     * Expects multipart/form-data with field name 'file'
     */
    static async uploadDocument(req: Request, res: Response) {
        try {
            // Check if file exists
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const { projectId } = req.body;
            if (!projectId) {
                return res.status(400).json({ error: "Project ID is required" });
            }

            // 3. Delegate to Service
            await knowledgeService.processDocument(
                projectId,
                req.file.buffer,      // The raw file data
                req.file.originalname,
                req.file.mimetype as any // Cast to our supported types
            );

            res.json({ success: true, message: "File uploaded and indexing started." });

        } catch (error) {
            console.error("Upload failed:", error);
            res.status(500).json({ error: (error as Error).message });
        }
    }

    /**
     * GET /api/knowledge/:projectId
     * List all files for a project
     */
    static async listFiles(req: Request, res: Response) {
        try {
            const { projectId } = req.params;
            const files = await knowledgeService.getDocuments(projectId);
            
            res.json(files);
        } catch (error) {
            res.status(500).json({ error:(error as Error).message});
        }
    }

    // Export the multer middleware so routes can use it
    static get uploadMiddleware() {
        return upload.single('file'); 
    }
}