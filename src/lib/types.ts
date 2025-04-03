export type Tool = 'hand' | 'pencil' | 'eraser' | 'text' | 'image' | 'color';

export type Point = {
  x: number;
  y: number;
};

export type TextElement = {
  text: string;
  position: Point;
  font: string;
  fontSize: number;
  color: string;
};

export type ImageElement = {
  url: string;
  position: Point;
  width: number;
  height: number;
};

export type DrawingAction = {
  tool: Tool;
  points: Point[];
  color: string;
  lineWidth: number;
  textElement?: TextElement;
  imageElement?: ImageElement;
};

export type DrawingState = {
  actions: DrawingAction[];
  currentAction: DrawingAction | null;
}