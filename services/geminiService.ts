/**
 * Client-side shim that calls the serverless /api/gemini endpoint.
 * This keeps API keys on the server and prevents bundling secrets.
 */
import { AiResponse, DebugInfo } from "../types";

export const getSenseiAdvice = async (
  imageBase64: string,
  activeFruits: { type: string; y: number }[],
  score: number
): Promise<AiResponse> => {
  const start = performance.now();
  const debug: DebugInfo = {
    latency: 0,
    screenshotBase64: imageBase64,
    promptContext: "",
    rawResponse: "",
    timestamp: new Date().toLocaleTimeString()
  };

  try {
    const resp = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, activeFruits, score })
    });

    const end = performance.now();
    debug.latency = Math.round(end - start);

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => null);
      console.error("/api/gemini error", resp.status, errBody);
      return {
        hint: { message: "Sensei unavailable." },
        debug: { ...debug, error: errBody }
      };
    }

    const body = await resp.json();
    debug.rawResponse = body.debugRaw ?? JSON.stringify(body.result ?? body);

    // If server returned parsed JSON result, use it; otherwise, return message with raw string
    const result = body.result ?? body;
    if (result && typeof result === "object" && result.message) {
      return { hint: { message: result.message }, debug } as unknown as AiResponse;
    }

    return { hint: { message: typeof result === "string" ? result : "No advice" }, debug } as unknown as AiResponse;
  } catch (e: any) {
    console.error("Fetch /api/gemini failed", e);
    return { hint: { message: "Sensei fetch failed." }, debug: { ...debug, error: String(e) } } as unknown as AiResponse;
  }
};
