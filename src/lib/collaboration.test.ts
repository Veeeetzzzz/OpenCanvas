import { beforeEach, describe, expect, it } from 'vitest';
import {
  CollaborationService,
  createProcessedEventTracker,
  isCollaborationEventPayload,
} from './collaboration';
import { OpenCanvasDocument } from './types';

const documentSnapshot: OpenCanvasDocument = {
  id: 'doc-1',
  name: 'Shared Doc',
  history: [
    {
      actions: [
        {
          tool: 'pencil',
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
          ],
          color: '#000000',
          lineWidth: 5,
        },
      ],
      currentAction: null,
    },
  ],
  historyIndex: 0,
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('isCollaborationEventPayload', () => {
  it('accepts valid collaboration event payloads', () => {
    const payload = {
      id: 'event_123',
      type: 'drawing',
      userId: 'user_123',
      data: { update: { actions: [] } },
      timestamp: Date.now(),
    };

    expect(isCollaborationEventPayload(payload)).toBe(true);
  });

  it('rejects unknown event types', () => {
    const payload = {
      id: 'event_123',
      type: 'unknown_type',
      userId: 'user_123',
      data: {},
      timestamp: Date.now(),
    };

    expect(isCollaborationEventPayload(payload)).toBe(false);
  });

  it('rejects malformed payloads with missing required fields', () => {
    const payload = {
      type: 'drawing',
      data: {},
    };

    expect(isCollaborationEventPayload(payload)).toBe(false);
  });

  it('rejects payloads without event ids', () => {
    const payload = {
      type: 'drawing',
      userId: 'user_123',
      data: {},
      timestamp: Date.now(),
    };

    expect(isCollaborationEventPayload(payload)).toBe(false);
  });
});

describe('createProcessedEventTracker', () => {
  it('accepts each event id only once', () => {
    const tracker = createProcessedEventTracker();

    expect(tracker.remember('event-1')).toBe(true);
    expect(tracker.remember('event-1')).toBe(false);
  });
});

describe('CollaborationService', () => {
  it('stores and loads the shared document snapshot for local links', async () => {
    const host = new CollaborationService();
    const link = host.generateShareLink(documentSnapshot);
    const shareId = new URL(link).searchParams.get('share');
    expect(shareId).toBeTruthy();

    const guest = new CollaborationService();
    const joinedDocument = await guest.joinSharedSession(shareId!);

    expect(joinedDocument).toEqual(documentSnapshot);

    host.disconnect();
    guest.disconnect();
  });
});
