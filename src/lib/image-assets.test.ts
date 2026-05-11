import { describe, expect, it } from 'vitest';
import { collectImageIdsFromDocuments } from './image-assets';
import { OpenCanvasDocument } from './types';

describe('collectImageIdsFromDocuments', () => {
  it('collects unique image ids referenced by document history', () => {
    const documents: OpenCanvasDocument[] = [
      {
        id: 'doc-1',
        name: 'One',
        history: [
          {
            currentAction: null,
            actions: [
              {
                tool: 'image',
                points: [],
                color: '',
                lineWidth: 0,
                imageElement: {
                  imageId: 'img-1',
                  position: { x: 0, y: 0 },
                  width: 100,
                  height: 100,
                },
              },
              {
                tool: 'image',
                points: [],
                color: '',
                lineWidth: 0,
                imageElement: {
                  imageId: 'img-1',
                  position: { x: 10, y: 10 },
                  width: 50,
                  height: 50,
                },
              },
            ],
          },
        ],
        historyIndex: 0,
      },
    ];

    expect(collectImageIdsFromDocuments(documents)).toEqual(['img-1']);
  });
});
