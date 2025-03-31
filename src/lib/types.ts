export type Tool = 'hand' | 'pencil' | 'eraser' | 'text' | 'image' | 'color';
export type DrawingAction = {
  tool: Tool;
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
};

export type DrawingState = {
  actions: DrawingAction[];
  currentAction: DrawingAction | null;
};