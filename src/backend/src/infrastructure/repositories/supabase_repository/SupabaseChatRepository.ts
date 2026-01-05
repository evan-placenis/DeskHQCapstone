import { SupabaseClient } from '@supabase/supabase-js';
import { ChatRepository } from '../../../domain/interfaces/ChatRepository';
import { ChatSession, ChatMessage } from '../../../domain/chat/chat.types';

export class SupabaseChatRepository implements ChatRepository {
    
    // No constructor needed anymore
    // constructor(private supabase: SupabaseClient) {}

    // --- 1. GET SESSION (With Messages) ---
    async getSessionById(sessionId: string, client: SupabaseClient): Promise<ChatSession | null> {
        // Fetch Session + Messages
        const { data, error } = await client
            .from('chat_sessions')
            .select(`
                *,
                chat_messages (*)
            `)
            .eq('id', sessionId)
            .single();

        if (error || !data) return null;

        // Map DB Messages -> Domain Messages
        // DB: id, session_id, sender, content, citations, suggestion, timestamp
        // Domain: messageId, sessionId, sender, content, citations, suggestion, timestamp
        const messages: ChatMessage[] = (data.chat_messages || []).map((msg: any) => ({
            messageId: msg.id,
            sessionId: msg.session_id,
            sender: msg.sender, // 'USER' | 'AI' (Direct match)
            content: msg.content,
            citations: msg.citations,
            suggestion: msg.suggestion,
            timestamp: new Date(msg.timestamp)
        }));

        // Sort by time
        messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Map DB Session -> Domain Session
        // DB: id, project_id, user_id, report_id, started_at, last_active_at
        // Domain: sessionId, projectId, userId, reportId, startedAt, lastActiveAt
        return {
            sessionId: data.id,
            projectId: data.project_id,
            reportId: data.report_id,
            userId: data.user_id,
            messages: messages,
            startedAt: new Date(data.started_at),
            lastActiveAt: new Date(data.last_active_at)
        };
    }

    // --- 2. CREATE SESSION ---
    async createSession(session: ChatSession, client: SupabaseClient): Promise<void> {
        // ⚠️ AUTO-FIX: Your domain doesn't have 'organizationId', but DB needs it.
        // We fetch it from the Project to satisfy the database constraint.
        const orgId = await this.getOrgIdFromProject(session.projectId, client);

        const { error } = await client
            .from('chat_sessions')
            .insert({
                id: session.sessionId, // Map sessionId -> id
                project_id: session.projectId,
                organization_id: orgId, // Injected automatically
                user_id: session.userId,
                report_id: session.reportId,
                started_at: session.startedAt,
                last_active_at: session.lastActiveAt
            });

        if (error) throw new Error(`Create Session Failed: ${error.message}`);
    }

    // --- 3. ADD MESSAGE ---
    // Note: Your ChatRepository interface asks for (message: ChatMessage)
    async addMessage(sessionId: string, message: ChatMessage, client: SupabaseClient): Promise<void> {
        const { error } = await client
            .from('chat_messages')
            .insert({
                id: message.messageId, // Map messageId -> id
                session_id: sessionId,
                sender: message.sender, // 'USER' | 'AI'
                content: message.content,
                citations: message.citations,
                suggestion: message.suggestion,
                timestamp: message.timestamp
            });

        if (error) throw new Error(`Add Message Failed: ${error.message}`);
    }

    // --- 4. LIST SESSIONS ---
    async getSessionsByProject(projectId: string, client: SupabaseClient): Promise<ChatSession[]> {
        const { data, error } = await client
            .from('chat_sessions')
            .select('*')
            .eq('project_id', projectId)
            .order('last_active_at', { ascending: false });

        if (error) throw new Error(`List Sessions Failed: ${error.message}`);

        // Map List Results
        return (data || []).map((row: any) => ({
            sessionId: row.id,
            projectId: row.project_id,
            reportId: row.report_id,
            userId: row.user_id,
            messages: [], // Empty for lists
            startedAt: new Date(row.started_at),
            lastActiveAt: new Date(row.last_active_at)
        }));
    }

    // --- HELPER: Resolve Organization ID ---
    private async getOrgIdFromProject(projectId: string, client: SupabaseClient): Promise<string> {
        const { data, error } = await client
            .from('projects')
            .select('organization_id')
            .eq('id', projectId)
            .single();

        if (error || !data) {
            // Fallback: This should only happen if data is corrupt
            console.error("CRITICAL: Project has no Organization ID", projectId);
            throw new Error("Cannot create chat: Project not found or invalid.");
        }
        return data.organization_id;
    }


    // --- 5. UPDATE MESSAGE ---
    // Critical for saving the "ACCEPTED" status on suggestions
    async updateMessage(message: ChatMessage, client: SupabaseClient): Promise<void> {
        const { error } = await client
            .from('chat_messages')
            .update({
                content: message.content,     // In case content was edited
                suggestion: message.suggestion, // This saves the 'status' change
                citations: message.citations
            })
            .eq('id', message.messageId);

        if (error) throw new Error(`Update Message Failed: ${error.message}`);
    }

    // --- 6. UPDATE SESSION TIMESTAMP ---
    // Critical for sorting chats by "Recently Active"
    async updateSessionTimestamp(sessionId: string, lastActiveAt: Date, client: SupabaseClient): Promise<void> {
        const { error } = await client
            .from('chat_sessions')
            .update({
                last_active_at: lastActiveAt
            })
            .eq('id', sessionId);

        if (error) throw new Error(`Update Session Timestamp Failed: ${error.message}`);
    }
}