import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GROK_API_KEY) {
    throw new Error("Missing XAI_API_KEY in .env");
}

// Initialize the Client pointing to xAI's servers
export const grokClient = new OpenAI({
    apiKey: process.env.GROK_API_KEY,
    baseURL: "https://api.x.ai/v1", // 👈 This tells it to talk to Grok, not OpenAI
});
