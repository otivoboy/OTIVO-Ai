import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const router = express.Router();

const API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean) as string[];

export function getServerAI(userApiKey?: string) {
  if (userApiKey && typeof userApiKey === 'string' && userApiKey.trim()) {
    return new GoogleGenAI({ apiKey: userApiKey.trim() });
  }
  const key = API_KEYS[0] || process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({ apiKey: key });
}

function getFormattedDateTime() {
  return new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

function pruneFiles(files: any[], maxChars: number = 100000) {
  if (!Array.isArray(files) || files.length === 0) return '';
  let output = '';
  let currentChars = 0;
  for (const f of files) {
    if (!f || !f.path) continue;
    const isMedia = /\.(png|jpg|jpeg|gif|webp|ico|svg|mp4|mp3|pdf)$/i.test(f.path);
    let content = isMedia ? '[Binary/Media Content]' : (f.content || '');
    if (content.length > 5000) {
      content = content.substring(0, 5000) + '\n[... truncated ...]';
    }
    const entry = `File: ${f.path}\n${content}\n\n`;
    if (currentChars + entry.length < maxChars) {
      output += entry;
      currentChars += entry.length;
    }
  }
  return output ? `\n\nProject Files Context:\n${output}` : '';
}

const ASSISTANT_SYSTEM_PROMPT = () => `You are OTIVO, an intelligent AI assistant and senior technical lead.

🚀 IDENTITY PROTOCOL:
- You are OTIVO.
- If the user greets you, reply warmly and professionally before proceeding.
- Conversational starters: Start your visible response naturally (e.g. 'Alright', 'Got you', 'Here is', 'I see what you mean').
- Today's Date & Time: ${getFormattedDateTime()}
- Voice: Professional, meticulous, and helpful.
- Formatting: Use Markdown with code blocks, bullet points, and tables where appropriate.

DOCUMENT GENERATION:
- When asked to generate a document (Markdown or PDF), use this tag format:
[DOCUMENT_START:Specific Document Title|format]
Content goes here...
[DOCUMENT_END]
- Format must be either 'md' or 'pdf'.
- Inside document content, do not use excessive markdown symbols so it renders cleanly.

CODE GENERATION:
- When providing code, use markdown code blocks (\`\`\`language) with full, production-ready implementations.`;

// ── 1. Streaming Assistant Chat Route ───────────────────────────────────────────
router.post('/stream', async (req, res) => {
  const { prompt, history = [], attachment, files = [], userApiKey } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendChunk = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const ai = getServerAI(userApiKey);
    const model = 'gemini-2.5-flash';

    // Format previous turns
    const contents: any[] = [];
    const prunedHistory = Array.isArray(history) ? history.slice(-12) : [];
    for (const h of prunedHistory) {
      if (!h || !h.content) continue;
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(h.content) }]
      });
    }

    // Prepare current user turn
    const fileContext = pruneFiles(files);
    const userParts: any[] = [{ text: `${prompt || ''}${fileContext}` }];

    if (attachment && attachment.data) {
      const isMedia = attachment.type?.startsWith('image/') ||
                      attachment.type?.startsWith('video/') ||
                      attachment.type?.startsWith('audio/') ||
                      attachment.type === 'application/pdf';
      if (isMedia) {
        const rawBase64 = attachment.data.includes(',') ? attachment.data.split(',')[1] : attachment.data;
        userParts.push({
          inlineData: {
            mimeType: attachment.type,
            data: rawBase64
          }
        });
      } else {
        userParts[0].text += `\n\nAttached Document (${attachment.name || 'document'}):\n${attachment.data.substring(0, 10000)}`;
      }
    }

    contents.push({
      role: 'user',
      parts: userParts
    });

    const isDeepQuery = typeof prompt === 'string' && (
      prompt.toLowerCase().includes('think') ||
      prompt.toLowerCase().includes('reason') ||
      prompt.toLowerCase().includes('research') ||
      prompt.toLowerCase().includes('explain in detail')
    );

    const responseStream = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction: ASSISTANT_SYSTEM_PROMPT(),
        maxOutputTokens: 16384,
        tools: [{ googleSearch: {} }]
      }
    });

    let accumulatedText = '';
    let accumulatedThought = '';
    const researchSources: { title: string; link: string }[] = [];

    for await (const chunk of responseStream) {
      const text = chunk.text || '';
      const thought = (chunk as any).candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.thought || '';

      accumulatedText += text;
      accumulatedThought += thought;

      // Extract Google search grounding sources
      const meta = (chunk as any).candidates?.[0]?.groundingMetadata;
      if (meta?.groundingChunks) {
        meta.groundingChunks.forEach((c: any) => {
          if (c.web?.uri) {
            const src = { title: c.web.title || c.web.uri, link: c.web.uri };
            if (!researchSources.some(s => s.link === src.link)) {
              researchSources.push(src);
            }
          }
        });
      }

      sendChunk({
        text,
        thought,
        accumulatedText,
        accumulatedThought,
        researchSources,
        isThinking: !!thought && !text
      });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('[AI Router] Stream error:', err);
    const msg = err.message || String(err);
    sendChunk({
      error: msg,
      text: `I encountered an error processing your request: ${msg}.`,
      accumulatedText: `I encountered an error processing your request: ${msg}.`,
      isThinking: false
    });
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ── 2. Chat Title Generation Route ─────────────────────────────────────────────
router.post('/title', async (req, res) => {
  const { userPrompt = '', aiResponse = '', userApiKey } = req.body;
  try {
    const ai = getServerAI(userApiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze this conversation turn and generate a concise 3-4 word title for chat history.
User: "${String(userPrompt).slice(0, 300)}"
Assistant: "${String(aiResponse).slice(0, 300)}"
Return ONLY the title (maximum 25 characters, no punctuation or quotes):`,
      config: { maxOutputTokens: 15 }
    });
    const title = (response.text || 'New Chat').trim().replace(/["']/g, '').slice(0, 25);
    res.json({ title: title || 'New Chat' });
  } catch (err) {
    console.warn('[AI Router] Title generation fallback:', err);
    res.json({ title: userPrompt.slice(0, 20) || 'New Chat' });
  }
});

// ── 3. Intent Classification Route ─────────────────────────────────────────────
router.post('/intent', async (req, res) => {
  const { prompt = '', userApiKey } = req.body;
  const lower = prompt.trim().toLowerCase();
  if (lower.startsWith('hello') || lower.startsWith('hi') || lower === 'hey' || lower.includes('how are you')) {
    return res.json({ intent: 'CHAT' });
  }

  try {
    const ai = getServerAI(userApiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Classify the following prompt as either BUILD (requires writing code, creating/editing components, or project files) or CHAT (general conversation, question, or advice).
Prompt: "${prompt}"
Respond with ONLY "BUILD" or "CHAT".`,
      config: { maxOutputTokens: 5 }
    });
    const result = (response.text || 'CHAT').trim().toUpperCase();
    res.json({ intent: result === 'BUILD' ? 'BUILD' : 'CHAT' });
  } catch (err) {
    res.json({ intent: 'CHAT' });
  }
});

