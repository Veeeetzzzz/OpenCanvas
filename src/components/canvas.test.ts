import { describe, expect, it } from 'vitest';
import { getDraggedPosition } from './canvas';

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
