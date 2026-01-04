import { AppHeader } from "@/frontend/pages/smart_components/AppHeader";
import { Page } from "@/app/pages/config/routes";
import { Button } from "@/frontend/pages/ui_components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/frontend/pages/ui_components/card";
import { Badge } from "@/frontend/pages/ui_components/badge";
import { ImageWithFallback } from "@/frontend/pages/figma/ImageWithFallback";
import { Progress } from "@/frontend/pages/ui_components/progress";
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  GripVertical,
  Check,
  Loader2,
  X,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

interface Photo {
  id: number;
  url: string;
  name: string;
  timestamp: number; // seconds from start of audio
  captureTime: string;
}

interface TranscriptSegment {
  id: number;
  text: string;
  timestamp: number; // seconds from start of audio
  endTime: number;
  linkedPhotoId: number | null;
  isDragging?: boolean;
  aiSummary?: string;
}

interface AudioTimelinePageProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onBack: () => void;
  projectName: string;
}

const observationColors = [
  { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900" },
  { bg: "bg-green-50", border: "border-green-200", text: "text-green-900" },
  { bg: "bg-theme-primary-lighter", border: "border-theme-primary-30", text: "text-theme-secondary" },
  { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-900" },
];

export function AudioTimelinePage({
  onNavigate,
  onLogout,
  onBack,
  projectName,
}: AudioTimelinePageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(240); // 4 minutes for demo
  const [processingStatus, setProcessingStatus] = useState<
    "idle" | "transcribing" | "aligning" | "complete"
  >("transcribing");
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);

  // Mock data
  const [photos] = useState<Photo[]>([
    {
      id: 1,
      url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=400",
      name: "Foundation Overview",
      timestamp: 15,
      captureTime: "10:23 AM",
    },
    {
      id: 2,
      url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=400",
      name: "Structural Support",
      timestamp: 58,
      captureTime: "10:24 AM",
    },
    {
      id: 3,
      url: "https://images.unsplash.com/photo-1645258044234-f4ba2655baf1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdpbmVlcmluZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=400",
      name: "Rebar Detail",
      timestamp: 125,
      captureTime: "10:26 AM",
    },
    {
      id: 4,
      url: "https://images.unsplash.com/photo-1738528575208-b9ccdca8acaf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2l0ZXxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=400",
      name: "Concrete Pour",
      timestamp: 190,
      captureTime: "10:28 AM",
    },
  ]);

  const [segments, setSegments] = useState<TranscriptSegment[]>([
    {
      id: 1,
      text: "Starting inspection at the foundation area. Weather is clear, approximately 21 degrees.",
      timestamp: 5,
      endTime: 12,
      linkedPhotoId: null,
      aiSummary: undefined,
    },
    {
      id: 2,
      text: "Foundation concrete appears to be properly cured. No visible surface defects or cracking observed.",
      timestamp: 15,
      endTime: 23,
      linkedPhotoId: 1,
      aiSummary: "Foundation inspection: Properly cured concrete with no defects.",
    },
    {
      id: 3,
      text: "The foundation shows excellent workmanship. All edges are clean and uniform. No honeycombing detected in any areas.",
      timestamp: 25,
      endTime: 33,
      linkedPhotoId: 1,
      aiSummary: undefined,
    },
    {
      id: 4,
      text: "Moving to the structural support section. Steel reinforcement is in place with proper spacing.",
      timestamp: 50,
      endTime: 58,
      linkedPhotoId: null,
      aiSummary: undefined,
    },
    {
      id: 5,
      text: "Rebar spacing verified at 200mm centers. All connections are properly tied and secured.",
      timestamp: 58,
      endTime: 68,
      linkedPhotoId: 2,
      aiSummary: "Structural support: Rebar at 200mm centers, properly secured.",
    },
    {
      id: 6,
      text: "Checking the cover depth. Minimum 50mm cover maintained throughout. This meets code requirements.",
      timestamp: 70,
      endTime: 78,
      linkedPhotoId: 2,
      aiSummary: undefined,
    },
    {
      id: 7,
      text: "Inspecting the detailed rebar configuration. Cover appears adequate at 50mm minimum.",
      timestamp: 120,
      endTime: 130,
      linkedPhotoId: 3,
      aiSummary: "Rebar detail: 50mm minimum cover verified, meets requirements.",
    },
    {
      id: 8,
      text: "All rebar connections show proper lap lengths. Wire ties are secure and rust-free.",
      timestamp: 132,
      endTime: 140,
      linkedPhotoId: 3,
      aiSummary: undefined,
    },
    {
      id: 9,
      text: "Final section showing the concrete pour in progress. Slump test results are within specification.",
      timestamp: 185,
      endTime: 195,
      linkedPhotoId: 4,
      aiSummary: "Concrete pour: Slump test passed, within specification.",
    },
    {
      id: 10,
      text: "Pour is proceeding smoothly. Vibration is adequate. No segregation observed in the mix.",
      timestamp: 197,
      endTime: 205,
      linkedPhotoId: 4,
      aiSummary: undefined,
    },
  ]);

  const [draggedSegment, setDraggedSegment] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [hoveredPhoto, setHoveredPhoto] = useState<number | null>(null);
  const [dragTargetPhoto, setDragTargetPhoto] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [photoDescriptions, setPhotoDescriptions] = useState<Record<number, string>>({});
  const [isGeneratingDescriptions, setIsGeneratingDescriptions] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState<number | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);

  // Simulate processing on mount
  useEffect(() => {
    const timer1 = setTimeout(() => {
      setTranscriptionProgress(100);
      setProcessingStatus("aligning");
    }, 2000);

    const timer2 = setTimeout(() => {
      setProcessingStatus("complete");
    }, 4000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Auto-increment transcription progress
  useEffect(() => {
    if (processingStatus === "transcribing" && transcriptionProgress < 100) {
      const interval = setInterval(() => {
        setTranscriptionProgress((prev) => Math.min(prev + 10, 100));
      }, 200);
      return () => clearInterval(interval);
    }
  }, [processingStatus, transcriptionProgress]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSegmentDragStart = (segmentId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedSegment(segmentId);
    setSegments(prev => prev.map(s => 
      s.id === segmentId ? { ...s, isDragging: true } : s
    ));
  };

  const handleSegmentDrag = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (draggedSegment === null || !timelineRef.current) return;
    
    // Find which photo element the mouse is over
    const photoElements = timelineRef.current.querySelectorAll('[data-photo-id]');
    let targetPhotoId: number | null = null;
    
    photoElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        targetPhotoId = parseInt(element.getAttribute('data-photo-id') || '0', 10);
      }
    });
    
    setDragTargetPhoto(targetPhotoId);
  }, [draggedSegment]);

  const handleSegmentDragEnd = useCallback(() => {
    if (draggedSegment === null) {
      return;
    }

    // Update segment to be linked to the target photo
    setSegments(prev => prev.map(s => {
      if (s.id === draggedSegment) {
        return {
          ...s,
          linkedPhotoId: dragTargetPhoto,
          isDragging: false,
        };
      }
      return s;
    }));

    setDraggedSegment(null);
    setDragTargetPhoto(null);
  }, [draggedSegment, dragTargetPhoto]);

  // Add global mouse event listeners for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedSegment !== null) {
        handleSegmentDrag(e);
      }
    };

    const handleMouseUp = () => {
      if (draggedSegment !== null) {
        handleSegmentDragEnd();
      }
    };

    if (draggedSegment !== null) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggedSegment, handleSegmentDrag, handleSegmentDragEnd]);

  const handleReassignToNearest = (segmentId: number) => {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return;

    let nearestPhoto: number | null = null;
    let minDistance = Infinity;
    photos.forEach((photo) => {
      const distance = Math.abs(photo.timestamp - segment.timestamp);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPhoto = photo.id;
      }
    });

    setSegments(segments.map(s =>
      s.id === segmentId ? { ...s, linkedPhotoId: nearestPhoto } : s
    ));
  };

  const handleDeleteSegment = (segmentId: number) => {
    setSegments(segments.filter(s => s.id !== segmentId));
  };

  const handleGenerateDescriptions = async () => {
    setIsGeneratingDescriptions(true);
    setGenerationProgress(0);

    // Simulate AI processing each photo
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      
      // Get all transcript segments linked to this photo
      const photoSegments = segments.filter(s => s.linkedPhotoId === photo.id);
      const transcriptText = photoSegments.map(s => s.text).join(' ');

      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Generate a concise description based on photo and transcript
      let description = '';
      
      if (photo.id === 1) {
        description = "Foundation concrete pour showing smooth, uniform finish with proper curing. No surface defects, cracking, or honeycombing detected. Excellent workmanship with clean, uniform edges throughout. Temperature at inspection: 21°C.";
      } else if (photo.id === 2) {
        description = "Structural steel reinforcement installation with rebar spacing verified at 200mm centers. All connections properly tied and secured. Minimum 50mm cover depth maintained throughout, meeting code requirements.";
      } else if (photo.id === 3) {
        description = "Detailed rebar configuration showing adequate 50mm minimum cover. All rebar connections display proper lap lengths with secure, rust-free wire ties. Installation meets structural specifications.";
      } else if (photo.id === 4) {
        description = "Concrete pour in progress with slump test results within specification. Pour proceeding smoothly with adequate vibration. No segregation observed in the mix. Proper consolidation achieved.";
      }

      setPhotoDescriptions(prev => ({
        ...prev,
        [photo.id]: description
      }));

      setGenerationProgress(((i + 1) / photos.length) * 100);
    }

    setIsGeneratingDescriptions(false);
  };

  // Get the color for a segment based on its linked photo
  const getSegmentColor = (segment: TranscriptSegment) => {
    if (!segment.linkedPhotoId) return { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-900" };
    const photoIndex = photos.findIndex(p => p.id === segment.linkedPhotoId);
    return observationColors[photoIndex % observationColors.length];
  };

  // Get AI summary for a photo
  const getPhotoSummary = (photoId: number) => {
    const photoSegments = segments.filter(s => s.linkedPhotoId === photoId && s.aiSummary);
    if (photoSegments.length === 0) return null;
    return photoSegments[0].aiSummary;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader 
        currentPage="dashboard" 
        onNavigate={onNavigate} 
        onLogout={onLogout}
        pageTitle="Audio Timeline"
      />

      <main className="container mx-auto px-6 py-8 max-w-[1600px]">
        {/* Back Button - Outside banner */}
        <Button 
          variant="ghost" 
          className="mb-4 rounded-lg hover:bg-slate-100 text-sm sm:text-base h-10 sm:h-auto px-3 sm:px-4" 
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Project
        </Button>

        {/* Project Title Banner - Teal with White Text */}
        <Card className="rounded-xl shadow-sm border-2 border-theme-primary bg-theme-primary p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white mb-2 text-xl sm:text-2xl lg:text-3xl font-bold">Audio Timeline</h1>
              <p className="text-white/90">{projectName}</p>
            </div>
          </div>
        </Card>

        {/* Main Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Audio Player & Processing - Hidden on Mobile */}
          <div className="col-span-3 space-y-6 hidden sm:block">
            {/* Audio Player */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Audio Playback
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Play button */}
                <Button
                  className="w-full bg-theme-action-primary hover:bg-theme-action-primary-hover rounded-lg"
                  size="lg"
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 mr-2" />
                  ) : (
                    <Play className="w-5 h-5 mr-2" />
                  )}
                  {isPlaying ? "Pause" : "Play"} Audio
                </Button>

                {/* Progress bar */}
                <div>
                  <Progress value={(currentTime / duration) * 100} className="h-2" />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Waveform placeholder */}
                <div className="h-16 bg-slate-100 rounded-lg flex items-end justify-around gap-0.5 p-2">
                  {Array.from({ length: 50 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-blue-400 rounded-sm"
                      style={{
                        height: `${Math.random() * 100}%`,
                        opacity: i / 50 < currentTime / duration ? 1 : 0.3,
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Processing Status */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle>Processing Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Transcription */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-900 flex items-center gap-2">
                      {processingStatus === "transcribing" ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : (
                        <Check className="w-4 h-4 text-green-600" />
                      )}
                      Transcribing audio
                    </span>
                    {processingStatus === "transcribing" && (
                      <span className="text-xs text-slate-500">{transcriptionProgress}%</span>
                    )}
                  </div>
                  <Progress
                    value={transcriptionProgress}
                    className={`h-1 ${
                      processingStatus !== "transcribing" ? "opacity-50" : ""
                    }`}
                  />
                </div>

                {/* Alignment */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-900 flex items-center gap-2">
                      {processingStatus === "aligning" ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      ) : processingStatus === "complete" ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-slate-300 rounded-full" />
                      )}
                      Matching with photos
                    </span>
                  </div>
                  <Progress
                    value={processingStatus === "complete" ? 100 : processingStatus === "aligning" ? 50 : 0}
                    className={`h-1 ${
                      processingStatus === "complete" ? "opacity-50" : ""
                    }`}
                  />
                </div>

                {processingStatus === "complete" && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-green-900">Processing complete</p>
                        <p className="text-xs text-green-700 mt-1">
                          {segments.filter(s => s.linkedPhotoId).length} segments linked to photos
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card className="rounded-xl shadow-sm border-slate-200 bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-900 mb-1">Drag to adjust</p>
                    <p className="text-xs text-blue-700">
                      Drag transcript segments up or down to reassign them to different photos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center/Right - Vertical Timeline */}
          <div className="col-span-12 sm:col-span-9">
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle>Timeline & Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative" ref={timelineRef}>
                  {/* Build timeline items array */}
                  {(() => {
                    // Combine photos and segments into timeline items
                    const timelineItems: Array<{
                      type: 'photo' | 'segment';
                      timestamp: number;
                      data: Photo | TranscriptSegment;
                    }> = [
                      ...photos.map(photo => ({
                        type: 'photo' as const,
                        timestamp: photo.timestamp,
                        data: photo
                      })),
                      ...segments.map(segment => ({
                        type: 'segment' as const,
                        timestamp: segment.isDragging && dragPosition !== null ? dragPosition : segment.timestamp,
                        data: segment
                      }))
                    ];

                    // Sort by timestamp
                    timelineItems.sort((a, b) => a.timestamp - b.timestamp);

                    return (
                      <div className="space-y-4">
                        {timelineItems.map((item, index) => {
                          const time = item.timestamp;
                          
                          if (item.type === 'photo') {
                            const photo = item.data as Photo;
                            const photoIndex = photos.findIndex(p => p.id === photo.id);
                            const color = observationColors[photoIndex % observationColors.length];
                            const summary = getPhotoSummary(photo.id);
                            
                            return (
                              <div key={`photo-${photo.id}`} className="relative flex items-start gap-2 sm:gap-4">
                                {/* Timeline marker - Narrower on mobile */}
                                <div className="flex flex-col items-center flex-shrink-0">
                                  <span className="text-xs text-slate-500 mb-2 w-10 sm:w-16 text-center">
                                    {formatTime(time)}
                                  </span>
                                  <div className={`w-4 h-4 rounded-full ${color.bg} border-4 ${color.border}`} />
                                  {index < timelineItems.length - 1 && (
                                    <div className="w-px h-full min-h-[60px] bg-slate-300 mt-2" />
                                  )}
                                </div>

                                {/* Photo content - Stack vertically on mobile */}
                                <div
                                  data-photo-id={photo.id}
                                  className={`flex-1 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border-2 ${color.border} ${color.bg} transition-all shadow-sm ${
                                    dragTargetPhoto === photo.id ? "ring-4 ring-blue-400 border-blue-500" : ""
                                  }`}
                                >
                                  <ImageWithFallback
                                    src={photo.url}
                                    alt={photo.name}
                                    className="w-full sm:w-48 h-48 sm:h-36 object-cover rounded-lg flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <h4 className={`${color.text}`}>{photo.name}</h4>
                                      <Badge className="bg-white/80 text-slate-700 rounded-md text-xs">
                                        {photo.captureTime}
                                      </Badge>
                                    </div>
                                    
                                    {/* AI-generated description */}
                                    {photoDescriptions[photo.id] && (
                                      <div className="mb-2 p-3 rounded-lg bg-white border-2 border-green-300">
                                        <div className="flex items-start gap-2 mb-1">
                                          <Sparkles className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                          <p className="text-xs text-green-700">AI-Generated Description</p>
                                        </div>
                                        {editingDescription === photo.id ? (
                                          <textarea
                                            className="w-full text-sm text-slate-900 bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                            value={photoDescriptions[photo.id]}
                                            onChange={(e) => {
                                              setPhotoDescriptions(prev => ({
                                                ...prev,
                                                [photo.id]: e.target.value
                                              }));
                                            }}
                                            onBlur={() => setEditingDescription(null)}
                                            autoFocus
                                            rows={3}
                                          />
                                        ) : (
                                          <p
                                            className="text-sm text-slate-900 cursor-text hover:bg-green-50 rounded p-1 -m-1"
                                            onClick={() => setEditingDescription(photo.id)}
                                          >
                                            {photoDescriptions[photo.id]}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    
                                    {summary && (
                                      <div className={`flex items-start gap-2 p-3 rounded-lg bg-white/50 border ${color.border}`}>
                                        <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-slate-700">{summary}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            const segment = item.data as TranscriptSegment;
                            const color = getSegmentColor(segment);
                            
                            return (
                              <div key={`segment-${segment.id}`} className="relative flex items-start gap-2 sm:gap-4">
                                {/* Timeline marker - Narrower on mobile */}
                                <div className="flex flex-col items-center flex-shrink-0">
                                  <span className="text-xs text-slate-500 mb-2 w-10 sm:w-16 text-center">
                                    {formatTime(time)}
                                  </span>
                                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                                  {index < timelineItems.length - 1 && (
                                    <div className="w-px h-full min-h-[60px] bg-slate-300 mt-2" />
                                  )}
                                </div>

                                {/* Transcript content */}
                                <div
                                  className={`flex-1 relative p-3 sm:p-4 rounded-lg border-2 ${color.border} ${color.bg} transition-all ${
                                    segment.isDragging
                                      ? "opacity-80 shadow-xl scale-105 z-50"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-start gap-2 sm:gap-3">
                                    <div
                                      className="cursor-move flex-shrink-0 hidden sm:block"
                                      onMouseDown={(e) => {
                                        if (editingSegment !== segment.id) {
                                          handleSegmentDragStart(segment.id, e);
                                        }
                                      }}
                                    >
                                      <GripVertical className="w-4 h-4 text-slate-400 mt-0.5" />
                                    </div>
                                    
                                    {editingSegment === segment.id ? (
                                      <textarea
                                        className={`w-full text-sm ${color.text} bg-white border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                        value={segment.text}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          if (newText.trim() === '') {
                                            handleDeleteSegment(segment.id);
                                          } else {
                                            setSegments(segments.map(s =>
                                              s.id === segment.id ? { ...s, text: newText } : s
                                            ));
                                          }
                                        }}
                                        onBlur={() => setEditingSegment(null)}
                                        autoFocus
                                        rows={2}
                                      />
                                    ) : (
                                      <p
                                        className={`text-sm ${color.text} flex-1 cursor-text rounded p-1 -m-1`}
                                        onClick={() => setEditingSegment(segment.id)}
                                      >
                                        {segment.text}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        })}

                        {/* Current time indicator */}
                        {currentTime > 0 && (
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center flex-shrink-0 w-16">
                              <div className="bg-red-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                                {formatTime(currentTime)}
                              </div>
                              <div className="w-3 h-3 rounded-full bg-red-500 mt-2" />
                            </div>
                            <div className="flex-1 h-px bg-red-500" />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Done Button & Generation Status */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  {isGeneratingDescriptions ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-900 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          Generating photo descriptions with AI...
                        </span>
                        <span className="text-xs text-slate-500">{Math.round(generationProgress)}%</span>
                      </div>
                      <Progress value={generationProgress} className="h-2" />
                      <p className="text-xs text-slate-600">
                        Analyzing photos and transcripts to create concise descriptions
                      </p>
                    </div>
                  ) : Object.keys(photoDescriptions).length > 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-green-900">Descriptions generated successfully</p>
                          <p className="text-xs text-green-700 mt-1">
                            {photos.length} photo descriptions created using AI analysis
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">
                        When you're satisfied with the transcript alignment, click Done to generate AI descriptions for each photo.
                      </p>
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700 rounded-lg"
                        size="lg"
                        onClick={handleGenerateDescriptions}
                        disabled={processingStatus !== "complete"}
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        Done - Generate Photo Descriptions
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}