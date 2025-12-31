
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from "@google/genai";
import { AiResponse, DebugInfo, BubbleColor } from "../types";

const MODEL_NAME = "gemini-3-flash-preview";

export interface TargetCandidate {
    id: string;
    color: BubbleColor;
    size: number;
    row: number;
    col: number;
    pointsPerBubble: number;
    description: string;
}

export const getSenseiAdvice = async (
  imageBase64: string,
  activeFruits: { type: string; y: number }[],
  score: number
): Promise<AiResponse> => {
  const startTime = performance.now();
  const debug: DebugInfo = { latency: 0, screenshotBase64: imageBase64, promptContext: "", rawResponse: "", timestamp: new Date().toLocaleTimeString() };
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return { hint: { message: "Sensei sedang istirahat (API Key Hilang)." }, debug: { ...debug, error: "Missing API_KEY" } };
  }

  const ai = new GoogleGenAI({ apiKey });
  const fruitContext = activeFruits.length > 0 
    ? activeFruits.map(f => `${f.type} di ketinggian ${Math.round(f.y)}`).join(", ")
    : "Tidak ada buah di layar.";

  const prompt = `
    Kamu adalah Sensei Abang Colex, ahli potong buah jalanan legendaris. 
    Analisis tangkapan layar game ini:
    - Skor: ${score}
    - Buah Aktif: ${fruitContext}

    DAFTAR BUAH & NILAI:
    - Jambu Biji (Guava): 10 pts
    - Mangga Hijau (Mango): 20 pts
    - Nanas Madu (Pineapple): 50 pts
    - Mangga Masak (Sweet Mango): 150 pts

    TUGAS:
    Berikan saran taktis dengan gaya bicara "Abang Jago" yang asik tapi bijak.
    Jika ada Mangga Masak atau Nanas, suruh pemain fokus!
    Ingatkan mereka untuk HATI-HATI terhadap Botol Sambal Pedas!
    Gunakan istilah lokal Indonesia yang keren.

    OUTPUT FORMAT (RAW JSON only):
    {
      "message": "Instruksi Sensei (contoh: 'Waduh, itu Mangga Masak lewat, sikat Bang!')",
      "rationale": "Penjelasan singkat taktik.",
      "priorityFruit": "mango|guava|pineapple|sweet_mango",
      "techniqueTip": "Tips gerakan tangan (contoh: 'Potong horizontal biar kena semua')"
    }
  `;

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } }] },
      config: { temperature: 0.7, responseMimeType: "application/json" }
    });

    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    let text = response.text || "{}";
    debug.rawResponse = text;
    
    try {
        const json = JSON.parse(text);
        return { hint: { message: json.message || "Terus potong!", rationale: json.rationale, priorityFruit: json.priorityFruit, techniqueTip: json.techniqueTip }, debug };
    } catch (e: any) {
        return { hint: { message: "Fokus, Bang! Potongannya kurang tajam." }, debug: { ...debug, error: e.message } };
    }
  } catch (error: any) {
    return { hint: { message: "Sensei lagi ngopi, lanjut potong dulu!" }, debug: { ...debug, error: error.message } };
  }
};

export const getStrategicHint = async (
  imageBase64: string,
  clusters: TargetCandidate[],
  maxRow: number
): Promise<AiResponse> => {
  const startTime = performance.now();
  const debug: DebugInfo = { latency: 0, screenshotBase64: imageBase64, promptContext: "", rawResponse: "", timestamp: new Date().toLocaleTimeString() };
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { hint: { message: "API Key Missing" }, debug: { ...debug, error: "Missing Key" }};

  const ai = new GoogleGenAI({ apiKey });
  const clusterContext = clusters.length > 0 
    ? clusters.map(c => `Cluster: ${c.color} (size ${c.size}) at Row ${c.row}, Col ${c.col} [${c.description}]`).join("; ")
    : "No clear targets reachable.";

  const prompt = `
    You are the Abang Tactical AI for a Slingshot game. 
    Analyze the state:
    - Reachable Clusters: ${clusterContext}

    Recommend the best target to clear bubbles.
    Use Indonesian street slang.

    OUTPUT FORMAT (RAW JSON only):
    {
      "message": "Strategic advice",
      "rationale": "Why this target",
      "targetRow": number,
      "targetCol": number,
      "recommendedColor": "red|blue|green|yellow|purple|orange"
    }
  `;

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } }] },
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            rationale: { type: Type.STRING },
            targetRow: { type: Type.NUMBER },
            targetCol: { type: Type.NUMBER },
            recommendedColor: { type: Type.STRING }
          },
          required: ["message", "rationale", "targetRow", "targetCol", "recommendedColor"]
        }
      }
    });

    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    let text = response.text || "{}";
    debug.rawResponse = text;
    
    try {
        const json = JSON.parse(text);
        return { hint: { message: json.message || "Tembak, Bang!", rationale: json.rationale, targetRow: json.targetRow, targetCol: json.targetCol, recommendedColor: json.recommendedColor as BubbleColor }, debug };
    } catch (e: any) {
        return { hint: { message: "Sistem taktik lagi hang, tembak asal aja dulu!" }, debug: { ...debug, error: e.message } };
    }
  } catch (error: any) {
    return { hint: { message: "Koneksi taktik putus!" }, debug: { ...debug, error: error.message } };
  }
};
