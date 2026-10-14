import { WebContainer } from '@webcontainer/api';

class WebContainerService {
  private instance: WebContainer | null = null;
  private bootPromise: Promise<WebContainer> | null = null;

  async boot() {
    // Check global window for instance or promise first (survives HMR)
    if ((window as any).__webcontainer_instance) {
      this.instance = (window as any).__webcontainer_instance;
      return this.instance!;
    }
    
    if ((window as any).__webcontainer_boot_promise) {
      this.bootPromise = (window as any).__webcontainer_boot_promise;
      return this.bootPromise!;
    }

    if (this.instance) return this.instance;
    if (this.bootPromise) return this.bootPromise;

    this.bootPromise = (async () => {
      try {
        if (!window.crossOriginIsolated) {
          console.warn('[OTIVO] WebContainer boot skipped: Cross-Origin Isolation is NOT active.');
          return null as any; // Return null but promise resolves
        }

        console.log('[OTIVO] Booting WebContainer...');
        
        // Add a 20-second timeout to boot
        const bootTimeout = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('WebContainer boot timed out')), 20000)
        );
        
        this.instance = await Promise.race([
          WebContainer.boot(),
          bootTimeout
        ]);
        
        (window as any).__webcontainer_instance = this.instance;
        console.log('[OTIVO] WebContainer booted successfully');
        return this.instance;
      } catch (error: any) {
        if (error.message?.includes('Unable to create more instances')) {
          console.warn('[OTIVO] WebContainer boot collision detected. Checking for instance...');
          
          if ((window as any).__webcontainer_instance) {
            this.instance = (window as any).__webcontainer_instance;
            return this.instance!;
          }
        }
        
        console.error('[OTIVO] Failed to boot WebContainer:', error);
        this.bootPromise = null;
        (window as any).__webcontainer_boot_promise = null;
        throw error;
      }
    })();

    (window as any).__webcontainer_boot_promise = this.bootPromise;
    return this.bootPromise;
  }

  async warmUp() {
    console.log('[OTIVO] Warming up WebContainer engine...');
    return this.boot();
  }

  getInstance() {
    return this.instance;
  }

  async mount(files: Record<string, any>) {
    const instance = await this.boot();
    if (!instance) return;
    await instance.mount(files);
  }

  async mountSnapshot(snapshot: Uint8Array) {
    const instance = await this.boot();
    if (!instance) return;
    // @ts-ignore - mount can take a Uint8Array snapshot in newer versions
    await instance.mount(snapshot);
  }

  async writeFile(path: string, content: string) {
    const instance = await this.boot();
    if (!instance) return;
    await instance.fs.writeFile(path, content);
  }

  async readFile(path: string) {
    const instance = await this.boot();
    if (!instance) return "";
    return await instance.fs.readFile(path, 'utf-8');
  }

  async mkdir(path: string) {
    const instance = await this.boot();
    if (!instance) return;
    await instance.fs.mkdir(path, { recursive: true });
  }

  async readTreeRecursive(path: string = '.'): Promise<any[]> {
    const instance = await this.boot();
    if (!instance) return [];
    
    const entries = await instance.fs.readdir(path, { withFileTypes: true });
    
    const tree: any[] = [];
    
    for (const entry of entries) {
      const entryPath = path === '.' ? entry.name : `${path}/${entry.name}`;
      
      if (entry.isDirectory()) {
        const children = await this.readTreeRecursive(entryPath);
        tree.push({
          name: entry.name,
          path: entryPath,
          type: 'directory',
          children
        });
      } else {
        const content = await instance.fs.readFile(entryPath, 'utf-8');
        tree.push({
          name: entry.name,
          path: entryPath,
          type: 'file',
          content
        });
      }
    }
    
    return tree;
  }
}

export const webContainerService = new WebContainerService();
