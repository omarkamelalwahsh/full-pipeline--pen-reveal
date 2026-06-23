import { ai } from "../config.ts";

// Helper to sleep for specific milliseconds
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to call ai.models.generateContent with fallback models and retry on 503/UNAVAILABLE or 429/RESOURCE_EXHAUSTED errors
export async function generateContentWithRetry(params: Parameters<typeof ai.models.generateContent>[0], options: { maxRetries?: number; initialDelay?: number; timeoutMs?: number } = {}) {
  const maxRetries = options.maxRetries ?? 2; // Up to 2 retries per model (total 3 attempts per model)
  const initialDelay = options.initialDelay ?? 1000; // 1 second base delay
  const timeoutMs = options.timeoutMs ?? 45000; // 45 seconds default timeout to fit within Vercel's hobby limit

  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Gemini API call timed out"));
    }, timeoutMs);
  });

  const executionPromise = (async () => {
    const hasAudio = JSON.stringify(params).toLowerCase().includes("audio/");
    // Only fall back to audio-supporting models if params contains audio
    const modelFallbacks = hasAudio
      ? ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.1-pro-preview"]
      : ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.1-pro-preview"];
      
    let lastError: any = null;

    const requestedModel = params.model || "gemini-2.5-flash";
    const candidateModels = Array.from(new Set([requestedModel, ...modelFallbacks]));

    for (const model of candidateModels) {
      let currentDelay = initialDelay;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Gemini API] Querying content with model: ${model} (Attempt ${attempt + 1}/${maxRetries + 1})...`);
          const updatedParams = { ...params, model };
          const response = await ai.models.generateContent(updatedParams);
          return response;
        } catch (error: any) {
          lastError = error;
          const status = error.status || "";
          const code = error.code || error.status || "";
          const errorMessage = error.message || JSON.stringify(error) || "";
          
          const isRetryable = 
            errorMessage.includes("503") || 
            errorMessage.includes("UNAVAILABLE") || 
            errorMessage.includes("429") || 
            errorMessage.includes("RESOURCE_EXHAUSTED") ||
            status === "UNAVAILABLE" ||
            status === "RESOURCE_EXHAUSTED" ||
            code === 503 ||
            code === 429;

          if (isRetryable && attempt < maxRetries) {
            console.warn(`[Gemini API] Model ${model} returned retryable error: "${errorMessage}". Retrying in ${currentDelay}ms...`);
            await delay(currentDelay);
            currentDelay *= 2; // exponential backoff
          } else {
            console.warn(`[Gemini API] Model ${model} failed completely on attempt ${attempt + 1}: "${errorMessage}".`);
            break; // Proceed to fallback model
          }
        }
      }
    }

    throw lastError || new Error(`Failed to generate content after trying multiple candidate models: ${candidateModels.join(", ")}`);
  })();

  try {
    const result = await Promise.race([executionPromise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (err) {
    clearTimeout(timeoutId!);
    throw err;
  }
}
