'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { AIChatInput } from "./AIChatInput";
import { useChat } from '@ai-sdk/react';
import { useAISDKRuntime, AssistantChatTransport} from '@assistant-ui/react-ai-sdk';
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  useMessage,
} from '@assistant-ui/react';
import { Button } from "../ui_components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui_components/dropdown-menu";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  X,
  Loader2,
  Wrench
} from "lucide-react";
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import { memo } from "react";



// 1. PERFORMANCE FIX: Define this OUTSIDE the main component

// By defining these OUTSIDE, they never change identity.
// The Markdown engine sees the exact same array pointer and knows it can just "update text"
// instead of "rebuild engine".
const MARKDOWN_PLUGINS = [remarkGfm];// (use this if you want advanced styling such as )

// This ensures React re-uses it instead of rebuilding it on every character.
const AI_Text_Renderer = memo(() => (
  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-ul:pl-4 prose-ol:pl-4">
    <MarkdownTextPrimitive remarkPlugins={MARKDOWN_PLUGINS} />
  </div>
));

// 2. STATUS INDICATOR (Memoized)
const StatusIndicator = memo(({ label }: { label: string }) => (
  // 'h-6' locks the height so it doesn't expand/collapse
  <div className="flex items-center gap-2 text-slate-400 h-6 px-1 animate-pulse">
    <Loader2 className="w-3.5 h-3.5 animate-spin" />
    <span className="text-xs font-medium">{label}</span>
  </div>
));

// 3. CRITICAL FIX: Define the config object OUTSIDE the component.
// This guarantees strict equality (===), so React skips the "Did config change?" check entirely.
const COMPONENT_CONFIG = {
  Text: AI_Text_Renderer,
};

const CustomMessage = () => {
  // Ignore the deprecation warning for now; it is safe to use.
  const message = useMessage();
  const [mounted, setMounted] = useState(false);

  // Avoid "Resource updated before mount" when chat is closed and reopened: only render
  // MessagePrimitive.Root after this component has committed, and skip if message is missing.
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!message || !mounted) {
    return null;
  }

  const isUser = message.role === 'user';

  // --- RAW CHECKS (Fast enough to run every render, safer than memo) ---
  // 1. Status Check
  const statusType = typeof message.status === 'string'
    ? message.status
    : message.status?.type;
  const isRunning = statusType === 'running';

  // 2. Content Checks
  const contentParts = message.content || [];

  // Check for ANY visible text
  const hasText = contentParts.some((c: any) => c.type === 'text' && c.text.length > 0);

  // Check for Tools
  const activeToolPart = contentParts.find((c: any) => c.type === 'tool-call' || c.type === 'tool-use');
  const toolName = (activeToolPart as any)?.toolName || (activeToolPart as any)?.name;

  // --- LOGIC: CALCULATE SPINNER STATE ---
  let loadingState = null;

  // Only consider showing a spinner if the AI is running and NOT the user
  if (!isUser && isRunning) {

    // PRIORITY 1: If we have text, FORCE HIDE the spinner.
    // This fixes the bug where spinner stayed while typing.
    if (hasText) {
      loadingState = null;
    }
    // PRIORITY 2: If no text, but we have a tool, show Tool Spinner
    else if (toolName) {
      const displayName = toolName.replace(/_/g, ' ');
      loadingState = `Running ${displayName}...`;
    }
    // PRIORITY 3: If no text and no tool, show Generic Spinner
    else {
      loadingState = "Reasoning...";
    }
  }


  // --- USER UI (Right Side) ---
  if (isUser) {
    return (
      <MessagePrimitive.Root className="mb-6 w-full flex justify-end animate-slide-up">
        <div className="
          max-w-[85%] 
          bg-slate-100 text-slate-900 
          px-5 py-3 
          rounded-3xl rounded-br-sm 
          shadow-sm text-sm leading-relaxed
        ">
          <MessagePrimitive.Content />
        </div>
      </MessagePrimitive.Root>
    );
  }

  // --- ASSISTANT UI ---
  return (
    <MessagePrimitive.Root className="mb-6 w-full flex justify-start animate-slide-up">
      <div className="max-w-[90%] w-full flex flex-col">

        {/* CONTENT AREA */}
        <div className="text-slate-800 text-sm leading-relaxed w-full">

          {/* 1. RENDER ACTUAL CONTENT (Text & Tools) */}
          <MessagePrimitive.Content
            components={COMPONENT_CONFIG}
          />

          {/* 2. RENDER STATUS SPINNER (Manually handled) */}
          {loadingState && (
            <StatusIndicator label={loadingState} />
          )}

        </div>
      </div>
    </MessagePrimitive.Root>
  );
};


