import { OpenCanvasDocument } from './types';

const DB_NAME = 'opencanvas-assets';
const DB_VERSION = 1;
const IMAGE_STORE = 'images';

type ImageRecord = {
  imageId: string;
  dataUrl: string;
};

const canUseIndexedDb = () => typeof indexedDB !== 'undefined';

function openAssetDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: 'imageId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function saveImageAsset(imageId: string, dataUrl: string) {
  const db = await openAssetDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(IMAGE_STORE, 'readwrite');
    transaction.objectStore(IMAGE_STORE).put({ imageId, dataUrl });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });

  db.close();
}

export async function loadImageAssets(
  imageIds: string[]
): Promise<Record<string, string>> {
  const uniqueImageIds = Array.from(new Set(imageIds));
  const db = await openAssetDb();
  if (!db || uniqueImageIds.length === 0) return {};

  const assets = await new Promise<Record<string, string>>((resolve) => {
    const loadedAssets: Record<string, string> = {};
    const transaction = db.transaction(IMAGE_STORE, 'readonly');
    const store = transaction.objectStore(IMAGE_STORE);

    uniqueImageIds.forEach((imageId) => {
      const request = store.get(imageId);
      request.onsuccess = () => {
        const result = request.result as ImageRecord | undefined;
        if (result?.dataUrl) {
          loadedAssets[imageId] = result.dataUrl;
        }
      };
    });

    transaction.oncomplete = () => resolve(loadedAssets);
    transaction.onerror = () => resolve(loadedAssets);
  });

  db.close();
  return assets;
}

export function collectImageIdsFromDocuments(
  documents: OpenCanvasDocument[]
): string[] {
  const imageIds = new Set<string>();

  documents.forEach((document) => {
    document.history.forEach((state) => {
      state.actions.forEach((action) => {
        const imageId = action.imageElement?.imageId;
        if (imageId) {
          imageIds.add(imageId);
        }
      });
    });
  });

  return Array.from(imageIds);
}
