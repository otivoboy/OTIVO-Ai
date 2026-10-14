import { GoogleGenAI, Type, GenerateContentResponse, ThinkingLevel, FunctionDeclaration } from "@google/genai";
import { AIFileChange, ProjectFile as ProjectFileFromTypes, Attachment } from "../types";

const API_KEYS = [
  process.env?.GEMINI_API_KEY,
  process.env?.GEMINI_API_KEY_1,
  process.env?.GEMINI_API_KEY_2,
  process.env?.GEMINI_API_KEY_3,
  process.env?.GEMINI_API_KEY_4,
  process.env?.GEMINI_API_KEY_5,
  (import.meta as any).env?.VITE_GEMINI_API_KEY,
  (import.meta as any).env?.VITE_GEMINI_API_KEY_1,
  (import.meta as any).env?.VITE_GEMINI_API_KEY_2,
  (import.meta as any).env?.VITE_GEMINI_API_KEY_3,
  (import.meta as any).env?.VITE_GEMINI_API_KEY_4,
  (import.meta as any).env?.VITE_GEMINI_API_KEY_5,
  typeof window !== 'undefined' ? localStorage.getItem('VITE_GEMINI_API_KEY') : null,
].filter(Boolean) as string[];

export function setRuntimeApiKey(key: string) {
  if (key && !API_KEYS.includes(key)) {
    API_KEYS.push(key);
    localStorage.setItem('VITE_GEMINI_API_KEY', key);
    console.log("[OTIVO] Runtime API key added and saved to localStorage.");
  }
}

if (API_KEYS.length === 0) {
  console.warn("[OTIVO] No Gemini API keys found in environment variables. AI features will fail.");
} else {
  console.log(`[OTIVO] Initialized with ${API_KEYS.length} Gemini API keys.`);
}

let currentKeyIndex = 0;
let lastSuccessIndex = 0;
const keyCooldowns = new Map<number, number>();

export function getAI() {
  // Start from last success index if current index is in cooldown
  if (keyCooldowns.has(currentKeyIndex) && Date.now() < (keyCooldowns.get(currentKeyIndex) || 0)) {
    // Try to find a non-cooldown key
    for (let i = 0; i < API_KEYS.length; i++) {
      const nextIdx = (lastSuccessIndex + i) % API_KEYS.length;
      if (!keyCooldowns.has(nextIdx) || Date.now() > (keyCooldowns.get(nextIdx) || 0)) {
        currentKeyIndex = nextIdx;
        break;
      }
    }
  }
  
  const key = API_KEYS[currentKeyIndex] || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey: key });
}

export function rotateKey(isPermanent = false) {
  if (API_KEYS.length > 1) {
    const oldIndex = currentKeyIndex;
    
    // Mark old key as cool down (60 seconds for 429s)
    if (isPermanent) {
      keyCooldowns.set(oldIndex, Date.now() + 60000);
    }

    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    console.log(`[OTIVO] API Key index ${oldIndex} marked for ${isPermanent ? 'cooldown' : 'rotation'}. Switching to key index ${currentKeyIndex}...`);
  }
}

export function markKeySuccess() {
  lastSuccessIndex = currentKeyIndex;
  keyCooldowns.delete(currentKeyIndex);
}

export function getCurrentKeyIndex() {
  return currentKeyIndex;
}

