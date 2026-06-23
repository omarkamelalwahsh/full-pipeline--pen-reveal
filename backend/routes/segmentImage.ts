import { Express } from "express";
import { Type } from "@google/genai";
import { upload } from "../middleware.ts";
import { generateContentWithRetry } from "../helpers/gemini.ts";

export default function registerSegmentImageRoute(app: Express) {
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
}
