import { describe, expect, it } from 'vitest';
import {
  CURRENT_DOCUMENT_ID_STORAGE_KEY,
  DOCUMENTS_STORAGE_KEY,
  loadDocumentStorage,
  resolveDeleteDocumentState,
  resolveRedoIndex,
  resolveUndoIndex,
  saveDocumentStorage,
} from './document-state';

type TestDoc = { id: string; name: string };

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('resolveDeleteDocumentState', () => {
  it('selects first remaining document when deleting current', () => {
    const docs: TestDoc[] = [
      { id: 'doc-1', name: 'One' },
      { id: 'doc-2', name: 'Two' },
      { id: 'doc-3', name: 'Three' },
    ];

    const result = resolveDeleteDocumentState(docs, 'doc-2', 'doc-2');

    expect(result.nextDocs.map((doc) => doc.id)).toEqual(['doc-1', 'doc-3']);
    expect(result.nextCurrentId).toBe('doc-1');
  });

  it('clears current id when deleting last document', () => {
    const docs: TestDoc[] = [{ id: 'doc-1', name: 'One' }];

    const result = resolveDeleteDocumentState(docs, 'doc-1', 'doc-1');

    expect(result.nextDocs).toEqual([]);
    expect(result.nextCurrentId).toBeNull();
  });

  it('preserves current id when deleting a different document', () => {
    const docs: TestDoc[] = [
      { id: 'doc-1', name: 'One' },
      { id: 'doc-2', name: 'Two' },
    ];

    const result = resolveDeleteDocumentState(docs, 'doc-1', 'doc-2');

    expect(result.nextDocs.map((doc) => doc.id)).toEqual(['doc-1']);
    expect(result.nextCurrentId).toBe('doc-1');
  });
});

describe('history index helpers', () => {
  it('allows the first action to undo back to a blank canvas', () => {
    expect(resolveUndoIndex(0)).toBe(-1);
  });

  it('redo advances from a blank canvas to the first action', () => {
    expect(resolveRedoIndex(2, -1)).toBe(0);
  });
});

describe('document storage helpers', () => {
  it('removes stale storage when saving an empty document list', () => {
    const storage = new MemoryStorage();
    storage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify([{ id: 'doc-1' }]));
    storage.setItem(CURRENT_DOCUMENT_ID_STORAGE_KEY, 'doc-1');

    saveDocumentStorage(storage, [], null);

    expect(storage.getItem(DOCUMENTS_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(CURRENT_DOCUMENT_ID_STORAGE_KEY)).toBeNull();
  });

  it('falls back to the first document when stored current id is stale', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      DOCUMENTS_STORAGE_KEY,
      JSON.stringify([{ id: 'doc-1', name: 'One' }])
    );
    storage.setItem(CURRENT_DOCUMENT_ID_STORAGE_KEY, 'missing');

    const result = loadDocumentStorage<TestDoc>(storage);

    expect(result.currentDocumentId).toBe('doc-1');
  });

  it('migrates valid legacy session storage into primary storage', () => {
    const primary = new MemoryStorage();
    const legacy = new MemoryStorage();
    legacy.setItem(
      DOCUMENTS_STORAGE_KEY,
      JSON.stringify([{ id: 'doc-2', name: 'Two' }])
    );
    legacy.setItem(CURRENT_DOCUMENT_ID_STORAGE_KEY, 'doc-2');

    const result = loadDocumentStorage<TestDoc>(primary, legacy);

    expect(result.source).toBe('legacy');
    expect(result.currentDocumentId).toBe('doc-2');
    expect(primary.getItem(DOCUMENTS_STORAGE_KEY)).toContain('doc-2');
  });
});
