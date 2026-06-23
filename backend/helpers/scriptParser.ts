import { Type } from "@google/genai";
import { generateContentWithRetry } from "./gemini.ts";
import { StoryboardStep } from "../types.ts";

// Lay out N scene panels as an even grid inside the 1920x1080 design space.
// Single source of geometry so segmentation, image panels and extraction agree.
export function computeGridBounds(n: number): { minX: number; minY: number; maxX: number; maxY: number }[] {
  const count = Math.max(1, Math.min(8, n));
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const W = 1920, H = 1080, pad = 40, gap = 40;
  const cellW = (W - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (H - pad * 2 - gap * (rows - 1)) / rows;
  const out: { minX: number; minY: number; maxX: number; maxY: number }[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const minX = pad + c * (cellW + gap);
    const minY = pad + r * (cellH + gap);
    out.push({ minX, minY, maxX: minX + cellW, maxY: minY + cellH });
  }
  return out;
}

// Helper to parse transcription script into structured sequential scenes with Gemini
export async function parseScriptIntoSteps(text: string, count: number = 5): Promise<StoryboardStep[]> {
  const stepCount = Math.max(1, Math.min(8, count));
  const fallbackBounds = computeGridBounds(stepCount);

  try {
    const prompt = `
      You are an expert storyboard visualizer.
      Parse this audio script or transcription text into EXACTLY ${stepCount} chronological storyboard scenes/steps.
      The input text contains multilingual narratives (Arabic and English) about a whiteboard animation project.

      For each of the ${stepCount} chronological steps, extract:
      1. "titleAr": A short catchy title in Arabic (RTL, e.g., "المشهد الأول: البداية").
      2. "titleEn": A short catchy title in English (LTR, e.g., "Intro Scene").
      3. "scriptAr": The specific right-to-left Arabic script/voiceover segment for this step.
      4. "scriptEn": The specific left-to-right English script/voiceover segment for this step.
      5. "desc": A detailed conceptual description of the visual illustration/webcomic panel drawing showing whiteboard animations, cute whiteboard doodles, lines, arrows, annotations, and colorful graphics matching the scene.
      6. "keywords": A list of 2-3 prominent keywords in English.

      Input text:
      "${text}"

      Return a strict JSON array of ${stepCount} objects containing "titleAr", "titleEn", "scriptAr", "scriptEn", "desc", and "keywords".
      Do not output any markdown formatting other than the JSON block.
    `;

    const response = await generateContentWithRetry({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              titleAr: { type: Type.STRING },
              titleEn: { type: Type.STRING },
              scriptAr: { type: Type.STRING },
              scriptEn: { type: Type.STRING },
              desc: { type: Type.STRING },
              keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["titleAr", "titleEn", "scriptAr", "scriptEn", "desc", "keywords"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, stepCount).map((item, idx) => ({
        ...item,
        bounds: fallbackBounds[idx] || fallbackBounds[0]
      }));
    }
  } catch (err) {
    console.error("Failed to parse script with Gemini, using split fallback:", err);
  }

  // Pure procedural fallback if LLM parser fails
  const words = text.split(/\s+/).filter(Boolean);
  const wordsPerStep = Math.max(1, Math.ceil(words.length / stepCount));
  const fallbackSteps: StoryboardStep[] = [];
  for (let i = 0; i < stepCount; i++) {
    const stepWords = words.slice(i * wordsPerStep, (i + 1) * wordsPerStep);
    const titleEn = `Step ${i + 1}: ${stepWords.slice(0, 3).join(' ') || 'Progress'}`;
    const titleAr = `الخطوة ${i + 1}: تقدُم`;
    const desc = stepWords.join(' ') || 'Continuing the narrative journey...';
    fallbackSteps.push({
      titleAr,
      titleEn,
      scriptAr: `البرمجة السردية للخطوة ${i + 1}: ${desc}`,
      scriptEn: `Narrative script for Step ${i + 1}: ${desc}`,
      desc: desc.length > 50 ? desc.substring(0, 47) + '...' : desc,
      keywords: stepWords.slice(0, 2),
      bounds: fallbackBounds[i]
    });
  }
  return fallbackSteps;
}
