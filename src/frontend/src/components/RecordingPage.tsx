import { useState, useEffect, useRef } from "react";
import { Mic, Square, Check, X, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Project } from "../App";

interface RecordingPageProps {
  onClose: () => void;
  onSave: (projectId: number, transcript: string, audioData: any) => void;
  projects: Project[];
}

export function RecordingPage({ onClose, onSave, projects }: RecordingPageProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(40).fill(0));
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const transcriptInterval = useRef<NodeJS.Timeout | null>(null);
  const audioVisualizerInterval = useRef<NodeJS.Timeout | null>(null);
  const speechPatternInterval = useRef<NodeJS.Timeout | null>(null);

  // Mock real-time transcription - simulates speech-to-text
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

  const startRecording = () => {
    setIsRecording(true);
    setDuration(0);
    setTranscript("");
    setIsSpeaking(false);

    // Duration counter
    durationInterval.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    // Simulate real-time transcription
    let segmentIndex = 0;
    transcriptInterval.current = setInterval(() => {
      if (segmentIndex < mockTranscriptSegments.length) {
        setTranscript(prev => prev + mockTranscriptSegments[segmentIndex]);
        segmentIndex++;
      }
    }, 2500); // Add a new segment every 2.5 seconds

    // Simulate realistic speech patterns - alternate between speaking and silence
    let currentlySpeaking = false;
    const toggleSpeech = () => {
      currentlySpeaking = !currentlySpeaking;
      setIsSpeaking(currentlySpeaking);
      
      // Random duration for speech (1-3 seconds) or silence (0.5-1.5 seconds)
      const nextDuration = currentlySpeaking 
        ? Math.random() * 2000 + 1000  // Speaking: 1-3 seconds
        : Math.random() * 1000 + 500;  // Silence: 0.5-1.5 seconds
      
      speechPatternInterval.current = setTimeout(toggleSpeech, nextDuration);
    };
    
    // Start with a short delay before first speech
    setTimeout(toggleSpeech, 500);

    // Audio visualizer animation - responds to speech state
    audioVisualizerInterval.current = setInterval(() => {
      setAudioLevels(prev => {
        const newLevels = [...prev];
        
        for (let i = 0; i < newLevels.length; i++) {
          if (currentlySpeaking) {
            // When speaking: animated bars with wave pattern
            const centerDistance = Math.abs(i - newLevels.length / 2);
            const centerBoost = (1 - centerDistance / (newLevels.length / 2)) * 20;
            const wavePattern = Math.sin(Date.now() * 0.005 + i * 0.3) * 15;
            const randomVariation = Math.random() * 30;
            newLevels[i] = Math.max(20, Math.min(95, 40 + centerBoost + wavePattern + randomVariation));
          } else {
            // When silent: decay to near zero
            newLevels[i] = Math.max(0, newLevels[i] * 0.85);
          }
        }
        
        return newLevels;
      });
    }, 50); // Faster update for smooth animation
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsSpeaking(false);
    
    // Clear all intervals
    if (durationInterval.current) clearInterval(durationInterval.current);
    if (transcriptInterval.current) clearInterval(transcriptInterval.current);
    if (audioVisualizerInterval.current) clearInterval(audioVisualizerInterval.current);
    if (speechPatternInterval.current) clearTimeout(speechPatternInterval.current);
    
    // Smoothly animate bars down to zero
    const animateDown = () => {
      setAudioLevels(prev => {
        const newLevels = prev.map(level => {
          if (level > 1) {
            return level * 0.75; // Decay to zero
          }
          return 0;
        });
        
        // Check if all levels are near zero
        const allZero = newLevels.every(level => level < 1);
        if (!allZero) {
          setTimeout(animateDown, 50);
        }
        return newLevels;
      });
    };
    animateDown();
  };

  const handleDone = () => {
    if (isRecording) {
      stopRecording();
    }
    if (transcript.trim().length > 0) {
      setShowProjectPicker(true);
    }
  };

  const handleProjectSelect = (projectId: number) => {
    onSave(projectId, transcript, { duration });
    setShowProjectPicker(false);
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
      if (transcriptInterval.current) clearInterval(transcriptInterval.current);
      if (audioVisualizerInterval.current) clearInterval(audioVisualizerInterval.current);
      if (speechPatternInterval.current) clearTimeout(speechPatternInterval.current);
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </Button>
          <h1 className="text-white">Voice Recording</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDone}
            disabled={transcript.trim().length === 0}
            className="text-theme-primary hover:bg-slate-800 rounded-lg disabled:opacity-40"
          >
            Done
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-between p-6 pb-8 overflow-hidden">
          {/* Audio Visualizer */}
          <div className="w-full flex-1 flex items-center justify-center max-w-md">
            <div className="flex items-end justify-center gap-1 h-48 w-full">
              {audioLevels.map((level, index) => (
                <div
                  key={index}
                  className="flex-1 bg-theme-primary rounded-full transition-all duration-100 ease-out min-h-2"
                  style={{
                    height: `${Math.max(8, level)}%`,
                    opacity: isRecording ? 0.6 + (level / 200) : 0.2,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Timer */}
          <div className="text-center mb-6">
            <div className="text-5xl text-white mb-2 font-mono tabular-nums">
              {formatDuration(duration)}
            </div>
            <div className="text-slate-400 text-sm">
              {isRecording ? "Recording..." : "Ready to record"}
            </div>
          </div>

          {/* Record/Stop Button */}
          <div className="mb-8">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="w-20 h-20 rounded-full bg-theme-action-primary hover:bg-theme-action-primary-hover shadow-2xl flex items-center justify-center transition-all active:scale-95"
              >
                <Mic className="w-10 h-10 text-white" />
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 shadow-2xl flex items-center justify-center transition-all active:scale-95"
              >
                <Square className="w-8 h-8 text-white fill-white" />
              </button>
            )}
          </div>

          {/* Transcript Display */}
          <div className="w-full max-w-2xl flex-1 max-h-64 overflow-hidden">
            <Card className="bg-slate-800 border-slate-700 h-full">
              <div className="p-4 h-full overflow-y-auto">
                <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {transcript || (
                    <span className="text-slate-500 italic">
                      Transcription will appear here as you speak...
                    </span>
                  )}
                  {isRecording && transcript && (
                    <span className="inline-block w-2 h-4 bg-theme-primary ml-1 animate-pulse" />
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Project Picker Modal */}
      <Dialog open={showProjectPicker} onOpenChange={setShowProjectPicker}>
        <DialogContent className="sm:max-w-[500px] rounded-xl">
          <DialogHeader>
            <DialogTitle>Select Project</DialogTitle>
            <DialogDescription>
              Choose which project to attach this audio recording to
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-96 overflow-y-auto py-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleProjectSelect(project.id)}
                className="w-full p-4 rounded-lg border-2 border-slate-200 hover:border-theme-primary hover:bg-theme-primary-10 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="group-hover:text-theme-primary transition-colors">
                        {project.name}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        project.status === "Active" 
                          ? "bg-theme-success-20 text-theme-success" 
                          : "bg-slate-200 text-slate-600"
                      }`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {project.reports} reports • {project.photos} photos
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-theme-primary transition-colors" />
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowProjectPicker(false)}
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