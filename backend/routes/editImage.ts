import { Express } from "express";
import { Type } from "@google/genai";
import { ai } from "../config.ts";
import { generateContentWithRetry } from "../helpers/gemini.ts";
import { escapeXml } from "../helpers/xml.ts";
import { mergeSvgWithBackgroundImage, generateFallbackStoryboardSVG } from "../helpers/svg.ts";
import { StoryboardStep } from "../types.ts";

export default function registerEditImageRoute(app: Express) {
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
}