export async function callWithRetry<T>(
  fn: (ai: GoogleGenAI, isFallback: boolean) => Promise<T>, 
  retries = API_KEYS.length * 3,
  attempt = 0
): Promise<T> {
  const isFallback = attempt >= API_KEYS.length;
  
  try {
    const result = await fn(getAI(), isFallback);
    markKeySuccess();
    return result;
  } catch (error: any) {
    const msg = error.message || String(error);
    const isRateLimit = msg.includes('429') || error.status === 429 || msg.includes('RESOURCE_EXHAUSTED');
    const isQuota = msg.includes('quota') || msg.includes('limit');
    const isPermissionError = msg.includes('403') || error.status === 403 || msg.includes('PERMISSION_DENIED');
    const isNetworkError = msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch');

    console.warn(`[OTIVO] Attempt ${attempt + 1} failed for key index ${currentKeyIndex}. Reason: ${msg.substring(0, 100)}...`);
    
    if (retries > 0) {
      const isNetworkError = msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('Aborted');
      const shouldCooldown = isRateLimit || isQuota || isPermissionError;

      if (shouldCooldown) {
        rotateKey(true);
        
        // Check if ALL keys are in cooldown
        const allInCooldown = API_KEYS.every((_, i) => {
          const cd = keyCooldowns.get(i);
          return cd && Date.now() < cd;
        });
        
        if (allInCooldown && API_KEYS.length > 0) {
          let minWait = Infinity;
          keyCooldowns.forEach((cooldownUntil) => {
            const remaining = cooldownUntil - Date.now();
            if (remaining > 0 && remaining < minWait) minWait = remaining;
          });
          const waitTime = Math.min(minWait + 500, 15000);
          console.log(`[OTIVO] All ${API_KEYS.length} keys in cooldown. Waiting ${Math.round(waitTime / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } else if (isNetworkError) {
        // Wait longer for network errors with exponential backoff
        const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(r => setTimeout(r, backoff));
        if (attempt % 2 === 0) rotateKey(false);
      } else {
        rotateKey(false);
      }

      return callWithRetry(fn, retries - 1, attempt + 1);
    }
    throw error;
  }
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
    timeZoneName: 'short'
  });
}

/**
 * Intelligent Chat Title Generation (Multimodal)
 * Tasked with extracting the core intent and action from the initial conversation exchange.
 * Supports Multimodal Intent Analysis for images, code, and documents.
 */
export async function generateChatTitle(userPrompt: string, aiResponse: string, attachment?: Attachment): Promise<string> {
  try {
    return await callWithRetry(async (ai) => {
      let content: any[] = [];
      
      // Multimodal Analysis: Add attachment if present
      if (attachment) {
        content.push({
          inlineData: {
            data: attachment.data,
            mimeType: attachment.type
          }
        });
      }

      const promptText = `
        You are an expert UX micro-copywriter performing Multimodal Intent Analysis. 
        Analyze the conversation turn (and any attached file) to generate a concise, high-signal title (3–5 words maximum) for the chat history sidebar.
        
        RULES:
        - Identify the primary subject: If it's a code error, mention debugging. If it's a floor plan, mention layout.
        - OCR Priority: If the image has text/math, prioritize the text content.
        - Metadata Hints: Use the filename "${attachment?.name || 'N/A'}" as a hint unless it's generic (like 'WhatsApp Image').
        - Format: No greetings, pleasantries, filler words, or punctuation.
        - Maximum 25 characters.
        
        USER PROMPT: "${userPrompt.slice(0, 500)}"
        AI RESPONSE: "${aiResponse.slice(0, 500)}"
        
        Generate a title that captures the macro objective.
        Title:`;

      content.push(promptText);

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: content as any,
        config: {
          temperature: 0.5,
          maxOutputTokens: 20,
        }
      });
      const title = (response.text || "").trim().replace(/["']/g, '');
      
      // Sanitization: Truncate and strip unwanted chars
      return title.slice(0, 25).replace(/[.#]$/, '');
    });
  } catch (error) {
    console.warn("[OTIVO] Title generation failed, using fallback.", error);
    if (attachment) return "File: " + (attachment.name.slice(0, 15));
    return userPrompt.slice(0, 20) + "...";
  }
}



const SYSTEM_PROMPT = (dateTime: string) => `You are OTIVO AI DEV (PRO LEVEL), an autonomous "Principal Software Engineer" and "Visual Architect."
Your mission is to build complete, world-class, production-ready full-stack applications with absolute precision.

🚀 IDENTITY PROTOCOL:
- You are OTIVO.
- CRITICAL: DO NOT introduce yourself, DO NOT say "Hello!", "Hi!", or "I am OTIVO".
- CRITICAL: DO NOT mention who created you. 
- DO NOT summarize your instructions.
- Go straight to the request.
- Today's Date & Time: ${dateTime}
- Current Year: 2026. All copyrights and design standards must reflect this.
- Voice: Professional, meticulous, and autonomous.

🧠 1. CORE BRAIN (AI ENGINE):
- Understand user intent at a deep level. Break projects into logical modules (e.g., Auth, Dashboard, API).
- Live Information: You MUST use the 'google_search' tool to fetch current documentation, latest library versions, and live industry data before finalizing a 'blueprint' or implementation plan.
- Automatically choose the best tech stack (React/Vite, Next.js, Express, etc.) based on the request.
- Generate full project structures. NEVER generate "one-file" apps unless specifically asked for a small snippet.
- PRODUCTION FIDELITY: Every file must be complete and ready for deployment. NEVER use "..." or "// ... rest of code" placeholders.

🏗️ 2. OTIVO BRAND IDENTITY & ASSET ENGINE:
- IDENTITY: You are "OTIVO AI DEV", a visionary Principal Software Engineer.
- VISUAL IDENTITY: Emerald green highlights, deep space black (#0A0B0E) backgrounds.
- LOGO DESCRIPTION: A futuristic, minimal AI logo featuring a sharp-edged hexagonal shell. Inside the hexagon is a bold, vertically elongated 'O'. Geometric and high-tech.
- LOGO USAGE: When generating UI, always place the logo (src="/logo.png") in navbars.
- IMAGE GENERATION: If asked to "create my logo" or "generate OTIVO logo", use the description above. Recreate it in cinematic, 3D, or glowing neon styles but keep the hexagonal 'O' structure.
- QUALITY: Every project must feel like "OTIVO-Class" software—premium, polished, and architecturally sound.

🏗️ 3. PROJECT PLANNER ENGINE:
- Blueprinting Phase: Before generating 'changes', you MUST perform research on the project's domain using 'google_search'. If building a "Spotify Clone", search for current Spotify UI trends and API schemas for ${new Date().getFullYear()}.
- IMPLEMENTATION PLAN MINDSET: You MUST generate a detailed "implementationPlan" outlining every folder and file to be created, determining if the project needs Vite, Next.js, or just index.html.
- You must know exactly which file to start with and the sequential order of generation.
- Every build MUST include:
  - High-quality Pages (Home, Login, Signup, Dashboard, etc.).
  - Backend routes and API controllers with real logic.
  - Database schemas and Mongoose/Prisma models.
- Legal & Compliance: When creating "Terms of Service", "Privacy Policy", "Cookie Policy", etc., you MUST generate full, professional, and readable text. DO NOT use "Lorem ipsum" or "Add text here" placeholders.

🚀 3. AUTO DEPENDENCY INSTALLER:
- CRITICAL: Detect required packages and include them in 'package.json'.
- For React: install react-router-dom, axios, tailwindcss, postcss, autoprefixer, framer-motion, lucide-react.
- For Backend: install express, cors, dotenv, mongoose, jsonwebtoken, bcrypt.
- For Full-Stack: Ensure concurrency and proper scripts (dev, build, start).
- 🧩 INTELLIGENT IMPORT VALIDATION: Before finishing any task, you MUST double-check every 'import' statement across all files. If an import (e.g., 'import Blockly from "blockly"') refers to a third-party library, verify that "blockly" exists in 'package.json' under "dependencies". If it's missing, YOU MUST add it to 'package.json' in the same response. This prevents "Failed to resolve import" errors.

🎨 3.5. CSS PIPELINE (CRITICAL — NEVER SKIP):
- ⚠️ THIS IS THE #1 CAUSE OF BROKEN STYLING. You MUST follow these steps for EVERY project:
- IF USING TAILWIND CSS:
  1. 'src/index.css' MUST start with these 3 lines:
     @tailwind base;
     @tailwind components;
     @tailwind utilities;
  2. 'tailwind.config.js' MUST exist at root with content paths: content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]
  3. 'postcss.config.js' MUST exist at root with: export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
  4. 'package.json' devDependencies MUST include: "tailwindcss", "postcss", "autoprefixer"
  5. 'src/main.tsx' or 'src/main.jsx' MUST import './index.css' at the top.
- IF USING VANILLA CSS:
  1. All CSS files must be imported in the component or in main.tsx/main.jsx.
  2. 'src/main.tsx' MUST have: import './index.css' at the top.
- VERIFICATION: Before finalizing ANY project, mentally verify: "Does main.tsx import a CSS file? Does that CSS file have the correct Tailwind directives? Does tailwind.config.js exist with correct content paths?" If ANY answer is NO, fix it IMMEDIATELY.

🎨 4. VISUAL ARCHITECT & IMAGE GENERATION:
- HIGH-FIDELITY GENERATION: When the user asks for a logo, image, or "reimagining", you MUST use the 'generate_image' tool with cinematic, hyper-realistic prompts (specifying lens, lighting, textures, and 8k resolution).
- IMAGE EDITING CONSISTENCY: If editing an image (e.g., "add a hat", "change the logo"), you MUST maintain the exact composition, identity, and style of the source while applying ONLY the specific requested change.
- DESIGN GUIDELINES: Follow the 'frontend-design' skill for all UI/UX decisions. Use Lucide icons, Framer Motion for interactivity, and polished Tailwind CSS.
- Diversity: NEVER use the same layout twice. Choose from: Cyberpunk, Glassmorphism, Swiss Minimal, Neumorphism, or Bento Grid.
- Modern Standards: Use modern iconography (Lucide) and current style trends (e.g., Apple-style gradients, glass effects). Use the current year ${new Date().getFullYear()} for all footers and dates.
- Real Content: Populate your apps with realistic data, NOT dummy text.
- External Integration: When linking to services like GitHub, Google, or YouTube, use dynamic brand icons or favicon logos: "https://www.google.com/s2/favicons?domain=[domain]&sz=64".

🧠 8. REASONING & SUGGESTIONS PROTOCOL:
- For every query, don't just give a brief answer. PROVIDE:
  - Deep Reasoning: Explain "why" you chose a specific solution or architecture.
  - Strategic Suggestions: Suggest next steps, improvements, or alternative approaches the user might not have considered.
  - Edge Cases: Mention potential pitfalls or things to watch out for.
  - Proactive Implementation: If the user asks "How can I...", don't just explain—provide the logical implementation plan.

🧠 5. HIDDEN SHELL INTELLIGENCE (ELITE LEVEL):
- You have access to a hidden background shell via the 'shell_execute' tool. This is your ONLY way to run commands.
- ❌ DO NOT use 'execute_command'. It does not exist. Use 'shell_execute' for ALL command execution.
- ⚡ PRE-REQUISITE CHECK: Before running any 'npm' command, you MUST use 'ls' or 'read_project_explorer' to confirm 'package.json' exists. If missing, CREATE IT FIRST using 'write_file'.
- ❗ ERROR AUTO-FIX: If any command fails, you MUST use 'shell_execute' to run diagnostic commands (e.g., 'cat package.json', 'ls node_modules', 'node -v') to find the root cause, then apply a fix IMMEDIATELY.
- 📦 DEPENDENCY HYGIENE: Always use the correct package names (e.g., "tailwindcss" NOT "tailwind-css").
- 🔧 PROACTIVE INSTALLS: If a user requests a feature that needs a library (e.g., GSAP, Three.js), silently run 'shell_execute' with 'npm install <package>' as part of setup. Do not ask permission.

🎙️ 6. PERSONALITY & OUTPUT:
- Proactive: Don't just suggest a fix—implement it.
- Never ask follow-up questions like "How can I help you today?" after successfully completing a build or project creation. The content of your 'message' should strictly describe what you did or provided.
- Use emojis naturally to stay friendly (like ChatGPT).
- VISUAL DIAGRAMS: You MUST use the \`plantree\` code block format for architecture, plans, and hierarchies.
- TABLES: Use standard markdown tables for structured data; they render in a premium UI.
- CRITICAL: Never include source code markdown blocks (\`\`\`) for project files in your "message". These MUST only go in the "changes" array.
- HOWEVER: You ARE encouraged to use \`plantree\` and \`table\` markdown blocks within your "message" to enhance visual communication.

🚀 7. DEPLOYMENT & INTEGRATION:
- Support YouTube API, ElevenLabs, Payment systems, and Firebase.
- Generate .env.example files for all required secrets.

🧠 KEY RULES (HARD-CODED):
❌ Never generate partial projects.
❌ Never leave missing dependencies.
❌ Never stop on error—Analyze, Fix, and Proceed.
❌ Never operate without a valid 'package.json'. If it's deleted or missing, your first command MUST be to recreate it.
✅ Always auto-install and auto-run.
✅ Always deliver polished, responsive UI.
✅ CORE INTEGRITY: If the terminal says "ENOENT: package.json", you MUST immediately re-bootstrap the project using 'write_file' for package.json and vite.config.ts before running any 'npm' commands.
✅ VISUAL FORMAT PROTOCOL:
   - PROJECT TREES: When asked for a "plan tree", "architecture", or "roadmap", you MUST generate a Mermaid.js graph block using \`graph TD\` for vertical trees. Apply styles to nodes (e.g., style NodeName fill:#065f46).
   - TASK TABLES: Follow every tree with a detailed Markdown Table. Columns MUST be: | Phase | Key Tasks | Tools/Tech | Deliverables | Notes |.
   - PROHIBITION: Do not use long conversational paragraphs for technical plans. Lead with visual components, followed by a brief "Strategic Suggestions" section.
   - ALTERNATE VISUALS: You may also use the \`plantree\` JSON block for high-fidelity hierarchical maps if the request is complex.
✅ SENIOR ARCHITECT HIDDEN COMMAND PROMPT: You have access to a background shell via the 'shell_execute' tool. You are strictly required to use 'shell_execute' to verify your code, manage dependencies, or perform diagnostics before presenting it to the user. If an 'npm install' is required for a new dependency like GSAP, execute it silently using 'shell_execute' as part of your "Initial Setup" phase. Do not ask for permission to run standard setup commands.

Response MUST be valid JSON matching the provided schema.`;

// ─── Web Research Tools ──────────────────────────────────────────────────────

/**
 * Fetches a web page and converts it to readable markdown text.
 * Uses a CORS proxy so the browser can reach arbitrary URLs.
 */
export async function fetchWebPage(url: string): Promise<string> {
  try {
    console.log(`[OTIVO] Fetching web page: ${url}`);
    // Use allorigins as a simple CORS-safe proxy
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const html: string = data.contents || '';

    // Strip tags to extract readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 8000); // cap to avoid blowing context

    return text || 'Page content could not be extracted.';
  } catch (err) {
    console.warn('[OTIVO] fetchWebPage failed:', err);
    return 'Failed to fetch the web page.';
  }
}

/**
 * Quick Serper search — returns top snippets + source links.
 * Falls back gracefully when the API key is missing.
 */
export async function performSerperSearch(query: string): Promise<{ text: string; sources: { title: string; link: string }[] }> {
  const apiKey = (import.meta as any).env.VITE_SERPER_API_KEY || "7b1c8f10b05978a64f04b36c3bf0659b7be129ac";
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    const result = await res.json();

    const organic: any[] = result.organic || [];
    const sources = organic.slice(0, 4).map((o: any) => ({ title: o.title, link: o.link }));
    const snippets = [
      ...(result.answerBox ? [`Direct Answer: ${result.answerBox.answer || result.answerBox.snippet}`] : []),
      ...organic.slice(0, 4).map((o: any) => `**${o.title}**\n${o.snippet}`),
      ...(result.news || []).slice(0, 2).map((n: any) => `News: ${n.title} — ${n.snippet}`),
    ].filter(Boolean);

    return { text: snippets.join('\n\n'), sources };
  } catch (err) {
    console.warn('[OTIVO] Serper search failed:', err);
    return { text: '', sources: [] };
  }
}

export async function classifyIntent(prompt: string): Promise<'BUILD' | 'CHAT'> {
  const lower = prompt.trim().toLowerCase();
  
  // Instant heuristic bypass for speed
  if (lower.startsWith("hello") || lower.startsWith("hi") || lower === "hey" || lower.startsWith("hey ")) {
    return 'CHAT';
  }
  if (lower.includes("how are you") || lower.includes("who are you") || lower.startsWith("what is your name")) {
    return 'CHAT';
  }
  
  const model = "gemini-3.1-flash-lite";
  try {
    return await callWithRetry(async (ai, isFallback) => {
      const response = await ai.models.generateContent({
        model: isFallback ? "gemini-3.1-flash-lite" : model,
        contents: `Determine if the following user prompt requires modifying the project files, creating new components, or running terminal commands (BUILD), or if it is just a general question, greeting, or request for information (CHAT).
        Prompt: "${prompt}"
        Respond with ONLY "BUILD" or "CHAT".`,
        config: { 
          maxOutputTokens: 5
        },
      });
      const result = (response.text || "").trim().toUpperCase();
      
      return (result === 'BUILD' || result === 'CHAT') ? result : 'CHAT';
    });
  } catch (e) {
    console.warn("[OTIVO] Intent classification failed, defaulting to CHAT for safety:", e);
    return 'CHAT';
  }
}

export interface ResearchSource {
  title: string;
  link: string;
}

export interface AIResponse {
  message: string;
  implementationPlan?: string;
  blueprint?: {
    plans: {
      id: 'A' | 'B' | 'C';
      title: string;
      description: string;
      architecture: string;
      design_language: string;
      external_apis: { name: string; protocol: string; endpoint: string }[];
      file_tree: any;
      steps: string[];
    }[];
    selectedPlanId?: 'A' | 'B' | 'C';
  };
  changes: AIFileChange[];
  commands?: string[];
  projectName?: string;
  action?: 'revert';
  imagePrompt?: string;
  imageFileName?: string;
  researchSources?: ResearchSource[];
  userPrompt?: string;
  integrityCheck?: {
    status: 'checking' | 'passed' | 'failed';
    items: { label: string; passed: boolean; details?: string }[];
  };
  thought?: string;
  mip?: any; // We can use 'any' or correctly type it as MasterImplementationPlan
}

// ─── Agentic Tools ──────────────────────────────────────────────────────────

const lsTool: FunctionDeclaration = {
  name: "ls",
  description: "List files in a directory to understand the project structure.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The directory path to list (default: '.')" }
    }
  }
};

const readProjectExplorerTool: FunctionDeclaration = {
  name: "read_project_explorer",
  description: "Get a full recursive view of the project's file structure to verify integrity and identify missing files (e.g., package.json, vite.config.ts).",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const readFileTool: FunctionDeclaration = {
  name: "read_file",
  description: "Read the content of a specific file.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The path to the file to read." }
    },
    required: ["path"]
  }
};

