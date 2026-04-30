/**
 * Pass 2 of the capture audio pipeline: Describer.
 *
 * Thin wrapper around `CaptureOrchestrator.describeOnePhoto` so the Trigger.dev
 * job has a stable, audio-pipeline-shaped import (matches `master-transcribe.ts`
 * and `transcript-router.ts`).
 */
import { CaptureOrchestrator } from '@/features/ai/orchestrators/capture-orchestrator';
import type { DescribeOnePhotoChunk } from '@/features/ai/orchestrators/capture-orchestrator';
import type { AiSdkChatProvider } from '@/lib/ai-providers';

import type { HeliconeContextInput } from '@/src/features/ai/services/models/gateway/helicone-context-builder';

export type PhotoDescriberInput = {
  projectImageId: string;
  image: { mimeType: string; base64: string };
  transcriptChunks: DescribeOnePhotoChunk[];
  projectId: string;
  provider?: AiSdkChatProvider;
  heliconeInput?: HeliconeContextInput;
};

let _orchestrator: CaptureOrchestrator | null = null;

function getOrchestrator(): CaptureOrchestrator {
  if (!_orchestrator) _orchestrator = new CaptureOrchestrator();
  return _orchestrator;
}

/** Generate a single field-note for one photo. Throws on hard failure. */
export async function describePhotoFromTranscript(
  input: PhotoDescriberInput,
): Promise<string> {
  return getOrchestrator().describeOnePhoto(input);
}

export type { DescribeOnePhotoChunk };
