import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser-client";

// Define the expected shape of your backend payloads for better TypeScript support
type BroadcastPayload = {
  payload?: {
    chunk?: string;
    reportId?: string | number;
    message?: string;
    error?: string;
    reportPlan?: any;
  };
};

export function useReportStreaming(projectId: string | null, isGenerating: boolean) {
  const [reasoningText, setReasoningText] = useState("");
  const [status, setStatus] = useState("Initializing...");
  const [reportId, setReportId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [reportPlan, setReportPlan] = useState<any>(null);

  // 1. Reset state ONLY when we START a new generation
  useEffect(() => {
    if (isGenerating && projectId) {
      setReasoningText("");
      setStatus("Initializing...");
      setIsComplete(false);
      setIsPaused(false);
      setReportPlan(null);
    }
  }, [isGenerating, projectId]);

  // 2. Handle the subscription logic
  useEffect(() => {
    if (!isGenerating || !projectId) return;

    let channel: ReturnType<typeof supabase.channel>;
    let retryCount = 0;
    let cancelled = false;
    const MAX_RETRIES = 2;

    function subscribeChannel() {
      if (cancelled) return; 

      channel = supabase
        .channel(`project-${projectId}`)
        
        // --- Text Chunks (Status, Thoughts, Reasoning) ---
        .on("broadcast", { event: "status" }, (event: BroadcastPayload) => {
          if (event.payload?.chunk) setStatus(event.payload.chunk);
        })
        .on("broadcast", { event: "agent_thought" }, (event: BroadcastPayload) => {
          if (event.payload?.chunk) setReasoningText((prev) => prev + event.payload!.chunk);
        })
        .on("broadcast", { event: "reasoning" }, (event: BroadcastPayload) => {
          if (event.payload?.chunk) setReasoningText((prev) => prev + event.payload!.chunk);
        })
        
        // --- System Events (Complete, Error, Paused) ---
        .on("broadcast", { event: "report_complete" }, (event: BroadcastPayload) => {
          const id = event.payload?.reportId;
          if (id) {
            setReportId(String(id));
            setIsComplete(true);
            setStatus("Report generated successfully!");
          }
        })
        .on("broadcast", { event: "error" }, (event: BroadcastPayload) => {
          const msg = event.payload?.message || event.payload?.error || "Unknown error occurred";
          console.error("[ReportStreaming] Error:", msg);
          setStatus(`Error: ${msg}`);
          setIsComplete(true); 
        })
        .on("broadcast", { event: "paused" }, (event: BroadcastPayload) => {
          const id = event.payload?.reportId;
          const plan = event.payload?.reportPlan;
          
          if (id) setReportId(String(id));
          if (plan) setReportPlan(plan);
          
          setIsPaused(true);
          setStatus("Waiting for plan approval...");
        })
        
        // --- Connection Lifecycle ---
        .subscribe((subStatus: string) => {
          if (subStatus === "CHANNEL_ERROR") {
            console.error("[ReportStreaming] Channel error for project", projectId);
          } else if (subStatus === "TIMED_OUT") {
            if (retryCount < MAX_RETRIES && !cancelled) {
              retryCount += 1;
              setStatus(`Reconnecting... (${retryCount}/${MAX_RETRIES})`);
              
              supabase.removeChannel(channel).then(() => {
                if (!cancelled) setTimeout(subscribeChannel, 2000);
              });
            } else {
              setStatus("Stream connection timed out. Status updates may not appear.");
            }
          }
        });
    }

    subscribeChannel();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isGenerating, projectId]);

  return {
    reasoningText,
    status,
    reportId,
    isComplete,
    isPaused,
    reportPlan,
  };
}