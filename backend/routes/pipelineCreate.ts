import { Express } from "express";
import { Type } from "@google/genai";
import { generateContentWithRetry } from "../helpers/gemini.ts";
import { computeGridBounds } from "../helpers/scriptParser.ts";
import { StoryboardScene } from "../types.ts";

export default function registerPipelineCreateRoute(app: Express) {
  // API Route for Pipeline Create (AI Script Parser)
  app.post("/api/pipeline/create", async (req, res) => {
    try {
      const { script } = req.body || {};
      if (!script) {
        return res.status(400).json({ error: "No script text provided" });
      }

      console.log(`[Pipeline] Creating storyboard from script: "${script.substring(0, 50)}..."`);

      const prompt = `
        You are a storyboard script writer.
        Parse the following voiceover script into its NATURAL logical, chronological scenes.
        Choose the number of scenes that genuinely fits the script's beats: between 3 and 6 scenes
        (use fewer for short scripts, more for longer ones). Do NOT pad with filler scenes.
        For each scene, provide:
        1. A sequential "scene_number" (integer starting at 1).
        2. The visual/script "text" chunk for that scene.
        3. An estimated "duration_seconds" (an integer, e.g. 5, 8, 10) depending on the amount of script text (approx 1 second per 3 words, min 3 seconds, max 15 seconds).
        4. "keywords": exactly 2-3 short descriptive English visual nouns capturing the scene's key imagery (e.g. ["rocket", "launch"], ["whiteboard", "drawing"]).

        Script to parse:
        "${script}"

        Return a strict JSON array of objects (one per scene) containing "scene_number", "text", "duration_seconds", and "keywords".
        Do not include any conversational text or markdown blocks, only the raw JSON.
      `;

      let scenes: StoryboardScene[] = [];
      try {
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
                  scene_number: { type: Type.INTEGER },
                  text: { type: Type.STRING },
                  duration_seconds: { type: Type.INTEGER },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["scene_number", "text", "duration_seconds", "keywords"]
              }
            }
          }
        });
        const parsed = JSON.parse(response.text || "[]");
        if (Array.isArray(parsed) && parsed.length > 0) {
          scenes = parsed;
        }
      } catch (e: any) {
        console.warn("[Pipeline] AI script parsing failed, using paragraph split fallback:", e.message);
      }

      if (scenes.length === 0) {
        // Heuristic fallback: split by paragraphs, else by sentences. Clamp to 3-6.
        let parts = script.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean);
        if (parts.length < 3) {
          parts = script.split(/(?<=[.!?؟])\s+/).map((p: string) => p.trim()).filter(Boolean);
        }
        if (parts.length === 0) parts = [script];
        const targetCount = Math.max(3, Math.min(6, parts.length));
        parts = parts.slice(0, targetCount);
        scenes = parts.map((text: string, i: number): StoryboardScene => {
          const wordCount = text.split(/\s+/).length;
          const kw = text.split(/\s+/).filter(w => w.length > 3).slice(0, 2);
          return {
            scene_id: "",
            scene_number: i + 1,
            text,
            duration_seconds: Math.max(3, Math.min(15, Math.ceil(wordCount / 3))),
            keywords: kw.length > 0 ? kw : ["scene", `part${i + 1}`]
          };
        });
      }

      // Clamp to a sane range and lay the panels out on a matching grid.
      scenes = scenes.slice(0, 6);
      const gridBounds = computeGridBounds(scenes.length);

      // Map to add scene_id
      const formattedScenes = scenes.map((s, idx) => ({
        scene_id: `scene-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        scene_number: idx + 1,
        text: s.text || "",
        duration_seconds: s.duration_seconds || 5,
        keywords: s.keywords || [],
        bounds: gridBounds[idx] || { minX: 0, maxX: 100, minY: 0, maxY: 100 }
      }));

      res.json({ scenes: formattedScenes });
    } catch (error: any) {
      console.error("[Pipeline] Pipeline create error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for Pipeline Edit (targeted incremental update)
  app.put("/api/pipeline/edit", async (req, res) => {
    try {
      const { scene_id, text } = req.body || {};
      if (!scene_id || text === undefined) {
        return res.status(400).json({ error: "Missing scene_id or text" });
      }

      console.log(`[Pipeline] Editing scene ID: ${scene_id} with updated text`);

      // Recalculate duration based on the new text (approx 1 second per 3 words)
      const wordCount = text.split(/\s+/).length;
      const duration_seconds = Math.max(3, Math.min(15, Math.ceil(wordCount / 3)));

      res.json({
        success: true,
        scene: {
          scene_id,
          text,
          duration_seconds
        }
      });
    } catch (error: any) {
      console.error("[Pipeline] Pipeline edit error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
