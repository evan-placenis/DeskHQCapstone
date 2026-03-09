import { createXai } from '@ai-sdk/xai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModelV2 } from '@ai-sdk/provider';
import {
    HeliconeContextBuilder,
    HELICONE_TARGET_URLS,
    type HeliconeContextInput,
} from '../gateway/HeliconeContextBuilder';

export class ModelStrategy {
    static getModel(
        provider: 'grok' | 'gemini-pro' | 'gemini-cheap' | 'claude',
        heliconeInput?: HeliconeContextInput,
    ): LanguageModelV2 {
        const helicone = heliconeInput
            ? HeliconeContextBuilder.build(heliconeInput)
            : null;

        switch (provider) {
            case 'grok': {
                const xai = createXai({
                    apiKey: process.env.XAI_API_KEY,
                    ...(helicone && {
                        baseURL: `${helicone.baseURL}/v1`,
                        headers: {
                            ...helicone.headers,
                            'Helicone-Target-Url': HELICONE_TARGET_URLS.xai,
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
                            'Helicone-Target-Url': HELICONE_TARGET_URLS.google,
                        },
                    }),
                });
                return google('gemini-3-pro-preview') as unknown as LanguageModelV2;
            }
            case 'gemini-cheap': {
                const google = createGoogleGenerativeAI({
                    apiKey: process.env.GOOGLE_API_KEY,
                    ...(helicone && {
                        baseURL: `${helicone.baseURL}/v1beta`,
                        headers: {
                            ...helicone.headers,
                            'Helicone-Target-Url': HELICONE_TARGET_URLS.google,
                        },
                    }),
                });
                return google('gemini-3-flash-preview') as unknown as LanguageModelV2;
            }
            case 'claude': {
                const anthropicProvider = createAnthropic({
                    apiKey: process.env.ANTHROPIC_API_KEY,
                    ...(helicone && {
                        baseURL: `${helicone.baseURL}/v1`,
                        headers: {
                            ...helicone.headers,
                            'Helicone-Target-Url': HELICONE_TARGET_URLS.anthropic,
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
                            'Helicone-Target-Url': HELICONE_TARGET_URLS.google,
                        },
                    }),
                });
                return google('gemini-3-flash-preview') as unknown as LanguageModelV2;
            }
        }
    }
}
