/**
 * Excalidraw JSON types based on the documented schema
 * @see https://docs.excalidraw.com/docs/codebase/json-schema
 */

export type ExcalidrawElementType =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'text'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'image'
  | 'frame'
  | 'group'
  | 'embeddable';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type FillStyle = 'solid' | 'hachure' | 'cross-hatch' | 'dots';
export type RoundnessType = 'legacy' | 'proportional_radius' | 'adaptive_radius';
export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type ArrowheadType = 'arrow' | 'bar' | 'dot' | 'triangle' | null;

export interface ExcalidrawPoint {
  x: number;
  y: number;
}

export interface BoundElement {
  id: string;
  type: 'arrow' | 'text';
}

export interface ExcalidrawElementBase {
  id: string;
  type: ExcalidrawElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: string | null;
  roundness: { type: RoundnessType; value?: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: BoundElement[] | null;
  updated: number;
  link: string | null;
  locked: boolean;
  customData?: Record<string, unknown>;
}

export interface ExcalidrawRectangle extends ExcalidrawElementBase {
  type: 'rectangle';
}

export interface ExcalidrawEllipse extends ExcalidrawElementBase {
  type: 'ellipse';
}

export interface ExcalidrawDiamond extends ExcalidrawElementBase {
  type: 'diamond';
}

export interface ExcalidrawText extends ExcalidrawElementBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: number; // 1 = Virgil, 2 = Helvetica, 3 = Cascadia
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  baseline: number;
  containerId: string | null;
  originalText: string;
  lineHeight: number;
}

export interface ExcalidrawArrow extends ExcalidrawElementBase {
  type: 'arrow';
  points: [number, number][];
  startBinding: {
    elementId: string;
    focus: number;
    gap: number;
  } | null;
  endBinding: {
    elementId: string;
    focus: number;
    gap: number;
  } | null;
  startArrowhead: ArrowheadType;
  endArrowhead: ArrowheadType;
}

export interface ExcalidrawLine extends ExcalidrawElementBase {
  type: 'line';
  points: [number, number][];
  startBinding: null;
  endBinding: null;
  startArrowhead: ArrowheadType;
  endArrowhead: ArrowheadType;
}

export interface ExcalidrawFreedraw extends ExcalidrawElementBase {
  type: 'freedraw';
  points: [number, number, number?][]; // [x, y, pressure?]
  pressures: number[];
  simulatePressure: boolean;
}

export interface ExcalidrawImage extends ExcalidrawElementBase {
  type: 'image';
  fileId: string;
  status: 'pending' | 'saved' | 'error';
  scale: [number, number];
}

export interface ExcalidrawFrame extends ExcalidrawElementBase {
  type: 'frame';
  name: string | null;
}

export type ExcalidrawElement =
  | ExcalidrawRectangle
  | ExcalidrawEllipse
  | ExcalidrawDiamond
  | ExcalidrawText
  | ExcalidrawArrow
  | ExcalidrawLine
  | ExcalidrawFreedraw
  | ExcalidrawImage
  | ExcalidrawFrame;

export interface ExcalidrawAppState {
  viewBackgroundColor: string;
  gridSize: number | null;
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
}

export interface ExcalidrawFile {
  type: 'excalidraw';
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState?: ExcalidrawAppState;
  files?: Record<string, {
    mimeType: string;
    id: string;
    dataURL: string;
    created: number;
  }>;
}
