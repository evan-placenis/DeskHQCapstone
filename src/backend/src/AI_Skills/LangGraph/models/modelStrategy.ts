import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai"; // For Grok (via OpenAI compatibility)
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export class ModelStrategy {
    static getModel(provider: string): BaseChatModel {
        switch (provider) {
            case 'grok':
                return new ChatOpenAI({ 
                    modelName: 'grok-4-fast', 
                    configuration: { baseURL: "https://api.x.ai/v1" },
                    apiKey: process.env.XAI_API_KEY
                });
            case 'gemini-pro':
                return new ChatGoogleGenerativeAI({ model: "gemini-3-pro-preview", apiKey: process.env.GOOGLE_API_KEY });
            case 'gemini-cheap':
                return new ChatGoogleGenerativeAI({ model: "gemini-3-flash-preview", apiKey: process.env.GOOGLE_API_KEY});
            case 'claude':
                return new ChatAnthropic({ model: "claude-sonnet-4-5" , apiKey: process.env.ANTHROPIC_API_KEY});
            default:
                return new ChatGoogleGenerativeAI({ model: "gemini-1.5-flash", apiKey: process.env.GOOGLE_API_KEY });
        }
    }
}