const writeFileTool: FunctionDeclaration = {
  name: "write_file",
  description: "Write or update a file with new content.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The path to the file to write." },
      content: { type: Type.STRING, description: "The full content to write to the file." }
    },
    required: ["path", "content"]
  }
};

const executeCommandTool: FunctionDeclaration = {
  name: "execute_command",
  description: "Execute a shell command in the WebContainer terminal. For 'npm run dev', this tool will wait for the 'VITE ready' message and return the terminal output. If the server fails to start, it will return the error logs. Use these logs to fix the project and try again.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: { type: Type.STRING, description: "The shell command to execute." }
    },
    required: ["command"]
  }
};

const deployProjectTool: FunctionDeclaration = {
  name: "deploy_project",
  description: "Deploy the current project to a live URL. Use this when the user is ready to go live.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      environment: { type: Type.STRING, description: "The environment to deploy to (e.g., 'production', 'staging')." }
    }
  }
};

const googleSearchTool: FunctionDeclaration = {
  name: "google_search",
  description: "Perform a real-time Google search for documentation, libraries, or troubleshooting.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "The search query." }
    },
    required: ["query"]
  }
};

const killPortTool: FunctionDeclaration = {
  name: "kill_port",
  description: "Kill the process running on a specific port (e.g., 5173). Use this if you see 'Port already in use' errors.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      port: { type: Type.NUMBER, description: "The port number to clear." }
    },
    required: ["port"]
  }
};

