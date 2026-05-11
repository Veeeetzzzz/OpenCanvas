export type DocumentSummary = {
  id: string;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const DOCUMENTS_STORAGE_KEY = 'openCanvasDocuments';
export const CURRENT_DOCUMENT_ID_STORAGE_KEY = 'openCanvasCurrentId';

export function resolveDeleteDocumentState<T extends DocumentSummary>(
  docs: T[],
  currentId: string | null,
  targetId: string
): { nextDocs: T[]; nextCurrentId: string | null } {
  const nextDocs = docs.filter((doc) => doc.id !== targetId);
  if (nextDocs.length === 0) {
    return { nextDocs: [], nextCurrentId: null };
  }
  if (currentId === targetId) {
    return { nextDocs, nextCurrentId: nextDocs[0].id };
  }
  return { nextDocs, nextCurrentId: currentId };
}

export function resolveUndoIndex(historyIndex: number): number {
  return historyIndex >= 0 ? historyIndex - 1 : -1;
}

export function resolveRedoIndex(
  historyLength: number,
  historyIndex: number
): number {
  return historyIndex < historyLength - 1 ? historyIndex + 1 : historyIndex;
}

export function isDocumentSummary(value: unknown): value is DocumentSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string'
  );
}

export function isOpenCanvasDocumentLike(value: unknown): value is DocumentSummary & {
  name: string;
  history: unknown[];
  historyIndex: number;
} {
  return (
    isDocumentSummary(value) &&
    'name' in value &&
    typeof value.name === 'string' &&
    'history' in value &&
    Array.isArray(value.history) &&
    'historyIndex' in value &&
    typeof value.historyIndex === 'number'
  );
}

export function normalizeCurrentDocumentId<T extends DocumentSummary>(
  docs: T[],
  currentId: string | null
): string | null {
  if (docs.length === 0) return null;
  return currentId && docs.some((doc) => doc.id === currentId)
    ? currentId
    : docs[0].id;
}

function parseStoredDocuments<T extends DocumentSummary>(
  rawDocuments: string | null,
  rawCurrentId: string | null
): { documents: T[]; currentDocumentId: string | null } | null {
  if (!rawDocuments) return null;

  try {
    const parsed = JSON.parse(rawDocuments);
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every(isDocumentSummary)
    ) {
      return null;
    }

    return {
      documents: parsed as T[],
      currentDocumentId: normalizeCurrentDocumentId(parsed as T[], rawCurrentId),
    };
  } catch {
    return null;
  }
}

export function loadDocumentStorage<T extends DocumentSummary>(
  primaryStorage: StorageLike,
  legacyStorage?: StorageLike
): {
  documents: T[] | null;
  currentDocumentId: string | null;
  source: 'primary' | 'legacy' | 'empty';
} {
  const primary = parseStoredDocuments<T>(
    primaryStorage.getItem(DOCUMENTS_STORAGE_KEY),
    primaryStorage.getItem(CURRENT_DOCUMENT_ID_STORAGE_KEY)
  );

  if (primary) {
    return { ...primary, source: 'primary' };
  }

  primaryStorage.removeItem(DOCUMENTS_STORAGE_KEY);
  primaryStorage.removeItem(CURRENT_DOCUMENT_ID_STORAGE_KEY);

  if (!legacyStorage) {
    return { documents: null, currentDocumentId: null, source: 'empty' };
  }

  const legacy = parseStoredDocuments<T>(
    legacyStorage.getItem(DOCUMENTS_STORAGE_KEY),
    legacyStorage.getItem(CURRENT_DOCUMENT_ID_STORAGE_KEY)
  );

  if (!legacy) {
    return { documents: null, currentDocumentId: null, source: 'empty' };
  }

  primaryStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(legacy.documents));
  if (legacy.currentDocumentId) {
    primaryStorage.setItem(
      CURRENT_DOCUMENT_ID_STORAGE_KEY,
      legacy.currentDocumentId
    );
  }

  return { ...legacy, source: 'legacy' };
}

export function saveDocumentStorage<T extends DocumentSummary>(
  storage: StorageLike,
  docs: T[],
  currentId: string | null
) {
  const normalizedCurrentId = normalizeCurrentDocumentId(docs, currentId);
  if (!normalizedCurrentId) {
    storage.removeItem(DOCUMENTS_STORAGE_KEY);
    storage.removeItem(CURRENT_DOCUMENT_ID_STORAGE_KEY);
    return;
  }

  storage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(docs));
  storage.setItem(CURRENT_DOCUMENT_ID_STORAGE_KEY, normalizedCurrentId);
}
