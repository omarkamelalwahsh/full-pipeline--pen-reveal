const fs = require('fs');

const logPath = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\602887fb-828b-4a99-acce-0afe859c90d6\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    // Search in the content of MODEL steps
    if (obj.source === 'MODEL' && obj.content && obj.content.includes('activeLeftTab')) {
      console.log(`Step ${obj.step_index} content contains activeLeftTab!`);
      fs.writeFileSync(`step_${obj.step_index}_content.txt`, obj.content, 'utf8');
    }
  } catch (e) {}
}
