import { ProjectFile } from '../types';

export interface BuildLog {
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateProject(files: ProjectFile[]): ValidationResult {
  const errors: string[] = [];
  
  const hasPackageJson = files.some(f => f.path === 'package.json');
  const hasIndexHtml = files.some(f => f.path === 'index.html');
  
  // Only require entry point if there are multiple files or it's a code project
  if (files.length > 0 && !hasPackageJson && !hasIndexHtml) {
    const hasCode = files.some(f => ['.js', '.jsx', '.ts', '.tsx', '.html', '.css'].some(ext => f.name.endsWith(ext)));
    if (hasCode) {
      errors.push("Missing project entry point (package.json or index.html)");
    }
  }

  if (hasPackageJson) {
    const packageJsonFile = files.find(f => f.path === 'package.json');
    try {
      const pkg = JSON.parse(packageJsonFile?.content || '{}');
      if (!pkg.scripts || !pkg.scripts.dev) {
        errors.push("package.json is missing 'dev' script");
      }
    } catch (e) {
      errors.push("Invalid package.json format");
    }
  }

  // Check for broken imports in JS/TS files
  files.forEach(file => {
    if (['.js', '.jsx', '.ts', '.tsx'].some(ext => file.name.endsWith(ext))) {
      const importRegex = /import\s+.*\s+from\s+['"](.*)['"]/g;
      let match;
      while ((match = importRegex.exec(file.content)) !== null) {
        const importPath = match[1];
        if (importPath.startsWith('.')) {
          const resolvedPath = resolvePath(file.path, importPath);
          const exists = files.some(f => 
            f.path === resolvedPath || 
            f.path === `${resolvedPath}.js` || 
            f.path === `${resolvedPath}.jsx` || 
            f.path === `${resolvedPath}.ts` || 
            f.path === `${resolvedPath}.tsx` ||
            f.path === `${resolvedPath}/index.js` ||
            f.path === `${resolvedPath}/index.jsx` ||
            f.path === `${resolvedPath}/index.ts` ||
            f.path === `${resolvedPath}/index.tsx`
          );
          if (!exists) {
            errors.push(`Broken import in ${file.path}: Cannot find ${importPath}`);
          }
        }
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function parseBuildLogs(logs: BuildLog[]): string[] {
  const errors: string[] = [];
  logs.forEach(log => {
    if (log.type === 'error') {
      errors.push(log.message);
    }
    // Also look for common error patterns in info/warning logs
    if (log.message.toLowerCase().includes('failed to compile') || 
        log.message.toLowerCase().includes('error:') ||
        log.message.toLowerCase().includes('exception')) {
      errors.push(log.message);
    }
  });
  return [...new Set(errors)]; // Deduplicate
}

function resolvePath(currentPath: string, relativePath: string): string {
  const parts = currentPath.split('/');
  parts.pop(); // Remove filename
  
  const relParts = relativePath.split('/');
  for (const part of relParts) {
    if (part === '.') continue;
    if (part === '..') {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  
  return parts.join('/');
}

export async function autoFixProject(files: ProjectFile[], errors: string[]): Promise<ProjectFile[]> {
  let updatedFiles = [...files];

  for (const error of errors) {
    if (error.includes("Missing package.json")) {
      // This should be handled by the template injection
    }
    
    if (error.includes("Broken import")) {
      // AI should handle this, but we could try to find the file
    }
  }

  return updatedFiles;
}
