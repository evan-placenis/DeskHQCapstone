import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
    HeliconeContextBuilder,
    HELICONE_TARGET_URLS,
    HELICONE_TARGET_URL_HEADER,
    type HeliconeContext,
    type HeliconeContextInput,
} from "../../gateway/HeliconeContextBuilder";

export class ModelStrategy {
    static getModel(
        provider: string,
        heliconeInput?: HeliconeContextInput,
    ): BaseChatModel {
        const helicone = heliconeInput
            ? HeliconeContextBuilder.build(heliconeInput)
            : null;

        switch (provider) {
            case 'grok':
                return new ChatOpenAI({
                    modelName: 'grok-4-fast',
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

            case 'gemini-pro':
                return createGoogleModel("gemini-3-pro-preview", helicone);

            case 'gemini-cheap':
                return createGoogleModel("gemini-3-flash-preview", helicone);

            case 'claude':
                return new ChatAnthropic({
                    model: "claude-sonnet-4-6",
                    apiKey: process.env.ANTHROPIC_API_KEY,
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

            default:
                return createGoogleModel("gemini-1.5-flash", helicone);
        }
    }
}

function createGoogleModel(
    modelName: string,
    helicone: HeliconeContext | null,
): ChatGoogleGenerativeAI {
    if (!helicone) {
        return new ChatGoogleGenerativeAI({
            model: modelName,
            apiKey: process.env.GOOGLE_API_KEY,
        });
    }

    const googleHeaders: Record<string, string> = {
        ...helicone.headers,
        [HELICONE_TARGET_URL_HEADER]: HELICONE_TARGET_URLS.google,
    };

    return new ChatGoogleGenerativeAI({
        model: modelName,
        apiKey: process.env.GOOGLE_API_KEY,
        baseUrl: helicone.baseURL,
        customHeaders: googleHeaders,
    });
}