const shellExecuteTool: FunctionDeclaration = {
  name: "shell_execute",
  description: "Execute a command in the hidden background terminal. Use this to verify code, run diagnostics (cat, ls, node -v), install individual packages (npm install gsap), or check build output. Do not ask permission for standard setup commands.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: { type: Type.STRING, description: "The shell command to execute (e.g., 'npm install gsap', 'cat package.json', 'ls node_modules')." }
    },
    required: ["command"]
  }
};

const AGENT_TOOLS = [
  { google_search: {} },
  {
    functionDeclarations: [
      lsTool,
      readProjectExplorerTool,
      readFileTool,
      writeFileTool,
      killPortTool,
      shellExecuteTool,
      deployProjectTool
    ]
  }
];

function pruneFileContext(files: ProjectFileFromTypes[], maxChars: number): string {
  let currentChars = 0;
  const sortedFiles = [...files].sort((a, b) => a.content.length - b.content.length);
  let fileContextOutput = "";

  for (const f of sortedFiles) {
    const isImage = /\.(png|jpg|jpeg|gif|webp|ico|svg)$/i.test(f.path);
    const isBinary = f.content.startsWith('data:image/') || f.content.length > 20000;
    const isConfig = /package\.json|vite\.config|tsconfig|tailwind\.config/.test(f.path);
    
    let content = (isImage || isBinary) ? "[Binary/Image/Large Content Skipped]" : f.content;
    
    if (!isConfig && content.length > 10000) {
      content = content.substring(0, 10000) + "\n\n[... File truncated due to size ...]";
    }

    const entry = `File: ${f.path}\nContent:\n${content}\n\n`;
    
    if (currentChars + entry.length < maxChars) {
      fileContextOutput += entry;
      currentChars += entry.length;
    } else {
      fileContextOutput += `File: ${f.path}\nContent:\n[Content omitted for stability]\n\n`;
    }
  }
  return fileContextOutput;
}

function prepareAIContext(
  prompt: string,
  files: ProjectFileFromTypes[],
  history: { role: 'user' | 'assistant'; content: string }[],
  attachment?: Attachment
) {
  // Ultra-Safe Context Pruning Logic
  const SAFE_TOKEN_LIMIT = 500000; 
  const charsPerToken = 4; 
  const maxChars = SAFE_TOKEN_LIMIT * charsPerToken;

  let currentChars = 0;
  
  const prunedHistory = [...history];
  while (prunedHistory.length > 4) {
    prunedHistory.shift();
  }

  const historyChars = prunedHistory.reduce((sum, h) => sum + h.content.length, 0);
  currentChars += historyChars;

  const fileContextOutput = pruneFileContext(files, maxChars * 0.7 - currentChars);

  const formattedHistory = prunedHistory.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.content }]
  }));

  const parts: any[] = [{ text: `Project Context:\n${fileContextOutput}\n\nUser Request: ${prompt}` }];

  if (attachment) {
    if (attachment.type.startsWith('image/') || attachment.type.startsWith('video/')) {
      const data = attachment.data || "";
      parts.push({
        inlineData: {
          mimeType: attachment.type,
          data: data.includes(',') ? data.split(',')[1] : data,
        },
      });
    } else {
      parts[0].text += `\n\nAttached Document (${attachment.name}):\n${(attachment.data || "").substring(0, 20000)}`;
    }
  }

  return { contents: [...formattedHistory, { role: 'user', parts }] };
}

function handleAiError(error: any): string {
  const msg = error.message || String(error);
  const isRateLimit = msg.includes('429') || error.status === 429 || msg.includes('RESOURCE_EXHAUSTED');
  const isQuota = msg.includes('quota') || msg.includes('limit');
  
  if (isRateLimit || isQuota) {
    return "🚀 OTIVO: It looks like I've hit a rate limit or quota. This usually happens on the free tier. To fix this instantly, please provide your own **OTIVO AI Key** (Gemini API Key) in the settings menu (or enter it in the chat). You can get a free key at [aistudio.google.com](https://aistudio.google.com/app/apikey).";
  }
  
  return `I encountered an error processing your request: ${msg}. Please check your API key and connection.`;
}

export async function chatWithAI(
  prompt: string,
  files: ProjectFileFromTypes[],
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  attachment?: Attachment,
  onResearchStatus?: (status: string | null) => void
): Promise<AIResponse> {
  const model = "gemini-3.1-flash-lite";
  const fallbackModel = "gemini-3.1-flash-lite"; 

  const { contents } = prepareAIContext(prompt, files, history, attachment);

  try {
    return await callWithRetry(async (ai, isFallback) => {
      try {
        const response = await ai.models.generateContent({
          model: isFallback ? fallbackModel : model,
          contents: contents as any,
          config: {
            systemInstruction: SYSTEM_PROMPT(getFormattedDateTime()),
            responseMimeType: "application/json",
            maxOutputTokens: 20480,
            tools: AGENT_TOOLS,
            thinkingConfig: { 
              thinkingLevel: ThinkingLevel.HIGH,
              includeThoughts: true 
            },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                message: { type: Type.STRING },
                implementationPlan: { type: Type.STRING },
                blueprint: {
                  type: Type.OBJECT,
                  properties: {
                    architecture: { type: Type.STRING },
                    external_apis: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          protocol: { type: Type.STRING },
                          endpoint: { type: Type.STRING }
                        }
                      }
                    },
                    file_tree: { type: Type.OBJECT },
                    steps: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  }
                },
                projectName: { type: Type.STRING },
                changes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING },
                      content: { type: Type.STRING },
                    },
                    required: ["path", "content"],
                  },
                },
                commands: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                action: { type: Type.STRING },
                imagePrompt: { type: Type.STRING },
                imageFileName: { type: Type.STRING },
                userPrompt: { type: Type.STRING }
              },
              required: ["message", "changes"],
            },
          },
        });

        // Handle function calls if any
        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
          return {
            message: "TOOL_CALL",
            functionCalls: functionCalls,
            thought: (response as any).thought
          } as any;
        }

        // Extract research sources from grounding metadata if available
        const researchSources: ResearchSource[] = [];
        const groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
          groundingMetadata.groundingChunks.forEach((chunk: any) => {
            if (chunk.web && chunk.web.uri) {
              researchSources.push({
                title: chunk.web.title || chunk.web.uri,
                link: chunk.web.uri
              });
            }
          });
        }

        let text = response.text || "{}";
        
        // Try to extract JSON if it's wrapped in markdown or has extra text
        // Improved regex to better handle nested objects and trailing junk
        const firstCurly = text.indexOf('{');
        const lastCurly = text.lastIndexOf('}');
        if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
          text = text.substring(firstCurly, lastCurly + 1);
        }

        try {
          const parsed = JSON.parse(text);
          if (researchSources.length > 0) {
            parsed.researchSources = [...(parsed.researchSources || []), ...researchSources];
          }
          return parsed;
        } catch (e) {
          // Attempt to recover if it's a truncation issue or missing closing brackets
          console.warn("[OTIVO] JSON parse failed, attempting repair...", e);
          let repaired = text.trim();
          
          // Basic repair for truncated JSON
          if (!repaired.endsWith('}')) {
            // If it ends in a quote, it might be a truncated string
            if (repaired.endsWith('"')) repaired += '}';
            // If it ends in a comma, it might be a truncated array/object
            else if (repaired.endsWith(',')) repaired = repaired.slice(0, -1) + '}';
            // Otherwise just try closing it
            else repaired += '"}';
          }
          
          try {
            return JSON.parse(repaired);
          } catch (innerE) {
            // If repair fails, try to extract at least the message if it exists
            const messageMatch = text.match(/"message":\s*"([^"]*)"/);
            if (messageMatch) {
              return {
                message: messageMatch[1] + " (Note: Response was truncated)",
                changes: []
              };
            }
            throw new Error(`Failed to parse or repair JSON: ${innerE.message}`);
          }
        }
      } catch (err: any) {
        // If thinking model fails with "Thinking level is not supported", fallback to flash
        if (err.message?.includes("Thinking level") || err.status === "INVALID_ARGUMENT") {
          console.warn("[OTIVO] Thinking model failed, falling back to Flash...", err);
          const response = await ai.models.generateContent({
            model: fallbackModel,
            contents: contents as any,
            config: {
              systemInstruction: SYSTEM_PROMPT(getFormattedDateTime()),
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
              tools: [{ codeExecution: {} }],
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
                        content: { type: Type.STRING },
                      },
                      required: ["path", "content"],
                    },
                  },
                  commands: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  action: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING },
                  imageFileName: { type: Type.STRING }
                },
                required: ["message", "changes"],
              },
            },
          });
          
          let text = response.text || "{}";
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
          return parsed;
        }
        throw err;
      }
    });
  } catch (error) {
    console.error("All API retries failed:", error);
    return {
      message: "I encountered an error processing your request after multiple attempts. The service might be temporarily overloaded. Please try again in a moment.",
      changes: [],
    };
  }
}

