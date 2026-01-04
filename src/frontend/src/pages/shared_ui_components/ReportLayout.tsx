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
import { PeerReviewPanel } from "../smart_components/PeerReviewPanel";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { PeerReview, ReportContent, ChatMessage } from "@/frontend/types";
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

interface SelectedContext {
  type: "photo" | "section" | "summary" | "text";
  content: string;
  id?: number;
  label: string;
  highlightedText?: string;
}

interface PendingChange {
  messageId: number;
  sectionId?: number;
  field?: string;
  oldValue: string;
  newValue: string;
  source: "ai" | "peer-review";
}

interface ReportLayoutProps {
  mode: "edit" | "peer-review";
  reportContent: ReportContent;
  onContentChange: (updates: Partial<ReportContent>) => void;
  onSectionChange: (sectionId: number, newContent: string) => void;
  
  // Header props
  onBack: () => void;
  backLabel?: string;
  
  // Photos
  photos?: Array<{ id: number; url: string; caption?: string; section?: string }>;
  
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
  onAddHighlightComment?: (highlightedText: string, sectionId: number, comment: string, type: "issue" | "suggestion" | "comment") => void;
  onResolveComment?: (commentId: number) => void;
  onCompleteReview?: () => void;
  onOpenRatingModal?: () => void;
}

