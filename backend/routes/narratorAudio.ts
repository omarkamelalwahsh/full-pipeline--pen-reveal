import { Express } from "express";
import { Type } from "@google/genai";
import { ai } from "../config.ts";
import { generateContentWithRetry, delay } from "../helpers/gemini.ts";
import { pcmToWav } from "../helpers/audio.ts";
import { Word } from "../types.ts";

export default function registerNarratorAudioRoute(app: Express) {
  // API Route for Generating Expressive Narrative Audiobook Voiceovers (TTS) and Transcribing them
  app.post("/api/generate-narrator-audio", async (req, res) => {
    try {
      const { script, voiceName = "Kore" } = req.body || {};
      if (!script) {
        return res.status(400).json({ error: "No script text provided" });
      }

      console.log(`Generating expressive storytelling narrator voice: [Voice: ${voiceName}]...`);

      // 1. Prompt model for warm script execution
      const prompt = `Expressively read this text in a warm, captivating storytelling narrator style: "${script}"`;

      // 2. Query gemini-3.1-flash-tts-preview to generate PCM stream with retry on rate limits or UNAVAILABLE
      let ttsResponse: any;
      let ttsError: any = null;
      let ttsDelay = 1000;
      const ttsRetries = 3;
      
      for (let attempt = 0; attempt <= ttsRetries; attempt++) {
        try {
          console.log(`[TTS Generation] Querying gemini-3.1-flash-tts-preview (Attempt ${attempt + 1}/${ttsRetries + 1})...`);
          ttsResponse = await ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceName }
                }
              }
            }
          });
          ttsError = null;
          break;
        } catch (err: any) {
          ttsError = err;
          const errorMessage = err.message || "";
          console.warn(`[TTS Generation] Attempt ${attempt + 1} failed: ${errorMessage}`);
          if (attempt < ttsRetries) {
            console.log(`Retrying TTS in ${ttsDelay}ms...`);
            await delay(ttsDelay);
            ttsDelay *= 2;
          }
        }
      }

      if (ttsError) {
        throw ttsError;
      }

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("The Text-to-Speech service did not return an audio stream. Please try again.");
      }

      const pcmBuffer = Buffer.from(base64Audio, "base64");
      const wavBuffer = pcmToWav(pcmBuffer, 24000);
      const audioDataUrl = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;

      // 3. Automatically perform word-level transcription on the generated audio for immediate mapping!
      console.log("Transcribing generated voiceover for automatic element-to-word alignment...");
      const transPrompt = `
        Transcribe the following audio file. 
        Provide a detailed word-level transcription with start and end timestamps.
        Return the result as a JSON array of objects with keys: word, start, end.
      `;

      let transcription: Word[] = [];
      try {
        const transResponse = await generateContentWithRetry({
          model: "gemini-2.5-flash",
          contents: {
            parts: [
              { text: transPrompt },
              {
                inlineData: {
                  data: wavBuffer.toString("base64"),
                  mimeType: "audio/wav",
                },
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER },
                },
                required: ["word", "start", "end"],
              },
            },
          },
        });
        transcription = JSON.parse(transResponse.text || "[]");
      } catch (err: any) {
        console.warn("Auto-transcription failed, using estimated proportional timestamps fallback", err);
        const estimatedDuration = pcmBuffer.length / (24000 * 2);
        const words = script.split(/\s+/).filter(Boolean);
        const secPerWord = estimatedDuration / Math.max(1, words.length);
        transcription = words.map((w: string, i: number): Word => ({
          word: w,
          start: Number((i * secPerWord).toFixed(1)),
          end: Number(((i + 1) * secPerWord).toFixed(1))
        }));
      }

      res.json({
        audioUrl: audioDataUrl,
        transcription: transcription,
        duration: pcmBuffer.length / (24000 * 2)
      });

    } catch (error: any) {
      console.error("Narrator voice generator error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
