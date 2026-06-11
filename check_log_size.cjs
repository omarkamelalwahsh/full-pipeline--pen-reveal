const fs = require('fs');

const logPath = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\602887fb-828b-4a99-acce-0afe859c90d6\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.step_index === 324 && obj.tool_calls) {
      const tc = obj.tool_calls[0];
      if (tc && tc.args) {
        console.log(`Step 324 TargetContent length in log: ${tc.args.TargetContent ? tc.args.TargetContent.length : 'undefined'}`);
        console.log(`Step 324 ReplacementContent length in log: ${tc.args.ReplacementContent ? tc.args.ReplacementContent.length : 'undefined'}`);
      }
    }
  } catch (e) {}
}
