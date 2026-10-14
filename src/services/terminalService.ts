import { WebContainerProcess } from '@webcontainer/api';
import { getWebContainer } from '../lib/webcontainer';
import { io, Socket } from 'socket.io-client';

export interface ProcessError {
  command: string;
  exitCode: number;
  output: string;
}

class TerminalService {
  private shellProcess: WebContainerProcess | null = null;
  private inputWriter: WritableStreamDefaultWriter<string> | null = null;
  private socket: Socket | null = null;
  private useSocket = false;
  private listeners: ((data: string) => void)[] = [];
  private fileListeners: ((event: { type: 'changed' | 'deleted', path: string, content?: string }) => void)[] = [];
  private errorListeners: ((error: ProcessError) => void)[] = [];
  private outputBuffer: string[] = [];
  private MAX_BUFFER_LINES = 100;
  private serverReadyListeners: ((port: number, url: string) => void)[] = [];

  async bootstrap() {
    if (this.shellProcess || this.socket) return;
    
    try {
      const container = await getWebContainer();
      console.log('[OTIVO] Spawning integrated WebContainer shell...');
      
      this.shellProcess = await container.spawn('jsh', {
        terminal: {
          cols: 80,
          rows: 24,
        }
      });

      this.inputWriter = this.shellProcess.input.getWriter();

      this.shellProcess.output.pipeTo(new WritableStream({
        write: (data) => {
          this.handleOutput(data);
        }
      }));
      
      console.log('[OTIVO] WebContainer shell spawned and piping active.');
    } catch (error: any) {
      console.warn('[OTIVO] WebContainer boot failed, falling back to Server Terminal:', error.message);
      this.useSocket = true;
      this.setupSocket();
    }
  }

