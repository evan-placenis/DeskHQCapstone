'use client';

import { useState, useEffect, useMemo, useRef } from "react";
import { AIChatInput } from "./ai-chat-input";
import { useChat } from '@ai-sdk/react';
import { useAISDKRuntime, AssistantChatTransport} from '@assistant-ui/react-ai-sdk';
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  useMessage,
} from '@assistant-ui/react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  X,
  Loader2,
  Wrench,
  Brain,
  FileSearch,
} from "lucide-react";
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import { apiRoutes } from "@/lib/api-routes";
import { DEFAULT_AI_SDK_CHAT_PROVIDER, type AiSdkChatProvider } from "@/lib/ai-providers";
import remarkGfm from 'remark-gfm';
import { memo } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";


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

/** Humanize tool name for display (e.g. read_specific_sections → "Read specific sections") */
function humanizeToolName(name: string): string {
  const display = name.replace(/_/g, ' ');
  return display.charAt(0).toUpperCase() + display.slice(1);
}

/** Icon for tool based on name - read/fetch tools get FileSearch, others get Wrench */
function ToolIcon({ toolName }: { toolName: string }) {
  const isRead = /^read_|^get|^search/.test(toolName);
  return isRead ? (
    <FileSearch className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
  ) : (
    <Wrench className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
  );
}

