import { Express } from "express";
import { upload } from "../middleware.ts";
import { generateContentWithRetry } from "../helpers/gemini.ts";
import { SyncElement, Word } from "../types.ts";

export default function registerSyncElementsRoute(app: Express) {
  // API Route for Auto-Syncing OCR elements to Transcription
  app.post("/api/sync-elements", upload.single("image"), async (req, res) => {
    const { data } = req.body || {};
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
}
