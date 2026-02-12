export type DocumentSummary = {
  id: string;
};

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
