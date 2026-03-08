// Offline Draft Storage — natív IndexedDB wrapper
// DB: zmail-offline, Store: drafts

export interface OfflineDraft {
  id: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments?: Array<{ filename: string; mimeType: string; content: string }>;
  status: 'draft' | 'pending';
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'zmail-offline';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraft(draft: OfflineDraft): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(draft);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getDrafts(): Promise<OfflineDraft[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result as OfflineDraft[]);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function getDraft(id: string): Promise<OfflineDraft | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      db.close();
      resolve(request.result as OfflineDraft | undefined);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getPendingDrafts(): Promise<OfflineDraft[]> {
  const all = await getDrafts();
  return all.filter((d) => d.status === 'pending');
}