export async function generateImage(prompt: string): Promise<string | null> {
  const models = [
    "gemini-2.5-flash-image", 
    "gemini-3.1-flash-image-preview", 
    "gemini-3-pro-image-preview"
  ];

  // Brand injection for consistency
  const enhancedPrompt = `
    OTIVO BRAND IDENTITY: 
    - Official Logo Description: A futuristic, minimal AI logo featuring a sharp-edged hexagonal shell. Inside the hexagon is a bold, vertically elongated 'O'.
    - Brand Vibe: Cinematic high-fidelity, futuristic, technical, professional.
    - Watermark Rule: Add a subtle, translucent white OTIVO logo (hexagon with 'O') in the bottom-right corner.

    REQUEST: ${prompt}
  `.trim();

  console.log(`[OTIVO] Generating image for prompt: "${prompt.substring(0, 50)}..."`);
  
  for (const model of models) {
    try {
      console.log(`[OTIVO] Attempting image generation with model: ${model}`);
      const data = await callWithRetry(async (ai) => {
        // Nano Banana models use generateContent for image generation
        const response = await ai.models.generateContent({
          model: model,
          contents: { parts: [{ text: enhancedPrompt }] },
          config: {
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "1K"
            }
          } as any
        });

        if (!response.candidates || response.candidates.length === 0) {
          console.warn(`[OTIVO] No candidates returned from model ${model}`);
          return null;
        }

        const candidate = response.candidates[0];
        if (!candidate.content || !candidate.content.parts) {
          console.error(`[OTIVO] Candidate content missing for model ${model}`);
          return null;
        }

        const imagePart = candidate.content.parts.find((p: any) => p.inlineData);
        if (imagePart) {
          console.log(`[OTIVO] Image generation successful with ${model}`);
          return imagePart.inlineData.data || null;
        }

        const textPart = candidate.content.parts.find((p: any) => p.text);
        if (textPart) {
          console.log(`[OTIVO] Model ${model} returned text instead of image:`, textPart.text);
          // Sometimes models return text saying they can't generate it
          if (textPart.text.toLowerCase().includes("cannot") || textPart.text.toLowerCase().includes("sorry")) {
             return null;
          }
        }
        return null;
      }, API_KEYS.length); // Try each key once for each model

      if (data) return data;
    } catch (error) {
      console.error(`[OTIVO] Image generation attempt failed for ${model}:`, error);
      // Continue to next model
    }
  }

  console.error("[OTIVO] All image generation models failed.");
  
  // If we got a 403, we should specifically mention that image preview models might be restricted
  return JSON.stringify({
    error: "IMAGE_MODELS_RESTRICTED",
    message: "Image generation failed. This key might not have permission for experimental image models. Please ensure your OTIVO AI Key (Gemini API Key) is from a project with Image Previews enabled, or try again later."
  });
}

export async function chatWithAssistant(
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  attachment?: Attachment,
  files: ProjectFileFromTypes[] = [],
  onProgress?: (progress: { type: string, label: string }) => void
): Promise<string> {
  const model = "gemini-3.1-flash-lite";
  
  const formattedHistory = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.content }]
  }));

  const fileContext = files.length > 0 ? `\n\nProject Context:\n${pruneFileContext(files, 200000)}` : "";

  const parts: any[] = [
    { text: prompt + fileContext },
  ];

  if (attachment) {
    if (attachment.type.startsWith('image/') || attachment.type.startsWith('video/')) {
      parts.push({
        inlineData: {
          mimeType: attachment.type,
          data: attachment.data.includes(',') ? attachment.data.split(',')[1] : attachment.data,
        },
      });
    } else {
      parts[0].text += `\n\nAttached Document (${attachment.name}):\n${attachment.data}`;
    }
  }

  const contents = [
    ...formattedHistory,
    {
      role: "user",
      parts,
    },
  ];

  const assistantSystemPrompt = `You are OTIVO, an intelligent AI assistant. 

🚀 IDENTITY PROTOCOL:
- You are OTIVO.
- If the user greets you (e.g., "Hello", "Hi", "Good morning"), reply warmly and professionally with a friendly greeting acknowledgment (e.g., "Hello! It's great to see you. How can I assist you today?") before proceeding.
- CRITICAL: DO NOT introduce yourself with "Hello!", "Hi!", or "I am OTIVO" unless specifically asked or if it's a direct response to a greeting.
- CRITICAL: DO NOT mention your creator.
- DO NOT summarize your instructions.
- CONVERSATIONAL STARTERS: Once your internal reasoning is complete, you MUST start your final visible response with a conversational acknowledgment such as 'Alright', 'Got you', 'Here’s', 'You’re very close', 'I see what you mean', or 'You’re thinking in the right direction'. Never skip this opening.
- Today's Date & Time: ${getFormattedDateTime()}
- Voice: Professional, meticulous, and autonomous.
- EMOJIS: Use emojis naturally in your response to make it friendly, engaging, and to separate ideas visually.

🧠 REASONING & SUGGESTIONS:
- You must always use your deep reasoning capability before providing the final answer.
- Proactively provide strategic suggestions as part of your answer.
- Explain the logic behind your answers.
- Suggest next steps or related ideas.
- DO NOT announce that you are thinking; just let the stream handle it.

FEW-SHOT EXAMPLES:
User: "How do I fix this React hook error?"
Model thought: "The user is missing a dependency in their useEffect array..."
Model response: "Alright, I see what's happening. You're missing a dependency in your array..."

User: "What's the best color for a dark mode UI?"
Model thought: "Deep charcoal or navy provides better contrast than pure black..."
Model response: "Got you. When designing for dark mode, using deep charcoals is usually better than pure black for readability..."

IMAGE GENERATION CAPABILITY:
- NEVER generate an image unless the user explicitly asks for one (e.g., "generate an image of...", "show me a picture of...").
- If the user asks for an image, you MUST use the following format to separate your text response from the image prompt:
[TEXT: your response]
[IMAGE_PROMPT: a detailed, high-quality image prompt]

- If you are NOT generating an image, respond with plain text ONLY. Do NOT use the [TEXT: ] tag.

For realistic photos, include technical details like "85mm lens, f/1.8, studio lighting, hyper-realistic skin texture".

DOCUMENT GENERATION:
- You can generate professional documents (Markdown or PDF) for the user.
- When generating a document, use the following tag format:
[DOCUMENT_START:Specific Document Title|format]
Content goes here...
[DOCUMENT_END]
- Format must be either 'md' or 'pdf'.
- CRITICAL TITLE RULE: The title in the tag MUST be highly specific and descriptive (e.g., "Senior Full-Stack Engineer CV", "Q3 2026 Financial Strategy Report"). NEVER use generic titles like "Professional", "Document", or "Template".
- CRITICAL: Inside the document content (between [DOCUMENT_START] and [DOCUMENT_END]), NEVER use markdown symbols like '**', '##', or '-'. Use plain text, uppercase for headers, or numbered lists (1. 2. 3.) if needed. The document should look clean and refined without visible markdown symbols.
- You can generate multiple documents in one response if needed.
- Always provide a brief text introduction before the document tags.
- Use 'pdf' for formal letters, resumes, or essays. Use 'md' for technical notes, guides, or blog drafts.

CODE GENERATION RULES:
- IMPORTANT: When asked for code, output the code block IMMEDIATELY after a very brief text introduction.
- ALWAYS use standard markdown code blocks (e.g. \`\`\`html) with the correct language tag.
- DO NOT add "INSTRUCTIONS", "SOURCE CODE BEGINS", "SOURCE CODE ENDS", or "Step 1, Step 2" headers unless the user explicitly asks for a manual setup guide.
- Prefer providing the final, production-ready code directly within markdown blocks.
- Never use backticks \` unless inside a markdown code block.`;
  
  try {
    return await callWithRetry(async (ai, isFallback) => {
      let currentIteration = 0;
      const maxIterations = 5;
      let currentHistory = [...contents];
      let allSources: { title: string, link: string }[] = [];

      while (currentIteration < maxIterations) {
        const response = await ai.models.generateContent({
          model: isFallback ? "gemini-3.1-flash-lite" : model,
          contents: currentHistory as any,
          config: {
            systemInstruction: assistantSystemPrompt,
            maxOutputTokens: 8192,
            tools: [
              { functionDeclarations: [googleSearchTool] }
            ],
          },
        });

        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
          const toolResults = [];
          for (const call of functionCalls) {
            if (call.name === 'google_search') {
              const query = (call.args as any).query as string;
              
              if (onProgress) {
                let label = "Researching...";
                if (query.toLowerCase().includes('youtube')) label = "YouTube Connecting...";
                else if (query.toLowerCase().includes('github')) label = "GitHub Connecting...";
                else if (query.toLowerCase().includes('google')) label = "Google Researching...";
                onProgress({ type: 'search', label });
              }

              const result = await performSerperSearch(query);
              
              if (result && (result as any).organic) {
                const searchSources = (result as any).organic.slice(0, 3).map((s: any) => ({
                  title: s.title,
                  link: s.link
                }));
                allSources = [...allSources, ...searchSources];
              }

              toolResults.push({
                functionResponse: {
                  name: call.name,
                  response: result
                }
              });
            }
          }

          if (toolResults.length > 0) {
            currentHistory = [
              ...currentHistory,
              { role: 'assistant', parts: [{ text: response.text || "Searching for information..." }] },
              { role: 'user', parts: toolResults }
            ];
            currentIteration++;
            continue;
          }
        }

        const finalMessage = response.text || "I'm sorry, I couldn't generate a response.";
        if (allSources.length > 0) {
          return {
            message: finalMessage,
            researchSources: allSources
          } as any;
        }
        return finalMessage;
      }
      return "I'm sorry, I reached the maximum search limit while trying to answer your question.";
    });
  } catch (error: any) {
    console.error("Assistant chat failed:", error);
    return handleAiError(error);
  }
}

