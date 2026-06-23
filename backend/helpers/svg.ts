import { escapeXml } from "./xml.ts";

// Helper to merge an AI-generated overlay SVG with the original uploaded background image
export function mergeSvgWithBackgroundImage(svgCode: string, originalImageBase64OrUrl: string): string {
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

// Generates high-fidelity vector storyboard SVGs dynamically to serve as a stunning, reliable fallback
export function generateFallbackStoryboardSVG(steps: Array<any>, _style: string, _bgColor: string): string {
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
