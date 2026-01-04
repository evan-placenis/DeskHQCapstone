import { useState, useEffect, useRef } from "react";
import { Camera, X, Mic, Square, Trash2, Search, Plus, Send, Upload } from "lucide-react";
import { Button } from "@/frontend/pages/ui_components/button";
import { Input } from "@/frontend/pages/ui_components/input";
import { Card } from "@/frontend/pages/ui_components/card";
import { Badge } from "@/frontend/pages/ui_components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/frontend/pages/ui_components/dialog";
import { Project } from "@/frontend/types";

interface CapturePageProps {
  onClose: () => void;
  onSave: (projectId: number, photos: CapturedPhoto[], audioTranscript?: string, groupName?: string) => void;
  onCreateProject?: () => void;
  projects: Project[];
}

interface CapturedPhoto {
  id: number;
  url: string;
  timestamp: Date;
}

export function CapturePage({ onClose, onSave, onCreateProject, projects }: CapturePageProps) {
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const transcriptInterval = useRef<NodeJS.Timeout | null>(null);
  const speechPatternInterval = useRef<NodeJS.Timeout | null>(null);

  // Mock transcript segments
  const mockTranscriptSegments = [
    "Inspecting foundation at grid line A3. ",
    "Concrete appears to be properly cured. ",
    "No visible cracks or defects observed. ",
    "Measured dimensions are within tolerance. ",
    "Rebar spacing verified at 12 inches on center. ",
    "Surface finish meets specification requirements. ",
    "Weather conditions: clear, 72 degrees. ",
    "Recommend approval for next phase of construction."
  ];

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraError(null);
      } catch (err) {
        console.error("Error accessing camera:", err);
        if (err instanceof Error) {
          if (err.name === "NotAllowedError") {
            setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
          } else if (err.name === "NotFoundError") {
            setCameraError("No camera found on this device.");
          } else if (err.name === "NotReadableError") {
            setCameraError("Camera is already in use by another application.");
          } else {
            setCameraError("Unable to access camera. You can still upload photos from your gallery.");
          }
        }
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (durationInterval.current) clearInterval(durationInterval.current);
      if (transcriptInterval.current) clearInterval(transcriptInterval.current);
      if (speechPatternInterval.current) clearTimeout(speechPatternInterval.current);
    };
  }, []);

  const handleTakePhoto = () => {
    // In production, this would capture from the video stream
    // For now, simulate with a placeholder
    const newPhoto: CapturedPhoto = {
      id: Date.now(),
      url: `https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80`,
      timestamp: new Date()
    };
    setCapturedPhotos([...capturedPhotos, newPhoto]);
  };

  const handleDeletePhoto = (photoId: number) => {
    setCapturedPhotos(capturedPhotos.filter(p => p.id !== photoId));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file);
        const newPhoto: CapturedPhoto = {
          id: Date.now() + Math.random(),
          url,
          timestamp: new Date()
        };
        setCapturedPhotos(prev => [...prev, newPhoto]);
      });
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setDuration(0);

    // Duration counter
    durationInterval.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    // Simulate real-time transcription
    let segmentIndex = 0;
    transcriptInterval.current = setInterval(() => {
      if (segmentIndex < mockTranscriptSegments.length) {
        setAudioTranscript(prev => prev + mockTranscriptSegments[segmentIndex]);
        segmentIndex++;
      }
    }, 2500);

    // Simulate speech patterns
    let currentlySpeaking = false;
    const toggleSpeech = () => {
      currentlySpeaking = !currentlySpeaking;
      setIsSpeaking(currentlySpeaking);
      
      const nextDuration = currentlySpeaking 
        ? Math.random() * 2000 + 1000
        : Math.random() * 1000 + 500;
      
      speechPatternInterval.current = setTimeout(toggleSpeech, nextDuration);
    };
    
    setTimeout(toggleSpeech, 500);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsSpeaking(false);
    
    if (durationInterval.current) clearInterval(durationInterval.current);
    if (transcriptInterval.current) clearInterval(transcriptInterval.current);
    if (speechPatternInterval.current) clearTimeout(speechPatternInterval.current);
  };

  const handleDone = () => {
    if (isRecording) {
      stopRecording();
    }
    if (capturedPhotos.length > 0) {
      setShowProjectSelector(true);
    }
  };

  const handleProjectSelect = (projectId: number) => {
    onSave(projectId, capturedPhotos, audioTranscript || undefined, groupName || undefined);
    setShowProjectSelector(false);
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-slate-800 rounded-lg h-9"
          >
            <X className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-3">
            <h1 className="text-white font-medium">Capture</h1>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full">
              <Camera className="w-4 h-4 text-theme-primary" />
              <span className="text-white text-sm">{capturedPhotos.length}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDone}
            disabled={capturedPhotos.length === 0}
            className="text-theme-primary hover:bg-slate-800 rounded-lg disabled:opacity-40 h-9 px-4"
          >
            Done
          </Button>
        </div>

        {/* Audio Recording Controls at Top */}
        <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 p-3">
          <div className="flex items-center gap-3">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                className="bg-theme-action-primary hover:bg-theme-action-primary-hover rounded-lg h-10 px-4"
              >
                <Mic className="w-4 h-4 mr-2" />
                Record Audio
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                className="bg-red-500 hover:bg-red-600 rounded-lg h-10 px-4"
              >
                <Square className="w-4 h-4 mr-2 fill-white" />
                Stop
              </Button>
            )}
            
            {isRecording && (
              <div className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white text-sm font-mono tabular-nums">
                    {formatDuration(duration)}
                  </span>
                </div>
                {isSpeaking && (
                  <div className="flex items-center gap-1">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-theme-primary rounded-full animate-pulse"
                        style={{
                          height: `${12 + Math.random() * 12}px`,
                          animationDelay: `${i * 0.1}s`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {audioTranscript && !isRecording && (
              <div className="flex-1 text-xs text-slate-400 truncate">
                Transcript saved ({audioTranscript.split(' ').length} words)
              </div>
            )}
          </div>
        </div>

        {/* Camera View */}
        <div className="flex-1 relative bg-black overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Camera Error Overlay */}
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-6">
              <div className="text-center max-w-md space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-red-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-white">Camera Access Required</h3>
                  <p className="text-sm text-slate-300">{cameraError}</p>
                </div>
                <div className="space-y-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-theme-primary hover:bg-theme-primary-hover rounded-lg h-11"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload from Gallery
                  </Button>
                  <p className="text-xs text-slate-400">
                    Or allow camera access in your browser settings and refresh the page
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {/* Capture Button */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
            {!cameraError && (
              <button
                onClick={handleTakePhoto}
                className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 shadow-2xl flex items-center justify-center transition-all active:scale-90 hover:border-theme-primary"
              >
                <div className="w-14 h-14 rounded-full bg-white" />
              </button>
            )}
            
            {/* Upload button always available */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-full bg-slate-700/80 backdrop-blur-sm border-2 border-slate-500 shadow-xl flex items-center justify-center transition-all active:scale-90 hover:bg-slate-600 hover:border-theme-primary"
              title="Upload from gallery"
            >
              <Upload className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Photo Thumbnail Strip at Bottom */}
        {capturedPhotos.length > 0 && (
          <div className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 p-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {capturedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative flex-shrink-0 group"
                >
                  <img
                    src={photo.url}
                    alt="Captured"
                    className="w-16 h-16 object-cover rounded-lg border-2 border-slate-600"
                  />
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Project Selector Modal */}
      <Dialog open={showProjectSelector} onOpenChange={setShowProjectSelector}>
        <DialogContent className="sm:max-w-[500px] rounded-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Project</DialogTitle>
            <DialogDescription>
              Choose a project and name this group of {capturedPhotos.length} photo{capturedPhotos.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          {/* Group Name Input */}
          <div className="space-y-2">
            <label className="text-sm text-slate-700">
              Group Name <span className="text-slate-400">(optional)</span>
            </label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Foundation Inspection - West Wing"
              className="rounded-lg"
            />
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 rounded-lg"
            />
          </div>

          {/* Create New Project Button */}
          {onCreateProject && (
            <Button
              onClick={() => {
                setShowProjectSelector(false);
                onCreateProject();
              }}
              variant="outline"
              className="w-full rounded-lg border-2 border-dashed border-theme-primary text-theme-primary hover:bg-theme-primary/5"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Project
            </Button>
          )}

          {/* Project List */}
          <div className="space-y-2 max-h-64 overflow-y-auto py-2 flex-1">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectSelect(project.id)}
                  className="w-full p-3 rounded-lg border-2 border-slate-200 hover:border-theme-primary hover:bg-theme-primary/5 transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="group-hover:text-theme-primary transition-colors truncate">
                          {project.name}
                        </h3>
                        <Badge
                          variant={project.status === "Active" ? "default" : "secondary"}
                          className="rounded-md flex-shrink-0"
                        >
                          {project.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500">
                        {project.reports} reports • {project.photos} photos
                      </div>
                    </div>
                    <Send className="w-4 h-4 text-slate-400 group-hover:text-theme-primary transition-colors flex-shrink-0 ml-2" />
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No projects found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setShowProjectSelector(false)}
              className="flex-1 rounded-lg"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}