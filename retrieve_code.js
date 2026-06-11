const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\602887fb-828b-4a99-acce-0afe859c90d6\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.error("Log file does not exist at:", logPath);
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');
console.log(`Read ${lines.length} lines from log.`);

// Find all tool calls related to write_to_file or replace_file_content on Workspace.tsx
lines.forEach((line, index) => {
  if (!line.trim()) return;
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      obj.tool_calls.forEach(tc => {
        if (tc.name === 'write_to_file' || tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
          console.log(`Line ${index + 1} (Step ${obj.step_index}): ${tc.name} on ${tc.args.TargetFile || tc.args.TargetFile}`);
        }
      });
    }
  } catch (e) {
    // Ignore parse errors
  }
});
