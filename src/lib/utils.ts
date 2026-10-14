import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ProjectFile } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function deduplicateFiles(files: ProjectFile[]): ProjectFile[] {
  const map = new Map<string, ProjectFile>();
  files.forEach(file => {
    // Normalize path: remove leading ./ and /
    const normalizedPath = file.path.replace(/^\.\//, '').replace(/^\//, '');
    map.set(normalizedPath, {
      ...file,
      path: normalizedPath
    });
  });
  return Array.from(map.values());
}

export function normalizeProjectFiles(files: ProjectFile[]): ProjectFile[] {
  if (files.length === 0) return files;

  // Filter out any empty paths or weird entries
  const validFiles = files.filter(f => f.path && f.path.trim() !== '');
  if (validFiles.length === 0) return files;

  const paths = validFiles.map(f => f.path);
  
  // Check if all files share the same first directory
  // We only do this if there are multiple files or if the single file is in a subdirectory
  const firstPathParts = paths[0].split('/');
  if (firstPathParts.length <= 1 && paths.length > 1) {
    // Check if ANY file is at the root. If yes, we don't normalize.
    const hasFileAtRoot = paths.some(p => !p.includes('/'));
    if (hasFileAtRoot) return validFiles;
  }

  const firstDir = firstPathParts[0];
  if (!firstDir) return validFiles;

  const allShareFirstDir = paths.every(p => p.startsWith(firstDir + '/'));

  if (allShareFirstDir) {
    const normalized = validFiles.map(f => ({
      ...f,
      path: f.path.substring(firstDir.length + 1)
    }));
    // Recursively check for more common folders
    return normalizeProjectFiles(normalized);
  }

  return validFiles;
}

export async function overlayLogo(base64Image: string, base64Logo: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.onload = () => {
        const padding = Math.min(canvas.width, canvas.height) * 0.05;
        const maxLogoSize = Math.min(canvas.width, canvas.height) * 0.2; // 20% of image size
        
        let logoWidth = logo.width;
        let logoHeight = logo.height;
        
        if (logoWidth > logoHeight) {
          logoHeight = (maxLogoSize / logoWidth) * logoHeight;
          logoWidth = maxLogoSize;
        } else {
          logoWidth = (maxLogoSize / logoHeight) * logoWidth;
          logoHeight = maxLogoSize;
        }
        
        // Top right placement
        ctx.drawImage(logo, canvas.width - logoWidth - padding, padding, logoWidth, logoHeight);
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      };
      logo.onerror = (e) => reject(new Error('Failed to load logo: ' + e));
      logo.src = base64Logo.startsWith('data:') ? base64Logo : `data:image/png;base64,${base64Logo}`;
    };
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = base64Image.startsWith('data:') ? base64Image : `data:image/png;base64,${base64Image}`;
  });
}

export function playSuccessSound() {
  const audio = new Audio('/sounds/success.mp3');
  audio.volume = 0.6;
  audio.play().catch(() => {
    // Fallback to simple beep
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  });
}

export function playErrorSound() {
  const audio = new Audio('/sounds/error.mp3');
  audio.volume = 0.5;
  audio.play().catch(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  });
}

export function playFixSound() {
  const audio = new Audio('/sounds/fix.mp3');
  audio.volume = 0.5;
  audio.play().catch(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  });
}

export function transformFilesToWebContainer(files: ProjectFile[]) {
  const tree: any = {};
  files.forEach(file => {
    if (!file.path) return;
    const parts = file.path.split('/');
    let current = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { directory: {} };
      }
      current = current[part].directory;
    }
    const fileName = parts[parts.length - 1];
    
    let contents: string | Uint8Array = file.content;
    if (file.encoding === 'base64') {
      const binaryString = atob(file.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      contents = bytes;
    }

    current[fileName] = {
      file: {
        contents
      }
    };
  });
  return tree;
}
