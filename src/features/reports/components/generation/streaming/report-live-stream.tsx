"use client";

import { memo, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { stripThinkingBlocksForMarkdown } from "./strip-thinking-blocks";

const MARKDOWN_PLUGINS = [remarkGfm];

const StreamRenderer = memo(({ content }: { content: string }) => {
  const cleaned = stripThinkingBlocksForMarkdown(content);
  return (
    <div
      className="prose prose-sm max-w-none text-slate-700 leading-relaxed
    prose-p:my-2 prose-ul:my-2 prose-li:my-1
    prose-headings:font-semibold prose-headings:text-slate-900 prose-headings:mt-5 prose-headings:mb-2
    prose-h2:text-base prose-h3:text-sm
    prose-strong:text-slate-900 prose-strong:font-semibold
    prose-blockquote:border-l-2 prose-blockquote:border-theme-primary/40 prose-blockquote:text-slate-500 prose-blockquote:pl-3
    prose-pre:bg-slate-100 prose-pre:p-3 prose-pre:rounded-lg prose-code:text-xs"
    >
      {cleaned ? (
        <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>{cleaned}</ReactMarkdown>
      ) : (
        <span className="text-slate-400 text-sm">…</span>
      )}
      <span className="inline-block w-1.5 h-4 ml-0.5 bg-theme-primary/70 animate-pulse align-middle translate-y-[1px] rounded-sm" />
    </div>
  );
});
StreamRenderer.displayName = "StreamRenderer";

const StatusFooter = memo(({ status }: { status: string }) => {
  if (!status || status === "Initializing...") return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 animate-in fade-in">
      <Loader2 className="w-3 h-3 animate-spin text-theme-primary flex-shrink-0" />
      <span className="text-xs text-slate-500 font-mono truncate">{status}</span>
    </div>
  );
});
StatusFooter.displayName = "StatusFooter";

/** Reasoning box while generating; success card when complete. */
export const ReportLiveStream = ({
  reasoningText,
  status,
  isComplete,
}: {
  reasoningText: string;
  status: string;
  isComplete?: boolean;
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bottomRef.current || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceFromBottom < 120) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [reasoningText]);

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto mt-8">
      {!isComplete && (
        <Card className="border border-slate-200 shadow-md bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white border-b border-slate-100 px-4 py-2.5 flex items-center gap-2.5">
            <div className="relative flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-theme-primary animate-ping absolute" />
              <div className="w-2 h-2 rounded-full bg-theme-primary" />
            </div>
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-widest">
              Analyzing &amp; Planning
            </span>
          </div>

          <div
            ref={scrollContainerRef}
            className="min-h-[220px] max-h-[60vh] overflow-y-auto bg-white"
          >
            <div className="p-5">
              {!reasoningText ? (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-3 py-14">
                  <Loader2 className="w-7 h-7 animate-spin opacity-40" />
                  <p className="text-sm text-slate-400">Starting agent...</p>
                </div>
              ) : (
                <StreamRenderer content={reasoningText} />
              )}
              <div ref={bottomRef} className="h-px" />
            </div>
          </div>

          <StatusFooter status={status} />
        </Card>
      )}

      {isComplete && (
        <Card className="border border-green-200 shadow-md bg-white overflow-hidden animate-in fade-in duration-300">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-3 min-h-[120px]">
            <div className="p-3 rounded-full bg-green-50 text-green-500">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-base font-semibold text-green-700">Report generated successfully!</h2>
            <p className="text-sm text-slate-400">Redirecting to report...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