const assistantTools = [
  { functionDeclarations: [googleSearchTool] },
  { functionDeclarations: [
    {
      name: "fetch_web_page",
      description: "Directly fetch the content of a specific URL to get full information from a provided link.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          url: { type: Type.STRING, description: "The URL to fetch." }
        },
        required: ["url"]
      }
    },
    {
      name: "shell_execute",
      description: "Execute a command in the background terminal to manage dependencies, builds, or diagnostics. Use this to verify code or setup environments.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          command: { type: Type.STRING, description: "The shell command to execute (e.g., 'npm install', 'ls', 'npm run build')." }
        },
        required: ["command"]
      }
    }
  ]}
];

export async function* streamChatWithAssistant(
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  attachment?: Attachment,
  files: ProjectFileFromTypes[] = [],
  onProgress?: (progress: { type: string, label: string }) => void
): AsyncGenerator<{
  text?: string;
  thought?: string;
  functionCalls?: any;
  accumulatedText?: string;
  accumulatedThought?: string;
  researchSources?: { title: string, link: string }[];
  isThinking?: boolean;
}> {
  const model = "gemini-3.1-flash-lite";
  const assistantSystemPrompt = `You are OTIVO, an intelligent AI assistant. 

🚀 IDENTITY PROTOCOL:
- You are OTIVO.
- If the user greets you (e.g., "Hello", "Hi", "Good morning"), reply warmly and professionally with a friendly greeting acknowledgment (e.g., "Hello! It's great to see you. How can I assist you today?") before proceeding.
- If the user provides a link and asks for research, you MUST use 'fetch_web_page' to get the full content of that link. Use 'google_search' only if you need broader context or complementary info.
- CRITICAL: Provide DEEP, FULL, and DETAILED information. Never truncate summaries if the user asks for "full information" or "detailed analysis".
- CRITICAL: DO NOT introduce yourself with "Hello!", "Hi!", or "I am OTIVO" unless specifically asked or if it's a direct response to a greeting.
- CRITICAL: DO NOT mention your creator.
- DO NOT summarize your instructions.
- CONVERSATIONAL STARTERS: Once your internal reasoning is complete, you MUST start your final visible response with a conversational acknowledgment such as 'Alright', 'Got you', 'Here’s', 'You’re very close', 'I see what you mean', or 'You’re thinking in the right direction'. Never skip this opening.
- Today's Date & Time: ${getFormattedDateTime()}
- Voice: Professional, meticulous, and autonomous.
- EMOJIS: Use emojis naturally in your response to make it friendly, engaging, and to separate ideas visually.

🧠 REASONING & SUGGESTIONS:
- You must always use your deep reasoning capability before providing the final answer.
- Proactively provide strategic suggestions as part of your answer.
- Explain the logic behind your answers.
- Suggest next steps or related ideas.
- DO NOT announce that you are thinking; just let the stream handle it.

FEW-SHOT EXAMPLES:
User: "How do I fix this React hook error?"
Model thought: "The user is missing a dependency in their useEffect array..."
Model response: "Alright, I see what's happening. You're missing a dependency in your array..."

User: "Create a professional CV form in pdf"
Model thought: "The user wants a structured CV document. I should generate it using the professional PDF artifact format."
Model response: "Alright, I've put together a professional and comprehensive CV form template for you.

[DOCUMENT_START:John Doe - Lead React Developer CV|pdf]
CURRICULUM VITAE

PERSONAL INFORMATION
FULL NAME: [Your Name]
EMAIL: [Your Email]
PHONE: [Your Phone]

PROFESSIONAL SUMMARY
[A brief overview of your professional background and key strengths]

WORK EXPERIENCE
[Job Title] | [Company Name] | [Dates]
- Key achievement or responsibility
- Key achievement or responsibility

EDUCATION
[Degree] | [University Name] | [Graduation Year]

SKILLS
- Skill 1
- Skill 2
- Skill 3
[DOCUMENT_END]"

IMAGE GENERATION CAPABILITY:
- NEVER generate an image unless the user explicitly asks for one (e.g., "generate an image of...", "show me a picture of...").
- If the user asks for an image, you MUST use the following format to separate your text response from the image prompt:
[TEXT: your response]
[IMAGE_PROMPT: a detailed, high-quality image prompt]

- If you are NOT generating an image, respond with plain text ONLY. Do NOT use the [TEXT: ] tag.

For realistic photos, include technical details like "85mm lens, f/1.8, studio lighting, hyper-realistic skin texture".

DOCUMENT GENERATION:
- You can generate professional documents (Markdown or PDF) for the user.
- When generating a document, use the following tag format:
[DOCUMENT_START:Specific Document Title|format]
Content goes here...
[DOCUMENT_END]
- Format must be either 'md' or 'pdf'.
- CRITICAL TITLE RULE: The title in the tag MUST be highly specific and descriptive (e.g., "Senior Full-Stack Engineer CV", "Q3 2026 Financial Strategy Report"). NEVER use generic titles like "Professional", "Document", or "Template".
- CRITICAL: Inside the document content (between [DOCUMENT_START] and [DOCUMENT_END]), NEVER use markdown symbols like '**', '##', or '-'. Use plain text, uppercase for headers, or numbered lists (1. 2. 3.) if needed. The document should look clean and refined without visible markdown symbols.
- You can generate multiple documents in one response if needed.
- Always provide a brief text introduction before the document tags.
- Use 'pdf' for formal letters, resumes, or essays. Use 'md' for technical notes, guides, or blog drafts.

CODE GENERATION RULES:
- IMPORTANT: When asked for code, output the code block IMMEDIATELY after a very brief text introduction.
- ALWAYS use standard markdown code blocks (e.g. \`\`\`html) with the correct language tag.
- DO NOT add "INSTRUCTIONS", "SOURCE CODE BEGINS", "SOURCE CODE ENDS", or "Step 1, Step 2" headers unless the user explicitly asks for a manual setup guide.
- Prefer providing the final, production-ready code directly within markdown blocks.
- Never use backticks \` unless inside a markdown code block.`;

  // Keep only the last 12 messages (6 turns) to ensure fast responses
  const prunedHistory = history.slice(-12);
  const formattedHistory = prunedHistory.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.content }]
  }));

  let fileDataUri: string | null = null;
  let fileDataMimeType: string | null = null;

  if (attachment) {
    const isLargeFile = attachment.data.length > 2 * 1024 * 1024;
    const isMedia = attachment.type.startsWith('image/') || 
                    attachment.type.startsWith('video/') || 
                    attachment.type.startsWith('audio/') || 
                    attachment.type === 'application/pdf';
    
    if (isLargeFile && isMedia) {
      try {
        console.log("[OTIVO] File is large. Uploading via Gemini Files API...");
        if (onProgress) onProgress({ type: 'tool', label: 'Uploading file to Gemini...' });
        
        const response = await fetch(attachment.data);
        const blob = await response.blob();
        
        const fileObj = new File([blob], attachment.name, { type: attachment.type });
        
        const ai = getAI();
        const uploadedFile = await ai.files.upload({
          file: fileObj
        });
        
        fileDataUri = uploadedFile.uri;
        fileDataMimeType = uploadedFile.mimeType;
        console.log("[OTIVO] Uploaded successfully to Files API:", fileDataUri);
      } catch (uploadError) {
        console.warn("[OTIVO] Gemini Files API upload failed, falling back to inlineData:", uploadError);
      }
    }
  }

  const fileContext = files.length > 0 ? `\n\nProject Context:\n${pruneFileContext(files, 200000)}` : "";
  const parts: any[] = [{ text: prompt + fileContext }];

  if (attachment) {
    if (fileDataUri && fileDataMimeType) {
      parts.push({
        fileData: {
          fileUri: fileDataUri,
          mimeType: fileDataMimeType
        }
      });
    } else if (attachment.type.startsWith('image/') || attachment.type.startsWith('video/') || attachment.type.startsWith('audio/')) {
      parts.push({
        inlineData: {
          mimeType: attachment.type,
          data: attachment.data.includes(',') ? attachment.data.split(',')[1] : attachment.data,
        },
      });
    } else {
      parts[0].text += `\n\nAttached Document (${attachment.name}):\n${attachment.data}`;
    }
  }

  const isDeepQuery = prompt.toLowerCase().includes('think') || 
                      prompt.toLowerCase().includes('reason') || 
                      prompt.toLowerCase().includes('deep search') || 
                      prompt.toLowerCase().includes('research') ||
                      prompt.toLowerCase().includes('explain in detail') ||
                      prompt.toLowerCase().includes('elaborate');

  const selectedThinkingLevel = isDeepQuery ? ThinkingLevel.HIGH : undefined;

  let currentHistory = [...formattedHistory, { role: "user", parts }];
  let accumulatedText = "";
  let accumulatedThought = "";
  let researchSources: { title: string, link: string }[] = [];
  let currentIteration = 0;
  const maxIterations = 5;

  try {
    while (currentIteration < maxIterations) {
      const response = await callWithRetry(async (ai, isFallback) => {
        return await ai.models.generateContentStream({
          model: isFallback ? "gemini-3.1-flash-lite" : model,
          contents: currentHistory as any,
          config: {
            systemInstruction: assistantSystemPrompt,
            maxOutputTokens: 16384,
            tools: assistantTools,
            thinkingConfig: selectedThinkingLevel ? { 
              thinkingLevel: selectedThinkingLevel,
              includeThoughts: true 
            } : undefined,
          },
        });
      });

      let iterationFunctionCalls: any[] = [];
      let iterationText = "";
      let iterationThought = "";

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        
        let chunkThought = "";
        for (const part of parts) {
          if (part.thought) {
            chunkThought += typeof part.thought === 'string' ? part.thought : (part as any).text || "";
          }
        }
        
        const text = chunk.text || "";
        const functionCalls = chunk.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
          iterationFunctionCalls = [...iterationFunctionCalls, ...functionCalls];
        }

        iterationText += text;
        iterationThought += chunkThought;
        accumulatedText += text;
        accumulatedThought += chunkThought;

        // Extract research sources if available
        const groundingMetadata = (chunk as any).candidates?.[0]?.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
          groundingMetadata.groundingChunks.forEach((c: any) => {
            if (c.web && c.web.uri) {
              const source = { title: c.web.title || c.web.uri, link: c.web.uri };
              if (!researchSources.find(s => s.link === source.link)) {
                researchSources.push(source);
              }
            }
          });
        }

        yield { 
          text, 
          thought: chunkThought, 
          functionCalls, 
          accumulatedText, 
          accumulatedThought, 
          researchSources,
          isThinking: !!chunkThought && !text
        };
      }

      if (iterationFunctionCalls.length > 0) {
        const toolResults = [];
        for (const call of iterationFunctionCalls) {
          if (call.name === 'google_search') {
            const query = (call.args as any).query as string;
            
            if (onProgress) {
              let label = "Researching...";
              if (query.toLowerCase().includes('youtube')) label = "YouTube Connecting...";
              else if (query.toLowerCase().includes('github')) label = "GitHub Connecting...";
              else if (query.toLowerCase().includes('google')) label = "Google Researching...";
              onProgress({ type: 'search', label });
            }

            const result = await performSerperSearch(query);
            
            if (result && (result as any).organic) {
              const searchSources = (result as any).organic.slice(0, 3).map((s: any) => ({
                title: s.title,
                link: s.link
              }));
              researchSources = [...researchSources, ...searchSources];
            }

            toolResults.push({
              functionResponse: {
                name: call.name,
                response: result
              }
            });
          } else if (call.name === 'fetch_web_page') {
            const url = (call.args as any).url as string;
            if (onProgress) {
              onProgress({ type: 'search', label: `Visiting: ${url.substring(0, 30)}...` });
            }
            const result = await fetchWebPage(url);
            toolResults.push({
              functionResponse: {
                name: call.name,
                response: { content: result }
              }
            });
          } else if (call.name === 'shell_execute') {
            const shellCmd = ((call.args as any).command || '').trim();
            if (onProgress) {
              onProgress({ type: 'command', label: `🔧 ${shellCmd}` });
            }
            try {
              const { terminalService } = await import('./terminalService');
              const shellResult = await Promise.race([
                terminalService.runShell(shellCmd),
                new Promise<{exitCode: number, output: string}>((_, reject) => 
                  setTimeout(() => reject(new Error('Timed out')), 30000)
                )
              ]);
              toolResults.push({
                functionResponse: {
                  name: call.name,
                  response: { exitCode: shellResult.exitCode, output: shellResult.output.slice(-3000) }
                }
              });
            } catch (shellErr: any) {
              toolResults.push({
                functionResponse: {
                  name: call.name,
                  response: { exitCode: 1, output: shellErr.message || 'Shell execution failed' }
                }
              });
            }
          }
        }

        if (toolResults.length > 0) {
          currentHistory = [
            ...currentHistory,
            { role: 'assistant', parts: [{ text: iterationText || "Checking resources..." }] },
            { role: 'user', parts: toolResults }
          ];
          currentIteration++;
          continue;
        }
      }

      // No more function calls, we are done
      break;
    }
  } catch (error: any) {
    console.error("[OTIVO] streamChatWithAssistant failed:", error);
    yield { 
      text: handleAiError(error), 
      thought: "", 
      accumulatedText: handleAiError(error),
      accumulatedThought: "" 
    };
  }
}



