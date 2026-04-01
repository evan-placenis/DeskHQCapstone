/** Stable public API for report feature UI (import from `@/features/reports/components`). */

export { ReportWorkspace, type ReportWorkspaceProps, type SelectedContext } from "./report-workspace";
export { ReportDocument, type ReportDocumentProps, type PendingChange } from "./report-workspace/document";
export { ReportPage } from "./report-page";
export { ReportCard } from "./presentation/report-card";
export { ReportStructureEditor } from "./generation/sections/report-structure-editor";
export { TiptapEditor, createChangeManagerExtension } from "./authoring/tiptap/tiptap-editor";
export type { SelectionContext, TiptapEditorHandle } from "./authoring/tiptap/tiptap-editor";
export { ReportLiveStream } from "./generation/streaming/report-live-stream";
export { useReportStreaming } from "./generation/streaming/use-report-streaming";
