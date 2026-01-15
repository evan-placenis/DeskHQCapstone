import ReactMarkdown from 'react-markdown';
import { useState, useEffect, useRef } from "react";
import { Button } from "../ui_components/button";
import { Card } from "../ui_components/card";
import { Badge } from "../ui_components/badge";
import { Avatar, AvatarFallback } from "../ui_components/avatar";
import { Separator } from "../ui_components/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui_components/select";
import { EditableText } from "../smart_components/EditableText";
import { RewritableText } from "../smart_components/RewritableText";
import { DiffView } from "../smart_components/DiffView";
import { HighlightableText } from "../smart_components/HighlightableText";
import { AIChatInput } from "./AIChatInput";
import { ChatBubble, ChatMessage } from "../smart_components/ChatBubble"; // 🟢 Updated Import
import { PeerReviewPanel } from "../smart_components/PeerReviewPanel";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { SecureImage } from "../smart_components/SecureImage";
import { PeerReview, ReportContent } from "@/frontend/types"; // 🟢 Removed ChatMessage from here
import {
  ArrowLeft,
  Download,
  Sparkles,
  User,
  Bot,
  Calendar,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Settings,
  Save,
  X,
  Image as ImageIcon,
  FileText,
  MousePointer2,
} from "lucide-react";

// Add these to your imports
import { DataSerializer } from "@/backend/AI_Strategies/ChatSystem/adapter/serializer"; 
import { PlateSectionEditor } from "../smart_components/PlateSectionEditor";

interface SelectedContext {
  type: "photo" | "section" | "text";
  content: string;
  id?: number | string;
  label: string;
  highlightedText?: string;
}

interface PendingChange {
  messageId: number | string; // Updated to allow string IDs
  sectionId?: number | string;
  field?: string;
  oldValue: string;
  newValue: string;
  newData?: any;
  changes?: any[]; 
  stats?: any;     
  source: "ai" | "peer-review";
}

interface ReportLayoutProps {
  mode: "edit" | "peer-review";
  projectId?: string | number; 
  reportId?: string | number;  
  reportContent: ReportContent;
  onContentChange: (updates: Partial<ReportContent>) => void;
  onSectionChange: (sectionId: number | string, newContent: string, newData?: any) => void;
  
  // Header props
  onBack: () => void;
  backLabel?: string;
  
  // Photos
  photos?: Array<{ id: number | string; url: string; caption?: string; section?: string }>;
  
  // Status
  reportStatus: string;
  onStatusChange: (status: string) => void;
  
  // Actions
  onRequestPeerReview?: () => void;
  onExport?: () => void;
  onSave?: () => void;
  showSaveButton?: boolean;
  
  // Peer Review (only for peer-review mode)
  peerReview?: PeerReview;
  onAddReviewComment?: (comment: string, type: "issue" | "suggestion" | "comment") => void;
  onAddHighlightComment?: (highlightedText: string, sectionId: number | string, comment: string, type: "issue" | "suggestion" | "comment") => void;
  onResolveComment?: (commentId: number) => void;
  onCompleteReview?: () => void;
  onOpenRatingModal?: () => void;
  initialReviewNotes?: string;
}

