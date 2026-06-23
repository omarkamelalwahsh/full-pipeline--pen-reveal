import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

export const PORT = 3000;

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});
