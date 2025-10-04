import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL_ID || 'gemini-2.5-flash';

// web=true => aktifkan Google Search grounding
export async function askGemini({ prompt, system, web = false }) {
  // Tool HARUS camelCase di JS: googleSearch
  const groundingTool = { googleSearch: {} };
  const config = web ? { tools: [groundingTool] } : undefined;

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,             // string OK; SDK akan bungkus ke parts
    systemInstruction: 'jawab se to-the-point mungkin, langsung ke poin inti dari pertanyaan; JANGAN ubah token mention Discord (biarkan format <@123>, <@!123>, <#123> apa adanya)' + (system ? `; ${system}` : ''),
    generationConfig: {
    maxOutputTokens: 50, // Naikkan batas token jika perlu
    temperature: 0.1,
      topP: 0.9,
      topK: 20,
  },
    config,                       // <— tools masuk ke sini
  });

  // SDK baru: response.text (bukan response.response.text())
  const text = (res?.text ?? '').trim();

  // Ambil sumber/citations kalau ada groundingMetadata
  const gm = res?.candidates?.[0]?.groundingMetadata;
  const sources = gm?.groundingChunks
    ?.map((c) => c?.web?.uri && { title: c.web?.title || c.web?.uri, url: c.web?.uri })
    ?.filter(Boolean) ?? [];

  return { text, sources, debug: { webSearchQueries: gm?.webSearchQueries } };
}

