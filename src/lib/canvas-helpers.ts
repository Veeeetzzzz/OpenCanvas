import { DrawingAction, DrawingState, Point } from './types';

export type BackgroundLineStyle = 'blank' | 'dots' | 'squares' | 'lines';

export type LineSegment = {
  from: Point;
  to: Point;
};

export const getDraggedPosition = (point: Point, dragStart: Point): Point => ({
  x: point.x - dragStart.x,
  y: point.y - dragStart.y,
});

export function replaceActionAtIndex(
  actions: DrawingAction[],
  index: number,
  nextAction: DrawingAction
): DrawingAction[] {
  if (index < 0 || index >= actions.length) {
    return [...actions, nextAction];
  }
  return actions.map((action, actionIndex) =>
    actionIndex === index ? nextAction : action
  );
}

export function removeActionAtIndex(
  actions: DrawingAction[],
  index: number
): DrawingAction[] {
  if (index < 0 || index >= actions.length) {
    return actions;
  }
  return actions.filter((_, actionIndex) => actionIndex !== index);
}

export function createActionReplacementState(
  currentState: DrawingState,
  index: number,
  nextAction: DrawingAction
): DrawingState {
  return {
    actions: replaceActionAtIndex(currentState.actions, index, nextAction),
    currentAction: null,
  };
}

export function getPreviewAction(
  action: DrawingAction,
  index: number,
  preview: {
    image?: DrawingAction | null;
    imageIndex?: number | null;
    text?: DrawingAction | null;
    textIndex?: number | null;
  }
): DrawingAction {
  if (preview.image && preview.imageIndex === index) {
    return preview.image;
  }
  if (preview.text && preview.textIndex === index) {
    return preview.text;
  }
  return action;
}

export function getBackgroundLineSegments(
  backgroundStyle: BackgroundLineStyle,
  width: number,
  height: number,
  size: number
): LineSegment[] {
  if (backgroundStyle !== 'squares' && backgroundStyle !== 'lines') {
    return [];
  }

  const segments: LineSegment[] = [];

  if (backgroundStyle === 'squares') {
    for (let x = size; x < width; x += size) {
      segments.push({ from: { x, y: 0 }, to: { x, y: height } });
    }
  }

  for (let y = size; y < height; y += size) {
    segments.push({ from: { x: 0, y }, to: { x: width, y } });
  }

  return segments;
}