// ── 4. Structured Project Build Route ─────────────────────────────────────────
router.post('/build-chat', async (req, res) => {
  const { prompt, files = [], history = [], attachment, userApiKey } = req.body;
  try {
    const ai = getServerAI(userApiKey);
    const fileContext = pruneFiles(files, 80000);

    const contents: any[] = [];
    const prunedHistory = Array.isArray(history) ? history.slice(-6) : [];
    for (const h of prunedHistory) {
      if (!h || !h.content) continue;
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(h.content) }]
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: `Project Context:\n${fileContext}\n\nUser Request: ${prompt}` }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: `You are OTIVO AI Dev, an autonomous Principal Software Engineer.
Generate complete, production-ready code changes for the project. Every file in 'changes' must be complete without placeholder comments.
Return valid JSON matching the schema.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            projectName: { type: Type.STRING },
            changes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  path: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ['path', 'content']
              }
            },
            commands: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['message', 'changes']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    console.error('[AI Router] Build chat error:', err);
    res.status(500).json({
      message: `Failed to process build request: ${err.message || String(err)}`,
      changes: []
    });
  }
});

// ── 5. Image Generation Route ─────────────────────────────────────────────────
router.post('/image', async (req, res) => {
  const { prompt = '', userApiKey } = req.body;
  try {
    const ai = getServerAI(userApiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: '1:1'
        }
      } as any
    });

    const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (part?.inlineData?.data) {
      return res.json({ data: part.inlineData.data });
    }
    return res.status(400).json({ error: 'No image data returned from model' });
  } catch (err: any) {
    console.warn('[AI Router] Image generation warning:', err.message || err);
    res.json({
      error: 'IMAGE_MODELS_RESTRICTED',
      message: 'Image generation requires a Gemini paid-tier project key.'
    });
  }
});

export default router;
