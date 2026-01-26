import { tool } from 'ai';
import { z } from 'zod/v3';
import { Container } from '../../config/container';

// You can export multiple related tools from one file
export const visionSkills = {

  analyzeSchematic: tool({
    description: 'Analyze a circuit schematic image for components',
    inputSchema: z.object({ imageId: z.string() }),
    execute: async ({ imageId }) => {
      // Your OLD "VisionStrategy.analyze()" logic goes here!
      return Container.visionService.analyze(imageId);
    },
  }),

  readHandwrittenNotes: tool({
    description: 'OCR for handwritten field notes',
    inputSchema: z.object({ imageId: z.string() }),
    execute: async ({ imageId }) => {
      return Container.ocrService.process(imageId);
    },
  })
};