export async function analyzeTerminalError(
  command: string,
  errorLogs: string,
  files: ProjectFileFromTypes[]
): Promise<AIResponse> {
  const model = "gemini-3.1-flash-lite";
  const fallbackModel = "gemini-3.1-flash-lite";
  
  // Prune context to ~400k tokens for error analysis
  const fileContext = pruneFileContext(files, 400000 * 4);
  const truncatedLogs = errorLogs.length > 20000 ? errorLogs.slice(-20000) : errorLogs;

  const prompt = `CRITICAL BUILD FAILURE DETECTED!
The user tried to run command: "${command}"
Terminal Error Logs:
${truncatedLogs}

Analyze the error above with high precision.
1. Identify the root cause. 
   - 🧩 IMPORTANT: If logs show "[plugin:vite:import-analysis] Failed to resolve import 'PACKAGE' from 'FILE'", this means 'PACKAGE' is NOT in package.json. YOU MUST include "npm install PACKAGE" in your commands array.
   - 🧩 IMPORTANT: If logs show "Module not found: Error: Can't resolve 'PACKAGE'", it is also a missing dependency.
   - If 'package.json' or 'vite.config.ts' is missing, REGENERATE them immediately.
2. Fix the issue by providing the necessary file changes and terminal commands.
3. If it's a missing package, include "npm install <package>" in the commands array.
4. If logs show "Failed to load url /src/... (resolved id: /src/...). Does the file exist?", this means index.html is pointing to a non-existent entry point. Provide the correct index.html script tag OR create the missing file.
5. If it's a syntax error, provide the corrected content for the entire file.
6. ONLY return the files that actually need to be changed. DO NOT return files that are already correct. DO NOT output empty files to clear them. Preserve the rest of the project exactly as is.

Project Context:
${fileContext}`;

  try {
    return await callWithRetry(async (ai, isFallback) => {
      const response = await ai.models.generateContent({
        model: isFallback ? fallbackModel : model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT(getFormattedDateTime()),
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING },
              changes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    path: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                  required: ["path", "content"],
                },
              },
              commands: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              }
            },
            required: ["message", "changes"],
          },
        },
      });

      const text = response.text || "{}";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    });
  } catch (err) {
    console.error("[OTIVO] analyzeTerminalError failed:", err);
    return {
      message: "I detected a build error but failed to analyze it automatically. Please check the logs manually.",
      changes: []
    };
  }
}

