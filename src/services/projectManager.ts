import { getWebContainer } from '../lib/webcontainer';
import { openDB } from '../lib/db';
// import { snapshot } from '@webcontainer/snapshot';

const PROJECT_STORE = 'projects_snapshot';
const DB_NAME = 'otivo_db';

interface ProjectSnapshot {
  id: string; // usually 'my-project'
  tree: any; // FileSystemTree exported from WebContainer
  timestamp: number;
  files: any[]; // The raw React state of files
  lastCommand?: string;
  terminalHistory?: string;
  packageLock?: string; // used for caching check
  binarySnapshot?: Uint8Array; // The binary snapshot including node_modules
}

/**
 * Ensures the projects_snapshot object store exists in IndexedDB.
 */
async function getStore(mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const db = await openDB();
  // Depending on how db.ts is structured, we might need to handle upgrade.
  // Assuming 'projects_snapshot' is added, or we have a generalized document store.
  // If the store doesn't exist, we'll try to trigger an upgrade by incrementing version,
  // but standard IndexedDB doesn't allow smooth upgrades without closing. 
  // We'll use a fallback localized DB for snapshots if it fails.
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(PROJECT_STORE, mode);
      resolve(tx.objectStore(PROJECT_STORE));
    } catch {
      // Fallback DB if main db doesn't have the table
      const request = indexedDB.open(DB_NAME + '_snapshots', 1);
      request.onupgradeneeded = (e) => {
        const fallbackDb = (e.target as any).result;
        fallbackDb.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      };
      request.onsuccess = (e) => {
        const fallbackDb = (e.target as any).result;
        const tx = fallbackDb.transaction(PROJECT_STORE, mode);
        resolve(tx.objectStore(PROJECT_STORE));
      };
      request.onerror = (e) => reject(request.error);
    }
  });
}

export const projectManager = {
  /**
   * Captures the current state of the WebContainer and saves it.
   */
  async saveSnapshot(projectId: string, filesState: any[], lastCommand?: string, terminalHistory?: string, includeBinary = false) {
    try {
      const container = await getWebContainer();
      if (!container) {
        console.warn(`[OTIVO Snapshot] Skipping snapshot for ${projectId}: WebContainer not available.`);
        return;
      }
      
      console.log(`[OTIVO Snapshot] Exporting VFS for ${projectId}...`);
      const tree = await container.export('/');

      // Create a binary snapshot including node_modules if requested
      let binarySnapshot: Uint8Array | undefined;
      if (includeBinary) {
        console.log(`[OTIVO Snapshot] Creating binary snapshot for ${projectId}...`);
        try {
          // @ts-ignore
          // binarySnapshot = await snapshot(container);
          console.log(`[OTIVO Snapshot] Binary snapshot feature disabled due to build issues.`);
        } catch (snapErr) {
          console.warn('[OTIVO Snapshot] Failed to create binary snapshot:', snapErr);
        }
      }

      let packageLock = '';
      if (tree['package-lock.json'] && (tree['package-lock.json'] as any).file) {
        const contents = (tree['package-lock.json'] as any).file.contents;
        packageLock = typeof contents === 'string' ? contents : new TextDecoder().decode(contents as Uint8Array);
      }

      const projectSnapshot: ProjectSnapshot = {
        id: projectId,
        tree,
        timestamp: Date.now(),
        files: filesState,
        lastCommand,
        terminalHistory,
        packageLock,
        binarySnapshot
      };

      const store = await getStore('readwrite');
      return new Promise<void>((resolve, reject) => {
        const request = store.put(projectSnapshot);
        request.onsuccess = () => {
          console.log(`[OTIVO Snapshot] Saved project ${projectId} successfully.`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('[OTIVO Snapshot] Failed to save snapshot:', err);
    }
  },

  /**
   * Retrieves a snapshot from the database.
   */
  async getSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
    try {
      const store = await getStore('readonly');
      return new Promise((resolve, reject) => {
        const request = store.get(projectId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[OTIVO Snapshot] Could not load snapshot:', err);
      return null;
    }
  },

  /**
   * Hydrates the WebContainer with the snapshot tree.
   */
  async hydrateProject(projectSnapshot: ProjectSnapshot) {
    const container = await getWebContainer();
    if (!container) {
      console.warn(`[OTIVO Snapshot] Cannot hydrate project ${projectSnapshot.id}: WebContainer not available.`);
      return;
    }
    
    if (projectSnapshot.binarySnapshot) {
      console.log(`[OTIVO Snapshot] Mounting binary snapshot for ${projectSnapshot.id}...`);
      // @ts-ignore
      await container.mount(projectSnapshot.binarySnapshot);
      console.log(`[OTIVO Snapshot] Binary snapshot mounted successfully.`);
    } else {
      console.log(`[OTIVO Snapshot] Mounting saved tree for ${projectSnapshot.id}...`);
      await container.mount(projectSnapshot.tree);
    }
  },

  /**
   * Determines if we can safely skip npm install by looking at lockfile continuity.
   */
  async checkBinaryCache(projectSnapshot: ProjectSnapshot): Promise<boolean> {
    if (projectSnapshot.binarySnapshot) {
      console.log('[OTIVO Fast Load] Binary snapshot found. Skipping npm install.');
      return true;
    }
    
    if (!projectSnapshot.packageLock) return false;
    
    console.log('[OTIVO Fast Load] No binary snapshot. Checking lockfile...');
    return false;
  }
};