export function ReportLayout({
  mode,
  projectId,
  reportId,
  reportContent,
  onContentChange,
  onSectionChange,
  onBack,
  backLabel = "Back",
  photos = [],
  reportStatus,
  onStatusChange,
  onRequestPeerReview,
  onExport,
  onSave,
  showSaveButton = false,
  peerReview,
  onAddReviewComment,
  onAddHighlightComment,
  onResolveComment,
  onCompleteReview,
  onOpenRatingModal,
  initialReviewNotes,
}: ReportLayoutProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    // 🟢 Initialize with Reviewer Notes if available
    const initialMessages: ChatMessage[] = [];
    
    // Add the Reviewer's thinking process first if it exists
    if (initialReviewNotes) {
      initialMessages.push({
        id: "init-1",
        role: "assistant",
        content: `**Reviewer Scratchpad:**\n\n${initialReviewNotes}`,
        timestamp: new Date()
      });
    }

    // Add standard greeting
    initialMessages.push({
      id: "init-2",
      role: "assistant",
      content: mode === "edit" 
        ? "Hello! I'm your AI assistant for this report. I can help you revise sections, add technical details, adjust the tone, or answer questions about the observations. What would you like me to help with?"
        : "Hello! I'm here to help you review this report. Feel free to ask questions about any section or request clarifications.",
      timestamp: new Date()
    });

    return initialMessages;
  });
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(384); // Default 384px (w-96)
  const [isResizing, setIsResizing] = useState(false);
  const [activeHighlightCommentId, setActiveHighlightCommentId] = useState<number | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedContexts, setSelectedContexts] = useState<SelectedContext[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  // State for window width to handle SSR and resize safely
  const [windowWidth, setWindowWidth] = useState(0);

  // Set window width on mount
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

  // Play notification sound when AI responds
  const playNotificationChime = () => {
    try {
      const audioContext = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;
      if (!audioContext) return;
      
      // Create a pleasant two-tone chime
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        // Envelope for smooth sound
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      playTone(800, now, 0.15);        // First tone (E5)
      playTone(1000, now + 0.1, 0.2);  // Second tone (C6)
    } catch (error) {
      console.log('Audio notification not supported');
    }
  };

  // Handle mouse resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || typeof window === "undefined") return;

      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 320; // Minimum chat width
      const maxWidth = windowWidth * 0.5; // Maximum 50% of screen width

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setChatWidth(newWidth);
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
  }, [isResizing]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleUpdateNestedContent = (
    sectionId: string | number,
    subSectionIndex: number, // -1 means Parent Description
    pointIndex: number | null, // null means updating subsection description
    newValue: string
  ) => {
    const newSections = reportContent.sections.map(sec => {
      if (sec.id !== sectionId) return sec;
      
      // Update Parent Description
      if (subSectionIndex === -1) {
          return { ...sec, description: newValue };
      }

      // Deep clone subSections to avoid mutation
      if (!sec.subSections) return sec;
      const newSubSections = [...sec.subSections];
      
      // Clone the specific subsection
      const sub = { ...newSubSections[subSectionIndex] };
      
      if (pointIndex !== null) {
        // Update bullet point
        if (sub.children && sub.children[pointIndex]) {
            const newChildren = [...sub.children];
            newChildren[pointIndex] = { ...newChildren[pointIndex], point: newValue };
            sub.children = newChildren;
        }
      } else {
        // Update description
        sub.description = newValue;
      }
      
      newSubSections[subSectionIndex] = sub;
      
      return { ...sec, subSections: newSubSections };
    });

    onContentChange({ sections: newSections });
  };

  const handleAcceptChange = () => {
    if (!pendingChange) return;

    if (pendingChange.sectionId) {
      // 🟢 Pass newData if available
      onSectionChange(pendingChange.sectionId, pendingChange.newValue, pendingChange.newData);
    }

    setPendingChange(null);
  };

  const handleRejectChange = () => {
    setPendingChange(null);
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // 1. Optimistic UI Update
    const userMessage: ChatMessage = {
      id: Date.now().toString(), 
      role: "user",
      content: message,
      timestamp: new Date()
    };

    const thinkingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Reasoning >",
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage, thinkingMessage]);

    try {
        let currentSessionId = sessionId;

        // 2. Ensure Session Exists
        if (!currentSessionId) {
            if (!projectId) {
                // If no projectId, fallback to mock/warning but don't break
                console.warn("Missing Project ID - cannot start real session");
                // Fallback to mock behavior or error message
                throw new Error("Missing Project ID");
            }
            const res = await fetch("/api/chat/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    projectId, 
                    reportId 
                })
            });
            if (!res.ok) throw new Error("Failed to create session");
            const sessionData = await res.json();
            currentSessionId = sessionData.sessionId;
            setSessionId(currentSessionId);
        }

        // 3. Send Message to Backend (including active context)
        const activeSection = selectedContexts.find(c => c.type === "section");
        const activeSectionId = activeSection ? String(activeSection.id) : undefined;
        
        // console.log("📤 Sending Message:", { message, activeSectionId, reportId }); // 🟢 FRONTEND DEBUG

        const response = await fetch(`/api/chat/sessions/${currentSessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message,
                activeSectionId,
                reportId // 🟢 Pass reportId in case session is missing it
            })
        });

        if (!response.ok) throw new Error("Failed to send message");
        const aiMessageData = await response.json();

        // 4. Update UI with Real Response
        const aiMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: aiMessageData.content,
            timestamp: new Date(),
            suggestion: aiMessageData.suggestion ? {
                id: aiMessageData.suggestion.id || "temp-id", // Use backend ID or fallback
                targetSectionId: aiMessageData.suggestion.targetSectionId,
                status: aiMessageData.suggestion.status,
                stats: aiMessageData.suggestion.stats,
                changes: aiMessageData.suggestion.changes,
                // We keep 'originalText', 'suggestedText' in raw object if needed, but 'suggestion' follows EditSuggestion interface
                // Note: The backend 'EditSuggestion' might have extra fields, but that's fine.
            } : undefined
        };

        setChatMessages(prev => {
            const filtered = prev.filter(msg => msg.content !== "Reasoning >");
            return [...filtered, aiMessage];
        });

        // Handle Suggestions (Legacy support for Main Diff View)
        if (aiMessageData.suggestion) {
            setPendingChange({
                messageId: aiMessage.id,
                sectionId: aiMessageData.suggestion.targetSectionId,
                oldValue: aiMessageData.suggestion.originalText,
                newValue: aiMessageData.suggestion.suggestedText,
                newData: aiMessageData.suggestion.suggestedData,
                changes: aiMessageData.suggestion.changes, // 🟢 Map from backend
                stats: aiMessageData.suggestion.stats,     // 🟢 Map from backend
                source: "ai"
            });
        }

        playNotificationChime();

    } catch (error) {
        console.error("Chat Error:", error);
        setChatMessages(prev => {
            const filtered = prev.filter(msg => msg.content !== "Reasoning >");
            return [...filtered, {
                id: Date.now().toString(),
                role: "assistant",
                content: "Sorry, I encountered an error processing your request. Please ensure you are connected to a valid project.",
                timestamp: new Date()
            }];
        });
    }
  };

  const handleHighlightEdit = (highlightedText: string, sectionId: number | string, newText: string) => {
    // Find the section content
    const section = reportContent.sections.find(s => s.id === sectionId);
    if (section) {
      setPendingChange({
        messageId: chatMessages.length + 1,
        sectionId: sectionId,
        oldValue: section.content,
        newValue: section.content.replace(highlightedText, newText),
        source: "peer-review"
      });
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      // Exiting selection mode - clear all selections
      setSelectedContexts([]);
    }
  };

  const handleItemClick = (context: SelectedContext) => {
    if (!isSelectionMode) return;

    // Check if already selected
    const existingIndex = selectedContexts.findIndex(
      (c) => c.type === context.type && c.id === context.id
    );

    if (existingIndex >= 0) {
      // Remove if already selected
      setSelectedContexts(selectedContexts.filter((_, i) => i !== existingIndex));
    } else {
      // Add to selections
      setSelectedContexts([...selectedContexts, context]);
    }
  };

  const isItemSelected = (type: string, id?: number | string) => {
    return selectedContexts.some(
      (c) => c.type === type && c.id === id
    );
  };

  const removeSelectedContext = (index: number) => {
    setSelectedContexts(selectedContexts.filter((_, i) => i !== index));
  };

  const handleRequestRewrite = (currentText: string, instructions: string, sectionId?: number | string, field?: string) => {
    // Create a user message with the rewrite request
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: `Rewrite this text: "${currentText.substring(0, 100)}${currentText.length > 100 ? '...' : ''}"\n\nInstructions: ${instructions}`,
      timestamp: new Date()
    };

    // Add thinking indicator
    const thinkingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Reasoning >",
      timestamp: new Date()
    };

    setChatMessages([...chatMessages, userMessage, thinkingMessage]);
    
    // Simulate AI response with rewrite
    setTimeout(() => {
        // Fallback or move this logic to backend too if needed
      const rewrittenText = "Rewrite logic pending backend integration"; 
      
      const response: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `I've rewritten the text based on your instructions. Review the changes below and accept if you're satisfied.`,
        timestamp: new Date(),
        // Mock suggestion for frontend simulation
        suggestion: {
            id: "mock-id",
            targetSectionId: String(sectionId),
            status: "PENDING",
            stats: { added: 0, removed: 0, changeSummary: "Mock Edit" },
            changes: []
        }
      };
      
      // Replace the thinking message with actual response
      setChatMessages(prev => {
        const withoutThinking = prev.filter(msg => msg.content !== "Reasoning >");
        return [...withoutThinking, response];
      });
      
      // Set as pending change
      setPendingChange({
        messageId: response.id,
        sectionId: sectionId,
        field: field,
        oldValue: currentText,
        newValue: rewrittenText,
        source: "ai"
      });
      
      // Play notification sound
      playNotificationChime();
    }, 1500);
  };
  // 🟢 1. INSTANTIATE SERIALIZER
  const serializer = new DataSerializer();

    // 2. MERGE ALL SECTIONS into one big Markdown string
  // We join them with "\n\n" to ensure distinct paragraphs between sections.
  const fullReportMarkdown = reportContent.sections
  .map(section => serializer.toMarkdown(section, 1)) // depth 1 = # Header
  .join("\n\n");

  // 🟢 3. NEW UPDATE HANDLER (Markdown -> JSON)
  //handle the Update (Splitting it back up) When the user types, you get one giant Markdown string back. You need to split it back into sections based on the headers (# Title).
  const handleFullDocumentUpdate = (fullMarkdown: string) => {
    // 1. Parse markdown into rich objects
    console.log("📥 [4. BACKEND PARSER] Received Markdown length:", fullMarkdown.length);
    const newSections = DataSerializer.parseFullMarkdownToSections(fullMarkdown);
    console.log("📥 [5. BACKEND PARSER] Parsed sections length:", newSections);
    // 2. Merge with existing IDs
    const mergedSections = newSections.map((newSec, index) => {
        const existing = reportContent.sections[index];
        
        // Use existing ID if titles match (best effort), otherwise random
        const idToUse = (existing && existing.title === newSec.title) 
            ? existing.id 
            : Math.random().toString();

        return {
            ...newSec,
            id: idToUse,
        };
    });

    onContentChange({ sections: mergedSections });
};
  

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden">
      {/* Main Report Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-3 sm:p-6 flex-shrink-0">
          <Button 
            variant="ghost" 
            size="sm"
            className="mb-2 sm:mb-3 -ml-2 rounded-lg text-xs sm:text-sm h-8 sm:h-auto"
            onClick={onBack}
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            {backLabel}
          </Button>

          
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
            <div className="flex-1 min-w-0">
              <h1 className="text-slate-900 mb-2 text-base sm:text-xl truncate">{reportContent.title}</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                  {reportContent.date}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                  {reportContent.location}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 sm:w-4 sm:h-4" />
                  {reportContent.engineer}
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <Select value={reportStatus} onValueChange={onStatusChange}>
                <SelectTrigger className="rounded-lg text-xs sm:text-sm h-8 sm:h-10 w-full sm:w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Under Review">Under Review</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              {mode === "edit" && onRequestPeerReview && (
                <Button 
                  variant="outline"
                  className="rounded-lg text-xs sm:text-sm h-8 sm:h-10"
                  onClick={onRequestPeerReview}
                >
                  <UserCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  Request Review
                </Button>
              )}
              {showSaveButton && onSave && (
                <Button 
                  className="bg-theme-success hover:bg-theme-success-hover rounded-lg text-xs sm:text-sm h-8 sm:h-10"
                  onClick={onSave}
                >
                  <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  Save
                </Button>
              )}
              {onExport && (
                <Button 
                  variant="default"
                  className="rounded-lg text-xs sm:text-sm h-8 sm:h-10"
                  onClick={onExport}
                >
                  <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  Export PDF
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Report Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className={`p-3 sm:p-6 transition-all duration-300 ${
            isChatCollapsed ? 'lg:max-w-5xl lg:mx-auto' : ''
          }`}>
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Peer Review Panel - Only show in peer-review mode */}
              {mode === "peer-review" && peerReview && (
                <PeerReviewPanel
                  reviewerName={peerReview.assignedToName}
                  requestedBy={peerReview.requestedByName}
                  requestDate={peerReview.requestDate}
                  requestNotes={peerReview.requestNotes}
                  comments={peerReview.comments}
                  onAddComment={onAddReviewComment || (() => {})}
                  onAddHighlightComment={onAddHighlightComment || (() => {})}
                  onResolveComment={onResolveComment || (() => {})}
                  onHighlightClick={(commentId) => setActiveHighlightCommentId(commentId)}
                  onCompleteReview={onCompleteReview || (() => {})}
                  onOpenRatingModal={onOpenRatingModal || (() => {})}
                  isCompleted={peerReview.status === "completed"}
                />
              )}

              {/* Report Card */}
              <Card className="rounded-xl shadow-sm border-slate-200 overflow-hidden">
                <div className="p-4 sm:p-8 bg-white space-y-6">
                  {/* Report Header Info */}
                  <div className="pb-6 border-b border-slate-200">
                    <div className="text-xl sm:text-2xl mb-4">
                      <EditableText
                        value={reportContent.title}
                        onChange={(value) => onContentChange({ title: value })}
                        textClassName="text-slate-900"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center">
                        <span className="text-slate-600">Date: </span>
                        <div className="ml-1 flex-1">
                          <EditableText
                            value={reportContent.date}
                            onChange={(value) => onContentChange({ date: value })}
                            textClassName="text-slate-900"
                          />
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-slate-600">Engineer: </span>
                        <div className="ml-1 flex-1">
                          <EditableText
                            value={reportContent.engineer}
                            onChange={(value) => onContentChange({ engineer: value })}
                            textClassName="text-slate-900"
                          />
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-slate-600">Location: </span>
                        <div className="ml-1 flex-1">
                          <EditableText
                            value={reportContent.location}
                            onChange={(value) => onContentChange({ location: value })}
                            textClassName="text-slate-900"
                          />
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-600">Status: </span>
                        <Badge 
                          className="rounded-md"
                          variant={reportStatus === "Completed" ? "default" : "secondary"}
                        >
                          {reportStatus === "Draft" && <Clock className="w-3 h-3 mr-1" />}
                          {reportStatus === "Under Review" && <AlertCircle className="w-3 h-3 mr-1" />}
                          {reportStatus === "Completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {reportStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>


                  <Separator />


                  {/* 🟢 Global / Fallback Diff View for Pending Changes */}
                  {/* If the pending change doesn't match a specific section (e.g. general context), show it here */}
                  {pendingChange && (!pendingChange.sectionId || pendingChange.sectionId === 'general-context' || !reportContent.sections.some(s => s.id === pendingChange.sectionId)) && (
                     <div className="mb-8 p-6 bg-blue-50/50 border border-blue-100 rounded-xl shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                             <Sparkles className="w-5 h-5 text-blue-600" />
                             <span className="font-semibold text-slate-800">Suggested Edit (General)</span>
                             {pendingChange.stats && (
                                <Badge variant="outline" className="ml-2 bg-white text-blue-600 border-blue-200">
                                    {pendingChange.stats.changeSummary}
                                </Badge>
                             )}
                        </div>
                         <DiffView
                                oldText={pendingChange.oldValue}
                                newText={pendingChange.newValue}
                                changes={pendingChange.changes} 
                                stats={pendingChange.stats}
                                onAccept={handleAcceptChange}
                                onReject={handleRejectChange}
                                source={pendingChange.source}
                            />
                    </div>
                  )}


                  {/* Report Sections */}
                  <div className="min-h-[500px]"> {/* Container to ensure editor has height */}
  
                  {/* 1. Global Diff View (Shows if AI suggests a change) */}
                  {pendingChange ? (
                      <div className="mb-6 border border-blue-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-blue-50 p-3 border-b border-blue-100 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">
                              Suggested Change ({pendingChange.source === 'ai' ? 'AI Assistant' : 'Peer Review'})
                            </span>
                          </div>
                          <DiffView
                              oldText={pendingChange.oldValue}
                              newText={pendingChange.newValue}
                              changes={pendingChange.changes}
                              stats={pendingChange.stats}
                              onAccept={handleAcceptChange}
                              onReject={handleRejectChange}
                              source={pendingChange.source}
                          />
                      </div>
                  ) : (
                      /* 2. The Main Editor */
                      /* We use a key to force re-render if the report structure changes externally (like after an AI edit) */
                      <PlateSectionEditor 
                          key={`editor-${reportContent.sections.length}-${reportContent.sections[0]?.id}`}
                          initialMarkdown={fullReportMarkdown} 
                          onChange={(newFullMarkdown) => {
                            // This function takes the giant string and parses it back into JSON sections
                            handleFullDocumentUpdate(newFullMarkdown);
                          }}
                      />
                  )}
                </div>

                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Sidebar - Always visible on desktop, hidden on mobile */}
      <div 
        className="hidden lg:flex flex-col bg-white border-l border-slate-200 relative"
        style={{
          width: isChatCollapsed ? '48px' : chatWidth,
          minWidth: isChatCollapsed ? '48px' : '320px',
          maxWidth: isChatCollapsed ? '48px' : `${windowWidth > 0 ? windowWidth * 0.5 : 500}px`,
          transition: isResizing ? 'none' : 'width 300ms'
        }}
      >
        {/* Resize Handle */}
        {!isChatCollapsed && (
          <div
            className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-theme-primary/50 active:bg-theme-primary transition-colors z-50 group"
            onMouseDown={() => setIsResizing(true)}
            title="Drag to resize"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-12 bg-slate-300 group-hover:bg-theme-primary rounded-full transition-colors" />
          </div>
        )}

        {isChatCollapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="m-2 relative group"
            onClick={() => setIsChatCollapsed(false)}
          >
            <ChevronLeft className="w-4 h-4" />
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-theme-primary rounded-full animate-pulse" />
          </Button>
        ) : (
          <>
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-theme-primary/5 to-theme-primary/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-theme-primary/20 rounded-full blur-md animate-pulse" />
                    <div 
                      className="relative p-2 rounded-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(to bottom right, var(--theme-primary), var(--theme-primary-hover))'
                      }}
                    >
                      <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-slate-900">AI Assistant</h3>
                    <p className="text-xs text-slate-500">Always here to help</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant={isSelectionMode ? "default" : "ghost"}
                    size="icon"
                    className={`hover:bg-white/50 ${isSelectionMode ? "bg-theme-primary hover:bg-theme-primary-hover text-white" : ""}`}
                    onClick={toggleSelectionMode}
                    title={isSelectionMode ? "Exit selection mode" : "Select items from report"}
                  >
                    <MousePointer2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-white/50"
                    onClick={() => setIsChatCollapsed(true)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {isSelectionMode && (
                <div className="text-xs text-theme-primary bg-white/50 rounded-md px-2 py-1.5 flex items-center gap-2">
                  <MousePointer2 className="w-3 h-3" />
                  <span>Selection mode active - Click items in the report to select them</span>
                </div>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-gradient-to-b from-slate-50/50 to-white" ref={chatScrollRef}>
              <div className="space-y-4">
                {chatMessages.length === 0 && (
                  <div className="text-center text-slate-400 text-sm py-8">
                    No messages yet
                  </div>
                )}
                {/* 🟢 NEW: Using ChatBubble Component */}
                {chatMessages.map((message) => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    onAcceptSuggestion={handleAcceptChange}
                    onRejectSuggestion={handleRejectChange}
                  />
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-gradient-to-r from-slate-50/50 to-white">
              {selectedContexts.length > 0 && (
                <div className="mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Selected references ({selectedContexts.length}):</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-xs hover:bg-white/50 text-slate-500"
                      onClick={() => setSelectedContexts([])}
                    >
                      Clear all
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedContexts.map((context, index) => (
                      <div 
                        key={index} 
                        className="flex items-center gap-1.5 bg-theme-primary/10 border border-theme-primary/30 rounded-md px-2 py-1"
                      >
                        {context.type === "photo" ? (
                          <ImageIcon className="w-3 h-3 text-theme-primary flex-shrink-0" />
                        ) : (
                          <FileText className="w-3 h-3 text-theme-primary flex-shrink-0" />
                        )}
                        <span className="text-xs text-slate-700">{context.label}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 flex-shrink-0 hover:bg-white/50 -mr-1"
                          onClick={() => removeSelectedContext(index)}
                        >
                          <X className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <AIChatInput onSendMessage={handleSendMessage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
