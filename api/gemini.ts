/**
 * Vercel serverless function to proxy frontend requests to Google GenAI.
 * Keeps API_KEY on the server (process.env.API_KEY) so it is never bundled to the client.
 */
import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const MODEL_NAME = "gemini-3-flash-preview";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageBase64, activeFruits = [], score = 0 } = req.body ?? {};

  if (!imageBase64) {
    return res.status(400).json({ error: "Missing imageBase64" });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY missing in server environment");
    return res.status(500).json({ error: "Server misconfiguration: missing API_KEY" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const fruitContext = activeFruits.length > 0
      ? activeFruits.map((f: any) => `${f.type} at height ${Math.round(f.y)}`).join(", ")
      : "No fruits currently on screen.";

    const prompt = `
      You are Sensei Gemini, a master of the Fruit Slicing arts. 
      Analyze this game screenshot and the current state:
      - Score: ${score}
      - Active Fruits: ${fruitContext}

      FRUIT VALUES:
      - Guava: 10 pts (Common)
      - Mango: 20 pts (Standard)
      - Pineapple: 50 pts (High Value)
      - Sweet Mango: 150 pts (Legendary)

      TASK:
      Provide tactical advice to the player. 
      If there are high-value fruits like Sweet Mango or Pineapple, tell them to focus!
      If they are missing many fruits, suggest a wider slicing technique.
      Be encouraging but firm like a martial arts master.

      OUTPUT FORMAT:
      Return RAW JSON only. 
      {
        "message": "Direct Sensei instruction (e.g. 'Concentrate on the Golden Mango!')",
        "rationale": "One sentence explanation.",
        "priorityFruit": "mango|guava|pineapple|sweet_mango",
        "techniqueTip": "Short tip (e.g. 'Use long horizontal strokes')"
      }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } }
        ]
      },
      config: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    // Attempt to extract a text output from the model response
    const raw = response?.outputs?.[0]?.content?.[0]?.text ?? "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // If parsing fails, return raw for debugging
      console.warn("Could not parse model output as JSON", e);
    }

    return res.status(200).json({ result: parsed ?? raw, debugRaw: raw });
  } catch (err: any) {
    console.error("GenAI error:", err);
    return res.status(500).json({ error: "AI request failed", details: String(err) });
  }
}
