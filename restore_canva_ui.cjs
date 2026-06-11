const fs = require('fs');

const logPath = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\602887fb-828b-4a99-acce-0afe859c90d6\\.system_generated\\logs\\transcript.jsonl';

const lines = fs.readFileSync(logPath, 'utf8').split('\n');

let targetContent = null;
let replacementContent = null;

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.step_index === 324 && obj.tool_calls) {
      const tc = obj.tool_calls[0];
      if (tc && tc.args) {
        targetContent = tc.args.TargetContent;
        replacementContent = tc.args.ReplacementContent;
      }
    }
  } catch (e) {}
}

function cleanString(str) {
  if (!str) return '';
  // The value is double-escaped inside the JSON string.
  // Since it was stored as a JSON string inside the JSON args, we can parse it as a JSON string.
  // But wait, it has unescaped real newlines, so we must escape them to make it valid JSON!
  try {
    // Escape newlines and tabs to make it valid JSON before parsing
    const escaped = str
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    // Wrap in double quotes if not already
    let jsonStr = escaped;
    if (!jsonStr.startsWith('"')) jsonStr = '"' + jsonStr;
    if (!jsonStr.endsWith('"')) jsonStr = jsonStr + '"';
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("JSON parse failed, manual clean:", e.message);
    // Strip leading/trailing quote if present
    let cleaned = str;
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    return cleaned
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }
}

const cleanedReplacement = cleanString(replacementContent);
const cleanedTarget = cleanString(targetContent);

fs.writeFileSync('replacement.txt', cleanedReplacement, 'utf8');
fs.writeFileSync('target.txt', cleanedTarget, 'utf8');

console.log("Wrote replacement.txt and target.txt!");
console.log(`replacement.txt size: ${cleanedReplacement.length}`);
console.log(`target.txt size: ${cleanedTarget.length}`);
