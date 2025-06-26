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
  imageId: string;
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

// New types for collaboration
export type CollaborationUser = {
  id: string;
  name: string;
  color: string;
  cursor?: Point;
};

export type SharedDocument = {
  id: string;
  name: string;
  history: DrawingState[];
  historyIndex: number;
  lastModified: number;
  isShared: boolean;
  shareId?: string; // Secret share identifier
};

export type CollaborationEvent = {
  type: 'drawing' | 'cursor' | 'document_update' | 'user_join' | 'user_leave';
  userId: string;
  data: any;
  timestamp: number;
};