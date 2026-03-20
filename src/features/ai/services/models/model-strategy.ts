import { createXai } from '@ai-sdk/xai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModelV2 } from '@ai-sdk/provider';
import {
    HeliconeContextBuilder,
    HELICONE_TARGET_URLS,
    HELICONE_TARGET_URL_HEADER,
    type HeliconeContextInput,
} from './gateway/helicone-context-builder';
import type { AiSdkChatProvider } from "@/lib/ai-providers";

export class ModelStrategy {
    static getModel(
        provider: AiSdkChatProvider,
        heliconeInput?: HeliconeContextInput,
    ): LanguageModelV2 {
        let helicone: ReturnType<typeof HeliconeContextBuilder.build> | null = null;
        if (heliconeInput) {
            try {
                helicone = HeliconeContextBuilder.build(heliconeInput);
                console.log('[Helicone] AI SDK routing ACTIVE for provider:', provider, '| baseURL:', helicone.baseURL, '| headers:', Object.keys(helicone.headers).join(', '));
            } catch (err: any) {
                console.error('[Helicone] Failed to build context, falling back to direct:', err.message);
            }
        } else {
            console.log('[Helicone] No heliconeInput provided — routing directly to provider:', provider);
        }

        switch (provider) {
            case 'grok': {
                const xai = createXai({
                    apiKey: process.env.XAI_API_KEY,
                    ...(helicone && {
                        baseURL: `${helicone.baseURL}/v1`,
                        headers: {
                            ...helicone.headers,
                            [HELICONE_TARGET_URL_HEADER]: HELICONE_TARGET_URLS.xai,
                        },
                    }),
                });
                return xai('grok-4-fast') as unknown as LanguageModelV2;
            }
            case 'gemini-pro': {
                const google = createGoogleGenerativeAI({
                    apiKey: process.env.GOOGLE_API_KEY,
                    ...(helicone && {
                        baseURL: `${helicone.baseURL}/v1beta`,
                        headers: {
                            ...helicone.headers,
                            [HELICONE_TARGET_URL_HEADER]: HELICONE_TARGET_URLS.google,
                        },
                    }),
                });
                return google('gemini-3.1-pro-preview') as unknown as LanguageModelV2;
            }
            case 'gemini-flash': {
                const google = createGoogleGenerativeAI({
                    apiKey: process.env.GOOGLE_API_KEY,
                    ...(helicone && {
                        baseURL: `${helicone.baseURL}/v1beta`,
                        headers: {
                            ...helicone.headers,
                            [HELICONE_TARGET_URL_HEADER]: HELICONE_TARGET_URLS.google,
                        },
                    }),
                });
                return google('gemini-3-flash-preview') as unknown as LanguageModelV2;
            }
            case 'gemini-lite': {
                const google = createGoogleGenerativeAI({
                    apiKey: process.env.GOOGLE_API_KEY,
                    ...(helicone && {
                        baseURL: `${helicone.baseURL}/v1beta`,
                        headers: {
                            ...helicone.headers,
                            [HELICONE_TARGET_URL_HEADER]: HELICONE_TARGET_URLS.google,
                        },
                    }),
                });
                return google('gemini-3.1-flash-lite-preview') as unknown as LanguageModelV2;
            }
            case 'claude': {
                const anthropicProvider = createAnthropic({
                    apiKey: process.env.ANTHROPIC_API_KEY,
                    ...(helicone && {
                        baseURL: `${helicone.baseURL}/v1`,
                        headers: {
                            ...helicone.headers,
                            [HELICONE_TARGET_URL_HEADER]: HELICONE_TARGET_URLS.anthropic,
                        },
                    }),
                });
                return anthropicProvider('claude-sonnet-4-5') as unknown as LanguageModelV2;
            }

            default: {
                const google = createGoogleGenerativeAI({
                    apiKey: process.env.GOOGLE_API_KEY,
                    ...(helicone && {
                        baseURL: `${helicone.baseURL}/v1beta`,
                        headers: {
                            ...helicone.headers,
                            [HELICONE_TARGET_URL_HEADER]: HELICONE_TARGET_URLS.google,
                        },
                    }),
                });
                return google('gemini-3-flash-preview') as unknown as LanguageModelV2;
            }
        }
    }
}
