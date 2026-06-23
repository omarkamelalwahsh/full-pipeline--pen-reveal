import { Express } from "express";
import { ai } from "../config.ts";
import { generateContentWithRetry } from "../helpers/gemini.ts";
import { escapeXml } from "../helpers/xml.ts";
import { generateFallbackStoryboardSVG } from "../helpers/svg.ts";
import { parseScriptIntoSteps } from "../helpers/scriptParser.ts";

export default function registerStoryboardImageRoute(app: Express) {
  // API Route for generating a storyboard main image via prompt and script understanding
  app.post("/api/generate-storyboard-image", async (req, res) => {
    try {
      const { text, style, bgColor, useFreeModel, sceneCount } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Missing transcription text" });
      }
      const panelCount = Math.max(1, Math.min(8, Number(sceneCount) || 5));

      console.log(`Generating visual storyboard prompt for style: ${style}...`);

      // We will first use gemini-flash-latest to expand the transcription story into a highly detailed visual whiteboard storyboard in English
      const systemPrompt = `
        You are a highly talented visual designer, comic book creator, master storyboard artist, and concept illustrator.
        Your task is to take this verbal transcription/script, extract the ${panelCount} major developments or sequential steps, and translate them into a single, cohesive, premium illustration page.
        
        ${style === 'Comic Strip' ? 'For Comic Strip style: The image MUST represent a masterpiece top-tier 2D digital anime/comic-book storyboard sheet with beautifully angled or slanting panel frames separated by clear borders (reminiscent of professional webcomics). Every panel contains exceptionally detailed, organic hand-drawn scenes with highly expressive characters showing realistic emotions (e.g., concern, shock, pride, relief), construction workers wearing high-visibility orange/yellow safety jackets and yellow hardhats, realistic scaffolding, construction cranes, gorgeous atmospheric skies, rich gradients, smooth digital cell-shading, dynamic shadow blocks, and flawless continuity of elements across frames. Add elegant white rectangular captions displaying beautifully styled handwritten-looking Arabic prose overlays at the bottom of each panel describing the action.' : `The image MUST contain exactly ${panelCount} neat, clearly separated visual panels or compartments (like a bento grid, whiteboard drawings, step-by-step illustrations) so that an automated stroke extraction algorithm can easily segment them.`}
        
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
        Start the prompt immediately without preamble or quotes, describing the overall layout first (e.g. "A premium single-page comic strip storyboard containing 5 separated panels..." or "A high-contrast single-panel composite bento grid or whiteboard containing 5 separated educational illustrations...") and detailing each of the ${panelCount} scenes or concepts neatly.
        ${style === 'Comic Strip' ? 'Ensure characters generated have exceptional physical consistency, wearing safety vests and hardhats, with stunning lighting, gradients, and beautiful Arabic calligraphy text boxes at the base of each section.' : `Maintain high-contrast isolated elements on a pure solid ${bgColor === 'black' ? 'black' : 'white'} background.`}
      `;

      let expandedPrompt = `Composite whiteboard storyboard illustrating: ${text}, flat clean vector icon style, solid ${bgColor === 'black' ? 'black' : 'white'} background, high contrast, ${panelCount} structured steps.`;
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

      // Hard constraint: the model keeps baking color codes / labels (e.g. "#FFDAB9",
      // "1 description", "paper") into the artwork. Forbid ALL text so we get a clean
      // illustration the pen can trace.
      expandedPrompt += ` ABSOLUTE RULE: Render ONLY the drawn illustration. Do NOT write or draw ANY text, words, letters, numbers, hex color codes (e.g. #FFDAB9), labels, captions, titles, legends, color swatches, panel headings, watermarks, arrows-with-text, or annotations ANYWHERE in the image. Picture only — zero typography. Draw with BOLD, thick, high-contrast solid black ink outlines (clearly visible, NOT faint thin gray lines) on a pure white background.`;

      console.log("Expanded Visual Prompt:", expandedPrompt);

      // Extract the structured scenes for this animation (count matches the grid)
      const steps = await parseScriptIntoSteps(text, panelCount);

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
}
