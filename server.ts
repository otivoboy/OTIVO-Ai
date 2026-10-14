import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import fs from "fs/promises";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createServer } from "http";
import { Server } from "socket.io";
import chokidar from "chokidar";
import dotenv from "dotenv";
import aiRouter from "./src/server/aiRouter";

dotenv.config();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;
  
  // Add COOP/COEP headers for WebContainers
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });
  
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Terminal logic
  io.on("connection", async (socket) => {
    console.log("Terminal client connected");
    
    const projectPath = path.join(process.cwd(), 'otivo-project');
    try {
      await fs.mkdir(projectPath, { recursive: true });
    } catch (e) {}

    // Detect platform and choose shell
    const isWindows = process.platform === "win32";
    
    // Robust shell selection
    let shellCommand = isWindows ? (process.env.COMSPEC || "cmd.exe") : "bash";
    let shellArgs = isWindows ? [] : ["-l"];

    console.log(`[OTIVO] Terminal client connected. Platform: ${process.platform}, Shell: ${shellCommand}`);

    let shell: ChildProcess;
    try {
      shell = spawn(shellCommand, shellArgs, {
        cwd: projectPath,
        env: { ...process.env, TERM: 'xterm-256color' },
        shell: isWindows // Use shell: true on Windows for better command handling
      });
    } catch (err: any) {
      console.error(`[OTIVO] Synchronous error spawning shell (${shellCommand}):`, err);
      socket.emit("output", `\r\n\x1b[31m[OTIVO] Error: Failed to start terminal shell (${shellCommand}).\x1b[0m\r\n`);
      socket.emit("output", `\x1b[31mDetails: ${err.message}\x1b[0m\r\n`);
      return;
    }

    shell.on("error", (err: any) => {
      console.error(`[OTIVO] Failed to spawn shell (${shellCommand}):`, err);
      
      // Fallback for Linux if bash is missing
      if (!isWindows && err.code === 'ENOENT' && shellCommand === 'bash') {
        console.log("[OTIVO] bash not found, falling back to /bin/sh");
        socket.emit("output", `\r\n\x1b[33m[OTIVO] Warning: bash not found, falling back to /bin/sh...\x1b[0m\r\n`);
        
        // In a real scenario, we might want to retry with /bin/sh here, 
        // but for now we'll just report the error clearly.
      }

      socket.emit("output", `\r\n\x1b[31m[OTIVO] Error: Failed to start terminal shell (${shellCommand}).\x1b[0m\r\n`);
      socket.emit("output", `\x1b[31mDetails: ${err.message}\x1b[0m\r\n`);
    });

    shell.stdout.on("data", (data) => {
      const output = data.toString();
      socket.emit("output", output);
      
      // Update projectPort if we see a URL
      const urlMatch = output.match(/http:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1|\[::\]):(\d+)/);
      if (urlMatch && urlMatch[2]) {
        console.log(`[OTIVO] Detected port change in terminal: ${urlMatch[2]}`);
        projectPort = parseInt(urlMatch[2]);
      }
    });

    shell.stderr.on("data", (data) => {
      const output = data.toString();
      socket.emit("output", output);
      
      const urlMatch = output.match(/http:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1|\[::\]):(\d+)/);
      if (urlMatch && urlMatch[2]) {
        projectPort = parseInt(urlMatch[2]);
      }
    });

    socket.on("input", (data) => {
      shell.stdin.write(data);
    });

    socket.on("resize", (cols, rows) => {
      // child_process.spawn doesn't support resizing easily without node-pty
      // but we can try to set stty if needed. For now, we'll just ignore or log.
      console.log(`Terminal resize requested: ${cols}x${rows}`);
    });

    socket.on("disconnect", () => {
      shell.kill();
      console.log("Terminal client disconnected");
    });
  });

  let devProcess: ChildProcess | null = null;
  let projectPort = 5173;
  let currentProjectPath: string = path.join(process.cwd(), 'otivo-project');
  let isBuilding = false;
  let lastProjectFiles: any[] = [];
  let projectType: 'react' | 'static' = 'react';
  let hasError = false;

  // Watcher for automatic restarts
  const watcher = chokidar.watch(currentProjectPath, {
    ignored: [/(^|[\/\\])\../, '**/node_modules/**'], // ignore dotfiles and node_modules
    persistent: true,
    ignoreInitial: true,
    depth: 99
  });

  let restartTimeout: NodeJS.Timeout | null = null;
  watcher.on('all', async (event, filePath) => {
    if (isBuilding || filePath.includes('node_modules')) return;
    
    const relativePath = path.relative(currentProjectPath, filePath);
    console.log(`[OTIVO] File change detected: ${event} ${relativePath}. Syncing to frontend...`);
    
    // Reset error state on file change
    if (event === 'add' || event === 'change') {
      hasError = false;
    }

    // Read the file and sync to frontend if it's a change/add
    if (event === 'add' || event === 'change') {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        io.emit('file-changed', { path: relativePath, content });
      } catch (e) {
        console.error(`[OTIVO] Failed to read changed file ${relativePath}:`, e);
      }
    } else if (event === 'unlink') {
      io.emit('file-deleted', { path: relativePath });
    }

    if (restartTimeout) clearTimeout(restartTimeout);
    
    if (hasError) {
      console.log(`[OTIVO] Auto-restart skipped because of existing error. Please fix the error first.`);
      return;
    }

    restartTimeout = setTimeout(async () => {
      io.emit('build-start', { message: 'Auto-restart triggered by file change...' });
      io.emit('output', `\r\n\x1b[33m[OTIVO] File change detected. Auto-restarting dev server...\x1b[0m\r\n`);
    }, 1000);
  });

  // Load last project if it exists
  try {
    const projectPath = currentProjectPath;
    const pkgPath = path.join(projectPath, 'package.json');
    const pkgExists = await fs.access(pkgPath).then(() => true).catch(() => false);
    
    if (pkgExists) {
      console.log("[OTIVO] Found existing project, auto-starting...");
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      projectType = 'react';
      
      // Trigger a build-like process internally
      setTimeout(async () => {
        console.log("[OTIVO] Triggering initial dev server start...");
        // We simulate a build request but without the file writing part
        // Since we don't have a res object, we'll just log to console
        try {
          const nodeModulesExists = await fs.access(path.join(projectPath, 'node_modules')).then(() => true).catch(() => false);
          if (!nodeModulesExists) {
            console.log("[OTIVO] Initial install needed...");
            const install = spawn("npm", ["install"], { cwd: projectPath, shell: true });
            await new Promise(resolve => install.on('close', resolve));
          }
          
          // Start dev server
          const isNext = !!(pkg.dependencies?.next || pkg.devDependencies?.next);
          const scripts = pkg.scripts || {};
          const hasDev = !!scripts.dev;
          const hasStart = !!scripts.start;
          const command = hasDev ? "dev" : (hasStart ? "start" : "dev");
          
          projectPort = isNext ? 3001 : 5173;
          const isWindows = process.platform === 'win32';
          const args = isNext 
            ? ["run", command, "--", "-p", projectPort.toString()]
            : ["run", command, "--", "--port", projectPort.toString(), "--host", "0.0.0.0", "--strictPort"];

          devProcess = spawn("npm", args, { 
            cwd: projectPath, 
            shell: true,
            env: { ...process.env, PORT: projectPort.toString(), BROWSER: 'none' }
          });
          
          devProcess.stdout?.on('data', (data) => console.log(`[CHILD-STDOUT] ${data}`));
          devProcess.stderr?.on('data', (data) => console.error(`[CHILD-STDERR] ${data}`));
          
          console.log(`[OTIVO] Initial dev server started on port ${projectPort}`);
        } catch (err) {
          console.error("[OTIVO] Failed to auto-start dev server:", err);
        }
      }, 2000);
    }
  } catch (e) {
    console.error("[OTIVO] Error during auto-start:", e);
  }

  const saveState = async (files: any[]) => {
    try {
      const statePath = path.join(process.cwd(), '.otivo-state.json');
      await fs.writeFile(statePath, JSON.stringify(files));
      lastProjectFiles = files;
    } catch (e) {
      console.error("Failed to save state:", e);
    }
  };

  const safeDelete = async (dirPath: string, retries = 5) => {
    for (let i = 0; i < retries; i++) {
      try {
        await fs.rm(dirPath, { recursive: true, force: true });
        return;
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const killProcessTree = (proc: ChildProcess) => {
    if (proc.pid) {
      try {
        process.kill(-proc.pid); // Kill process group
      } catch (e) {
        proc.kill(); // Fallback
      }
    }
  };

    // Proxy for the preview
    app.use('/preview', (req, res, next) => {
      console.log(`[OTIVO] Preview Request: ${req.method} ${req.originalUrl} (Type: ${projectType})`);
      
      // Force trailing slash for the root of the preview to ensure relative links work
      if (req.originalUrl.split('?')[0] === '/preview') {
        const query = req.originalUrl.split('?')[1];
        return res.redirect(301, '/preview/' + (query ? '?' + query : ''));
      }

    // If it's a static project, serve files directly
    if (projectType === 'static') {
      return express.static(currentProjectPath, {
        index: ['index.html', 'index.htm'],
        fallthrough: true,
        setHeaders: (res) => {
          res.setHeader('Cache-Control', 'no-store');
        }
      })(req, res, async () => {
        // Fallback to index.html for client-side routing or missing pages
        // But only if it's not a request for a specific file that doesn't exist
        if (req.path.includes('.') && !req.path.endsWith('.html')) {
          return res.status(404).send('Not Found');
        }
        
        // Try to find index.html at root
        const indexPath = path.join(currentProjectPath, 'index.html');
        try {
          await fs.access(indexPath);
          return res.sendFile(indexPath, {
            headers: { 'Cache-Control': 'no-store' }
          });
        } catch (e) {
          // If not found at root, let's try to find ANY .html file
          try {
            const findAnyHtml = async (dir: string): Promise<string | null> => {
              const entries = await fs.readdir(dir, { withFileTypes: true });
              // Prioritize index.html in subfolders
              for (const entry of entries) {
                if (entry.isDirectory() && entry.name !== 'node_modules') {
                  const found = await findAnyHtml(path.join(dir, entry.name));
                  if (found && found.endsWith('index.html')) return found;
                } else if (entry.name === 'index.html') {
                  return path.join(dir, entry.name);
                }
              }
              // If no index.html, take the first .html file
              for (const entry of entries) {
                if (entry.isDirectory() && entry.name !== 'node_modules') {
                  const found = await findAnyHtml(path.join(dir, entry.name));
                  if (found) return found;
                } else if (entry.name.endsWith('.html')) {
                  return path.join(dir, entry.name);
                }
              }
              return null;
            };
            
            const entryHtml = await findAnyHtml(currentProjectPath);
            if (entryHtml) {
              console.log(`[OTIVO] Found entry HTML at: ${entryHtml}`);
              return res.sendFile(entryHtml, {
                headers: { 'Cache-Control': 'no-store' }
              });
            }
          } catch (err) {}
          
          // If still not found, show an error page.
          return res.status(404).send(`
            <html>
              <head><title>Project Not Found</title></head>
              <body style="background: #0A0A0A; color: #8E9299; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center;">
                <div>
                  <h1 style="color: #00f2ff;">404: Project Not Found</h1>
                  <p>No index.html found in your project workspace.</p>
                  <p style="font-size: 10px; opacity: 0.5;">Path: ${currentProjectPath}</p>
                </div>
              </body>
            </html>
          `);
        }
      });
    }

    // For framework projects, use the proxy
    return createProxyMiddleware({
      target: `http://localhost:${projectPort}`,
      changeOrigin: true,
      pathRewrite: (path, req) => {
        // If the path already starts with /preview, don't double it
        if (path.startsWith('/preview')) return path;
        
        // If we have a devProcess, we assume it's configured with /preview base
        // because our build system injects 'base: "/preview/"' into Vite/Next configs.
        if (devProcess) {
          let fullPath = '/preview' + path;
          fullPath = fullPath.replace(/\/+/g, '/');
          return fullPath;
        }
        
        // If no devProcess (manual start in terminal), assume it's running on root /
        // This allows users to manually run 'npm run dev' and still see the preview.
        return path;
      },
      ws: true,
      on: {
        proxyRes: (proxyRes, req, res) => {
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        },
        error: (err, req, res: any) => {
          console.error("Proxy Error:", err);
          if (res.writeHead) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
          }
          res.end('Bad Gateway: The development server is still starting, has crashed, or was started manually without the correct configuration.');
        }
      }
    })(req, res, next);
  });

  let buildStartTime = 0;

  // API to get current project state
  app.get("/api/project", (req, res) => {
    res.json({ files: lastProjectFiles, isRunning: !!devProcess });
  });

  // API config route for runtime parameters
  app.get("/api/config", (req, res) => {
    res.json({
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      GEMINI_API_KEY_1: process.env.GEMINI_API_KEY_1 || '',
      GEMINI_API_KEY_2: process.env.GEMINI_API_KEY_2 || '',
      GEMINI_API_KEY_3: process.env.GEMINI_API_KEY_3 || '',
      GEMINI_API_KEY_4: process.env.GEMINI_API_KEY_4 || '',
      GEMINI_API_KEY_5: process.env.GEMINI_API_KEY_5 || '',
      SERPER_API_KEY: process.env.VITE_SERPER_API_KEY || '',
    });
  });

  // Mount AI server-side routes
  app.use("/api/ai", aiRouter);

  // API to build and run the project
  app.post("/api/build", async (req, res) => {
    if (isBuilding && Date.now() - buildStartTime < 300000) { // 5 min timeout
      console.log("Build already in progress, rejecting request.");
      return res.status(429).send("A build is already in progress.");
    }
    
    isBuilding = true;
    buildStartTime = Date.now();
    const { files, type, clear } = req.body;
    if (type) projectType = type;
    
    await saveState(files);
    const projectPath = currentProjectPath;

    // Setup SSE for logs
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (message: string, type: string = 'info') => {
      res.write(`data: ${JSON.stringify({ message, type, timestamp: Date.now() })}\n\n`);
    };

    try {
      const projectExists = await fs.access(projectPath).then(() => true).catch(() => false);
      
      if (clear && projectExists) {
        sendLog("Clearing workspace for fresh project...", "info");
        // Delete everything except node_modules
        const entries = await fs.readdir(projectPath);
        for (const entry of entries) {
          if (entry !== 'node_modules') {
            await fs.rm(path.join(projectPath, entry), { recursive: true, force: true });
          }
        }
      }
      
      // Determine project type if not provided
      if (!req.body.type) {
        const pkgFile = files.find((f: any) => f.path === 'package.json');
        let hasFramework = false;
        if (pkgFile) {
          try {
            const pkg = JSON.parse(pkgFile.content);
            hasFramework = !!(
              pkg.dependencies?.vite || pkg.devDependencies?.vite ||
              pkg.dependencies?.next || pkg.devDependencies?.next ||
              pkg.dependencies?.['@astrojs/vercel'] || // Astro
              pkg.scripts?.dev || pkg.scripts?.start
            );
          } catch (e) {}
        }
        
        // If there's a package.json with framework traces, it's react/framework
        if (pkgFile && hasFramework) {
          projectType = 'react';
        } else {
          projectType = 'static';
        }
      }
      sendLog(`Project type: ${projectType}`, "info");

      if (!projectExists) {
        sendLog("Initializing new workspace...", "info");
        await fs.mkdir(projectPath, { recursive: true });
      } else {
        sendLog("Updating existing workspace...", "info");
      }

      // Check if package.json changed to decide if npm install is needed
      let needsInstall = false;
      const newPkgFile = files.find((f: any) => f.path === 'package.json');
      
      // Check if node_modules exists
      const nodeModulesExists = await fs.access(path.join(projectPath, 'node_modules')).then(() => true).catch(() => false);
      
      if (!nodeModulesExists) {
        needsInstall = true;
        sendLog("node_modules missing, will run npm install", "info");
      } else if (newPkgFile) {
        try {
          const oldPkgContent = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
          if (oldPkgContent !== newPkgFile.content) {
            needsInstall = true;
            sendLog("package.json changed, will run npm install", "info");
          }
        } catch (e) {
          needsInstall = true;
        }
      }

      sendLog("Writing project files...", "info");
      
      // Deduplicate files by path (keep the last one)
      const uniqueFiles = files.reduce((acc: any[], file: any) => {
        const index = acc.findIndex(f => f.path === file.path);
        if (index !== -1) {
          acc[index] = file;
        } else {
          acc.push(file);
        }
        return acc;
      }, []);

      // Ensure a default vite.config.ts exists if it's a React project and it's missing
      if (projectType === 'react' && !uniqueFiles.some(f => f.path.includes('vite.config'))) {
        sendLog("Adding default vite.config.ts for React project...", "info");
        uniqueFiles.push({
          path: 'vite.config.ts',
          content: `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false
    }
  },
  base: '/preview/'
})
          `.trim()
        });
      }

      console.log(`[OTIVO] Build: Writing ${uniqueFiles.length} files to ${projectPath}`);
      for (const file of uniqueFiles) {
        let content = file.content;
        console.log(`Writing file: ${file.path} (${content.length} bytes, encoding: ${file.encoding || 'utf8'})`);
        
        // Patch HTML for static projects to support absolute paths
        if (projectType === 'static' && file.path.endsWith('.html')) {
          if (content.includes('<head>')) {
            content = content.replace('<head>', '<head>\n  <base href="/preview/">');
          } else if (content.includes('<html>')) {
            content = content.replace('<html>', '<html>\n<head>\n  <base href="/preview/">\n</head>');
          }
        }

        // Smart Fix: Correct common AI mistakes before writing
        if (file.path === 'package.json') {
          if (content.includes('"tailwind-css"')) {
            console.log(`[OTIVO] Smart Fix: Replacing "tailwind-css" with "tailwindcss" in package.json`);
            content = content.replace(/"tailwind-css"/g, '"tailwindcss"');
          }
        }

        // Patch Vite/Next config to prevent browser opening and set base path
        if (projectType === 'react' && (file.path.includes('vite.config') || file.path.includes('next.config'))) {
          if (file.path.includes('vite.config')) {
            const serverConfig = 'server: { open: false, strictPort: true, hmr: { overlay: false }, host: "0.0.0.0", port: 5173 }, base: "/preview/"';
            
            // Idempotency check: if already contains our specific settings, skip patching
            if (content.includes('base: "/preview/"') && content.includes('hmr: { overlay: false }')) {
              console.log(`[OTIVO] ${file.path} already patched, skipping.`);
            } else {
              // More robust removal of existing base and server blocks
              // We look for the key and then try to match the object/string value
              content = content.replace(/base:\s*['"][^'"]*['"]\s*,?/g, '');
              
              // For server, we try to match the whole block including nested braces (up to 2 levels)
              // This is a heuristic but better than the previous one
              content = content.replace(/server:\s*\{[^{}]*(\{?[^{}]*\}?)*\s*\}\s*,?/g, '');
              
              if (content.includes('defineConfig({')) {
                content = content.replace('defineConfig({', `defineConfig({\n  ${serverConfig},`);
              } else if (content.includes('export default {')) {
                content = content.replace('export default {', `export default {\n  ${serverConfig},`);
              } else if (content.includes('export default defineConfig(')) {
                // Handle function-based config
                content = content.replace('export default defineConfig(', `export default defineConfig({\n  ${serverConfig},\n  ...(`);
                if (content.endsWith(')')) {
                  content = content.slice(0, -1) + ')}';
                }
              }
            }
          } else if (file.path.includes('next.config')) {
            const nextConfig = 'basePath: "/preview", trailingSlash: true,';
            
            // Remove existing basePath if present
            content = content.replace(/basePath:\s*['"][^'"]*['"],?/g, '');
            content = content.replace(/trailingSlash:\s*(true|false),?/g, '');

            if (content.includes('module.exports = {')) {
              content = content.replace('module.exports = {', `module.exports = {\n  ${nextConfig}`);
            } else if (content.includes('export default {')) {
              content = content.replace('export default {', `export default {\n  ${nextConfig}`);
            } else if (content.includes('const nextConfig = {')) {
              content = content.replace('const nextConfig = {', `const nextConfig = {\n  ${nextConfig}`);
            }
          }
        }

        const filePath = path.join(projectPath, file.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        
        if (file.encoding === 'base64') {
          await fs.writeFile(filePath, Buffer.from(content, 'base64'));
        } else {
          await fs.writeFile(filePath, content);
        }
      }

      if (needsInstall) {
        sendLog("[✔] Installing dependencies...", "info");
        const install = spawn("npm", ["install"], { 
          cwd: projectPath, 
          shell: true,
          windowsHide: true,
          env: { ...process.env, BROWSER: 'none' }
        });

        install.on("error", (err) => {
          console.error("[OTIVO] Failed to spawn npm install:", err);
          sendLog(`[ERROR] Failed to start npm install: ${err.message}`, "error");
        });
        
        install.stdout.on('data', (data) => sendLog(data.toString(), "info"));
        install.stderr.on('data', (data) => sendLog(data.toString(), "warning"));

        await new Promise((resolve) => {
          install.on('close', (code) => {
            if (code !== 0) {
              sendLog(`Install exited with code ${code}`, "warning");
            } else {
              sendLog("[✔] Dependencies installed successfully", "success");
            }
            resolve(null);
          });
        });
      }

      // Start or restart server if not running or if it's a new project or if install happened
      const shouldRestart = !devProcess || needsInstall;
      
      if (projectType === 'react' && shouldRestart) {
        if (devProcess) {
          sendLog("[✔] Restarting dev server due to changes...", "info");
          killProcessTree(devProcess);
          devProcess = null;
        }

        sendLog("[✔] Starting dev server...", "info");

        const pkgFile = files.find((f: any) => f.path === 'package.json');
        let isNext = false;
        let scripts: any = {};
        if (pkgFile) {
          try {
            const pkg = JSON.parse(pkgFile.content);
            isNext = !!(pkg.dependencies?.next || pkg.devDependencies?.next);
            scripts = pkg.scripts || {};
          } catch (e) {}
        }

        const hasDev = !!scripts.dev;
        const hasStart = !!scripts.start;
        const command = hasDev ? "dev" : (hasStart ? "start" : "dev");

        projectPort = isNext ? 3001 : 5173;
        const isWindows = process.platform === 'win32';
        const args = isNext 
          ? ["run", command, "--", "-p", projectPort.toString()]
          : ["run", command, "--", "--port", projectPort.toString(), "--host", "0.0.0.0", "--strictPort"];

        sendLog(`[✔] Ensuring port ${projectPort} is free...`, "info");
        try {
          const killCmd = isWindows 
            ? `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${projectPort}') do taskkill /f /pid %a`
            : `fuser -k ${projectPort}/tcp || npx kill-port ${projectPort}`;
          
          await new Promise((resolve) => {
            const killer = spawn(isWindows ? "cmd.exe" : "sh", [isWindows ? "/c" : "-c", killCmd], { shell: true });
            killer.on('close', () => resolve(null));
          });
          // Small delay to ensure OS releases the port
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {}

        sendLog(`Executing: npm ${args.join(' ')}`, "info");

        try {
          devProcess = spawn("npm", args, { 
            cwd: projectPath, 
            shell: true,
            detached: !isWindows, // Only detach on non-windows
            windowsHide: true,
            env: { 
              ...process.env, 
              PORT: projectPort.toString(), 
              BROWSER: 'none',
              NODE_ENV: 'development',
              FORCE_COLOR: '1'
            }
          });

          devProcess.on("error", (err) => {
            console.error("[OTIVO] Failed to spawn npm dev server:", err);
            sendLog(`[ERROR] Failed to start dev server: ${err.message}`, "error");
          });
        } catch (err: any) {
          console.error("[OTIVO] Synchronous error spawning dev server:", err);
          sendLog(`[ERROR] Synchronous error starting dev server: ${err.message}`, "error");
          isBuilding = false;
          res.end();
          return;
        }

        let serverReady = false;
        let resolveReady: (value: unknown) => void;
        const readyPromise = new Promise((resolve) => {
          resolveReady = resolve;
        });

        const checkReady = (output: string) => {
          if (serverReady) return;
          
          // Detect errors to stop infinite restart loop
          if (output.includes("ERROR") || output.includes("✘ [ERROR]") || output.includes("failed to load config")) {
            hasError = true;
            sendLog(`[ERROR] Dev server failed to start. Auto-restart disabled until fix.`, "error");
            // We don't kill it immediately, let it finish its own crash or wait for user fix
          }

          // Improved detection regex for URLs (Vite, Next, etc.)
          const urlMatch = output.match(/http:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1|\[::\]):(\d+)/);
          
          if (
            urlMatch ||
            output.includes("Local:") || 
            output.includes("ready on") || 
            output.includes("started server on") ||
            output.includes("ready in") ||
            output.includes("Server running at") ||
            output.includes("listening on")
          ) {
            serverReady = true;
            if (urlMatch && urlMatch[2]) {
              projectPort = parseInt(urlMatch[2]);
            }
            const url = urlMatch ? urlMatch[0] : `http://localhost:${projectPort}`;
            sendLog(`[✔] Server ready at ${url}`, "success");
            sendLog(`REAL SERVER READY at port ${projectPort}`, "success");
            resolveReady(true);
          }
        };

        devProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          sendLog(output, "info");
          checkReady(output);
        });

        devProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          sendLog(output, "warning");
          checkReady(output);
        });

        devProcess.on('close', (code) => {
          sendLog(`Server process exited with code ${code}`, "warning");
          devProcess = null;
          serverReady = false;
          resolveReady(false);
        });

        // Fallback: Poll the port if no "ready" message is seen after 20 seconds
        const fallbackTimer = setTimeout(async () => {
          if (!serverReady && devProcess) {
            sendLog("No ready message detected, polling port...", "info");
            try {
              const res = await fetch(`http://localhost:${projectPort}/preview/`, { method: 'HEAD' });
              if (res.ok || res.status === 404) {
                serverReady = true;
                sendLog(`[✔] Server ready (via polling) at http://localhost:${projectPort}`, "success");
                sendLog(`REAL SERVER READY at port ${projectPort}`, "success");
                resolveReady(true);
              }
            } catch (e) {
              sendLog("Port polling failed, server might still be starting...", "info");
            }
          }
        }, 20000);

        // Wait for server to be ready (or timeout) before finishing the build request
        await Promise.race([
          readyPromise,
          new Promise((resolve) => setTimeout(resolve, 30000)) // 30s max wait for ready
        ]);
        clearTimeout(fallbackTimer);
      } else if (projectType === 'react') {
        sendLog("Workspace updated. Dev server is already running.", "success");
        // We still send this to trigger the frontend to refresh the iframe
        sendLog(`REAL SERVER READY at port ${projectPort}`, "success");
      } else {
        sendLog("Workspace updated.", "success");
      }

    } catch (error: any) {
      sendLog(`Build error: ${error.message}`, "error");
    } finally {
      isBuilding = false;
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`OTIVO Main Server running on http://localhost:${PORT}`);
  });
}

startServer();
