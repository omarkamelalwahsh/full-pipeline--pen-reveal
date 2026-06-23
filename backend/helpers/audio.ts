// Helper to normalize and clean audio MIME Type for Gemini compatibility
export function cleanAudioMimeType(mimeType: string, filename?: string): string {
  let clean = (mimeType || "").toLowerCase().split(";")[0].trim();
  if (!clean && filename) {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === "wav") return "audio/wav";
    if (ext === "mp3") return "audio/mp3";
    if (ext === "ogg") return "audio/ogg";
    if (ext === "webm") return "audio/webm";
    if (ext === "m4a" || ext === "mp4" || ext === "aac") return "audio/mp3";
  }

  if (clean.includes("wav")) return "audio/wav";
  if (clean.includes("mp3")) return "audio/mp3";
  if (clean.includes("mpeg") || clean.includes("mp4") || clean.includes("m4a") || clean.includes("aac")) {
    return "audio/mp3"; // Gemini natively ingests MP3/MPEG
  }
  if (clean.includes("ogg")) return "audio/ogg";
  if (clean.includes("webm")) return "audio/webm";

  return "audio/mp3"; // Default robust fallback
}

// Convert raw 16-bit Mono S16_LE PCM data to a standard WAV container buffer
export function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const buffer = Buffer.alloc(44 + pcmBuffer.length);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + pcmBuffer.length, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // Raw PCM format
  buffer.writeUInt16LE(1, 22); // Mono channel
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // 16-bit Mono byte rate (2 bytes per sample)
  buffer.writeUInt16LE(2, 32); // Block Align (2 bytes)
  buffer.writeUInt16LE(16, 34); // Bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(pcmBuffer.length, 40);
  pcmBuffer.copy(buffer, 44);
  return buffer;
}
