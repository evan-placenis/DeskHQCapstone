import OpenAI from "openai";


let _instance: OpenAI | undefined;

// ✅ This waits until you actually ask for the client
export const getGrokClient = (): OpenAI => {
  if (!_instance) {
    if (!process.env.GROK_API_KEY) {
      throw new Error("Missing GROK_API_KEY in environment variables");
    }
    _instance = new OpenAI({
      apiKey: process.env.GROK_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });
  }
  return _instance;
};