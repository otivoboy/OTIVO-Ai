
const DB_NAME = 'otivo_db';
const SESSIONS_STORE = 'sessions';
const SIDEBAR_STORE = 'sidebar_messages';
const PROJECTS_STORE = 'projects';
const DB_VERSION = 3;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SIDEBAR_STORE)) {
        db.createObjectStore(SIDEBAR_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const saveSessions = async (sessions: any[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(SESSIONS_STORE, 'readwrite');
  const store = tx.objectStore(SESSIONS_STORE);

  for (const session of sessions) {
    // Ensure we don't save sidebar messages here
    if (session.id !== 'sidebar_messages') {
      store.put(session);
    }
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const loadSessions = async (): Promise<any[]> => {
  const db = await openDB();
  const tx = db.transaction(SESSIONS_STORE, 'readonly');
  const store = tx.objectStore(SESSIONS_STORE);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      // Filter out any accidental sidebar messages and sort
      const sessions = request.result
        .filter((s: any) => s.id !== 'sidebar_messages')
        .sort((a: any, b: any) => {
          const timeA = a.lastUpdated || a.timestamp || 0;
          const timeB = b.lastUpdated || b.timestamp || 0;
          return timeB - timeA;
        });
      resolve(sessions);
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveSidebarMessages = async (messages: any[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(SIDEBAR_STORE, 'readwrite');
  const store = tx.objectStore(SIDEBAR_STORE);
  
  store.put({ id: 'sidebar_messages', messages, lastUpdated: Date.now() });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const loadSidebarMessages = async (): Promise<any[]> => {
  const db = await openDB();
  const tx = db.transaction(SIDEBAR_STORE, 'readonly');
  const store = tx.objectStore(SIDEBAR_STORE);
  const request = store.get('sidebar_messages');

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result?.messages || []);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteSessionFromDB = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(SESSIONS_STORE, 'readwrite');
  const store = tx.objectStore(SESSIONS_STORE);
  store.delete(id);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const saveProjectsToDB = async (projects: any[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(PROJECTS_STORE, 'readwrite');
  const store = tx.objectStore(PROJECTS_STORE);

  // Clear existing items then put new ones? Or just put all?
  // Since we pass the whole array, we might want to ensure sync.
  // However, simple put(project) inside a loop is safer for large arrays.
  for (const project of projects) {
    store.put(project);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const loadProjectsFromDB = async (): Promise<any[]> => {
  const db = await openDB();
  const tx = db.transaction(PROJECTS_STORE, 'readonly');
  const store = tx.objectStore(PROJECTS_STORE);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const deleteProjectFromDB = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(PROJECTS_STORE, 'readwrite');
  const store = tx.objectStore(PROJECTS_STORE);
  store.delete(id);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
