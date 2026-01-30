import { xai } from '@ai-sdk/xai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { LanguageModelV2 } from '@ai-sdk/provider';

export class ModelStrategy {
    // Instead of returning "GrokAgent", we return "LanguageModel"
    static getModel(provider: 'grok' | 'gemini' | 'claude'): LanguageModelV2 {
        switch (provider) {
            case 'grok':
                // No need to instantiate "OpenAI()", the SDK handles auth via env vars
                return xai('grok-4-fast') as unknown as LanguageModelV2;
            case 'gemini':
                return google('gemini-1.5-pro') as unknown as LanguageModelV2;
            case 'claude':
                return anthropic('claude-3-5-sonnet-20240620') as unknown as LanguageModelV2;
            default:
                return google('gemini-1.5-flash') as unknown as LanguageModelV2;
        }
    }
}