  private setupSocket() {
    if (this.socket) return;

    // Connect to the same host
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('[OTIVO] Connected to Server Terminal via Socket.io');
      this.handleOutput('\x1b[33m[OTIVO] WebContainer restricted. Connected to Server Terminal.\x1b[0m\r\n');
    });

    this.socket.on('output', (data: string) => {
      this.handleOutput(data);
    });

    this.socket.on('file-changed', (data: { path: string, content: string }) => {
      this.fileListeners.forEach(l => l({ type: 'changed', path: data.path, content: data.content }));
    });

    this.socket.on('file-deleted', (data: { path: string }) => {
      this.fileListeners.forEach(l => l({ type: 'deleted', path: data.path }));
    });

    this.socket.on('disconnect', () => {
      console.log('[OTIVO] Disconnected from Server Terminal');
    });
  }

  // For backward compatibility with existing code that calls connect()
  async connect() {
    return this.bootstrap();
  }

  private handleOutput(data: string) {
    // Add to buffer
    const lines = data.split('\n');
    this.outputBuffer = [...this.outputBuffer, ...lines].slice(-this.MAX_BUFFER_LINES);
    
    // Notify listeners
    this.listeners.forEach(l => l(data));
    
    // Detect server ready
    const serverUrlMatch = data.match(/http:\/\/(localhost|0\.0\.0\.0|127\.0\.0\.1|\[::\]):(\d+)/);
    if (serverUrlMatch) {
      const port = parseInt(serverUrlMatch[2]);
      const url = serverUrlMatch[0];
      this.serverReadyListeners.forEach(l => l(port, url));
    }
    
    // Scan for immediate critical errors (e.g. during dev mode)
    if (this.detectErrorInOutput(data)) {
      console.warn('[OTIVO] Terminal watchdog detected a potential build error.');
      // We don't trigger auto-fix immediately on every line to avoid spam, 
      // but we could signal a "warning" state.
    }
  }

  private detectErrorInOutput(data: string): boolean {
    const errorPatterns = [
      /error:/i,
      /failed to compile/i,
      /npm ERR!/i,
      /cannot find module/i,
      /sh:.*not found/i,
      /Module not found:/i
    ];
    return errorPatterns.some(pattern => pattern.test(data));
  }

  async write(data: string) {
    if (this.useSocket) {
      if (!this.socket) this.setupSocket();
      this.socket?.emit('input', data);
      return;
    }

    if (!this.inputWriter) await this.bootstrap();
    await this.inputWriter?.write(data);
  }

  async execute(command: string) {
    const cmd = command.endsWith('\n') ? command : command + '\n';
    await this.write(cmd);
  }

  /**
   * Runs a command and waits for its exit, returning the result.
   * Useful for one-off tasks like 'npm install'.
   */
  async executeWithAgent(command: string, args: string[] = []) {
    if (this.useSocket) {
      // For socket fallback, we just write the command and hope for the best
      // or we could implement a more complex protocol.
      // For now, let's just write it.
      const fullCmd = `${command} ${args.join(' ')}\n`;
      await this.write(fullCmd);
      return { exitCode: 0, output: "Command sent to server terminal." };
    }

    const container = await getWebContainer();
    const process = await container.spawn(command, args);
    let processOutput = "";

    process.output.pipeTo(new WritableStream({
      write: (data) => {
        // Limit processOutput to prevent Out of Memory errors
        if (processOutput.length < 100000) {
          processOutput += data;
        } else {
          processOutput = processOutput.slice(-50000) + data;
        }
        this.handleOutput(data);
      }
    }));

    const exitCode = await process.exit;
    
    if (exitCode !== 0) {
      const error: ProcessError = {
        command: `${command} ${args.join(' ')}`,
        exitCode,
        output: processOutput || this.getRecentOutput()
      };
      this.errorListeners.forEach(l => l(error));
    }

    return { exitCode, output: processOutput };
  }

  async runShell(command: string) {
    if (this.useSocket) {
      await this.write(`${command}\n`);
      return { exitCode: 0, output: "Command sent to server shell." };
    }

    const container = await getWebContainer();
    // Use jsh -c to support complex commands, pipes, and redirects
    const process = await container.spawn('jsh', ['-c', command]);
    let processOutput = "";

    process.output.pipeTo(new WritableStream({
      write: (data) => {
        // Limit processOutput to prevent Out of Memory errors
        if (processOutput.length < 100000) {
          processOutput += data;
        } else {
          processOutput = processOutput.slice(-50000) + data;
        }
        this.handleOutput(data);
      }
    }));

    const exitCode = await process.exit;
    return { exitCode, output: processOutput };
  }

  onOutput(callback: (data: string) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  onFileEvent(callback: (event: { type: 'changed' | 'deleted', path: string, content?: string }) => void) {
    this.fileListeners.push(callback);
    return () => {
      this.fileListeners = this.fileListeners.filter(l => l !== callback);
    };
  }

  onProcessError(callback: (error: ProcessError) => void) {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter(l => l !== callback);
    };
  }

  onServerReady(callback: (port: number, url: string) => void) {
    this.serverReadyListeners.push(callback);
    return () => {
      this.serverReadyListeners = this.serverReadyListeners.filter(l => l !== callback);
    };
  }

  getRecentOutput(): string {
    return this.outputBuffer.join('\n');
  }

  getErrorBuffer(): string {
    // For now we just return recent output as the "error buffer"
    return this.getRecentOutput();
  }

  clearErrorBuffer() {
    // No-op for now or clear the buffer
  }

  restoreHistory(history: string) {
    if (!history) return;
    this.outputBuffer = history.split('\n').slice(-this.MAX_BUFFER_LINES);
    this.listeners.forEach(l => l(history));
  }

  async resize(cols: number, rows: number) {
    if (this.useSocket) {
      this.socket?.emit('resize', cols, rows);
      return;
    }
    if (this.shellProcess) {
      this.shellProcess.resize({ cols, rows });
    }
  }

  async terminateProcesses() {
    if (this.useSocket) {
      await this.write('\x03'); // Send Ctrl+C
      await new Promise(resolve => setTimeout(resolve, 500));
      return;
    }
    // For WebContainer, we can't easily kill all, but we can try to restart the shell
    // or tell the shell to kill processes.
    await this.write('\x03');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  async killPort(port: number) {
    console.log(`[OTIVO] Attempting to kill process on port ${port}...`);
    // npx kill-port is a reliable way across environments if installed, 
    // but in jsh we can try fuser or just rely on the next command failing gracefully
    // or use the WebContainer specific way if it existed.
    // For now, we'll use a shell command.
    await this.execute(`npx kill-port ${port}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async runInstall() {
    console.log('[OTIVO] Starting monitored turbo npm install...');
    return this.executeWithAgent('npm', ['install', '--prefer-offline', '--no-audit']);
  }

  async runDevServer() {
    if (this.useSocket) {
      await this.write('npm run dev\n');
      return { success: true, message: "Dev server command sent to socket." };
    }
    
    const container = await getWebContainer();
    const process = await container.spawn('npm', ['run', 'dev']);
    
    return new Promise((resolve) => {
      let output = "";
      const reader = process.output.getReader();
      let isResolved = false;
      
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          resolve({ 
            success: false, 
            output: output || "Timeout waiting for server output.", 
            message: "Dev server timed out while starting. Check logs for errors." 
          });
        }
      }, 30000); // 30s timeout
      
      const read = async () => {
        const { done, value } = await reader.read();
        if (done) {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            resolve({ 
              success: false, 
              output, 
              message: "Dev server process exited prematurely. Analyze the output to fix errors." 
            });
          }
          return;
        }
        if (!isResolved) {
          // Limit memory usage for output buffer used in error reporting
          if (output.length < 50000) {
            output += value;
          }
        }
        this.handleOutput(value);
        
        if (!isResolved) {
          // Detect success
          if (value.includes('Local:') || value.includes('http://localhost:') || value.includes('ready in')) {
            isResolved = true;
            clearTimeout(timeout);
            resolve({ success: true, output, message: "Dev server is running successfully." });
          }
          // Detect common errors
          else if (value.includes('address already in use') || value.includes('EADDRINUSE')) {
            // Extract port if possible to proactively kill it
            const portMatch = value.match(/EADDRINUSE:?.*:(\d+)/i) || value.match(/port\s+(\d+)\s+is\s+in\s+use/i);
            const portToKill = portMatch ? parseInt(portMatch[1]) : null;
            
            if (portToKill) {
              this.killPort(portToKill);
            }

            isResolved = true;
            clearTimeout(timeout);
            resolve({ 
              success: false, 
              output, 
              message: `Port ${portToKill || ''} already in use. AI has attempted to kill the process on that port. Please try again.` 
            });
          }
        }

        // Always continue reading to prevent stream buffer overflow and hanging
        read();
      };
      read();
    });
  }

  getShell() {
    return this.shellProcess;
  }
}

export const terminalService = new TerminalService();
