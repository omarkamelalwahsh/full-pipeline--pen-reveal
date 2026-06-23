import { Express } from "express";
import { Type } from "@google/genai";
import { ai } from "../config.ts";
import { generateContentWithRetry, delay } from "../helpers/gemini.ts";
import { pcmToWav } from "../helpers/audio.ts";
import { PipelineScene } from "../types.ts";

// Fixed 2x2 master-grid geometry (3840x2160). Each scene is a 1920x1080 tile.
const STORYBOARD_QUADRANTS = [
  { x: 0,    y: 0,    w: 1920, h: 1080 }, // Scene 1 — Top-Left
  { x: 1920, y: 0,    w: 1920, h: 1080 }, // Scene 2 — Top-Right
  { x: 0,    y: 1080, w: 1920, h: 1080 }, // Scene 3 — Bottom-Left
  { x: 1920, y: 1080, w: 1920, h: 1080 }, // Scene 4 — Bottom-Right
];

const WHITEBOARD_STYLE_SUFFIX =
  "Whiteboard sketch line-art, high-contrast, BOLD thick clearly-visible black ink outlines, pure solid white background, " +
  "no shadows, no gradients, no color fills, a single clear centered subject that nearly fills the frame with generous margins. " +
  "ABSOLUTELY NO text, letters, numbers, labels, captions, watermarks, panel borders or frames anywhere — drawing only.";

// Model 1 (Orchestrator): partition the raw script into EXACTLY 4 sequential
// scenes and engineer a drawable image prompt for each. The LLM only writes
// prompts here — it never emits SVG or geometric primitives.
async function partitionScriptIntoFourScenes(script: string): Promise<PipelineScene[]> {
  const orchestratorPrompt = `
    You are a storyboard director and image prompt engineer.
    Split the following voiceover script into EXACTLY 4 sequential scenes that flow chronologically.
    For each scene return:
      - "scene_number": integer from 1 to 4.
      - "text": the spoken voiceover sentence(s) for that scene, in the script's own language.
      - "image_prompt": a vivid, concrete ENGLISH description (25-45 words) of ONE single illustration for
        that scene — describe the subject, action and composition only. Describe drawable subject matter ONLY.
        Do NOT mention SVG, code, panels, grids, captions, watermarks or text overlays.
      - "word_count": integer count of words in "text".
    Script:
    """${script}"""
    Return ONLY a raw JSON array of exactly 4 objects. No markdown fences, no commentary.
  `;

  const response = await generateContentWithRetry({
    model: "gemini-2.5-flash",
    contents: orchestratorPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            scene_number: { type: Type.INTEGER },
            text: { type: Type.STRING },
            image_prompt: { type: Type.STRING },
            word_count: { type: Type.INTEGER },
          },
          required: ["scene_number", "text", "image_prompt", "word_count"],
        },
      },
    },
  });

  const parsed = JSON.parse(response.text || "[]");
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Orchestrator model returned no scenes.");
  }

  const scenes: PipelineScene[] = parsed.slice(0, 4).map((s: any, i: number): PipelineScene => {
    const text = String(s?.text ?? "").trim();
    return {
      scene_number: i + 1,
      text,
      image_prompt: String(s?.image_prompt ?? text ?? `Scene ${i + 1}`).trim(),
      word_count: Number.isFinite(s?.word_count) ? Number(s.word_count) : text.split(/\s+/).filter(Boolean).length,
    };
  });

  if (scenes.length < 4) {
    throw new Error(`Orchestrator produced only ${scenes.length} scene(s); exactly 4 are required.`);
  }
  return scenes;
}

// Real image generation only. Tries the provisioned image models in order and
// throws the actual API error if none succeed — NEVER an SVG/placeholder.
async function generateSceneImage(prompt: string): Promise<string> {
  const fullPrompt = `${prompt} ${WHITEBOARD_STYLE_SUFFIX}`;
  const errors: string[] = [];

  try {
    const r = await ai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt: fullPrompt,
      config: { numberOfImages: 1, aspectRatio: "16:9" },
    });
    const bytes = r.generatedImages?.[0]?.image?.imageBytes;
    if (bytes) return `data:image/png;base64,${bytes}`;
    errors.push("imagen-4.0-generate-001 returned no image bytes");
  } catch (e: any) {
    errors.push(`imagen-4.0-generate-001: ${e?.message || e}`);
  }

  for (const model of ["gemini-3.1-flash-image", "gemini-2.5-flash-image"]) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: fullPrompt }] },
        config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } },
      });
      for (const part of r.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
      }
      errors.push(`${model} returned no inline image data`);
    } catch (e: any) {
      errors.push(`${model}: ${e?.message || e}`);
    }
  }

  throw new Error(`Image generation failed across all provisioned models -> ${errors.join(" | ")}`);
}

