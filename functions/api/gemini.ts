
import { GoogleGenAI, Type } from "@google/genai";
import type { PagesFunction } from '../types';

interface Env {
  API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { prompt } = await context.request.json() as { prompt: string };
    const apiKey = context.env?.API_KEY || (typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY || process.env?.API_KEY) : '');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Gemini API Key not configured." }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // 使用官方标准的 gemini-3.8-flash 获得敏捷极速的棋力推理
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash', 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bestMoveIndex: { type: Type.INTEGER },
            reasoning: { type: Type.STRING }
          },
          required: ["bestMoveIndex"]
        }
      }
    });

    return new Response(JSON.stringify({ text: response.text }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "AI Service Error" }), { status: 500 });
  }
}
