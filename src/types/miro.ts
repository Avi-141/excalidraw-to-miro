/**
 * Miro REST API v2 types
 * @see https://developers.miro.com/reference
 */

// Common types
export interface MiroPosition {
  x: number;
  y: number;
  origin?: 'center';
}

export interface MiroGeometry {
  width?: number;
  height?: number;
  rotation?: number;
}

// Shape types
export type MiroShapeType =
  | 'rectangle'
  | 'round_rectangle'
  | 'circle'
  | 'triangle'
  | 'rhombus'
  | 'parallelogram'
  | 'trapezoid'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'wedge_round_rectangle_callout'
  | 'star'
  | 'flow_chart_predefined_process'
  | 'cloud'
  | 'cross'
  | 'can'
  | 'right_arrow'
  | 'left_arrow'
  | 'left_right_arrow'
  | 'left_brace'
  | 'right_brace';

export interface MiroShapeStyle {
  fillColor?: string;
  fillOpacity?: string; // "0.0" to "1.0"
  fontFamily?: string;
  fontSize?: string; // e.g., "14"
  textAlign?: 'left' | 'center' | 'right';
  textAlignVertical?: 'top' | 'middle' | 'bottom';
  borderColor?: string;
  borderWidth?: string; // e.g., "2.0"
  borderOpacity?: string;
  borderStyle?: 'normal' | 'dashed' | 'dotted';
  color?: string; // text color
}

export interface MiroShapeData {
  content?: string;
  shape: MiroShapeType;
}

export interface MiroCreateShapeRequest {
  data: MiroShapeData;
  style?: MiroShapeStyle;
  position: MiroPosition;
  geometry?: MiroGeometry;
}

// Text types
export interface MiroTextStyle {
  color?: string;
  fillColor?: string;
  fillOpacity?: string;
  fontFamily?: string;
  fontSize?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface MiroTextData {
  content: string;
}

export interface MiroCreateTextRequest {
  data: MiroTextData;
  style?: MiroTextStyle;
  position: MiroPosition;
  geometry?: MiroGeometry;
}

// Sticky note types
export type MiroStickyNoteShape = 'square' | 'rectangle';

export interface MiroStickyNoteStyle {
  fillColor?:
    | 'gray'
    | 'light_yellow'
    | 'yellow'
    | 'orange'
    | 'light_green'
    | 'green'
    | 'dark_green'
    | 'cyan'
    | 'light_pink'
    | 'pink'
    | 'violet'
    | 'red'
    | 'light_blue'
    | 'blue'
    | 'dark_blue'
    | 'black';
  textAlign?: 'left' | 'center' | 'right';
  textAlignVertical?: 'top' | 'middle' | 'bottom';
}

export interface MiroStickyNoteData {
  content: string;
  shape?: MiroStickyNoteShape;
}

export interface MiroCreateStickyNoteRequest {
  data: MiroStickyNoteData;
  style?: MiroStickyNoteStyle;
  position: MiroPosition;
}

// Connector types
export type MiroConnectorShape = 'straight' | 'elbowed' | 'curved';
export type MiroStrokeStyle = 'normal' | 'dashed' | 'dotted';
export type MiroConnectorCaption = 'none' | 'auto_position';

export type MiroStrokeCap =
  | 'none'
  | 'stealth'
  | 'rounded_stealth'
  | 'diamond'
  | 'filled_diamond'
  | 'oval'
  | 'filled_oval'
  | 'arrow'
  | 'triangle'
  | 'filled_triangle'
  | 'erd_one'
  | 'erd_many'
  | 'erd_one_or_many'
  | 'erd_only_one'
  | 'erd_zero_or_one'
  | 'erd_zero_or_many';

export interface MiroConnectorStyle {
  startStrokeCap?: MiroStrokeCap;
  endStrokeCap?: MiroStrokeCap;
  strokeStyle?: MiroStrokeStyle;
  strokeColor?: string;
  strokeWidth?: string;
}

export interface MiroConnectorEndpoint {
  id: string;
  position?: {
    x: string; // percentage e.g. "50%"
    y: string;
  };
  snapTo?: 'auto' | 'top' | 'right' | 'bottom' | 'left';
}

export interface MiroCreateConnectorRequest {
  startItem: MiroConnectorEndpoint;
  endItem: MiroConnectorEndpoint;
  shape?: MiroConnectorShape;
  style?: MiroConnectorStyle;
  captions?: Array<{
    content: string;
    position?: string;
  }>;
}

// API response types
export interface MiroItem {
  id: string;
  type: string;
  position: MiroPosition;
  geometry?: MiroGeometry;
  createdAt: string;
  createdBy: { id: string; type: string };
  modifiedAt: string;
  modifiedBy: { id: string; type: string };
}

export interface MiroShapeItem extends MiroItem {
  type: 'shape';
  data: MiroShapeData;
  style: MiroShapeStyle;
}

export interface MiroTextItem extends MiroItem {
  type: 'text';
  data: MiroTextData;
  style: MiroTextStyle;
}

export interface MiroStickyNoteItem extends MiroItem {
  type: 'sticky_note';
  data: MiroStickyNoteData;
  style: MiroStickyNoteStyle;
}

export interface MiroConnectorItem extends MiroItem {
  type: 'connector';
  startItem: MiroConnectorEndpoint;
  endItem: MiroConnectorEndpoint;
  style: MiroConnectorStyle;
}

// Image types
export interface MiroImageData {
  imageUrl: string;
  title?: string;
}

export interface MiroCreateImageMetadata {
  title?: string;
  position?: MiroPosition;
  geometry?: MiroGeometry;
  parent?: { id: string };
}

export interface MiroImageItem extends MiroItem {
  type: 'image';
  data: MiroImageData;
}

// Frame types
export interface MiroFrameStyle {
  fillColor?: string;
}

export interface MiroFrameData {
  title?: string;
  format?: 'custom';
  type?: 'freeform';
}

export interface MiroCreateFrameRequest {
  data: MiroFrameData;
  style?: MiroFrameStyle;
  position?: MiroPosition;
  geometry?: {
    width?: number;
    height?: number;
  };
}

export interface MiroFrameItem extends MiroItem {
  type: 'frame';
  data: MiroFrameData;
  style?: MiroFrameStyle;
}

// Update item parent
export interface MiroUpdateItemRequest {
  parent?: { id: string };
  position?: MiroPosition;
}
