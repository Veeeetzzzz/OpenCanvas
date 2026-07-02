import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { collaborationService } from '@/lib/collaboration';
import {
  CURRENT_DOCUMENT_ID_STORAGE_KEY,
  DOCUMENTS_STORAGE_KEY,
} from '@/lib/document-state';
import { loadImageAssets } from '@/lib/image-assets';
import { OpenCanvasDocument } from '@/lib/types';

vi.mock('@/lib/image-assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image-assets')>();
  return {
    ...actual,
    loadImageAssets: vi.fn(async () => ({
      'img-seeded': 'data:image/png;base64,seeded',
    })),
    saveImageAsset: vi.fn(async () => undefined),
  };
});

const mockLoadImageAssets = vi.mocked(loadImageAssets);

const getCanvas = (container: HTMLElement) => {
  const canvas = container.querySelector('canvas');
  if (!canvas) {
    throw new Error('Expected canvas to render');
  }
  canvas.getBoundingClientRect = () =>
    ({
      bottom: 1080,
      height: 1080,
      left: 0,
      right: 1920,
      top: 0,
      width: 1920,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return canvas;
};

describe('App smoke flows', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    mockLoadImageAssets.mockClear();
  });

  afterEach(() => {
    collaborationService.disconnect();
    cleanup();
  });

  it('draws with pointer events and can undo the first stroke', async () => {
    const { container } = render(<App />);

    await screen.findByRole('button', { name: 'Document 1' });
    const canvas = getCanvas(container);

    fireEvent.pointerDown(canvas, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(canvas, {
      clientX: 140,
      clientY: 120,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerUp(canvas, {
      clientX: 160,
      clientY: 140,
      pointerId: 1,
      pointerType: 'touch',
    });

    const undoButton = screen.getByRole('button', { name: 'Undo Action' });
    await waitFor(() => expect(undoButton).toBeEnabled());

    fireEvent.click(undoButton);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Redo Action' })).toBeEnabled()
    );
  });

  it('generates a same-browser share link from the share dialog', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Share' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate Share Link' }));

    const shareInput = await screen.findByLabelText('Share Link');
    await waitFor(() =>
      expect((shareInput as HTMLInputElement).value).toContain('?share=share_')
    );
  });

  it('loads missing image assets for restored documents', async () => {
    const seededDocument: OpenCanvasDocument = {
      id: 'doc-seeded',
      name: 'Restored',
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
                imageId: 'img-seeded',
                position: { x: 100, y: 100 },
                width: 80,
                height: 60,
              },
            },
          ],
        },
      ],
      historyIndex: 0,
    };
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify([seededDocument]));
    localStorage.setItem(CURRENT_DOCUMENT_ID_STORAGE_KEY, seededDocument.id);

    render(<App />);

    await screen.findByRole('button', { name: 'Restored' });
    await waitFor(() =>
      expect(mockLoadImageAssets).toHaveBeenCalledWith(['img-seeded'])
    );
  });
});
