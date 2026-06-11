const fs = require('fs');

const logPath = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\602887fb-828b-4a99-acce-0afe859c90d6\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      obj.tool_calls.forEach((tc, idx) => {
        if (tc.name === 'replace_file_content' && tc.args.TargetFile.includes('Workspace.tsx')) {
          console.log(`Step ${obj.step_index} idx ${idx} Replace L${tc.args.StartLine}-${tc.args.EndLine}`);
          console.log(`  TargetContent length: ${tc.args.TargetContent ? tc.args.TargetContent.length : 0}`);
          console.log(`  ReplacementContent length: ${tc.args.ReplacementContent ? tc.args.ReplacementContent.length : 0}`);
        }
      });
    }
  } catch (e) {}
}
