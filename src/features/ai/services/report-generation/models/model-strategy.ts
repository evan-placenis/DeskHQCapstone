import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { RunnableConfig } from "@langchain/core/runnables";
import {
    HeliconeContextBuilder,
    HELICONE_TARGET_URLS,
    HELICONE_TARGET_URL_HEADER,
    type HeliconeContext,
    type HeliconeContextInput,
} from "../../models/gateway/helicone-context-builder";
import { invokeWithRetry as invokeWithRetryImpl } from "../utils/model-invoke-retry";

/** Provider keys: anthropic, google, openai, grok (frontend sends claude→anthropic, gemini→google) */
const MODEL_REGISTRY: Record<string, Record<string, string>> = {
    anthropic: {
        lightweight: 'claude-haiku-4-5-20251001',
        heavyweight: 'claude-sonnet-4-6'
    },
    google: {
        lightweight: 'gemini-3-flash-preview',
        heavyweight: 'gemini-3.1-pro-preview'
    },
    openai: {
        lightweight: 'gpt-4o-mini',
        heavyweight: 'gpt-4o'
    },
    grok: {
        lightweight: 'grok-4-turbo',
        heavyweight: 'grok-4-fast'
    }
};

/** Map frontend provider names (and legacy values) to registry keys */
const PROVIDER_MAP: Record<string, string> = {
    claude: 'anthropic',
    gemini: 'google',
    openai: 'openai',
    grok: 'grok',
};

export type ModelSize = 'lightweight' | 'heavyweight';

export class ModelStrategy {
    /**
     * Invoke a chat model (including `.bindTools()` results) with retries and exponential backoff.
     * Prefer this over raw `.invoke()` for resilience; do not wrap the model in RunnableRetry
     * or `.bindTools()` will break.
     */
    static invokeWithRetry(
        model: { invoke(input: unknown, config?: RunnableConfig): Promise<unknown> },
        input: unknown,
        config?: RunnableConfig,
    ): Promise<unknown> {
        return invokeWithRetryImpl(model, input, config);
    }

    /**
     * Get a model by provider and size.
     * @param provider   - Frontend value: 'claude' | 'gemini' | 'grok' | 'openai' (or registry key)
     * @param size       - 'lightweight' (fast/cheap) or 'heavyweight' (strong reasoning). Default: lightweight
     * @param heliconeInput - Optional Helicone context for observability
     * @param streaming  - Whether the model should stream tokens. Default: true.
     *                     Pass false for Phase 2 (tool-calling) invocations to avoid Gemini's
     *                     "Failed to parse stream" error when streaming complex JSON tool arguments.
     */
    static getModel(
        provider: string,
        size: ModelSize = 'lightweight',
        heliconeInput?: HeliconeContextInput,
        streaming: boolean = true,
    ): BaseChatModel {
        const helicone = heliconeInput
            ? HeliconeContextBuilder.build(heliconeInput)
            : null;

        const registryKey = PROVIDER_MAP[provider?.toLowerCase()] ?? provider?.toLowerCase();
        const providerRegistry = MODEL_REGISTRY[registryKey];
        const modelName = providerRegistry?.[size] ?? MODEL_REGISTRY.google.lightweight;

        switch (registryKey) {
            case 'anthropic':
                return new ChatAnthropic({
                    model: modelName,
                    apiKey: process.env.ANTHROPIC_API_KEY,
                    streaming,
                    ...(helicone && {
                        clientOptions: {
                            baseURL: `${helicone.baseURL}/v1`,
                            defaultHeaders: {
                                ...helicone.headers,
                                [HELICONE_TARGET_URL_HEADER]: HELICONE_TARGET_URLS.anthropic,
                            },
                        },
                    }),
                });

            case 'google':
                return createGoogleModel(modelName, helicone, streaming);

            case 'openai':
                return new ChatOpenAI({
                    modelName,
                    streaming,
                    apiKey: process.env.OPENAI_API_KEY,
                    configuration: {
                        baseURL: helicone ? `${helicone.baseURL}/v1` : undefined,
                        defaultHeaders: helicone
                            ? { ...helicone.headers, [HELICONE_TARGET_URL_HEADER]: HELICONE_TARGET_URLS.openai }
                            : undefined,
                    },
                });

            case 'grok':
                return new ChatOpenAI({
                    modelName,
                    streaming,
                    configuration: {
                        baseURL: helicone
                            ? `${helicone.baseURL}/v1`
                            : "https://api.x.ai/v1",
                        defaultHeaders: helicone
                            ? { ...helicone.headers, [HELICONE_TARGET_URL_HEADER]: HELICONE_TARGET_URLS.xai }
                            : undefined,
                    },
                    apiKey: process.env.XAI_API_KEY,
                });

            default:
                return createGoogleModel(MODEL_REGISTRY.google.lightweight, helicone, streaming);
        }
    }
}

function createGoogleModel(
    modelName: string,
    helicone: HeliconeContext | null,
    streaming: boolean = true,
): ChatGoogleGenerativeAI {
    if (!helicone) {
        return new ChatGoogleGenerativeAI({
            model: modelName,
            apiKey: process.env.GOOGLE_API_KEY,
            streaming,
        });
    }

    const googleHeaders: Record<string, string> = {
        ...helicone.headers,
        [HELICONE_TARGET_URL_HEADER]: HELICONE_TARGET_URLS.google,
    };

    return new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey: process.env.GOOGLE_API_KEY,
        streaming,
        baseUrl: helicone.baseURL,
        customHeaders: googleHeaders,
    });
}
