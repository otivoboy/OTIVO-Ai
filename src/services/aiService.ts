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

if (typeof window !== 'undefined') {
  fetch('/api/config')
    .then((res) => res.json())
    .then((data) => {
      const serverKeys = [
        data.GEMINI_API_KEY,
        data.GEMINI_API_KEY_1,
        data.GEMINI_API_KEY_2,
        data.GEMINI_API_KEY_3,
        data.GEMINI_API_KEY_4,
        data.GEMINI_API_KEY_5,
      ].filter(Boolean);
      for (const k of serverKeys) {
        if (!API_KEYS.includes(k)) {
          API_KEYS.push(k);
        }
      }
    })
    .catch(() => {});
}

export function setRuntimeApiKey(key: string) {
  if (key && !API_KEYS.includes(key)) {
    API_KEYS.push(key);
    localStorage.setItem('VITE_GEMINI_API_KEY', key);
    console.log("[OTIVO] Runtime API key added and saved to localStorage.");
  }
}

if (API_KEYS.length === 0) {
  console.log("[OTIVO] Loading API configuration...");
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
    const userApiKey = typeof window !== 'undefined' ? (localStorage.getItem('VITE_GEMINI_API_KEY') || '') : '';
    const res = await fetch('/api/ai/title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userPrompt, aiResponse, attachment, userApiKey })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.title) return data.title;
    }
  } catch (error) {
    console.warn("[OTIVO] Title generation failed, using fallback.", error);
  }
  if (attachment) return "File: " + (attachment.name.slice(0, 15));
  return userPrompt.slice(0, 20) + "...";
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
  const apiKey = (import.meta as any).env.VITE_SERPER_API_KEY || "";
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
  
  try {
    const userApiKey = typeof window !== 'undefined' ? (localStorage.getItem('VITE_GEMINI_API_KEY') || '') : '';
    const res = await fetch('/api/ai/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, userApiKey })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.intent === 'BUILD' || data.intent === 'CHAT') return data.intent;
    }
  } catch (e) {
    console.warn("[OTIVO] Intent classification failed, defaulting to CHAT for safety:", e);
  }
  return 'CHAT';
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
  try {
    const userApiKey = typeof window !== 'undefined' ? (localStorage.getItem('VITE_GEMINI_API_KEY') || '') : '';
    const res = await fetch('/api/ai/build-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, files, history, attachment, userApiKey })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.message) return data;
    }
  } catch (err) {
    console.warn("[OTIVO] Server build chat failed, falling back:", err);
  }

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
  try {
    const userApiKey = typeof window !== 'undefined' ? (localStorage.getItem('VITE_GEMINI_API_KEY') || '') : '';
    const res = await fetch('/api/ai/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, userApiKey })
    });
    const data = await res.json();
    if (data.data) {
      return data.data;
    }
    if (data.error) {
      return JSON.stringify(data);
    }
  } catch (e) {
    console.warn("[OTIVO] generateImage failed:", e);
  }
  return JSON.stringify({
    error: "IMAGE_MODELS_RESTRICTED",
    message: "Image generation requires a Gemini paid-tier project key."
  });
}

export async function chatWithAssistant(
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  attachment?: Attachment,
  files: ProjectFileFromTypes[] = [],
  onProgress?: (progress: { type: string, label: string }) => void
): Promise<string> {
  const stream = streamChatWithAssistant(prompt, history, attachment, files, onProgress);
  let result = '';
  for await (const chunk of stream) {
    if (chunk.accumulatedText) {
      result = chunk.accumulatedText;
    }
  }
  return result || "I'm sorry, I couldn't generate a response.";
}


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
  const userApiKey = typeof window !== 'undefined' ? (localStorage.getItem('VITE_GEMINI_API_KEY') || '') : '';

  try {
    const response = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history, attachment, files, userApiKey }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errorMsg = errJson.error || `Server responded with status ${response.status}`;
      yield {
        text: handleAiError(new Error(errorMsg)),
        thought: '',
        accumulatedText: handleAiError(new Error(errorMsg)),
        accumulatedThought: ''
      };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Could not read response stream');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') return;

        try {
          const chunk = JSON.parse(dataStr);
          if (chunk.progress && onProgress) {
            onProgress(chunk.progress);
          }
          yield chunk;
        } catch (e) {
          console.warn('Failed to parse SSE chunk:', dataStr);
        }
      }
    }
  } catch (err: any) {
    console.error('[OTIVO] streamChatWithAssistant error:', err);
    yield {
      text: handleAiError(err),
      thought: '',
      accumulatedText: handleAiError(err),
      accumulatedThought: ''
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

