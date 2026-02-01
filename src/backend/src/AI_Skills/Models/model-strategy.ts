import { xai } from '@ai-sdk/xai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { LanguageModelV2 } from '@ai-sdk/provider';

export class ModelStrategy {
    // Instead of returning "GrokAgent", we return "LanguageModel"
    static getModel(provider: 'grok' | 'gemini-pro' | 'gemini-cheap' | 'claude'): LanguageModelV2 {
        switch (provider) {
            case 'grok':
                // No need to instantiate "OpenAI()", the SDK handles auth via env vars
                return xai('grok-4-fast') as unknown as LanguageModelV2;
            case 'gemini-pro':
                return google('gemini-3-pro-preview') as unknown as LanguageModelV2;
            case 'gemini-cheap':
                return google('gemini-3-flash-preview') as unknown as LanguageModelV2;
            case 'claude':
                return anthropic('claude-sonnet-4-5') as unknown as LanguageModelV2;
            default:
                return google('gemini-3-flash-preview') as unknown as LanguageModelV2;
        }
    }
}