// EditSuggestion type for proposeEdit tool
export interface EditSuggestion {
  sectionRowId: string;    // UUID primary key from report_sections.id (for DB updates)
  sectionId: string;       // Template category like "exec-summary" (for context)
  sectionHeading: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

interface AIChatSidebarProps {
  projectId?: string;
  reportId?: string;
  sessionId: string | null;
  initialMessages?: Array<{ role: string; content: string; messageId?: string }>;
  activeSectionId?: string;
  isCollapsed: boolean;
  width: number;
  onToggleCollapse: () => void;
  onResize: (width: number) => void;
  onSuggestionAccept: (suggestion: any) => void;
  onEditSuggestion?: (suggestion: EditSuggestion) => void; // New: for proposeEdit tool
  onRequestAIEdit?: (sectionRowId: string, instruction: string) => Promise<EditSuggestion | null>; // Non-streaming edit
  isGeneratingEdit?: boolean;
  selectedContexts?: any[];
  onClearSelectedContexts?: () => void;
  onRemoveSelectedContext?: (index: number) => void;
  isSelectionMode?: boolean;
  onToggleSelectionMode?: () => void;
  useTiptap?: boolean;
  onSetDiffContent?: (content: string) => void;
}

export function AIChatSidebar({
  projectId,
  reportId,
  sessionId,
  initialMessages = [],
  activeSectionId,
  isCollapsed,
  width,
  onToggleCollapse,
  onResize,
  onSuggestionAccept,
  onEditSuggestion,
  onRequestAIEdit,
  isGeneratingEdit = false,
  selectedContexts = [],
  onClearSelectedContexts,
  onRemoveSelectedContext,
  isSelectionMode = false,
  onToggleSelectionMode,
  useTiptap = false,
  onSetDiffContent,
}: AIChatSidebarProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [chatProvider, setChatProvider] = useState<'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap'>('gemini-cheap');

  const modelLabel: Record<typeof chatProvider, string> = {
    grok: 'Grok',
    'gemini-pro': 'Gemini Pro',
    'gemini-cheap': 'Gemini (fast)',
    claude: 'Claude',
  };

  // Set window width on mount and handle resize
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowWidth(window.innerWidth);
    }

    const handleResize = () => {
      if (typeof window !== "undefined") {
        setWindowWidth(window.innerWidth);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Handle mouse resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || typeof window === "undefined") return;

      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 320; // Minimum chat width
      const maxWidth = windowWidth * 0.5; // Maximum 50% of screen width

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        onResize(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, windowWidth, onResize]);

