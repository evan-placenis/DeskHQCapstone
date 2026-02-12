import { useState, useEffect } from 'react';
import { supabase } from '@/frontend/lib/supabaseClient';

/**
 * Custom hook for subscribing to report generation streaming via Supabase Realtime
 * 
 * @param projectId - The project ID to subscribe to
 * @param isGenerating - Whether report generation is active
 * @returns Object containing reasoningText, status, reportId, and isComplete
 */
export function useReportStreaming(projectId: string | null, isGenerating: boolean) {
  const [reasoningText, setReasoningText] = useState("");
  const [status, setStatus] = useState("Initializing...");
  const [reportId, setReportId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [reportPlan, setReportPlan] = useState<any>(null);

  useEffect(() => {
    if (!isGenerating || !projectId) {
      // Reset state when not generating
      if (!isGenerating) {
        setReasoningText("");
        setStatus("Initializing...");
        setIsComplete(false);
      }
      return;
    }

    console.log(`🔌 Subscribing to channel: project-${projectId}`);

    const channel = supabase.channel(`project-${projectId}`)
      // Status updates (e.g., "Starting report generation...")
      .on('broadcast', { event: 'status' }, (payload: any) => {
        setStatus(payload.payload.chunk);
      })
      
      // Streaming reasoning text (batched chunks every 500ms)
      .on('broadcast', { event: 'reasoning' }, (payload: any) => {
        setReasoningText(prev => prev + payload.payload.chunk);
      })
      
      // Review reasoning (alternative event name)
      .on('broadcast', { event: 'review_reasoning' }, (payload: any) => {
        setReasoningText(prev => prev + payload.payload.chunk);
      })
      
      // Report completion - contains the final reportId
      .on('broadcast', { event: 'report_complete' }, (payload: any) => {
        console.log("✅ Report Complete! Loading report...", payload);
        if (payload.payload.reportId) {
          setReportId(payload.payload.reportId);
          setIsComplete(true);
          setStatus("Report generated successfully!");
        }
      })
      
      // Error handling
      .on('broadcast', { event: 'error' }, (payload: any) => {
        console.error("❌ Report generation error:", payload.payload.message);
        setStatus(`Error: ${payload.payload.message}`);
        setIsComplete(true);
      })
      
      // Human-in-the-Loop: Graph paused for approval
      .on('broadcast', { event: 'paused' }, (payload: any) => {
        console.log("⏸️ Report generation paused for human approval", payload);
        setReportId(payload.payload.reportId);
        setReportPlan(payload.payload.reportPlan);
        setIsPaused(true);
        setStatus("Waiting for plan approval...");
      })
      
      .subscribe();

    return () => {
      console.log("🔌 Unsubscribing from channel");
      supabase.removeChannel(channel);
    };
  }, [isGenerating, projectId]);

  return {
    reasoningText,
    status,
    reportId,
    isComplete,
    isPaused,
    reportPlan
  };
}