// Real TTS only. Returns a WAV data URL plus the measured duration in seconds.
async function generateSceneAudio(text: string, voiceName: string): Promise<{ audioUrl: string; duration: number }> {
  const prompt = `Read this in a warm, captivating storytelling narrator voice: "${text}"`;
  let lastError: any = null;
  let backoff = 1000;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      });
      const b64 = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) throw new Error("Text-to-Speech service returned no audio stream");
      const pcm = Buffer.from(b64, "base64");
      const wav = pcmToWav(pcm, 24000);
      return {
        audioUrl: `data:audio/wav;base64,${wav.toString("base64")}`,
        duration: pcm.length / (24000 * 2), // 16-bit mono PCM @ 24kHz
      };
    } catch (e: any) {
      lastError = e;
      if (attempt < 3) { await delay(backoff); backoff *= 2; }
    }
  }
  throw new Error(`TTS generation failed: ${lastError?.message || lastError}`);
}

export default function registerStoryboardPipelineRoute(app: Express) {
  // ==========================================================================
  //  MULTI-MODEL STORYBOARD PIPELINE  —  POST /api/generate-storyboard  (SSE)
  //
  //  Streams Server-Sent Events as each scene finishes, so the client never
  //  waits on one giant blocking response (which is what drops the Vite HMR
  //  socket). The browser composites the four 1920x1080 scene images into the
  //  3840x2160 master grid — the backend does NOT touch the filesystem.
  //
  //  Events:
  //    event: status -> { phase }                       progress label
  //    event: meta   -> { totalScenes, master, timeline } scene plan + geometry
  //    event: scene  -> { index, scene_number, text, imageUrl, audioUrl,
  //                       duration, quadrant, camera }  one finished scene
  //    event: error  -> { scene_number?, message }      REAL api error, no mock
  //    event: done   -> { timeline }                    all four succeeded
  // ==========================================================================
  app.post("/api/generate-storyboard", async (req, res) => {
    const { script, voiceName = "Kore" } = req.body || {};

    // SSE handshake — flush headers immediately so the client opens the stream
    // right away (non-blocking), before any model work begins.
    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();

    let clientGone = false;
    req.on("close", () => { clientGone = true; });

    const send = (event: string, data: unknown) => {
      if (clientGone || res.writableEnded) return;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    if (!script || !String(script).trim()) {
      send("error", { message: "No script text provided" });
      return res.end();
    }

    try {
      send("status", { phase: "orchestrating" });
      const scenes = await partitionScriptIntoFourScenes(String(script));

      const timeline = scenes.map((s, i) => ({
        scene_number: s.scene_number,
        text: s.text,
        quadrant: STORYBOARD_QUADRANTS[i],
        camera: { index: i, ...STORYBOARD_QUADRANTS[i] }, // lens marker for the pen-reveal viewport
        estDuration: Math.max(3, Math.min(15, Math.ceil(s.word_count / 3))),
        duration: 0,
      }));

      send("meta", {
        totalScenes: 4,
        master: { width: 3840, height: 2160 },
        timeline,
      });
      send("status", { phase: "generating" });

      // Parallel image + audio per scene. Each task streams its own SSE event the
      // instant it settles, so scenes hydrate the client in completion order.
      const tasks = scenes.map((scene, i) =>
        (async () => {
          // The image is the hard requirement. The voice track is best-effort:
          // if TTS isn't provisioned we still ship the scene (audioUrl: null) and
          // the client speaks the text via the Web Speech API instead — the voice
          // is never silently dropped.
          const imagePromise = generateSceneImage(scene.image_prompt);
          const audioPromise = generateSceneAudio(scene.text, voiceName).catch((e: any) => {
            console.warn(`[Storyboard Pipeline] Scene ${scene.scene_number} TTS failed: ${e?.message || e}`);
            return { audioUrl: null as string | null, duration: 0 };
          });

          const [imageUrl, audio] = await Promise.all([imagePromise, audioPromise]);
          const duration = audio.duration > 0 ? audio.duration : timeline[i].estDuration;
          timeline[i].duration = duration;

          send("scene", {
            index: i,
            scene_number: scene.scene_number,
            text: scene.text,
            imageUrl,
            audioUrl: audio.audioUrl,
            duration,
            quadrant: STORYBOARD_QUADRANTS[i],
            camera: timeline[i].camera,
          });
        })().catch((err: any) => {
          // Image generation failed — bubble up the exact error, never a placeholder.
          send("error", { scene_number: scene.scene_number, message: err?.message || String(err) });
          throw err;
        })
      );

      const results = await Promise.allSettled(tasks);
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed > 0) {
        send("error", { message: `${failed}/4 scenes failed to generate — see per-scene errors above.` });
        return res.end();
      }

      send("done", { timeline });
      res.end();
    } catch (err: any) {
      console.error("[Storyboard Pipeline] Fatal:", err);
      send("error", { message: err?.message || "Storyboard pipeline failed." });
      res.end();
    }
  });
}
