import { describe, expect, it } from 'vitest';
import {
  createActionReplacementState,
  getBackgroundLineSegments,
  getDraggedPosition,
  replaceActionAtIndex,
} from '@/lib/canvas-helpers';
import { DrawingAction, DrawingState } from '@/lib/types';

describe('getDraggedPosition', () => {
  it('calculates image/text drag offsets consistently', () => {
    const position = getDraggedPosition({ x: 140, y: 90 }, { x: 40, y: 15 });
    expect(position).toEqual({ x: 100, y: 75 });
  });

  it('supports negative movement without mutating inputs', () => {
    const point = { x: 25, y: 30 };
    const dragStart = { x: 50, y: 80 };

    const position = getDraggedPosition(point, dragStart);

    expect(position).toEqual({ x: -25, y: -50 });
    expect(point).toEqual({ x: 25, y: 30 });
    expect(dragStart).toEqual({ x: 50, y: 80 });
  });
});

describe('canvas state helpers', () => {
  const originalTextAction: DrawingAction = {
    tool: 'text',
    points: [],
    color: '#000000',
    lineWidth: 0,
    textElement: {
      text: 'Before',
      position: { x: 10, y: 20 },
      font: 'Arial',
      fontSize: 16,
      color: '#000000',
    },
  };

  const nextTextAction: DrawingAction = {
    ...originalTextAction,
    textElement: {
      ...originalTextAction.textElement!,
      text: 'After',
    },
  };

  it('replaces edited text instead of appending a duplicate action', () => {
    const actions = replaceActionAtIndex([originalTextAction], 0, nextTextAction);

    expect(actions).toHaveLength(1);
    expect(actions[0].textElement?.text).toBe('After');
  });

  it('creates one replacement state for image transform commits', () => {
    const currentState: DrawingState = {
      actions: [originalTextAction],
      currentAction: null,
    };

    const nextState = createActionReplacementState(
      currentState,
      0,
      nextTextAction
    );

    expect(nextState.actions).toHaveLength(1);
    expect(nextState.actions[0]).toBe(nextTextAction);
    expect(currentState.actions[0]).toBe(originalTextAction);
  });

  it('draws ruled line backgrounds horizontally', () => {
    const lines = getBackgroundLineSegments('lines', 100, 60, 20);

    expect(lines).toEqual([
      { from: { x: 0, y: 20 }, to: { x: 100, y: 20 } },
      { from: { x: 0, y: 40 }, to: { x: 100, y: 40 } },
    ]);
  });
});
