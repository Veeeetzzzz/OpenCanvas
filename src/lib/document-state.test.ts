import { describe, expect, it } from 'vitest';
import { resolveDeleteDocumentState } from './document-state';

type TestDoc = { id: string; name: string };

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
