import OpenAI from "openai";

let _instance: OpenAI | undefined;

// ✅ This waits until you actually ask for the client
export const getOpenAIClient = (): OpenAI => {
  if (!_instance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY in environment variables");
    }
    _instance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // No baseURL needed for standard OpenAI
    });
  }
  return _instance;
};
