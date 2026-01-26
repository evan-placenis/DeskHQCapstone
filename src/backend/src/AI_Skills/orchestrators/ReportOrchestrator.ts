import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { reportSkills } from '../skills/report.skills';
import { visionSkills } from '../skills/vison.skills';
import { researchSkills } from '../skills/research.skills';
import { ModelStrategy } from '../Models/model-strategy';


export class ReportOrchestrator {
  /**
   * Orchestrates the generation flow using Vercel SDK
   */
  async generateStream(params: {
    messages: any[];
    projectId: string;
    userId: string;
    reportType: string;
    provider: 'grok' | 'gemini' | 'claude';
  }) {
    const { messages, projectId, userId, reportType, provider } = params;

    // Call the Model (The SDK Logic)
    // Note: We return the 'result' object, NOT the response yet.
    return streamText({
      model: ModelStrategy.getModel(provider),

      // Helper to sanitize inputs
      messages: await convertToModelMessages(messages),

      stopWhen: stepCountIs(10),

      system: `You are an expert technical writer generating a ${reportType} report.
               1. Search for project specs using 'getProjectSpecs' or 'searchInternalKnowledge'.
               2. Research additional information using 'searchWeb' if needed.
               3. Write sections using 'updateSection'.
               4. Analyze images using vision tools when provided.`,

      tools: {
        ...reportSkills(projectId, userId), // Factory function - pass context
        ...visionSkills,
        ...researchSkills,
      },

      // Optional: Add lifecycle hooks for logging/analytics
      onFinish: async ({ text }) => {
        console.log(`[Agent] Finished generation for project ${projectId}`);
      }
    });
  }
}

// Add to your Container
export const reportOrchestrator = new ReportOrchestrator();