import { useEffect, useState } from "react";
import { apiRoutes } from "@/lib/api-routes";

export type ChatBootstrapMessage = { role: string; content: string; messageId?: string };

/**
 * Ensures a chat session exists for the report and loads initial thread messages when returned by the API.
 */
export function useReportChatSession(
  projectId: string | number | undefined,
  reportId: string | number | undefined,
) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialChatMessages, setInitialChatMessages] = useState<ChatBootstrapMessage[]>([]);

  useEffect(() => {
    const ensureSession = async () => {
      if (!sessionId && projectId) {
        try {
          const res = await fetch(apiRoutes.chat.root, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, reportId, message: null }),
          });

          let newSessionId = null;
          if (res.ok) {
            const data = await res.json();
            newSessionId = data.sessionId || data.session?.sessionId || data.id;
            setSessionId(newSessionId);
            if (Array.isArray(data.messages) && data.messages.length > 0) {
              setInitialChatMessages(
                data.messages.map(
                  (m: { role?: string; sender?: string; content?: string; messageId?: string }) => ({
                    role: m.sender ?? m.role ?? "user",
                    content: m.content ?? "",
                    messageId: m.messageId,
                  }),
                ),
              );
            }
          } else {
            const errBody = await res.json().catch(() => ({}));
            const errMsg = (errBody as { error?: string })?.error ?? res.statusText;
            console.error("ensureSession: POST /api/chat failed", res.status, errMsg);
          }
        } catch (error) {
          console.error("ensureSession error:", error);
        }
      }
    };
    ensureSession();
  }, [sessionId, projectId, reportId]);

  return { sessionId, initialChatMessages };
}
