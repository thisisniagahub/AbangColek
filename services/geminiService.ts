
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from "@google/genai";
import { AiResponse, DebugInfo, BubbleColor } from "../types";

const MODEL_NAME = "gemini-3-flash-preview";

// Exporting TargetCandidate for Slingshot game as expected by GeminiSlingshot component
export interface TargetCandidate {
    id: string;
    color: BubbleColor;
    size: number;
    row: number;
    col: number;
    pointsPerBubble: number;
    description: string;
}

// Fix: Use new GoogleGenAI instance inside each function call for dynamic API key access
export const getSenseiAdvice = async (
  imageBase64: string,
  activeFruits: { type: string; y: number }[],
  score: number
): Promise<AiResponse> => {
  const startTime = performance.now();
  
  const debug: DebugInfo = {
    latency: 0,
    screenshotBase64: imageBase64,
    promptContext: "",
    rawResponse: "",
    timestamp: new Date().toLocaleTimeString()
  };

  // Use process.env.API_KEY as per Google GenAI SDK guidelines
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.error("API Key missing. Please set API_KEY in your environment variables.");
    return {
        hint: { message: "Sensei lost connection (Missing API Key)." },
        debug: { ...debug, error: "Missing API_KEY" }
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const fruitContext = activeFruits.length > 0 
    ? activeFruits.map(f => `${f.type} at height ${Math.round(f.y)}`).join(", ")
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

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
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

    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    let text = response.text || "{}";
    debug.rawResponse = text;
    
    try {
        const json = JSON.parse(text);
        debug.parsedResponse = json;
        return {
            hint: {
                message: json.message || "Keep slicing!",
                rationale: json.rationale,
                priorityFruit: json.priorityFruit,
                techniqueTip: json.techniqueTip
            },
            debug
        };
    } catch (e: any) {
        return {
            hint: { message: "Your technique is evolving. Stay focused." },
            debug: { ...debug, error: e.message }
        };
    }
  } catch (error: any) {
    return {
        hint: { message: "Sensei is observing your spirit." },
        debug: { ...debug, error: error.message }
    };
  }
};

/**
 * Tactical analysis for the Slingshot game.
 * Recommends the best target based on on-screen clusters and screenshot.
 */
export const getStrategicHint = async (
  imageBase64: string,
  clusters: TargetCandidate[],
  maxRow: number
): Promise<AiResponse> => {
  const startTime = performance.now();
  
  const debug: DebugInfo = {
    latency: 0,
    screenshotBase64: imageBase64,
    promptContext: "",
    rawResponse: "",
    timestamp: new Date().toLocaleTimeString()
  };

  const apiKey = process.env.API_KEY;
  if (!apiKey) return { hint: { message: "API Key Missing" }, debug: { ...debug, error: "Missing Key" }};

  const ai = new GoogleGenAI({ apiKey });

  const clusterContext = clusters.length > 0 
    ? clusters.map(c => `Cluster: ${c.color} (size ${c.size}) at Row ${c.row}, Col ${c.col} [${c.description}]`).join("; ")
    : "No clear targets reachable.";

  const prompt = `
    You are the Gemini Tactical AI for a Bubble Slingshot game. 
    Analyze the game screenshot and identified clusters:
    - Current Bottom Row of Bubbles: ${maxRow}
    - Reachable Clusters: ${clusterContext}

    GOAL:
    Recommend the best target to clear the most bubbles or high-value colors.
    If multiple clusters are available, prioritize larger clusters or those higher up.
    If the bubbles are getting too low (maxRow > 10), warn the player.

    OUTPUT FORMAT:
    Return RAW JSON only. 
    {
      "message": "Strategic advice (e.g. 'Aim for the large purple cluster on the left!')",
      "rationale": "Why this target is optimal.",
      "targetRow": number,
      "targetCol": number,
      "recommendedColor": "red|blue|green|yellow|purple|orange"
    }
  `;

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } }
        ]
      },
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
        debug.parsedResponse = json;
        return {
            hint: {
                message: json.message || "Ready for next shot.",
                rationale: json.rationale,
                targetRow: json.targetRow,
                targetCol: json.targetCol,
                recommendedColor: json.recommendedColor as BubbleColor
            },
            debug
        };
    } catch (e: any) {
        return {
            hint: { message: "Strategy engine encountered a calculation error." },
            debug: { ...debug, error: e.message }
        };
    }
  } catch (error: any) {
    return {
        hint: { message: "Tactical link interrupted." },
        debug: { ...debug, error: error.message }
    };
  }
};
