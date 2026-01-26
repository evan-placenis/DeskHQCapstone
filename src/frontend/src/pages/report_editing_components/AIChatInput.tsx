import { useState } from "react";
import { Input } from "../ui_components/input";
import { Button } from "../ui_components/button";
import { Send, Mic, MicOff, Plus, Paperclip } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui_components/dropdown-menu";

interface AIChatInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AIChatInput({ 
  onSendMessage, 
  placeholder = "Ask AI to revise the report...",
  disabled = false
}: AIChatInputProps) {
  const [chatInput, setChatInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput);
    setChatInput("");
  };

  const handleFileUpload = () => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf,.doc,.docx';
    input.multiple = true;
    
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files || []) as File[];
      if (files.length > 0) {
        // For now, just show an alert. In a real app, this would upload the files
        const fileNames = files.map(f => f.name).join(', ');
        alert(`Selected files: ${fileNames}\n\nFile upload functionality would be implemented here in production.`);
      }
    };
    
    input.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  const handleVoiceInput = async () => {
    // Check if Speech Recognition is supported
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    // If already recording, stop
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    // Check microphone permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed to check permission
      stream.getTracks().forEach(track => track.stop());
      setMicPermissionDenied(false);
    } catch (err: any) {
      console.error('Microphone permission error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermissionDenied(true);
        alert("Microphone access denied. Please allow microphone access in your browser settings to use voice input.");
      } else {
        alert("Could not access microphone. Please check your browser settings.");
      }
      return;
    }

    setIsRecording(true);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setChatInput(transcript);
      setIsRecording(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      
      if (event.error === 'not-allowed') {
        setMicPermissionDenied(true);
        alert("Microphone access was denied. Please allow microphone access in your browser settings to use voice input.");
      } else if (event.error === 'no-speech') {
        alert("No speech detected. Please try again.");
      } else if (event.error === 'network') {
        alert("Network error occurred. Please check your internet connection.");
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setIsRecording(false);
    }
  };

  return (
    <div className="flex gap-2 mb-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon" 
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex-shrink-0"
            disabled={disabled}
            title="Add content"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={handleFileUpload}>
            <Paperclip className="w-4 h-4 mr-2" />
            Add photos & files
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Input
        placeholder={placeholder}
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="rounded-lg flex-1"
        disabled={disabled}
      />
      <Button 
        size="icon" 
        className={`rounded-lg flex-shrink-0 ${
          isRecording 
            ? "bg-red-600 hover:bg-red-700 animate-pulse" 
            : micPermissionDenied
            ? "bg-slate-300 hover:bg-slate-400 text-slate-600"
            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
        }`}
        onClick={handleVoiceInput}
        disabled={disabled}
        title={
          micPermissionDenied 
            ? "Microphone access denied - click to retry" 
            : isRecording 
            ? "Recording... (click to stop)" 
            : "Voice input"
        }
      >
        {micPermissionDenied ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>
      <Button 
        size="icon" 
        className="bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg flex-shrink-0"
        onClick={handleSend}
        disabled={!chatInput.trim() || disabled}
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}