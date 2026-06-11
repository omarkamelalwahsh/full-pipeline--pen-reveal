const fs = require('fs');

const logPath = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\602887fb-828b-4a99-acce-0afe859c90d6\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.step_index === 324) {
      console.log("Found Step 324!");
      console.log("Type:", obj.type);
      console.log("Tool calls:", JSON.stringify(obj.tool_calls, null, 2));
    }
  } catch (e) {}
}
