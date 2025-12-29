import { Pool } from 'pg'; // The Postgres driver
import { ChatRepository } from '../../../domain/interfaces/ChatRepository';
import { ChatSession, ChatMessage } from '../../../domain/chat/chat.types';

export class PostgresChatRepository implements ChatRepository {
    
    private db: Pool;

    constructor() {
        // Connect to your actual database here
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
    }

    // --- IMPLEMENTATION OF "getSessionById" ---
    async getSessionById(sessionId: string): Promise<ChatSession | null> {
        // Here is the ACTUAL SQL code
        const query = `
            SELECT * FROM chat_sessions 
            WHERE id = $1
        `;
        const result = await this.db.query(query, [sessionId]);
        
        if (result.rows.length === 0) return null;

        // We also need to fetch the messages for this session
        const msgQuery = `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY sent_at ASC`;
        const msgResult = await this.db.query(msgQuery, [sessionId]);

        // Map the database rows back to your Domain Object
        const session: ChatSession = {
            sessionId: result.rows[0].id,
            projectId: result.rows[0].project_id,
            userId: result.rows[0].user_id,
            messages: msgResult.rows.map(row => ({
                messageId: row.id,
                sessionId: row.session_id,
                sender: row.sender,
                content: row.content,
                timestamp: row.sent_at
                // ... map other fields like suggestions/citations
            })),
            startedAt: result.rows[0].started_at,
            lastActiveAt: new Date() // Simplified
        };

        return session;
    }

    // --- IMPLEMENTATION OF "addMessage" ---
    async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
        const query = `
            INSERT INTO chat_messages (id, session_id, sender, content, sent_at)
            VALUES ($1, $2, $3, $4, $5)
        `;
        
        await this.db.query(query, [
            message.messageId,
            sessionId,
            message.sender,
            message.content,
            message.timestamp
        ]);
        
        console.log("✅ Saved message to Postgres");
    }

    // --- IMPLEMENTATION OF "createSession" ---
    async createSession(session: ChatSession): Promise<void> {
        const query = `
            INSERT INTO chat_sessions (id, project_id, user_id, report_id, started_at)
            VALUES ($1, $2, $3, $4, $5)
        `;
        
        await this.db.query(query, [
            session.sessionId,
            session.projectId,
            session.userId,
            session.reportId,
            session.startedAt
        ]);
    }

    async getSessionsByProject(projectId: string): Promise<ChatSession[]> {
        // ... similar SQL logic ...
        return []; 
    }
}

// 🧠 Why is this amazing?Imagine next year your boss says: 
// "Postgres is too expensive! We are moving to MongoDB!"
// If you wrote SQL queries inside your Controller, 
// you would have to rewrite your whole API.But with this architecture:
// You create a new file MongoChatRepository.ts.You update one line in the Controller: 
// new PostgresChatRepository() $\rightarrow$ new MongoChatRepository().
// The rest of your app (Services, AI Agents, React Frontend) doesn't 
// even know anything changed. It just works.