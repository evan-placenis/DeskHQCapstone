import { Request, Response } from 'express';
// import { ChatService } from '../Services/ChatService';
import { reportService, chatService } from '../config/container';  
import { PostgresChatRepository } from '../infrastructure/repositories/postgres_repository/PostgresChatRepository'; // Import the Chef

export class ChatController {


    // POST /api/chat/message
    static async sendMessage(req: Request, res: Response) {
        try {
            const { sessionId, message } = req.body;
            
            if (!sessionId || !message) {
                return res.status(400).json({ error: "Missing fields" });
            }

            // Delegate to Service
            const aiResponse = await chatService.handleUserMessage(sessionId, message);

            // Respond to Client
            res.json(aiResponse);

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to process message" });
        }
    }

    // POST /api/chat/start
    static async startSession(req: Request, res: Response) {
        try {
            const { userId, projectId, reportId } = req.body;
            const session = await chatService.startSession(userId, projectId, reportId);
            res.json(session);
        } catch (error) {
            res.status(500).json({ error: (error as Error).message });
        }
    }
}


// You might ask: "Why do we need the Service? Why not just call the AI from the Controller?"

// Imagine later you want to add Slack Integration.

// If logic is in the Controller, you can't reuse it for Slack.

// If logic is in the Service, you just call chatService.handleUserMessage() from your Slack bot, and it works exactly the same way as your React website.

// Controller -> Service -> AI