  // Vercel useChat + assistant-ui adapter (useAISDKRuntime = "useVercelUseChatRuntime" pattern)
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: sessionId ? `/api/chat/sessions/${sessionId}/stream` : '',
        body: { activeSectionId, reportId, projectId, provider: chatProvider },
      }),
    [sessionId, activeSectionId, reportId, projectId, chatProvider]
  );
  const chat = useChat({ id: sessionId ?? 'pending', transport });
  const runtime = useAISDKRuntime(chat);

  // Hydrate once when sessionId is set: fetch history from /stream and inject into chat.
  // Only depend on sessionId so we don't refetch on every chat state update (chat reference changes often).
  const setMessagesRef = useRef(chat?.setMessages);
  setMessagesRef.current = chat?.setMessages;

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    const fetchHistory = async () => {
      try {
        const response = await fetch(`/api/chat/sessions/${sessionId}/stream`);
        if (cancelled) return;
        if (!response.ok) return;
        const history = await response.json();
        if (cancelled) return;
        if (!Array.isArray(history) || history.length === 0) return;

        const setMessages = setMessagesRef.current;
        if (typeof setMessages !== "function") return;

        const uiMessages = history.map((msg: { id?: string; role?: string; content?: string }, i: number) => ({
          id: msg.id ?? `load-${sessionId}-${i}`,
          role: (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          parts: [{ type: "text" as const, text: msg.content ?? "" }]
        }));
        setMessages(uiMessages);
      } catch (err) {
        if (!cancelled) console.error("fetchHistory error:", err);
      }
    };

    fetchHistory();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Track processed edits to avoid duplicates
  const processedEditRef = useRef<string | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);

  // Listen for message completion to handle tool calls and trigger non-streaming edits
  useEffect(() => {
    if (!runtime || !sessionId) return;

    // Helper function to extract and process tool calls
    const processToolCalls = (lastMessage: any) => {
      try {
        // Get tool calls from content array (assistant-ui format) OR toolInvocations (vercel ai format)
        const contentParts = (lastMessage as any).content || [];
        const toolCalls = contentParts.filter((part: any) => 
          part.type === 'tool-call' && part.result !== undefined
        );
        
        // Also check legacy toolInvocations property
        const toolInvocations = (lastMessage as any).toolInvocations || [];
        const allToolCalls = [...toolCalls, ...toolInvocations];
        
        if (allToolCalls.length > 0) {
          // Check for retrieveReportContext tool calls - this triggers the non-streaming edit
          const retrieveContextCall = allToolCalls.find(
            (tool: any) => {
              const toolName = tool.toolName || tool.name;
              const hasResult = 'result' in tool;
              return toolName === 'retrieveReportContext' && hasResult;
            }
          );

          if (retrieveContextCall && onRequestAIEdit) {
            const toolResult = retrieveContextCall.result;
            
            // If we found a section successfully, trigger the non-streaming edit
            if (toolResult?.status === 'SUCCESS' && toolResult?.sectionRowId) {
              // Avoid duplicate processing
              const editKey = `${toolResult.sectionRowId}-${lastUserMessageRef.current}`;
              if (processedEditRef.current === editKey) {
                return;
              }
              processedEditRef.current = editKey;
              
              // Get the user's instruction from the last message they sent
              const instruction = lastUserMessageRef.current || 'improve this section';
              
              console.log(`🔄 [AIChatSidebar] Triggering non-streaming edit for "${toolResult.sectionHeading}"`);
              onRequestAIEdit(toolResult.sectionRowId, instruction);
              return true;
            }
          }

          // Fallback: Check for updateSection tool calls (legacy)
          const updateSectionCall = allToolCalls.find(
            (tool: any) => {
              const toolName = tool.toolName || tool.name;
              const hasResult = 'result' in tool;
              return toolName === 'updateSection' && hasResult;
            }
          );

          if (updateSectionCall && activeSectionId) {
            const toolResult = updateSectionCall.result;
            const messageContent = (lastMessage as any).content || (lastMessage as any).text || '';
            const suggestedText = (toolResult?.markdown ||
              (typeof toolResult === 'string' ? toolResult : null) ||
              messageContent) as string;

            if (useTiptap && activeSectionId === "main-content" && onSetDiffContent) {
              onSetDiffContent(suggestedText);
            } else {
              onSuggestionAccept({
                messageId: (lastMessage as any).id || String(Date.now()),
                sectionId: activeSectionId,
                oldValue: '',
                newValue: suggestedText,
                source: "ai"
              });
            }
          }
        }
      } catch (err) {
        console.error('[AIChatSidebar] Error processing tool calls:', err);
      }
    };

    // Subscribe to thread state changes to detect completed messages
    const unsubscribe = runtime.thread.subscribe(() => {
      try {
        const threadState = runtime.thread.getState();
        const messages = threadState.messages || [];

        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];

          // Check if message is from assistant (process both running and complete to catch tool results early)
          if (lastMessage.role === 'assistant') {
            const messageStatus = typeof (lastMessage as any).status === 'string' 
              ? (lastMessage as any).status 
              : (lastMessage as any).status?.type;
            
            // Process tool calls when message is complete, or when running (to catch results as they stream)
            if (messageStatus === 'complete' || messageStatus === 'running') {
              processToolCalls(lastMessage);
            }
          }
        }
      } catch (err) {
        // Catch streaming errors gracefully - the tool result data may still be valid
        console.warn('[AIChatSidebar] Streaming error (may be recoverable):', err);
      }
    });

    return () => {
      unsubscribe();
      // Reset processed edit ref when unsubscribing
      processedEditRef.current = null;
    };
  }, [runtime, sessionId, activeSectionId, useTiptap, onSuggestionAccept, onSetDiffContent, onEditSuggestion]);

  const handleCustomSend = async (message: string) => {
    if (!runtime) return;
    // Track the user's message for non-streaming edit instruction
    lastUserMessageRef.current = message;
    await runtime.thread.append({
      role: 'user',
      content: [{ type: 'text', text: message }],
    });
  };

  return (
    <div
      className="hidden lg:flex flex-col bg-white border-l border-slate-200 relative h-full"
      style={{
        width: isCollapsed ? '48px' : width,
        minWidth: isCollapsed ? '48px' : '320px',
        maxWidth: isCollapsed ? '48px' : `${windowWidth > 0 ? windowWidth * 0.5 : 500}px`,
        transition: isResizing ? 'none' : 'width 300ms'
      }}
    >
      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-theme-primary/50 active:bg-theme-primary transition-colors z-50 group"
          onMouseDown={() => setIsResizing(true)}
          title="Drag to resize"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-slate-300 group-hover:bg-theme-primary rounded-full transition-colors" />
        </div>
      )}

      <div className="flex-none">
        {isCollapsed ? (
          <Button variant="ghost" size="icon" className="m-2" onClick={onToggleCollapse}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        ) : (
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-theme-primary/5 to-theme-primary/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-theme-primary/20 rounded-full blur-md animate-pulse" />
                  <div className="relative p-2 rounded-full bg-theme-primary flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-slate-900 font-medium">AI Assistant</h3>
                  <p className="text-xs text-slate-500">Always here to help</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    >
                      {modelLabel[chatProvider]}
                      <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[140px]">
                    <DropdownMenuItem onClick={() => setChatProvider('grok')}>Grok (xAI)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChatProvider('gemini-pro')}>Gemini Pro</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChatProvider('gemini-cheap')}>Gemini (fast)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChatProvider('claude')}>Claude</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleCollapse}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isCollapsed && runtime && sessionId ? (
        <AssistantRuntimeProvider runtime={runtime}>
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto bg-slate-50/30">
              <ThreadPrimitive.Root className="h-full flex flex-col">
                <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Custom Message Component */}
                  <ThreadPrimitive.Messages
                    components={{
                      Message: CustomMessage
                    }}
                  />
                </ThreadPrimitive.Viewport>
              </ThreadPrimitive.Root>
            </div>

            {selectedContexts.length > 0 && onRemoveSelectedContext && (
              <div className="px-4 py-2 border-t border-slate-100 bg-white">
                <div className="flex flex-wrap gap-2">
                  {selectedContexts.map((ctx, i) => (
                    <div key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-100">
                      <FileText className="w-3 h-3" />
                      <span className="truncate max-w-[100px]">{ctx.label}</span>
                      <button onClick={() => onRemoveSelectedContext(i)}><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 border-t border-slate-200 bg-white">
              <AIChatInput
                onSendMessage={handleCustomSend}
                placeholder="Ask AI to revise the report..."
                disabled={false}
              />
            </div>

          </div>
        </AssistantRuntimeProvider>
      ) : (
        !isCollapsed && (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            {sessionId ? "Loading..." : "Initializing chat..."}
          </div>
        )
      )}
    </div>
  );
}