export function ReportLayout({
  mode,
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
}: ReportLayoutProps) {
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      content: mode === "edit" 
        ? "Hello! I'm your AI assistant for this report. I can help you revise sections, add technical details, adjust the tone, or answer questions about the observations. What would you like me to help with?"
        : "Hello! I'm here to help you review this report. Feel free to ask questions about any section or request clarifications.",
      timestamp: "10:30 AM"
    }
  ]);
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

  const handleAcceptChange = () => {
    if (!pendingChange) return;

    if (pendingChange.field === "summary") {
      onContentChange({ summary: pendingChange.newValue });
    } else if (pendingChange.sectionId) {
      onSectionChange(pendingChange.sectionId, pendingChange.newValue);
    }

    setPendingChange(null);
  };

  const handleRejectChange = () => {
    setPendingChange(null);
  };

  const handleSendMessage = (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      id: chatMessages.length + 1,
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Add user message and thinking indicator
    const thinkingMessage: ChatMessage = {
      id: chatMessages.length + 2,
      role: "assistant",
      content: "Reasoning >",
      timestamp: ""
    };

    setChatMessages([...chatMessages, userMessage, thinkingMessage]);
    
    // Simulate AI response with changes
    setTimeout(() => {
      const response = generateAIResponse(message);
      
      // Replace the thinking message with actual response
      setChatMessages(prev => {
        const withoutThinking = prev.filter(msg => msg.content !== "Reasoning >");
        return [...withoutThinking, response];
      });
      
      // If the response has suggested changes, set them as pending
      if (response.suggestedChanges) {
        setPendingChange({
          messageId: response.id,
          sectionId: response.suggestedChanges.sectionId,
          field: response.suggestedChanges.field,
          oldValue: response.suggestedChanges.oldValue,
          newValue: response.suggestedChanges.newValue,
          source: "ai"
        });
      }
      
      // Play notification sound
      playNotificationChime();
    }, 1500);
  };

  const generateAIResponse = (input: string): ChatMessage => {
    const lowerInput = input.toLowerCase();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (lowerInput.includes("summary") && (lowerInput.includes("shorter") || lowerInput.includes("concise"))) {
      const newSummary = "Foundation inspection at Route 95, Section A evaluates structural integrity, material quality, and design compliance.";
      return {
        id: chatMessages.length + 2,
        role: "assistant",
        content: "I've made the summary more concise while keeping the key points. Review the changes below and accept if you're satisfied.",
        timestamp,
        suggestedChanges: {
          field: "summary",
          oldValue: reportContent.summary,
          newValue: newSummary
        }
      };
    } else if (lowerInput.includes("detail") && reportContent.sections.length > 0) {
      const section = reportContent.sections[0];
      const newContent = section.content + "\n\nAdditional technical details: All measurements were taken using calibrated instruments with ±0.1% accuracy. Environmental conditions were monitored throughout the inspection period to ensure data quality and reliability.";
      return {
        id: chatMessages.length + 2,
        role: "assistant",
        content: "I've added more technical details to the first section. Review the changes below.",
        timestamp,
        suggestedChanges: {
          sectionId: section.id,
          oldValue: section.content,
          newValue: newContent
        }
      };
    }

    return {
      id: chatMessages.length + 2,
      role: "assistant",
      content: "I can help you with:\n\n• Making sections more concise or detailed\n• Adding technical specifications and measurements\n• Improving clarity and structure\n• Adjusting professional tone\n• Expanding recommendations\n\nTry asking: \"Make the summary shorter\" or \"Add more detail to the first section\"",
      timestamp
    };
  };

  const handleHighlightEdit = (highlightedText: string, sectionId: number, newText: string) => {
    // Find the section content
    if (sectionId === 0) {
      // Summary section
      setPendingChange({
        messageId: chatMessages.length + 1,
        field: "summary",
        oldValue: reportContent.summary,
        newValue: reportContent.summary.replace(highlightedText, newText),
        source: "peer-review"
      });
    } else {
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
      (c) => c.type === context.type && 
      (c.id === context.id || (c.type === "summary" && context.type === "summary"))
    );

    if (existingIndex >= 0) {
      // Remove if already selected
      setSelectedContexts(selectedContexts.filter((_, i) => i !== existingIndex));
    } else {
      // Add to selections
      setSelectedContexts([...selectedContexts, context]);
    }
  };

  const isItemSelected = (type: string, id?: number) => {
    return selectedContexts.some(
      (c) => c.type === type && 
      (id !== undefined ? c.id === id : c.type === "summary")
    );
  };

  const removeSelectedContext = (index: number) => {
    setSelectedContexts(selectedContexts.filter((_, i) => i !== index));
  };

  const handleTextSelection = (text: string, sectionId: number | undefined, sectionTitle: string) => {
    if (!isSelectionMode) return;

    const selectedText = text.trim();

    if (selectedText && selectedText.length > 0) {
      const context: SelectedContext = {
        type: "text",
        id: sectionId,
        content: selectedText,
        label: `"${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}" from ${sectionTitle}`,
        highlightedText: selectedText
      };

      // Check if already selected
      const exists = selectedContexts.some(
        (c) => c.type === "text" && c.highlightedText === selectedText && c.id === sectionId
      );

      if (!exists) {
        setSelectedContexts([...selectedContexts, context]);
      }
    }
  };

  const handleRequestRewrite = (currentText: string, instructions: string, sectionId?: number, field?: string) => {
    // Create a user message with the rewrite request
    const userMessage: ChatMessage = {
      id: chatMessages.length + 1,
      role: "user",
      content: `Rewrite this text: "${currentText.substring(0, 100)}${currentText.length > 100 ? '...' : ''}"\n\nInstructions: ${instructions}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Add thinking indicator
    const thinkingMessage: ChatMessage = {
      id: chatMessages.length + 2,
      role: "assistant",
      content: "Reasoning >",
      timestamp: ""
    };

    setChatMessages([...chatMessages, userMessage, thinkingMessage]);
    
    // Simulate AI response with rewrite
    setTimeout(() => {
      const rewrittenText = generateRewrittenText(currentText, instructions);
      
      const response: ChatMessage = {
        id: chatMessages.length + 2,
        role: "assistant",
        content: `I've rewritten the text based on your instructions. Review the changes below and accept if you're satisfied.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedChanges: {
          sectionId: sectionId,
          field: field,
          oldValue: currentText,
          newValue: rewrittenText
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

  const generateRewrittenText = (originalText: string, instructions: string): string => {
    const lowerInstructions = instructions.toLowerCase();
    
    // Simulate different rewrite styles based on instructions
    if (lowerInstructions.includes("concise") || lowerInstructions.includes("shorter") || lowerInstructions.includes("brief")) {
      // Make it shorter
      const sentences = originalText.split(/[.!?]+/).filter(s => s.trim());
      return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(". ") + ".";
    } else if (lowerInstructions.includes("detail") || lowerInstructions.includes("expand") || lowerInstructions.includes("elaborate")) {
      // Add more detail
      return originalText + " Additional technical specifications have been incorporated to ensure comprehensive documentation. Detailed measurements and quality control parameters are now included for reference.";
    } else if (lowerInstructions.includes("formal") || lowerInstructions.includes("professional")) {
      // Make more formal
      return "Upon thorough examination, " + originalText.toLowerCase() + " All observations have been documented in accordance with industry standards and best practices.";
    } else if (lowerInstructions.includes("simple") || lowerInstructions.includes("clear") || lowerInstructions.includes("plain")) {
      // Simplify
      return originalText.split(/[.!?]+/)[0].trim() + ". The findings are clear and straightforward.";
    } else {
      // Generic improvement
      return originalText + " This has been reviewed and enhanced for clarity and precision.";
    }
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

                  {/* Photos Grid */}
                  {photos.length > 0 && (
                    <div>
                      <h3 className="text-slate-900 mb-3">Photos</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {photos.map((photo) => {
                          const contextData: SelectedContext = {
                            type: "photo",
                            id: photo.id,
                            content: photo.url,
                            label: photo.caption || `Photo ${photo.id}`
                          };
                          const selected = isItemSelected("photo", photo.id);

                          return (
                            <div 
                              key={photo.id} 
                              className={`relative group cursor-pointer transition-all ${
                                selected
                                  ? "ring-2 ring-theme-primary rounded-lg" 
                                  : isSelectionMode
                                    ? "hover:ring-2 hover:ring-theme-primary/50 rounded-lg"
                                    : "hover:ring-2 hover:ring-slate-300 rounded-lg"
                              }`}
                              onClick={() => handleItemClick(contextData)}
                            >
                              <ImageWithFallback
                                src={photo.url}
                                alt={photo.caption || `Photo ${photo.id}`}
                                className="w-full h-32 sm:h-40 object-cover rounded-lg"
                              />
                              {(photo.caption || photo.section) && (
                                <div className="absolute bottom-2 left-2 right-2">
                                  <Badge variant="secondary" className="text-xs rounded-md">
                                    {photo.caption || photo.section}
                                  </Badge>
                                </div>
                              )}
                              {selected && (
                                <div className="absolute top-2 right-2 bg-theme-primary text-white rounded-full p-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Summary with diff view */}
                  <div>
                    <h3 
                      className={`text-slate-900 mb-3 cursor-pointer transition-all ${
                        isItemSelected("summary")
                          ? "text-theme-primary" 
                          : isSelectionMode
                            ? "hover:text-theme-primary"
                            : "hover:text-theme-primary"
                      }`}
                      onClick={() => handleItemClick({
                        type: "summary",
                        content: reportContent.summary,
                        label: "Summary"
                      })}
                    >
                      Summary {isItemSelected("summary") && <CheckCircle2 className="w-4 h-4 inline ml-1" />}
                    </h3>
                    {pendingChange && pendingChange.field === "summary" ? (
                      <DiffView
                        oldText={pendingChange.oldValue}
                        newText={pendingChange.newValue}
                        onAccept={handleAcceptChange}
                        onReject={handleRejectChange}
                        source={pendingChange.source}
                      />
                    ) : mode === "peer-review" && peerReview && peerReview.comments ? (
                      <HighlightableText
                        content={reportContent.summary}
                        sectionId={0}
                        comments={peerReview.comments}
                        onAddHighlightComment={onAddHighlightComment}
                        onAddHighlightEdit={handleHighlightEdit}
                        onHighlightClick={(commentId) => setActiveHighlightCommentId(commentId)}
                        activeCommentId={activeHighlightCommentId}
                        disabled={isSelectionMode}
                        onTextSelection={(text) => handleTextSelection(text, undefined, "Summary")}
                      />
                    ) : (
                      <RewritableText
                        value={reportContent.summary}
                        onChange={(value) => onContentChange({ summary: value })}
                        onRequestRewrite={(currentText, instructions) => 
                          handleRequestRewrite(currentText, instructions, undefined, "summary")
                        }
                        multiline
                        disabled={isSelectionMode}
                        onTextSelection={(text) => handleTextSelection(text, undefined, "Summary")}
                      />
                    )}
                  </div>

                  <Separator />

                  {/* Report Sections */}
                  {reportContent.sections.map((section) => (
                    <div key={section.id}>
                      <h3 
                        className={`text-slate-900 mb-3 cursor-pointer transition-all ${
                          isItemSelected("section", section.id) 
                            ? "text-theme-primary" 
                            : isSelectionMode
                              ? "hover:text-theme-primary"
                              : "hover:text-theme-primary"
                        }`}
                        onClick={() => handleItemClick({
                          type: "section",
                          id: section.id,
                          content: section.content,
                          label: section.title
                        })}
                      >
                        {section.title} {isItemSelected("section", section.id) && <CheckCircle2 className="w-4 h-4 inline ml-1" />}
                      </h3>
                      {pendingChange && pendingChange.sectionId === section.id ? (
                        <DiffView
                          oldText={pendingChange.oldValue}
                          newText={pendingChange.newValue}
                          onAccept={handleAcceptChange}
                          onReject={handleRejectChange}
                          source={pendingChange.source}
                        />
                      ) : mode === "peer-review" && peerReview && peerReview.comments ? (
                        <HighlightableText
                          content={section.content}
                          sectionId={section.id}
                          comments={peerReview.comments}
                          onAddHighlightComment={onAddHighlightComment}
                          onAddHighlightEdit={handleHighlightEdit}
                          onHighlightClick={(commentId) => setActiveHighlightCommentId(commentId)}
                          activeCommentId={activeHighlightCommentId}
                          disabled={isSelectionMode}
                          onTextSelection={(text) => handleTextSelection(text, section.id, section.title)}
                        />
                      ) : (
                        <RewritableText
                          value={section.content}
                          onChange={(value) => onSectionChange(section.id, value)}
                          onRequestRewrite={(currentText, instructions) => 
                            handleRequestRewrite(currentText, instructions, section.id, undefined)
                          }
                          multiline
                          disabled={isSelectionMode}
                          onTextSelection={(text) => handleTextSelection(text, section.id, section.title)}
                        />
                      )}
                    </div>
                  ))}
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
                {chatMessages.map((message) => {
                  const isUser = message.role === "user";
                  const isAssistant = message.role === "assistant";
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                    >
                      {/* Avatar */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isAssistant 
                          ? "bg-gradient-to-br from-[#3c6e71] to-[#2d5456] text-white ring-2 ring-[#3c6e71]/20" 
                          : "bg-slate-200 text-slate-700"
                      }`}>
                        {isAssistant ? (
                          <Bot className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      
                      {/* Message Content */}
                      <div className={`flex-1 max-w-[75%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                        <div className={`rounded-lg px-4 py-2.5 shadow-sm ${
                          isAssistant
                            ? "bg-white border border-slate-200"
                            : "bg-gradient-to-r from-[#3c6e71] to-[#2d5456]"
                        }`}>
                          <div className={`text-sm whitespace-pre-wrap break-words ${
                            message.content === "Reasoning >" 
                              ? "text-slate-400 italic" 
                              : isAssistant 
                                ? "text-slate-900" 
                                : "text-white"
                          }`}>
                            {message.content}
                          </div>
                        </div>
                        {message.timestamp && (
                          <div className="text-xs text-slate-500 mt-1 px-1">
                            {message.timestamp}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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