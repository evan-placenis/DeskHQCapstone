import { SupabaseClient } from '@supabase/supabase-js';
import { ChatRepository } from '../../../domain/interfaces/ChatRepository';
import { ChatSession, ChatMessage } from '../../../domain/chat/chat.types';

export class SupabaseChatRepository implements ChatRepository {
    
    // No constructor needed anymore
    // constructor(private supabase: SupabaseClient) {}

    // --- 0. GET MESSAGES BY SESSION (from chat_messages table) ---
    // DB sender is 'user' | 'assistant'; domain uses same.
    private async getMessagesBySessionId(sessionId: string, client: SupabaseClient): Promise<ChatMessage[]> {
        const { data, error } = await client
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('timestamp', { ascending: true })
            .limit(20);

        if (error) return [];
        const messages: ChatMessage[] = (data || []).map((msg: any) => ({
            messageId: msg.id,
            sessionId: msg.session_id,
            sender: (msg.sender === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: msg.content,
            citations: msg.citations,
            suggestion: msg.suggestion,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
        }));
        return messages;
    }

    // --- 1. GET SESSION (session row + messages from chat_messages) ---
    async getSessionById(sessionId: string, client: SupabaseClient): Promise<ChatSession | null> {
        const { data, error } = await client
            .from('chat_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (error || !data) {
            // Surface the real error — most likely RLS filtering out the row
            console.error(`getSessionById(${sessionId}): ${error?.code} ${error?.message ?? 'no data returned'}`);
            return null;
        }

        const messages = await this.getMessagesBySessionId(sessionId, client);

        return {
            sessionId: data.id,
            projectId: data.project_id,
            reportId: data.report_id,
            userId: data.user_id,
            messages,
            startedAt: new Date(data.started_at ?? data.created_at),
            lastActiveAt: new Date(data.last_active_at ?? data.created_at)
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

    // --- 2b. GET SESSION BY REPORT ID (find-or-create: avoid duplicate session when trigger already created one)
    async getSessionByReportId(reportId: string, client: SupabaseClient): Promise<ChatSession | null> {
        const { data, error } = await client
            .from('chat_sessions')
            .select('id')
            .eq('report_id', reportId)
            .limit(1)
            .maybeSingle();

        if (error || !data?.id) return null;
        return this.getSessionById(data.id, client);
    }

    // --- 3. ADD MESSAGE ---
    // Note: Your ChatRepository interface asks for (message: ChatMessage)
    async addMessage(sessionId: string, message: ChatMessage, client: SupabaseClient): Promise<void> {
        const { error } = await client
            .from('chat_messages')
            .insert({
                id: message.messageId,
                session_id: sessionId,
                sender: message.sender,
                content: message.content
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
            console.error("CRITICAL: Project has npm no Organization ID", projectId);
            throw new Error("Cannot create chat: Project not found or invalid.");
        }
        return data.organization_id;
    }


    // --- 5. UPDATE MESSAGE ---
    // Schema has id, session_id, sender, content
    async updateMessage(message: ChatMessage, client: SupabaseClient): Promise<void> {
        const { error } = await client
            .from('chat_messages')
            .update({ content: message.content })
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