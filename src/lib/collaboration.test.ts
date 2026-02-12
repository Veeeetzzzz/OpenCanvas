import { describe, expect, it } from 'vitest';
import { isCollaborationEventPayload } from './collaboration';

describe('isCollaborationEventPayload', () => {
  it('accepts valid collaboration event payloads', () => {
    const payload = {
      type: 'drawing',
      userId: 'user_123',
      data: { update: { actions: [] } },
      timestamp: Date.now(),
    };

    expect(isCollaborationEventPayload(payload)).toBe(true);
  });

  it('rejects unknown event types', () => {
    const payload = {
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
});