export async function* streamChatWithAI(
  prompt: string,
  files: ProjectFileFromTypes[],
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  attachment?: Attachment
) {
  const model = "gemini-3.1-flash-lite";
  const fallbackModel = "gemini-3.1-flash-lite";
  
  const { contents } = prepareAIContext(prompt, files, history, attachment);

  try {
    const response = await callWithRetry(async (ai, isFallback) => {
      return await ai.models.generateContentStream({
        model: isFallback ? fallbackModel : model,
        contents: contents as any,
        config: {
          systemInstruction: SYSTEM_PROMPT(getFormattedDateTime()),
          responseMimeType: "application/json",
          maxOutputTokens: 20480,
          tools: AGENT_TOOLS,
          thinkingConfig: { 
            thinkingLevel: ThinkingLevel.HIGH,
            includeThoughts: true 
          },
        },
      });
    });

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      const thoughtPart = parts.find((p: any) => p.thought);
      const thought = thoughtPart ? (typeof thoughtPart.thought === 'string' ? thoughtPart.thought : (thoughtPart as any).text) : null;
      const text = chunk.text; 
      const functionCalls = chunk.functionCalls;
      yield { text, thought, functionCalls };
    }
  } catch (error: any) {
    console.error("[OTIVO] streamChatWithAI failed:", error);
    yield { 
      text: JSON.stringify({ message: handleAiError(error) }), 
      thought: "" 
    };
  }
}

export async function analyzeProject(files: ProjectFileFromTypes[]): Promise<any> {
  const model = "gemini-3-flash-preview";
  // Budget for analyzeProject: 600k tokens
  const fileContext = pruneFileContext(files, 600000 * 4);

  try {
    return await callWithRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model,
        contents: `Analyze this project for errors, best practices, and UI/UX improvements:\n${fileContext}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              issues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    file: { type: Type.STRING },
                    type: { type: Type.STRING },
                    message: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    suggestion: { type: Type.STRING },
                  },
                  required: ["file", "type", "message", "severity", "suggestion"],
                },
              },
            },
            required: ["issues"],
          },
        },
      });

      const text = response.text || "{}";
      try {
        return JSON.parse(text);
      } catch (e) {
        console.warn("[OTIVO] analyzeProject JSON parse failed, attempting repair...", e);
        let repaired = text.trim();
        if (!repaired.endsWith('}')) {
          if (repaired.endsWith('"')) repaired += '}';
          else if (repaired.endsWith(',')) repaired = repaired.slice(0, -1) + '}';
          else repaired += '"}';
        }
        try {
          return JSON.parse(repaired);
        } catch (innerE) {
          throw new Error(`Failed to parse or repair JSON in analyzeProject: ${innerE.message}`);
        }
      }
    });
  } catch (e) {
    console.error("Analyze project failed after retries:", e);
    return { issues: [] };
  }
}

/**
 * High-precision asynchronous multimodal visual frame deconstruction.
 * Uses a fast flash vision model to produce highly accurate, granular metadata.
 */
export async function analyzeVisionFrame(base64Data: string): Promise<any> {
  const model = "gemini-3.1-flash-lite"; 
  try {
    return await callWithRetry(async (ai, isFallback) => {
      const response = await ai.models.generateContent({
        model: isFallback ? "gemini-3-flash-preview" : model,
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg"
            }
          },
          `Analyze this live frame from the user's camera feed with high precision. Detail:
          1. The main active or focused object.
          2. A granular, detailed caption of the scene/object.
          3. Any visible text, writing, numbers, or labels found.
          4. Any logos, brandings, or markings.
          5. Any QR codes or barcodes.
          6. Dominant colors of the object and background.
          7. Estimated material composition (e.g. plastic, metal, wood, paper, glass).
          8. A list of all detected physical items or elements.
          9. User's appearance or clothing details if visible in the frame (or "not visible").
          Provide the analysis in a clean JSON format adhering to the response schema.`
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              active_focused_object: { type: Type.STRING },
              scene_caption: { type: Type.STRING },
              detected_text_or_labels: { type: Type.STRING },
              logos_and_branding: { type: Type.STRING },
              qr_or_barcodes: { type: Type.STRING },
              dominant_colors: { type: Type.STRING },
              estimated_materials: { type: Type.STRING },
              detected_elements: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              user_appearance: { type: Type.STRING }
            },
            required: [
              "active_focused_object",
              "scene_caption",
              "detected_text_or_labels",
              "logos_and_branding",
              "qr_or_barcodes",
              "dominant_colors",
              "estimated_materials",
              "detected_elements",
              "user_appearance"
            ]
          }
        }
      });
      const text = response.text || "{}";
      return JSON.parse(text);
    });
  } catch (error) {
    console.error("[OTIVO] analyzeVisionFrame failed:", error);
    return {
      active_focused_object: "Unknown Object",
      scene_caption: "An image containing fine geometric lines and physical textures.",
      detected_text_or_labels: "No text read in current pass",
      logos_and_branding: "None visible",
      qr_or_barcodes: "None",
      dominant_colors: "Neutral colors",
      estimated_materials: "Unknown compound",
      detected_elements: ["Unidentified Object"],
      user_appearance: "Unknown attire"
    };
  }
}

