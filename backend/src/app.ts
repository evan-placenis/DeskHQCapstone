import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables (.env) before anything else!
dotenv.config();

// Import Controllers
import { ReportController } from './Controllers/ReportController';
import { ChatController } from './Controllers/ChatController';
import { KnowledgeController } from './Controllers/KnowledgeController'

const app = express();

// --- MIDDLEWARE ---
app.use(cors());                 // Allow React to talk to Express
app.use(express.json());         // Parse JSON bodies (for Report/Chat)

// --- ROUTES ---

// 1. Report Routes
app.post('/api/reports/generate', ReportController.generateReport);
app.patch('/api/reports/:reportId/sections', ReportController.updateSection);

// 2. Chat Routes
app.post('/api/chat/start', ChatController.startSession);
app.post('/api/chat/message', ChatController.sendMessage);

// 3. Knowledge Routes (RAG)
// Note: We use the middleware getter we created earlier
app.post(
    '/api/knowledge/upload', 
    KnowledgeController.uploadMiddleware, 
    KnowledgeController.uploadDocument
);
app.get('/api/knowledge/:projectId', KnowledgeController.listFiles);

// --- HEALTH CHECK (To see if it works) ---
app.get('/', (req, res) => {
    res.send('AI Engineering System is Running 🚀');
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`\n================================`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`================================\n`);
});

export default app;