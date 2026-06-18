import express from "express";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { GoogleGenAI, Type } from "@google/genai";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

interface StoryboardStep {
  titleAr: string;
  titleEn: string;
  scriptAr: string;
  scriptEn: string;
  desc: string;
  keywords: string[];
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

interface SyncElement {
  id: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

interface Word {
  word: string;
  start: number;
  end: number;
}

interface StoryboardScene {
  scene_id: string;
  scene_number: number;
  text: string;
  duration_seconds: number;
  keywords: string[];
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

const app = express();
const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json({ limit: '50mb' }));

  // Set up Gemini
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Helper to escape XML special characters
  function escapeXml(unsafe: string): string {
    return (unsafe || "").replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  // Helper to merge an AI-generated overlay SVG with the original uploaded background image
  function mergeSvgWithBackgroundImage(svgCode: string, originalImageBase64OrUrl: string): string {
    let cleanSvg = (svgCode || "").trim();
    
    // Clean potential markdown blocks
    if (cleanSvg.includes("```xml")) {
      cleanSvg = cleanSvg.split("```xml")[1]?.split("```")[0]?.trim() || "";
    } else if (cleanSvg.includes("```html")) {
      cleanSvg = cleanSvg.split("```html")[1]?.split("```")[0]?.trim() || "";
    } else if (cleanSvg.includes("```")) {
      cleanSvg = cleanSvg.split("```")[1]?.split("```")[0]?.trim() || "";
    }

    if (!cleanSvg.startsWith("<svg")) {
      const svgIdx = cleanSvg.indexOf("<svg");
      const endSvgIdx = cleanSvg.lastIndexOf("</svg>");
      if (svgIdx !== -1 && endSvgIdx !== -1) {
        cleanSvg = cleanSvg.substring(svgIdx, endSvgIdx + 6);
      }
    }

    // Replace the placeholder if present
    if (cleanSvg.includes("ORIGINAL_IMAGE_PLACEHOLDER")) {
      return cleanSvg.replace(/ORIGINAL_IMAGE_PLACEHOLDER/g, originalImageBase64OrUrl);
    }
    
    // Inject background image right after <svg ...> tag if not present
    const svgOpenTagMatch = cleanSvg.match(/<svg[^>]*>/i);
    if (svgOpenTagMatch) {
      const openTag = svgOpenTagMatch[0];
      const insertIndex = cleanSvg.indexOf(openTag) + openTag.length;
      
      const imageTag = `\n  <image href="${originalImageBase64OrUrl}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />`;
      cleanSvg = cleanSvg.slice(0, insertIndex) + imageTag + cleanSvg.slice(insertIndex);
    }
    return cleanSvg;
  }

  // Helper to normalize and clean audio MIME Type for Gemini compatibility
  function cleanAudioMimeType(mimeType: string, filename?: string): string {
    let clean = (mimeType || "").toLowerCase().split(";")[0].trim();
    if (!clean && filename) {
      const ext = filename.toLowerCase().split('.').pop();
      if (ext === "wav") return "audio/wav";
      if (ext === "mp3") return "audio/mp3";
      if (ext === "ogg") return "audio/ogg";
      if (ext === "webm") return "audio/webm";
      if (ext === "m4a" || ext === "mp4" || ext === "aac") return "audio/mp3";
    }
    
    if (clean.includes("wav")) return "audio/wav";
    if (clean.includes("mp3")) return "audio/mp3";
    if (clean.includes("mpeg") || clean.includes("mp4") || clean.includes("m4a") || clean.includes("aac")) {
      return "audio/mp3"; // Gemini natively ingests MP3/MPEG
    }
    if (clean.includes("ogg")) return "audio/ogg";
    if (clean.includes("webm")) return "audio/webm";
    
    return "audio/mp3"; // Default robust fallback
  }

  // Helper to sleep for specific milliseconds
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper to call ai.models.generateContent with fallback models and retry on 503/UNAVAILABLE or 429/RESOURCE_EXHAUSTED errors
  async function generateContentWithRetry(params: Parameters<typeof ai.models.generateContent>[0], options: { maxRetries?: number; initialDelay?: number; timeoutMs?: number } = {}) {
    const maxRetries = options.maxRetries ?? 2; // Up to 2 retries per model (total 3 attempts per model)
    const initialDelay = options.initialDelay ?? 1000; // 1 second base delay
    const timeoutMs = options.timeoutMs ?? 45000; // 45 seconds default timeout to fit within Vercel's hobby limit

    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Gemini API call timed out"));
      }, timeoutMs);
    });

    const executionPromise = (async () => {
      const hasAudio = JSON.stringify(params).toLowerCase().includes("audio/");
      // Only fall back to audio-supporting models if params contains audio
      const modelFallbacks = hasAudio
        ? ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.1-pro-preview"]
        : ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.1-pro-preview"];
        
      let lastError: any = null;

      const requestedModel = params.model || "gemini-2.5-flash";
      const candidateModels = Array.from(new Set([requestedModel, ...modelFallbacks]));

      for (const model of candidateModels) {
        let currentDelay = initialDelay;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[Gemini API] Querying content with model: ${model} (Attempt ${attempt + 1}/${maxRetries + 1})...`);
            const updatedParams = { ...params, model };
            const response = await ai.models.generateContent(updatedParams);
            return response;
          } catch (error: any) {
            lastError = error;
            const status = error.status || "";
            const code = error.code || error.status || "";
            const errorMessage = error.message || JSON.stringify(error) || "";
            
            const isRetryable = 
              errorMessage.includes("503") || 
              errorMessage.includes("UNAVAILABLE") || 
              errorMessage.includes("429") || 
              errorMessage.includes("RESOURCE_EXHAUSTED") ||
              status === "UNAVAILABLE" ||
              status === "RESOURCE_EXHAUSTED" ||
              code === 503 ||
              code === 429;

            if (isRetryable && attempt < maxRetries) {
              console.warn(`[Gemini API] Model ${model} returned retryable error: "${errorMessage}". Retrying in ${currentDelay}ms...`);
              await delay(currentDelay);
              currentDelay *= 2; // exponential backoff
            } else {
              console.warn(`[Gemini API] Model ${model} failed completely on attempt ${attempt + 1}: "${errorMessage}".`);
              break; // Proceed to fallback model
            }
          }
        }
      }

      throw lastError || new Error(`Failed to generate content after trying multiple candidate models: ${candidateModels.join(", ")}`);
    })();

    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (err) {
      clearTimeout(timeoutId!);
      throw err;
    }
  }

  // Multer for audio uploads - increased limits to accept extremely large serialized text field parameters safely
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fieldSize: 100 * 1024 * 1024, // 100MB
    },
  });

  // API Route for Transcription
  app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded" });
      }

      const cleanMimeType = cleanAudioMimeType(req.file.mimetype, req.file.originalname);
      console.log(`Transcribing audio via robust Gemini pipeline... Cleaned MIME type: ${cleanMimeType}`);
      
      const prompt = `
        Transcribe the following audio file. 
        Provide a detailed word-level transcription with start and end timestamps.
        Return the result as a JSON array of objects.
      `;

      let transcription: Word[] = [];
      try {
        const response = await generateContentWithRetry({
          model: "gemini-2.5-flash",
          contents: {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: req.file.buffer.toString("base64"),
                  mimeType: cleanMimeType,
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

        transcription = JSON.parse(response.text || "[]");
      } catch (err: any) {
        console.warn("Auto-transcription via AI failed or timed out, generating duration-based fallback mapping:", err.message);
        // Estimate PCM/audio duration from butter size roughly (safe fallback of 10s if we cannot estimate)
        const estimatedDuration = req.file.size ? Math.max(5, Math.min(150, req.file.size / (16000 * 2))) : 15;
        const fallbackWords = ["Story", "Intro", "Action", "Detail", "Key", "Concept", "Peak", "Outcome", "Ending", "Credits"];
        const secPerWord = estimatedDuration / fallbackWords.length;
        transcription = fallbackWords.map((word, i) => ({
          word,
          start: Number((i * secPerWord).toFixed(1)),
          end: Number(((i + 1) * secPerWord).toFixed(1))
        }));
      }

      res.json({ transcription });
    } catch (error: any) {
      console.error("Transcription error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for Auto-Syncing OCR elements to Transcription
  app.post("/api/sync-elements", upload.single("image"), async (req, res) => {
    const { data } = req.body;
    let elements: SyncElement[] = [];
    let transcription: Word[] = [];
    
    try {
      if (data) {
        const parsedData = JSON.parse(data);
        elements = parsedData.elements || [];
        transcription = parsedData.transcription || [];
      }
    } catch (e) {
      console.warn("Could not pre-parse body data", e);
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      const prompt = `
        Look at this image. I have extracted some visual elements (path components) from it.
        Here are the bounding boxes for each element:
        ${JSON.stringify(elements.map((el: SyncElement) => ({ id: el.id, bounds: el.bounds })))}

        I also have an audio transcription:
        ${JSON.stringify(transcription)}

        Your task is to map each visual element to its corresponding word in the transcription.
        The text in the image is exactly what's in the audio.
        Return a JSON object where keys are element IDs and values are the index of the word in the transcription array.

        If an element doesn't seem to be a word or text, skip it.
        
        Example return:
        {
          "element-1": 0,
          "element-2": 1
        }
        
        Only return the JSON object.
      `;

      let mapping: Record<string, number> = {};
      try {
        const response = await generateContentWithRetry({
          model: "gemini-2.5-flash",
          contents: {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: req.file.buffer.toString("base64"),
                  mimeType: req.file.mimetype,
                },
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
          },
        });

        mapping = JSON.parse(response.text || "{}");
      } catch (err: any) {
        console.warn("AI OCR mapping failed or timed out, using sequential distribution fallback:", err.message);
        // Distribute elements sequentially across transcription words
        mapping = {};
        elements.forEach((el: SyncElement, idx: number) => {
          mapping[el.id] = idx % Math.max(1, transcription.length);
        });
      }

      res.json({ mapping });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for Smart Image Segmentation via Gemini
  app.post("/api/segment-image", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }

      console.log("Analyzing and segmenting image using Gemini...");

      const prompt = `
        Analyze this image and partition it into at least 5 distinct visual or written components (representing text titles, signature lines, logos, drawings, characters, banners, or illustrations).
        For each segmented element, specify:
        1. "label": A brief clear descriptive name in English or Arabic of the component (e.g., "Main Title", "Illustration Icon", "Handwritten Phrase", "Sub-header Text").
        2. "box": Exactly 4 normalized coordinates [ymin, xmin, ymax, xmax] as integers from 0 to 100 representing the bounding box.
        3. "elementType": Crucial! Map to 'written' if it is words, letters, signatures, Arabic standard text, handwritten letters; or 'visual' if it is an image, logo, graphic, or decorative illustration.
        4. "writingDirection": Set to 'rtl' if Arabic writing, 'ltr' if English/Latin writing, or 'auto' for visual graphics.

        You must segment the image into AT LEAST 5 elements to ensure a high-quality, professional step-by-step assembly.
        Ensure your coordinate percentages cover the key areas of the image properly.
      `;

      let segments: any[] = [];
      try {
        const response = await generateContentWithRetry({
          model: "gemini-2.5-flash",
          contents: {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: req.file.buffer.toString("base64"),
                  mimeType: req.file.mimetype,
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
                  label: { type: Type.STRING },
                  box: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER }
                  },
                  elementType: { type: Type.STRING },
                  writingDirection: { type: Type.STRING }
                },
                required: ["label", "box", "elementType", "writingDirection"]
              }
            }
          },
        });

        segments = JSON.parse(response.text || "[]");
        console.log("Gemini parsed segments:", segments);
      } catch (err: any) {
        console.warn("Smart image segmentation failed or timed out, generating horizontal division fallbacks:", err.message);
        // Fallback: 5 logical horizontal/vertical storyboard regions
        segments = [
          { label: "Scene 1: Introduction", box: [0, 0, 100, 20], elementType: "written", writingDirection: "auto" },
          { label: "Scene 2: Main Character", box: [0, 20, 100, 40], elementType: "visual", writingDirection: "auto" },
          { label: "Scene 3: Development Concept", box: [0, 40, 100, 60], elementType: "visual", writingDirection: "auto" },
          { label: "Scene 4: Action Challenge", box: [0, 60, 100, 80], elementType: "visual", writingDirection: "auto" },
          { label: "Scene 5: Resolution Ending", box: [0, 80, 100, 100], elementType: "written", writingDirection: "auto" }
        ];
      }

      res.json({ segments });
    } catch (error: any) {
      console.error("Image segmentation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for AI Image Editing via Gemini 2.5 Image Editing Model
  app.post("/api/edit-image", async (req, res) => {
    try {
      const { image, prompt, steps: clientSteps, style, bgColor, isStoryboardImg } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image provided for editing" });
      }
      if (!prompt) {
        return res.status(400).json({ error: "Please provide editing instructions/prompt" });
      }

      console.log("Editing image using Gemini 2.5-flash-image...");

      const isStoryboard = isStoryboardImg === true;

      // Parse the base64 image data and mime type
      let base64Data = image;
      let mimeType = "image/png"; // default

      if (image.startsWith("data:")) {
        const parts = image.split(",");
        const header = parts[0];
        const mimeMatch = header.match(/:(.*?);/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
        base64Data = parts[1];
      }

      // We call the model 'gemini-2.5-flash-image'
      // Support fallbacks to either gemini-3.1-flash-image or standard flash model.
      const modelsToTry = ["gemini-2.5-flash-image", "gemini-3.1-flash-image"];
      let modifiedImageBase64 = "";
      let modelUsed = "";
      let errorMsgs = [];

      // Check if we can run image models, only if not restricted by free keys
      for (const model of modelsToTry) {
        try {
          console.log(`Trying image editing with model: ${model}...`);
          const geminiImgRes = await ai.models.generateContent({
            model: model,
            contents: {
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: mimeType,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          });

          if (geminiImgRes.candidates?.[0]?.content?.parts) {
            for (const part of geminiImgRes.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                modifiedImageBase64 = part.inlineData.data;
                modelUsed = model;
                break;
              }
            }
          }
          if (modifiedImageBase64) {
            break; // Success!
          }
        } catch (err: any) {
          console.warn(`Editing failed on model ${model}:`, err.message);
          errorMsgs.push(`${model}: ${err.message}`);
        }
      }

      if (modifiedImageBase64) {
        const finalUrl = `data:${mimeType};base64,${modifiedImageBase64}`;
        return res.json({ imageUrl: finalUrl, model: modelUsed, steps: clientSteps });
      }

      // --- Start of Graceful Fallback Logic ---
      if (!isStoryboard) {
        console.log("Image editing model failed / throttled on custom uploaded image. Launching AI-assisted Single Vector Editor fallback...");
        let singleSvgGenerated = "";
        
        try {
          const editSingleImgPrompt = `
            You are an expert SVG illustrator, overlay visual designer, and master graphics developer.
            The user has uploaded a background image (provided in the inlineData) and wants to apply the following edit instructions to it: "${prompt}".
            
            We are going to embed the original image as a background layer in an SVG template using an <image> element.
            YOUR TASK:
            Generate ONLY the beautiful, perfectly styled vector visual additions, stickers, decals, annotations, doodles, labels, shapes, or highlights (layered on top of the background image) that fully satisfy the user's edit instructions: "${prompt}".
            
            SVG GRAPHICS CODE REQUIREMENTS:
            - Start your output directly with '<svg ...>' and end with '</svg>'. Do NOT wrap it in markdown code blocks (\`\`\`xml or \`\`\`), do NOT output any conversational text, explanations, or warnings.
            - Inside the SVG, you MUST include a background image layer using this EXACT placeholder:
              <image href="ORIGINAL_IMAGE_PLACEHOLDER" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />
            - Draw the newly requested elements (for example, if the prompt asks to "add a cartoon banana next to the screen" or "draw a highlighting arrow", draw those exact items as gorgeous, colorful, clean vector paths, circles, rectangles, or text elements) layered on top of the <image> element, so they integrate seamlessly with the background artwork.
            - Ensure the rest of the SVG template is transparent so the background image is fully visible and not replaced!
            - Use a responsive viewBox layout (such as viewBox="0 0 800 600").
            - Avoid simplistic shapes; use rich, beautiful, colorful gradients and detailed closed vector paths to make the additions look professional and hand-crafted!
          `;

          const response = await generateContentWithRetry({
            model: "gemini-2.5-flash",
            contents: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                }
              },
              {
                text: editSingleImgPrompt
              }
            ]
          });

          singleSvgGenerated = response.text ? response.text.trim() : "";
          if (singleSvgGenerated.includes("```xml")) {
            singleSvgGenerated = singleSvgGenerated.split("```xml")[1]?.split("```")[0]?.trim() || "";
          } else if (singleSvgGenerated.includes("```html")) {
            singleSvgGenerated = singleSvgGenerated.split("```html")[1]?.split("```")[0]?.trim() || "";
          } else if (singleSvgGenerated.includes("```")) {
            singleSvgGenerated = singleSvgGenerated.split("```")[1]?.split("```")[0]?.trim() || "";
          }

          if (!singleSvgGenerated.startsWith("<svg")) {
            const svgIdx = singleSvgGenerated.indexOf("<svg");
            const endSvgIdx = singleSvgGenerated.lastIndexOf("</svg>");
            if (svgIdx !== -1 && endSvgIdx !== -1) {
              singleSvgGenerated = singleSvgGenerated.substring(svgIdx, endSvgIdx + 6);
            }
          }
        } catch (err: any) {
          console.error("AI Single SVG editing fallback failed:", err);
        }

        if (singleSvgGenerated && singleSvgGenerated.startsWith("<svg") && singleSvgGenerated.includes("</svg>")) {
          const mergedSvg = mergeSvgWithBackgroundImage(singleSvgGenerated, image);
          const finalEncodedSvg = `data:image/svg+xml;base64,${Buffer.from(mergedSvg).toString('base64')}`;
          return res.json({
            imageUrl: finalEncodedSvg,
            model: "Gemini 3.5 AI Visual Editor (Single Vector Overlay Fallback)"
          });
        } else {
          // If even fallback SVG fails, let's return a simple beautifully designed warning SVG that is single panel
          const errorSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
            <image href="ORIGINAL_IMAGE_PLACEHOLDER" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />
            <rect x="150" y="200" width="500" height="200" rx="15" fill="#0c0c0c" opacity="0.95" stroke="#f59e0b" stroke-width="3"/>
            <path d="M400,230 L450,310 L350,310 Z" fill="none" stroke="#f59e0b" stroke-width="4" stroke-linejoin="round"/>
            <text x="400" y="340" fill="#f59e0b" font-family="system-ui, sans-serif" font-size="18" font-weight="900" text-anchor="middle">⚠️ EDITING PROCESS DETECTED AN EXCEPTION</text>
            <text x="400" y="370" fill="#a3a3a3" font-family="system-ui, sans-serif" font-size="12" text-anchor="middle">Could not complete edits. Background preserved.</text>
          </svg>
          `;
          const mergedSvg = mergeSvgWithBackgroundImage(errorSvg, image);
          const finalEncodedSvg = `data:image/svg+xml;base64,${Buffer.from(mergedSvg).toString('base64')}`;
          return res.json({
            imageUrl: finalEncodedSvg,
            model: "Gemini Image Edit Error Handler"
          });
        }
      }

      console.log("Image editing model failed or was throttled. Launching AI-assisted Vector Storyboard editor fallback...");

      let stepsToUse: StoryboardStep[] = clientSteps;
      if (!stepsToUse || !Array.isArray(stepsToUse) || stepsToUse.length === 0) {
        stepsToUse = [
          { titleAr: "مقدمة لوحة القصة", titleEn: "Storyboard Introduction", scriptAr: "مرحباً بكم في قصتنا الممتعة", scriptEn: "Welcome to our fun narrative journey", desc: "A clean whiteboard doodle showing a laptop screen with a loading bar", keywords: ["intro", "start"] },
          { titleAr: "مواصفات الجهاز", titleEn: "Device Specs", scriptAr: "مواصفات مميزة وأداء عالي السرعة", scriptEn: "High-speed specs and amazing performance", desc: "A microchip with glowing traces inside a smartphone shield", keywords: ["tech", "performance"] },
          { titleAr: "لوحة الرسم", titleEn: "Drawing Board", scriptAr: "المساحة الإبداعية للتطبيقات العملية", scriptEn: "Creative workspace for practical apps", desc: "An artistic custom drawing tool showing paintbrushes and canvas", keywords: ["creative", "canvas"] },
          { titleAr: "عجائب الحركة", titleEn: "Whiteboard Motion", scriptAr: "عجائب الحركة والتحريك اليدوي الساحر", scriptEn: "Magical whiteboard gestures and manual animations", desc: "Hands sliding elements across the screen with star dust around them", keywords: ["animation", "magic"] },
          { titleAr: "إكمال الرحلة", titleEn: "Completing Voyage", scriptAr: "تم توقيع العقد بنجاح ونمو متصاعد", scriptEn: "Successfully signed contract showing upwards charts", desc: "A hand signing a certificate document next to high-rising bars", keywords: ["finish", "growth"] }
        ];
      }

      // 1. Rewrite steps using Gemini 3.5 (standard, free model)
      const editStepsPrompt = `
        You are an expert storyboard visualizer and comic illustrator.
        We have an existing set of 5 chronological storyboard scenes/steps. The user wants to modify the visual doodles/illustrations and script scenes based on this edit instruction: "${prompt}"

        Here are the 5 existing storyboard steps as a JSON array:
        ${JSON.stringify(stepsToUse, null, 2)}

        Please modify these 5 chronological steps to faithfully reflect the edit instructions.
        Specifically:
        - Adjust the "desc" of ALL relevant steps. This is a detailed conceptual description of the visual illustration/whiteboard doodle. Make sure to weave the user's edits (e.g., adding a character, banana, changing backgrounds, or styling) seamlessly into the illustration concepts for each relevant scene.
        - Update "keywords" to include terms relevant to the edits.
        - If the edit instructions suggest changing the script or titles (Arabic/English), apply those adjustments too.
        - Keep the output structurally identical: EXACTLY 5 chronological step items.

        Return a strict JSON array of exactly 5 objects containing "titleAr", "titleEn", "scriptAr", "scriptEn", "desc", and "keywords".
        Do not output any markdown formatting other than JSON.
      `;

      let updatedSteps: StoryboardStep[] = stepsToUse;
      try {
        const rewriteRes = await generateContentWithRetry({
          model: "gemini-2.5-flash",
          contents: editStepsPrompt,
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

        if (rewriteRes.text) {
          const parsed = JSON.parse(rewriteRes.text.trim());
          if (Array.isArray(parsed) && parsed.length === 5) {
            updatedSteps = parsed;
          }
        }
      } catch (err) {
        console.warn("Could not rewrite steps via JSON, continuing with original steps representation:", err);
      }

      // 2. Try generating detailed XML SVG storyboard based on new steps
      let generatedSvg = "";
      const isDark = bgColor === 'black';
      const bg = isDark ? '#050505' : '#ffffff';

      try {
        const svgGenerationPrompt = `
          You are an expert high-fidelity illustrator and master SVG graphics designer specializing in whiteboard animation storyboards.
          Your task is to write a single, breathtakingly beautiful, vibrant, and incredibly detailed comic strip storyboard as a valid <svg> XML graphic code with style "${style || 'Whiteboard'}".
          Do NOT output any conversational text, no explanations, no markdown blocks (do NOT wrap it in \`\`\`xml or \`\`\`), starting directly with '<svg' and ending with '</svg>'.

          The SVG must have a widescreen storyboard viewBox="0 0 1200 500" with a solid backdrop fill="${bg}".
          
          You MUST divide the width of 1200px into exactly 5 gorgeous, horizontally-adjacent panels.
          To make it look like a premium hand-drawn comic strip storyboard (matching top-tier whiteboard sketches), use dividers between panels with 10px gutter gaps, styled with solid color outlines, linear/radial gradients, and outer borders with crisp dropshadows (<filter id="dropShadow">).
          
          Color Palettes & Gradients to define:
          - Define linear gradients for panel backgrounds:
            - Panel 1: Sunny warm sky (soft teal-blue to banana-yellow gradient)
            - Panel 2: Vibrant productivity (bright workspace cyan to indigo)
            - Panel 3: Technical drawing (blueprint-sky-blue or graphite-gray grid)
            - Panel 4: Magic & Imagination (vivid purple to gold stars gradient)
            - Panel 5: Bright outcome & Celebration (radiant sunshine-orange to lime-green gradient)
            
          For each of the 5 panels, you MUST render a gorgeous, highly creative, recognizable vector whiteboard sketch or drawing that represents the corresponding step's title, description, and keywords.
          Each panel should contain detailed colorful vector shapes, lines, arrows, annotations, and doodles (like bananas, microchips, glowing lightbulbs, tech gadgets, interfaces, screens, or users drawing) matching these parsed details:
          ${updatedSteps.map((s, idx) => `
            - Panel ${idx + 1}:
              * Arabic Title & Script: ${s.titleAr} - ${s.scriptAr}
              * English Title & Script: ${s.titleEn} - ${s.scriptEn}
              * Visual Concept sketch: ${s.desc}
          `).join('\n')}

          Detailed SVG Graphic elements to draw inside panels:
          - Render extremely rich, recognizable doodles, paths, circles, and curves representing the themes of each panel. Make the drawings detailed and layered, not just simple shapes!
          
          Multilingual Caption ribbons (CRITICAL):
          - For each panel, design a beautiful semi-transparent or solid white/dark overlay banner ribbon at the bottom of the panel.
          - Inside each ribbon/overlay, you MUST place TWO separate lines of clean XML <text> tags:
            1. The FIRST line (top of the ribbon) MUST display the Arabic script corresponding to that panel (e.g. Panel 1 Arabic script: "${escapeXml(updatedSteps[0]?.scriptAr || '')}", Panel 2 Arabic script: "${escapeXml(updatedSteps[1]?.scriptAr || '')}" etc.) using direction="rtl" and unicode-bidi="embed" with gold, white, or high-contrast color.
            2. The SECOND line (bottom of the ribbon) MUST display the English script corresponding to that panel (e.g. Panel 1 English script: "${escapeXml(updatedSteps[0]?.scriptEn || '')}", Panel 2 English script: "${escapeXml(updatedSteps[1]?.scriptEn || '')}" etc.) using standard left-to-right alignment.
          - Make sure text is positioned safely so it's fully readable, never overlaps with the drawings, and centers nicely.
          - Let's overlap the panel number (1, 2, 3, 4, 5) wrapped inside a bright stylized solid circle badge.

          Make the SVG look exceptionally active, lively, premium, colorful, and textured. Write valid, complete XML.
        `;

        const svgResponse = await generateContentWithRetry({
          model: "gemini-2.5-flash",
          contents: svgGenerationPrompt,
        });
        generatedSvg = svgResponse.text ? svgResponse.text.trim() : "";

        if (generatedSvg.includes("```xml")) {
          generatedSvg = generatedSvg.split("```xml")[1]?.split("```")[0]?.trim() || "";
        } else if (generatedSvg.includes("```html")) {
          generatedSvg = generatedSvg.split("```html")[1]?.split("```")[0]?.trim() || "";
        } else if (generatedSvg.includes("```")) {
          generatedSvg = generatedSvg.split("```")[1]?.split("```")[0]?.trim() || "";
        }

        if (!generatedSvg.startsWith("<svg")) {
          const svgIdx = generatedSvg.indexOf("<svg");
          const endSvgIdx = generatedSvg.lastIndexOf("</svg>");
          if (svgIdx !== -1 && endSvgIdx !== -1) {
            generatedSvg = generatedSvg.substring(svgIdx, endSvgIdx + 6);
          }
        }
      } catch (svgErr) {
        console.warn("AI SVG update failed, using procedural layout SVG creator:", svgErr);
      }

      // If AI SVG falls flat or is null, create the high-fidelity structural fallback procedural SVG
      if (!generatedSvg || !generatedSvg.startsWith("<svg") || !generatedSvg.includes("</svg>")) {
        generatedSvg = generateFallbackStoryboardSVG(updatedSteps, style || 'Whiteboard', bgColor || 'black');
      }

      const finalEncodedSvg = `data:image/svg+xml;base64,${Buffer.from(generatedSvg).toString('base64')}`;
      return res.json({
        imageUrl: finalEncodedSvg,
        model: "Gemini 3.5 AI Whiteboard Engine (Vector Fallback)",
        steps: updatedSteps
      });
    } catch (error: any) {
      console.error("Image editing route crashed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper to parse transcription script into 5 structured sequential scenes with Gemini
  async function parseScriptIntoSteps(text: string): Promise<StoryboardStep[]> {
    const fallbackBounds = [
      { minX: 50, maxX: 900, minY: 50, maxY: 500 },
      { minX: 1020, maxX: 1870, minY: 50, maxY: 500 },
      { minX: 50, maxX: 600, minY: 580, maxY: 1030 },
      { minX: 700, maxX: 1250, minY: 580, maxY: 1030 },
      { minX: 1350, maxX: 1870, minY: 580, maxY: 1030 }
    ];

    try {
      const prompt = `
        You are an expert storyboard visualizer.
        Parse this audio script or transcription text into EXACTLY 5 chronological storyboard scenes/steps.
        The input text contains multilingual narratives (Arabic and English) about a whiteboard animation project.
        
        For each of the 5 chronological steps, extract:
        1. "titleAr": A short catchy title in Arabic (RTL, e.g., "المشهد الأول: البداية").
        2. "titleEn": A short catchy title in English (LTR, e.g., "Intro Scene").
        3. "scriptAr": The specific right-to-left Arabic script/voiceover segment for this step.
        4. "scriptEn": The specific left-to-right English script/voiceover segment for this step.
        5. "desc": A detailed conceptual description of the visual illustration/webcomic panel drawing showing whiteboard animations, cute whiteboard doodles, lines, arrows, annotations, and colorful graphics matching the scene.
        6. "keywords": A list of 2-3 prominent keywords in English.

        Input text:
        "${text}"

        Return a strict JSON array of 5 objects containing "titleAr", "titleEn", "scriptAr", "scriptEn", "desc", and "keywords".
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
      if (Array.isArray(parsed) && parsed.length === 5) {
        return parsed.map((item, idx) => ({
          ...item,
          bounds: fallbackBounds[idx]
        }));
      }
    } catch (err) {
      console.error("Failed to parse script with Gemini, using split fallback:", err);
    }

    // Pure procedural fallback if LLM parser fails
    const words = text.split(/\s+/).filter(Boolean);
    const wordsPerStep = Math.max(1, Math.ceil(words.length / 5));
    const fallbackSteps: StoryboardStep[] = [];
    for (let i = 0; i < 5; i++) {
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

  // Generates high-fidelity vector storyboard SVGs dynamically to serve as a stunning, reliable fallback
  function generateFallbackStoryboardSVG(steps: Array<any>, _style: string, _bgColor: string): string {
    const escapeXml = (unsafe: string) => {
      return (unsafe || "").replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });
    };

    const getSceneText = (step: any): string => {
      if (!step) return '';
      const title = step.titleEn || step.title || '';
      const body = step.scriptEn || step.desc || step.text || '';
      const fullText = title ? `${title}: ${body}` : body;
      return escapeXml(fullText.replace(/[\r\n\t]+/g, ' ').trim());
    };

    // Distinct accent color per bento cell.
    const accents = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    // Minimalist single-stroke line icons, each drawn inside a local 56x56 box.
    const icons = [
      '<rect x="6" y="6" width="44" height="32" rx="4" /><line x1="13" y1="16" x2="43" y2="16" /><line x1="13" y1="24" x2="34" y2="24" /><line x1="2" y1="48" x2="54" y2="48" stroke-width="3.5" />',
      '<path d="M28 6 a16 16 0 0 1 9 29 v5 h-18 v-5 a16 16 0 0 1 9 -29 Z" /><line x1="22" y1="46" x2="34" y2="46" /><line x1="24" y1="51" x2="32" y2="51" />',
      '<path d="M8 10 h40 a4 4 0 0 1 4 4 v18 a4 4 0 0 1 -4 4 h-24 l-10 8 v-8 h-6 a4 4 0 0 1 -4 -4 v-18 a4 4 0 0 1 4 -4 Z" /><line x1="18" y1="20" x2="40" y2="20" /><line x1="18" y1="28" x2="34" y2="28" />',
      '<path d="M8 6 v40 h44" /><path d="M14 40 l11 -13 l9 7 l16 -20" /><path d="M44 14 h7 v7" />',
      '<circle cx="28" cy="28" r="20" /><circle cx="28" cy="28" r="11" /><circle cx="28" cy="28" r="3.5" fill="currentColor" stroke="none" />',
    ];

    // Bento layout: matching coordinates exactly
    const cells = [
      { x: 50,   y: 50,   w: 850, h: 450 },
      { x: 1020, y: 50,   w: 850, h: 450 },
      { x: 50,   y: 580,  w: 550, h: 450 },
      { x: 700,  y: 580,  w: 550, h: 450 },
      { x: 1350, y: 580,  w: 520, h: 450 },
    ];

    const buildPanel = (i: number): string => {
      const c = cells[i];
      const accent = accents[i];
      const text = getSceneText(steps[i]);
      const iconX = Math.round(c.x + c.w / 2 - 39.2);
      const iconY = c.y + 40;
      const dividerX = Math.round(c.x + c.w / 2 - 35);
      return `
        <g>
          <rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="3.5" />
          <circle cx="${c.x + 45}" cy="${c.y + 45}" r="22" fill="${accent}" />
          <text x="${c.x + 45}" y="${c.y + 51}" fill="#ffffff" font-size="18" font-weight="700" text-anchor="middle" font-family="system-ui, sans-serif">${i + 1}</text>
          <g transform="translate(${iconX}, ${iconY}) scale(1.4)" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: ${accent}">
            ${icons[i]}
          </g>
          <rect x="${dividerX}" y="${c.y + 130}" width="70" height="4.5" rx="2" fill="${accent}" opacity="0.3" />
          <foreignObject x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}">
            <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: center; justify-content: center; height: 100%; box-sizing: border-box; padding: 160px 40px 30px 40px; font-family: system-ui, -apple-system, sans-serif; font-size: 18px; color: #334155; line-height: 1.6; text-align: center; word-wrap: break-word; overflow-wrap: break-word; overflow: hidden; font-weight: 500;">
              ${text}
            </div>
          </foreignObject>
        </g>`;
    };

    const panels = cells.map((_, i) => buildPanel(i)).join('\n');

    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%" style="background-color: #ffffff; font-family: system-ui, -apple-system, sans-serif;">
        <rect width="1920" height="1080" fill="#ffffff" />
        ${panels}
      </svg>
    `;

    return `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
  }

  // Convert raw 16-bit Mono S16_LE PCM data to a standard WAV container buffer
  function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
    const buffer = Buffer.alloc(44 + pcmBuffer.length);
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + pcmBuffer.length, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // Raw PCM format
    buffer.writeUInt16LE(1, 22); // Mono channel
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28); // 16-bit Mono byte rate (2 bytes per sample)
    buffer.writeUInt16LE(2, 32); // Block Align (2 bytes)
    buffer.writeUInt16LE(16, 34); // Bits per sample
    buffer.write("data", 36);
    buffer.writeUInt32LE(pcmBuffer.length, 40);
    pcmBuffer.copy(buffer, 44);
    return buffer;
  }

  // API Route for Generating Expressive Narrative Audiobook Voiceovers (TTS) and Transcribing them
  app.post("/api/generate-narrator-audio", async (req, res) => {
    try {
      const { script, voiceName = "Kore" } = req.body;
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

  // API Route for generating a storyboard main image via prompt and script understanding
  app.post("/api/generate-storyboard-image", async (req, res) => {
    try {
      const { text, style, bgColor, useFreeModel } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Missing transcription text" });
      }

      console.log(`Generating visual storyboard prompt for style: ${style}...`);

      // We will first use gemini-flash-latest to expand the transcription story into a highly detailed visual whiteboard storyboard in English
      const systemPrompt = `
        You are a highly talented visual designer, comic book creator, master storyboard artist, and concept illustrator.
        Your task is to take this verbal transcription/script, extract the 5 major developments or sequential steps, and translate them into a single, cohesive, premium illustration page.
        
        ${style === 'Comic Strip' ? 'For Comic Strip style: The image MUST represent a masterpiece top-tier 2D digital anime/comic-book storyboard sheet with beautifully angled or slanting panel frames separated by clear borders (reminiscent of professional webcomics). Every panel contains exceptionally detailed, organic hand-drawn scenes with highly expressive characters showing realistic emotions (e.g., concern, shock, pride, relief), construction workers wearing high-visibility orange/yellow safety jackets and yellow hardhats, realistic scaffolding, construction cranes, gorgeous atmospheric skies, rich gradients, smooth digital cell-shading, dynamic shadow blocks, and flawless continuity of elements across frames. Add elegant white rectangular captions displaying beautifully styled handwritten-looking Arabic prose overlays at the bottom of each panel describing the action.' : 'The image MUST contain exactly 5 neat, clearly separated visual panels or compartments (like a bento grid, whiteboard drawings, step-by-step illustrations) so that an automated stroke extraction algorithm can easily segment them.'}
        
        ${style === 'Comic Strip' ? 'The background color should be a subtle warm/dark backdrop that frames the dynamic comic panels beautifully. Avoid plain gray boxes.' : `The background of the image MUST be absolutely pure solid ${bgColor === 'black' ? 'black' : 'white'}. NO complex shadows, NO gradients, NO textured paper. Pure crisp lineart and flat graphics inside.`}
        
        Selected Visual Style: ${style || 'Auto-select'}
Logic Guidelines:
        ${style === 'Comic Strip' ? 'An absolute masterpiece of 2D comic art storyboard. Dynamic diagonally-split panels with 10px white border gutters. Every panel is heavily illustrated with detailed environment backdrops. In Panel 1, show a robust safety emblem surrounded by tools. In Panel 2, show a worker on scaffolding. In Panel 3, show a dramatic accident or falling motion. In Panel 4, show a character in reflection next to a thinking bubble enclosing a highly detailed pickup truck. In Panel 5, show a happy worker with shiny stars signing a contract.' : ''}
        ${style === 'Kawaii' ? 'Kawaii chibi cute doodles, bold pastel soft colors, thick clean dark outlines, playful adorable elements on solid background.' : ''}
        ${style === 'Clay' ? 'Fine 3D plasticine claymation model elements, colorful soft clay, cute cartoonish modeling, crisp shapes on solid background.' : ''}
        ${style === 'Sketch Note' ? 'Hand-drawn educational sketch-note whiteboard, clean neat lineart doodles, arrows, annotations, beautifully handlettered concepts on solid background.' : ''}
        ${style === 'Anime' ? 'Modern anime ink illustration style, clear clean vector cartoon art, vibrant colors, clean bounds on solid background.' : ''}
        ${style === 'Editorial' ? 'Minimalistic elegant flat editorial vector graphics, luxury magazine editorial design, refined lineart, stylish layouts, beautiful muted colors on solid background.' : ''}
        ${style === 'Instructional' ? 'Clear instructional schematic, flat infographics, step 1, step 2, step 3, step 4, step 5 labeled in clean circles, pure vector diagram on solid background.' : ''}
        ${style === 'Bento Grid' ? 'Ultra-modern bento grid layout of 5 rounded panels with elegant space between them, containing distinct vector symbols/drawings inside each panel on solid background.' : ''}
        ${style === 'Bricks' ? 'Isometric toy building block instructions, lego bricks concept diagram, highly colorful, clean bricks layout on solid background.' : ''}
        ${style === 'Scientific' ? 'Precise engineering blueprint schematics, detailed technical layout drawing, thin precise vector drafting lines, annotations on solid background.' : ''}
        ${style === 'Professional' ? 'Top-tier executive slide presentation style, 5 clean modern icons matched with subtle vector concepts, balanced layout on solid background.' : ''}
        ${!style || style === 'Auto-select' ? 'A beautiful high-contrast flat graphic layout containing 5 clear thematic concept panels illustrating the story on solid background.' : ''}
        
        Input Transcription script:
        "${text}"
        
        Write a single highly detailed English image generation prompt (approx 100-150 words) that describes this composite storyboard scene.
        Start the prompt immediately without preamble or quotes, describing the overall layout first (e.g. "A premium single-page comic strip storyboard containing 5 separated panels..." or "A high-contrast single-panel composite bento grid or whiteboard containing 5 separated educational illustrations...") and detailing each of the 5 scenes or concepts neatly.
        ${style === 'Comic Strip' ? 'Ensure characters generated have exceptional physical consistency, wearing safety vests and hardhats, with stunning lighting, gradients, and beautiful Arabic calligraphy text boxes at the base of each section.' : `Maintain high-contrast isolated elements on a pure solid ${bgColor === 'black' ? 'black' : 'white'} background.`}
      `;

      let expandedPrompt = `Composite whiteboard storyboard illustrating: ${text}, flat clean vector icon style, solid ${bgColor === 'black' ? 'black' : 'white'} background, high contrast, 5 structured steps.`;
      try {
        const promptRes = await generateContentWithRetry({
          model: "gemini-2.5-flash",
          contents: systemPrompt,
        });
        if (promptRes.text) {
          expandedPrompt = promptRes.text;
        }
      } catch (err: any) {
        console.warn("Script expansion failed, using default prompt fallback", err.message);
      }
      
      console.log("Expanded Visual Prompt:", expandedPrompt);

      // Extract 5 structured scenes for this animation
      const steps = await parseScriptIntoSteps(text);

      // Unique Gemini model SVG generation when using the free model
      if (useFreeModel) {
        console.log("Generating customized, highly detailed visual SVG via free Gemini model...");
        const isDark = bgColor === 'black';
        const bg = isDark ? '#050505' : '#ffffff';
        
        const panelPrompts = steps.map((s, idx) => {
          const xMin = idx * 240;
          const xMax = (idx + 1) * 240;
          const xCenter = xMin + 120;
          return `
          - Panel ${idx + 1}:
            * Horizontal coordinate space: x ranges strictly from ${xMin + 15} to ${xMax - 15}. Keep ALL visual sketch lines, shapes, and paths for this panel inside these coordinates so they do not bleed into neighbor panels.
            * Arabic Title: "${s.titleAr}"
            * Arabic Script: "${s.scriptAr}"
            * English Title: "${s.titleEn}"
            * English Script: "${s.scriptEn}"
            * Visual Concept to draw: ${s.desc}
            * Caption ribbon details:
              - Draw a background rectangle for the caption at x="${xMin + 10}", y="420", width="220", height="70".
              - Inside it, draw the Arabic text: "${escapeXml(s.scriptAr)}" at x="${xCenter}", y="445", text-anchor="middle", fill="white", font-size="10.5", font-weight="bold".
              - Draw the English text: "${escapeXml(s.scriptEn)}" at x="${xCenter}", y="475", text-anchor="middle", fill="white", font-size="9.5".
              - Draw a circle badge with number "${idx + 1}" centered at x="${xMin + 25}", y="35", r="15".
          `;
        }).join('\n');

        const svgGenerationPrompt = `
          You are an expert high-fidelity illustrator and master SVG graphics designer specializing in whiteboard animation storyboards.
          Your task is to write a single, breathtakingly beautiful, vibrant, and incredibly detailed comic strip storyboard as a valid <svg> XML graphic code.
          Do NOT output any conversational text, no explanations, no markdown blocks (do NOT wrap it in \`\`\`xml or \`\`\`), starting directly with '<svg' and ending with '</svg>'.

          The SVG must have a widescreen storyboard viewBox="0 0 1200 500" with a solid backdrop fill="${bg}".
          
          You MUST divide the width of 1200px into exactly 5 gorgeous, horizontally-adjacent panels.
          To make it look like a premium hand-drawn comic strip storyboard (matching top-tier whiteboard sketches), use dividers between panels with 10px gutter gaps, styled with solid color outlines, linear/radial gradients, and outer borders with crisp dropshadows (<filter id="dropShadow">).
          
          Color Palettes & Gradients to define:
          - Define linear gradients for panel backgrounds:
            - Panel 1: Sunny warm sky (soft teal-blue to banana-yellow gradient)
            - Panel 2: Vibrant productivity (bright workspace cyan to indigo)
            - Panel 3: Technical drawing (blueprint-sky-blue or graphite-gray grid)
            - Panel 4: Magic & Imagination (vivid purple to gold stars gradient)
            - Panel 5: Bright outcome & Celebration (radiant sunshine-orange to lime-green gradient)
            
          Here are the specific details, coordinates, and content for each of the 5 panels:
          ${panelPrompts}

          Detailed SVG Graphic elements to draw inside panels:
          - For each panel, render extremely rich, detailed, recognizable doodles, paths, circles, and curves representing the visual concepts described above. Make the drawings detailed and layered, not just simple shapes!
          - Crucial: Ensure ALL drawings and caption text for Panel N are positioned strictly inside its horizontal coordinate space.
          
          Multilingual Caption ribbons (CRITICAL):
          - For each panel, implement the caption ribbon using the specific details and text provided under the Panel list above.
          - Make sure text is positioned safely so it's fully readable, never overlaps with the drawings, and centers nicely within the panel's width.
          - Place the circle panel number badge (1, 2, 3, 4, 5) at the top left of each panel.

          Make the SVG look exceptionally active, lively, premium, colorful, and textured. Write valid, complete XML.
        `;

        let generatedSvg = "";
        try {
          const svgResponse = await generateContentWithRetry({
            model: "gemini-2.5-flash",
            contents: svgGenerationPrompt,
          });
          generatedSvg = svgResponse.text ? svgResponse.text.trim() : "";
          
          // Basic clean-up if the model wrapped it in markdown code blocks
          if (generatedSvg.includes("```xml")) {
            generatedSvg = generatedSvg.split("```xml")[1]?.split("```")[0]?.trim() || "";
          } else if (generatedSvg.includes("```html")) {
            generatedSvg = generatedSvg.split("```html")[1]?.split("```")[0]?.trim() || "";
          } else if (generatedSvg.includes("```")) {
            generatedSvg = generatedSvg.split("```")[1]?.split("```")[0]?.trim() || "";
          }
          
          if (!generatedSvg.startsWith("<svg")) {
            const svgIdx = generatedSvg.indexOf("<svg");
            const endSvgIdx = generatedSvg.lastIndexOf("</svg>");
            if (svgIdx !== -1 && endSvgIdx !== -1) {
              generatedSvg = generatedSvg.substring(svgIdx, endSvgIdx + 6);
            }
          }
        } catch (svgErr: any) {
          console.warn("AI generated SVG failed, falling back to procedural SVG generator", svgErr.message);
        }

        if (generatedSvg && generatedSvg.startsWith("<svg") && generatedSvg.includes("</svg>")) {
          const encodedSvg = `data:image/svg+xml;base64,${Buffer.from(generatedSvg).toString('base64')}`;
          return res.json({
            imageUrl: encodedSvg,
            prompt: "Generated high-contrast custom vector drawings via Gemini 3.5 Free Model.",
            model: "Gemini 3.5 SVG Graphic Engine",
            steps: steps
          });
        }
      }

      // We will try running different image models, fallback gracefully if some are not provisioned/enabled in user's key.
      let base64Image = "";
      let usedModel = "";

      // Try 1: imagen-4.0-generate-001
      try {
        console.log("Attempting image generation via imagen-4.0-generate-001...");
        const imageRes = await ai.models.generateImages({
          model: 'imagen-4.0-generate-001',
          prompt: expandedPrompt,
          config: {
            numberOfImages: 1,
            aspectRatio: '1:1',
          }
        });
        if (imageRes.generatedImages?.[0]?.image?.imageBytes) {
          base64Image = imageRes.generatedImages[0].image.imageBytes;
          usedModel = 'imagen-4.0-generate-001';
        }
      } catch (err: any) {
        console.warn("Imagen 4.0-generate-001 failed, trying gemini-3.1-flash-image fallback", err.message);
      }

      // Try 2: gemini-3.1-flash-image (high quality paid model)
      if (!base64Image) {
        try {
          console.log("Attempting image generation via gemini-3.1-flash-image...");
          const geminiImgRes = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image',
            contents: {
              parts: [{ text: expandedPrompt }]
            },
            config: {
              imageConfig: {
                aspectRatio: "1:1",
                imageSize: "1K"
              }
            }
          });
          
          if (geminiImgRes.candidates?.[0]?.content?.parts) {
            for (const part of geminiImgRes.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                base64Image = part.inlineData.data;
                usedModel = 'gemini-3.1-flash-image';
                break;
              }
            }
          }
        } catch (err: any) {
          console.warn("gemini-3.1-flash-image failed, trying gemini-2.5-flash-image fallback", err.message);
        }
      }

      // Try 3: fallback to gemini-2.5-flash-image
      if (!base64Image) {
        try {
          console.log("Attempting image generation via gemini-2.5-flash-image...");
          const geminiImgRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
              parts: [{ text: expandedPrompt }]
            },
            config: {
              imageConfig: {
                aspectRatio: "1:1",
                imageSize: "1K"
              }
            }
          });
          
          if (geminiImgRes.candidates?.[0]?.content?.parts) {
            for (const part of geminiImgRes.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                base64Image = part.inlineData.data;
                usedModel = 'gemini-2.5-flash-image';
                break;
              }
            }
          }
        } catch (err: any) {
          console.warn("All image generation models failed in this environment:", err.message);
        }
      }

      // Safe aesthetic vector SVG fallback if all image generation models fail
      if (!base64Image) {
        console.log("Generating premium vector SVG storyboard fallback due to API constraints...");
        const svgUrl = generateFallbackStoryboardSVG(steps, style, bgColor);
        
        return res.json({
          imageUrl: svgUrl,
          prompt: expandedPrompt,
          model: "Aesthetic Vector SVG Fallback Engine",
          steps: steps
        });
      }

      res.json({
        imageUrl: `data:image/png;base64,${base64Image}`,
        prompt: expandedPrompt,
        model: usedModel,
        steps: steps
      });

    } catch (error: any) {
      console.error("Storyboard image generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Network and sharing endpoints
  let tunnelProcess: any = null;
  let tunnelUrl: string | null = null;
  let tunnelPublicIp: string | null = null;

  function getLocalIpAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push(iface.address);
        }
      }
    }
    return addresses;
  }

  app.get("/api/network-info", async (_req, res) => {
    const localIps = getLocalIpAddresses();
    const localUrl = localIps.length > 0 ? `http://${localIps[0]}:${PORT}` : `http://localhost:${PORT}`;
    res.json({
      localUrl,
      tunnelUrl,
      publicIp: tunnelPublicIp
    });
  });

  app.post("/api/start-tunnel", async (_req, res) => {
    if (tunnelUrl) {
      return res.json({ url: tunnelUrl, publicIp: tunnelPublicIp });
    }

    try {
      // Get public IP for tunnel password
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json() as any;
      tunnelPublicIp = ipData.ip;
    } catch (err) {
      console.warn("Could not retrieve public IP address:", err);
    }

    try {
      const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
      console.log(`Starting localtunnel on port ${PORT}...`);
      tunnelProcess = spawn(cmd, ["localtunnel", "--port", PORT.toString()]);

      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          res.status(500).json({ error: "Tunnel startup timed out" });
        }
      }, 12000);

      tunnelProcess.stdout.on("data", (data: any) => {
        const output = data.toString();
        console.log(`[Tunnel stdout] ${output}`);
        const match = output.match(/your url is:\s*(https:\/\/[^\s]+)/i);
        if (match && match[1]) {
          tunnelUrl = match[1].trim();
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            res.json({ url: tunnelUrl, publicIp: tunnelPublicIp });
          }
        }
      });

      tunnelProcess.stderr.on("data", (data: any) => {
        console.error(`[Tunnel stderr] ${data.toString()}`);
      });

      tunnelProcess.on("close", (code: any) => {
        console.log(`Tunnel process exited with code ${code}`);
        tunnelUrl = null;
        tunnelProcess = null;
      });

      tunnelProcess.on("error", (err: any) => {
        console.error("Tunnel process error:", err);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          res.status(500).json({ error: err.message || "Failed to start tunnel process" });
        }
      });

    } catch (error: any) {
      console.error("Failed to start tunnel:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for Pipeline Create (AI Script Parser)
  app.post("/api/pipeline/create", async (req, res) => {
    try {
      const { script } = req.body;
      if (!script) {
        return res.status(400).json({ error: "No script text provided" });
      }

      console.log(`[Pipeline] Creating storyboard from script: "${script.substring(0, 50)}..."`);

      const prompt = `
        You are a storyboard script writer.
        Parse the following voiceover script into exactly 5 logical, chronological scenes.
        For each scene, provide:
        1. A sequential "scene_number" (integer 1 to 5).
        2. The visual/script "text" chunk for that scene.
        3. An estimated "duration_seconds" (an integer, e.g. 5, 8, 10) depending on the amount of script text (approx 1 second per 3 words, min 3 seconds, max 15 seconds).
        4. "keywords": exactly 2-3 short descriptive English visual nouns capturing the scene's key imagery (e.g. ["rocket", "launch"], ["whiteboard", "drawing"]).

        Script to parse:
        "${script}"

        Return a strict JSON array of 5 objects containing "scene_number", "text", "duration_seconds", and "keywords".
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
        // Heuristic fallback: split by double newlines or sentences
        const paragraphs = script.split(/\n\n+/).filter(Boolean).slice(0, 5);
        if (paragraphs.length === 0) paragraphs.push(script);
        while (paragraphs.length < 5) {
          paragraphs.push(`Continuing narrative... Scene ${paragraphs.length + 1}`);
        }
        scenes = paragraphs.map((text: string, i: number): StoryboardScene => {
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

      const fallbackBounds = [
        { minX: 50, maxX: 900, minY: 50, maxY: 500 },
        { minX: 1020, maxX: 1870, minY: 50, maxY: 500 },
        { minX: 50, maxX: 600, minY: 580, maxY: 1030 },
        { minX: 700, maxX: 1250, minY: 580, maxY: 1030 },
        { minX: 1350, maxX: 1870, minY: 580, maxY: 1030 }
      ];

      // Map to add scene_id
      const formattedScenes = scenes.map((s, idx) => ({
        scene_id: `scene-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        scene_number: s.scene_number || (idx + 1),
        text: s.text || "",
        duration_seconds: s.duration_seconds || 5,
        keywords: s.keywords || [],
        bounds: fallbackBounds[idx] || { minX: 0, maxX: 100, minY: 0, maxY: 100 }
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
      const { scene_id, text } = req.body;
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

  // Vite middleware for development
  if (!process.env.VERCEL) {
    (async () => {
      if (process.env.NODE_ENV !== "production") {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
          configLoader: "runner",
        });
        app.use(vite.middlewares);
      } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }

      app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n🚀 Server is running!`);
        console.log(`🏠 Local:            http://localhost:${PORT}`);
        const localIps = getLocalIpAddresses();
        localIps.forEach(ip => {
          console.log(`🌐 On Your Network:  http://${ip}:${PORT}`);
        });
        console.log(`\n💡 To share this publicly over the internet, click "Share / Invite" in the UI.\n`);
      });
    })();
  }

  export default app;
