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

    let channel: ReturnType<typeof supabase.channel>;
    let retryCount = 0;
    let cancelled = false;
    const MAX_RETRIES = 2;

    function subscribeChannel() {
      channel = supabase.channel(`project-${projectId}`)
        .on('broadcast', { event: 'status' }, (payload: any) => {
          const chunk = payload?.payload?.chunk ?? payload?.chunk ?? payload?.payload?.payload?.chunk ?? (typeof payload === 'string' ? payload : null);
          if (typeof chunk === 'string') setStatus(chunk);
        })
        // 2. TYPEWRITER STREAM: The Schema-Driven Chain of Thought
        .on('broadcast', { event: 'agent_thought' }, (payload: any) => {
          const chunk = payload?.payload?.chunk ?? payload?.chunk;
          if (typeof chunk === 'string') setReasoningText(prev => prev + chunk);
        })
        .on('broadcast', { event: 'reasoning' }, (payload: any) => {
          const chunk = payload?.payload?.chunk ?? payload?.chunk ?? payload?.payload?.payload?.chunk ?? (typeof payload === 'string' ? payload : null);
          if (typeof chunk === 'string') setReasoningText(prev => prev + chunk);
        })
        .on('broadcast', { event: 'report_complete' }, (payload: any) => {
          const inner = payload?.payload ?? payload;
          const id = inner?.reportId;
          if (id) {
            setReportId(id);
            setIsComplete(true);
            setStatus("Report generated successfully!");
          }
        })
        .on('broadcast', { event: 'error' }, (payload: any) => {
          const inner = payload?.payload ?? payload;
          const msg = inner?.message ?? inner?.error;
          console.error("[ReportStreaming] Error:", msg);
          setStatus(`Error: ${msg ?? 'Unknown'}`);
          setIsComplete(true);
        })
        .on('broadcast', { event: 'paused' }, (payload: any) => {
          const inner = payload?.payload ?? payload;
          if (inner?.reportId) setReportId(inner.reportId);
          if (inner?.reportPlan) setReportPlan(inner.reportPlan);
          setIsPaused(true);
          setStatus("Waiting for plan approval...");
        })
        .subscribe((subStatus: any) => {
          if (subStatus === 'CHANNEL_ERROR') {
            console.error("[ReportStreaming] Channel error for project", projectId);
          } else if (subStatus === 'TIMED_OUT') {
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
      if (channel) supabase.removeChannel(channel);
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