/** Collapsible "Thought" section showing reasoning/plan from tool args */
const ThoughtDropdown = memo(({
  reasoning,
  reason,
  defaultOpen = false,
}: {
  reasoning?: string;
  reason?: string;
  defaultOpen?: boolean;
}) => {
  const content = reasoning?.trim() || reason?.trim();
  if (!content) return null;
  

  return (
    <Collapsible defaultOpen={defaultOpen} className="mt-1 group">
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-slate-500 hover:text-slate-700 transition-colors py-1">
        <Brain className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-xs font-medium">Thought</span>
        <ChevronDown className="w-3 h-3 ml-auto flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-5 ml-1.5 border-l border-slate-200 py-2 space-y-1">
          {content.split(/\n+/).filter(Boolean).map((line, i) => (
            <div key={i} className="flex gap-2 text-xs text-slate-600">
              <span className="text-slate-400">◦</span>
              <span className="leading-relaxed">{line.trim()}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});
ThoughtDropdown.displayName = 'ThoughtDropdown';

/** Persistent trace item for each tool call - shows name, status, and optional Thought dropdown */
const ToolTraceItem = memo(({
  part,
  rawContentParts = [],
  isMessageComplete = false,
}: { part: any; rawContentParts?: readonly any[]; isMessageComplete?: boolean }) => {
  const toolName = part.toolName ?? part.name ?? 'tool';
  const toolCallId = part.toolCallId ?? part.id;

  // 1. Check if there is an explicit 'tool-result' part in the array
  const hasSeparateResultPart = rawContentParts.some((p: any) =>
    (p.type === 'tool-result' || p.type === 'tool-return') &&
    (p.toolCallId === toolCallId || p.id === toolCallId)
  );

  // 2. Safely find the tool part, ensuring result is NOT null
  const rawPart = toolCallId && rawContentParts.length > 0
  ? (rawContentParts as any[]).find((p: any) => (p.toolCallId ?? p.id) === toolCallId && p.result !== undefined) 
    ?? (rawContentParts as any[]).find((p: any) => (p.toolCallId ?? p.id) === toolCallId) 
    ?? part
  : part;

  // 3. Tool is done if we have a valid inline result OR a separate result part
  const showDone = hasSeparateResultPart || (rawPart.result !== undefined && rawPart.result !== null);

  const displayName = humanizeToolName(toolName);
  const args = part.args ?? {};
  const reasoning = typeof args.reasoning === 'string' ? args.reasoning : undefined;
  const reason = typeof args.reason === 'string' ? args.reason : undefined;

  // useEffect(() => {
  //   console.log(`[DEBUG - Trace] ${toolName} (${toolCallId}):`, {
  //     showDone,
  //     hasSeparateResultPart,
  //     rawResult: rawPart?.result,
  //     rawState: rawPart?.state,
  //     partType: rawPart?.type
  //   });
  // }, [toolName, toolCallId, showDone, hasSeparateResultPart, rawPart]);

  return (
    <div className="mt-2 mb-1 flex flex-col gap-0">
      <div className="flex items-center gap-2 text-slate-500">
        <ToolIcon toolName={toolName} />
        <span className="text-xs font-medium">{displayName}</span>
        {!showDone && (
          <Loader2 className="w-3 h-3 animate-spin text-slate-400 flex-shrink-0" />
        )}
        {showDone && (
          <span className="text-xs text-slate-400">— Done</span>
        )}
      </div>
      <ThoughtDropdown reasoning={reasoning} reason={reason} defaultOpen={false} />
    </div>
  );
});
ToolTraceItem.displayName = 'ToolTraceItem';

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

  // --- NEW GLOBAL SPINNER LOGIC ---
  // Type for tool-call parts (AI SDK uses toolName or name, toolCallId or id)
  type ToolCallPart = { type: string; toolName?: string; name?: string; toolCallId?: string; id?: string; result?: unknown; };
  const isToolCallPart = (p: unknown): p is ToolCallPart =>
    (p as { type?: string })?.type === 'tool-call' || (p as { type?: string })?.type === 'tool-use';


  const allToolParts = contentParts.filter(isToolCallPart) as ToolCallPart[];

  // FIX: Filter out tools that are already done. Only keep tools currently running.
  const activeRunningTools = allToolParts.filter((toolPart) => {
    // Safely get the ID for the current tool call
    const targetId = toolPart.toolCallId || toolPart.id;

    // If the tool doesn't even have an ID yet, it's brand new and streaming. Keep it!
    if (!targetId) return true;

    // --- THE BULLETPROOF CHECKS (Matching ToolTraceItem's logic) ---

    // Check 1: Does ANY part in the entire content array share this ID *AND* have a result?
    const hasResultInAnyPart = contentParts.some((p: any) => {
      const pId = p.toolCallId ?? p.id;
      return pId === targetId && p.result !== undefined && p.result !== null;
    });

    // Check 2: Is there a dedicated tool-result part for this ID?
    const hasToolResultType = contentParts.some((p: any) => {
      const pId = p.toolCallId ?? p.id;
      return (p.type === 'tool-result' || p.type === 'tool-return') && pId === targetId;
    });

    // Check 3: Is the state explicitly marked as 'result'?
    const isStateResult = (toolPart as any).state === 'result';

    // If ANY of these are true, the tool is completely finished.
    const isFinished = hasResultInAnyPart || hasToolResultType || isStateResult;

    return !isFinished; // Keep ONLY if it hasn't finished yet
  });
  // Get the genuinely active tool (ignoring any that have already finished)
  const currentActiveTool = activeRunningTools[activeRunningTools.length - 1];// We no longer need `toolIsFinished`. If activeRunningTools has items, a tool is actively running.
  const toolName = currentActiveTool?.toolName || currentActiveTool?.name;
  const isToolRunning = activeRunningTools.length > 0;

//  // --- DEBUG LOGGING: GLOBAL SPINNER ---
//  useEffect(() => {
//   if (isRunning && toolName) {
//     console.log('[DEBUG - Spinner] Active Tool State:', {
//       toolName,
//       isToolRunning,
//       rawStateToolName: currentActiveTool?.toolName,
//       partKeys: currentActiveTool ? Object.keys(currentActiveTool) : []
//     });
//   }
// }, [isRunning, toolName, isToolRunning, currentActiveTool]);



  // --- LOGIC: CALCULATE SPINNER STATE ---
  let loadingState = null;

  // Only consider showing a spinner if the AI is running and NOT the user
  if (!isUser && isRunning) {

    // PRIORITY 1: If we have text, FORCE HIDE the spinner.
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

  // --- EARLY RETURN (Must be placed AFTER all hooks!) ---
  if (!message || !mounted) {
    return null;
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

          {/* 1. RENDER CONTENT (Text + Tool trace + Thought dropdown) */}
          <MessagePrimitive.Content
            components={{
              Text: AI_Text_Renderer,
              tools: {
                Fallback: (props: any) => (
                  <ToolTraceItem
                    part={props}
                    rawContentParts={contentParts}
                    isMessageComplete={!isRunning}
                  />
                ),
              },
            }}
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


/** Anchor for structure-based insertion or replacement (no selection) */
export type InsertAnchor =
  | 'start_of_report'
  | 'end_of_report'
  | { afterHeading: string }
  | { replaceSection: string };

// EditSuggestion type (selection-based flow uses range; structure-based uses insertAnchor)
export interface EditSuggestion {
  sectionRowId?: string;    // UUID from report_sections (section-based flow only)
  sectionId?: string;
  sectionHeading?: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  /** ProseMirror range for range-based replace in Tiptap (selection flow) */
  range?: { from: number; to: number };
  /** Structure-based: insert at end or after section (resolved at accept time) */
  insertAnchor?: InsertAnchor;
  /** Legacy: when set without range, Accept used fullDocument replace (deprecated) */
  fullDocument?: string;
  startIdx?: number;
  endIdx?: number;
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
  onEditSuggestion?: (suggestion: EditSuggestion) => void;
  /** When user has highlighted text: get selection + markdown + range from editor (client-context edit) */
  getEditorSelectionContext?: () => import("@/features/reports/components/tiptap-editor").SelectionContext | null;
  /** Trigger selection-based edit (streaming). Called with full context (send context.markdown to API). */
  onRequestAIEditWithSelection?: (context: import("@/features/reports/components/tiptap-editor").SelectionContext, instruction: string) => Promise<void>;
  /** Pinned selection (survives blur) - show Cursor-style "Editing selection" pill when set */
  pinnedSelectionContext?: import("@/features/reports/components/tiptap-editor").SelectionContext | null;
  onClearPinnedSelection?: () => void;
  isGeneratingEdit?: boolean;
  selectedContexts?: any[];
  onClearSelectedContexts?: () => void;
  onRemoveSelectedContext?: (index: number) => void;
  isSelectionMode?: boolean;
  onToggleSelectionMode?: () => void;
  useTiptap?: boolean;
  onSetDiffContent?: (content: string) => void;
  /** Called at send time to get fresh Map & Lens from the live editor. Avoids stale state. */
  getEditorContext?: () => {
    documentOutline: string;
    activeSectionMarkdown: string;
    activeSectionHeading: string;
    fullReportMarkdown: string;
  };
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
  getEditorSelectionContext,
  onRequestAIEditWithSelection,
  pinnedSelectionContext,
  onClearPinnedSelection,
  isGeneratingEdit = false,
  selectedContexts = [],
  onClearSelectedContexts,
  onRemoveSelectedContext,
  isSelectionMode = false,
  onToggleSelectionMode,
  useTiptap = false,
  onSetDiffContent,
  getEditorContext,
}: AIChatSidebarProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [chatProvider, setChatProvider] = useState<AiSdkChatProvider>(DEFAULT_AI_SDK_CHAT_PROVIDER);

  const modelLabel: Record<AiSdkChatProvider, string> = {
    grok: 'Grok',
    'gemini-pro': 'Gemini Pro',
    'gemini-flash': 'Gemini Flash',
    'gemini-lite': 'Gemini Lite',
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

  // Body is a function so it's evaluated at send time — ensures fresh Map & Lens from the live editor.
  // When user had selection, pendingSelectionForBodyRef is set so we send selectionEdit for the chat API.
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: sessionId ? apiRoutes.chat.sessionStream(sessionId) : "",
        body: () => {
          const ctx = getEditorContext?.();
          const sel = pendingSelectionForBodyRef.current;
          const body: Record<string, unknown> = {
            activeSectionId,
            reportId,
            projectId,
            provider: chatProvider,
            documentOutline: ctx?.documentOutline ?? '',
            activeSectionMarkdown: ctx?.activeSectionMarkdown ?? '',
            activeSectionHeading: ctx?.activeSectionHeading ?? '',
            fullReportMarkdown: ctx?.fullReportMarkdown ?? '',
          };
          if (sel?.selection?.trim()) {
            body.selectionEdit = true;
            body.selectionMarkdown = sel.markdown;
            body.surroundingContext = sel.surroundingContext ?? '';
          }
          return body;
        },
      }),
    [sessionId, activeSectionId, reportId, projectId, chatProvider, getEditorContext]
  );

  const chat = useChat({ id: sessionId ?? 'pending', transport });
  const runtime = useAISDKRuntime(chat);

  // Hydrate once when sessionId is set: fetch history from /stream and inject into chat.
  // Skip if initialMessages were already provided by the parent (avoids redundant GET that may 404).
  // Only depend on sessionId so we don't refetch on every chat state update (chat reference changes often).
  const setMessagesRef = useRef(chat?.setMessages);
  setMessagesRef.current = chat?.setMessages;
  const initialMessagesRef = useRef(initialMessages);
  initialMessagesRef.current = initialMessages;

  useEffect(() => {
    if (!sessionId) return;

    const setMessages = setMessagesRef.current;
    if (typeof setMessages !== "function") return;

    // If parent already provided messages (from the POST /api/chat response), use those directly
    const parentMessages = initialMessagesRef.current;
    if (parentMessages && parentMessages.length > 0) {
      const uiMessages = parentMessages.map((msg, i) => ({
        id: msg.messageId ?? `init-${sessionId}-${i}`,
        role: (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        parts: [{ type: "text" as const, text: msg.content ?? "" }]
      }));
      setMessages(uiMessages);
      return;
    }

    // Otherwise fetch history from the API
    let cancelled = false;
    const fetchHistory = async () => {
      try {
        const response = await fetch(apiRoutes.chat.sessionStream(sessionId));
        if (cancelled) return;
        if (!response.ok) return;
        const history = await response.json();
        if (cancelled) return;
        if (!Array.isArray(history) || history.length === 0) return;

        const setMsgs = setMessagesRef.current;
        if (typeof setMsgs !== "function") return;

        const uiMessages = history.map((msg: { id?: string; role?: string; content?: string }, i: number) => ({
          id: msg.id ?? `load-${sessionId}-${i}`,
          role: (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          parts: [{ type: "text" as const, text: msg.content ?? "" }]
        }));
        setMsgs(uiMessages);
      } catch (err) {
        if (!cancelled) console.error("fetchHistory error:", err);
      }
    };

    fetchHistory();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Track processed edits to avoid duplicates
  const lastUserMessageRef = useRef<string | null>(null);
  const lastProcessedStructureInsertRef = useRef<string | null>(null);
  // Hold selection for transport body when sending with selection (body runs at fetch time)
  const pendingSelectionForBodyRef = useRef<typeof pinnedSelectionContext>(null);
  // Guard: when the last send was a selection-based edit, the applyInlineDiff is
  // handled by requestAIEditWithSelection.  Block propose_structure_insertion
  // processing here so the diff is not applied a second time from the chat stream.
  const selectionEditActiveRef = useRef(false);

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
          // Structure-based insertion: user asked to write something without selection
          const structureInsertCall = allToolCalls.find(
            (tool: any) => {
              const toolName = tool.toolName || tool.name;
              const hasResult = 'result' in tool;
              return toolName === 'propose_structure_insertion' && hasResult;
            }
          );

          if (structureInsertCall && onEditSuggestion) {
            const msgId = (lastMessage as any).id ?? '';
            const callId = `${msgId}-propose_structure_insertion`;
            if (lastProcessedStructureInsertRef.current === callId) {
              // Already processed this tool call
            } else if (selectionEditActiveRef.current) {
              // This chat turn was triggered alongside a selection-based ai-edit.
              // The diff is already being applied by requestAIEditWithSelection —
              // skip this tool call to prevent a double-apply that corrupts the diff.
              // CRITICAL: also mark callId as processed so subsequent processToolCalls
              // invocations (which fire on every thread state update) don't retry.
              lastProcessedStructureInsertRef.current = callId;
              console.log('[AIChatSidebar] Skipping propose_structure_insertion — selection edit is active');
            } else {
              lastProcessedStructureInsertRef.current = callId;
              const result = structureInsertCall.result;
              const content = result?.content ?? '';
              const anchor = result?.anchor;
              const reason = result?.reason ?? 'AI proposed insertion';
              const originalContent = result?.originalContent;
              if (content && anchor) {
                const insertAnchor: InsertAnchor = anchor === 'start_of_report'
                  ? 'start_of_report'
                  : anchor === 'end_of_report'
                    ? 'end_of_report'
                    : typeof anchor === 'object' && (anchor as any)?.replaceSection
                      ? { replaceSection: (anchor as { replaceSection: string }).replaceSection }
                      : typeof anchor === 'object' && anchor?.afterHeading
                        ? { afterHeading: anchor.afterHeading }
                        : 'end_of_report';
                // Fallback to live editor state when AI doesn't return originalContent (e.g. to save tokens)
                const ctx = getEditorContext?.();
                const fallbackOriginalText =
                  insertAnchor && typeof insertAnchor === 'object' && 'replaceSection' in insertAnchor
                    ? (ctx?.activeSectionMarkdown ?? '')
                    : '';
                const sectionLabel = insertAnchor === 'start_of_report'
                  ? 'Start of report'
                  : insertAnchor === 'end_of_report'
                    ? 'End of report'
                    : typeof insertAnchor === 'object' && 'replaceSection' in insertAnchor
                      ? `Replace "${insertAnchor.replaceSection}"`
                      : `After "${(insertAnchor as { afterHeading: string }).afterHeading}"`;
                onEditSuggestion({
                  originalText: originalContent || fallbackOriginalText,
                  suggestedText: content,
                  reason,
                  status: 'PENDING',
                  insertAnchor,
                  sectionHeading: sectionLabel,
                });
              }
            }
          }

          // Check for updateSection tool calls (legacy)
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

            const ctx = getEditorContext?.();
            const liveOldValue = ctx?.activeSectionMarkdown ?? '';

            if (useTiptap && activeSectionId === "main-content" && onSetDiffContent) {
              onSetDiffContent(suggestedText);
            } else {
              onSuggestionAccept({
                messageId: (lastMessage as any).id || String(Date.now()),
                sectionId: activeSectionId,
                oldValue: liveOldValue,
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

    return () => unsubscribe();
  }, [runtime, sessionId, activeSectionId, useTiptap, onSuggestionAccept, onSetDiffContent, onEditSuggestion]);

  const handleCustomSend = async (message: string) => {
    if (!runtime) return;
    lastUserMessageRef.current = message;

    const selectionCtx =
      pinnedSelectionContext ??
      getEditorSelectionContext?.() ??
      null;
    const hadSelection = useTiptap && !!selectionCtx?.selection?.trim();

    // When user has selection: stash for transport body (evaluated at fetch time) and run ai-edit in parallel.
    if (hadSelection && selectionCtx) {
      pendingSelectionForBodyRef.current = selectionCtx;
      selectionEditActiveRef.current = true;
      onRequestAIEditWithSelection?.(selectionCtx, message);
    } else {
      pendingSelectionForBodyRef.current = null;
      selectionEditActiveRef.current = false;
    }

    // Always append to thread — both flows use the chat stream so the AI SDK shows its native loader/skills.
    await runtime.thread.append({
      role: 'user',
      content: [{ type: 'text', text: message }],
    });
    pendingSelectionForBodyRef.current = null;
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
                    <DropdownMenuItem onClick={() => setChatProvider('gemini-flash')}>Gemini Flash</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChatProvider('gemini-lite')}>Gemini Lite</DropdownMenuItem>
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

            {/* Pinned selection pill (Cursor-style): show when user highlighted text then clicked to chat */}
            {useTiptap && pinnedSelectionContext && onClearPinnedSelection && (
              <div className="px-3 pt-2 pb-0 border-t border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2 flex-wrap rounded-lg border border-theme-primary/30 bg-theme-primary/5 px-3 py-2">
                  <span className="text-xs font-medium text-theme-primary shrink-0">Editing selection:</span>
                  <span className="text-xs text-slate-600 truncate min-w-0 flex-1" title={pinnedSelectionContext.selection}>
                    &quot;{pinnedSelectionContext.selection.length > 50 ? pinnedSelectionContext.selection.slice(0, 50) + '…' : pinnedSelectionContext.selection}&quot;
                  </span>
                  <button
                    type="button"
                    onClick={onClearPinnedSelection}
                    className="shrink-0 p-1 rounded hover:bg-slate-200/80 text-slate-500 hover:text-slate-700"
                    title="Clear selection"
                    aria-label="Clear selection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            <div className="p-3 border-t border-slate-200 bg-white">
              <AIChatInput
                onSendMessage={handleCustomSend}
                placeholder={pinnedSelectionContext ? "Ask AI to edit the selection above..." : "Ask AI to revise the report..."}
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