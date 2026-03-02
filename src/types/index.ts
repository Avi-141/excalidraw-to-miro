export * from './excalidraw';
export * from './miro';

/**
 * Mapping between Excalidraw element IDs and created Miro item IDs
 */
export interface IdMap {
  [excalidrawId: string]: string; // miroItemId
}

/**
 * Result of converting an Excalidraw file
 */
export interface ConversionResult {
  success: boolean;
  itemsCreated: number;
  connectorsCreated: number;
  framesCreated: number;
  imagesCreated: number;
  freedrawConverted: number;
  skippedElements: Array<{
    id: string;
    type: string;
    reason: string;
  }>;
  idMap: IdMap;
  errors: string[];
}

/**
 * Conversion options
 */
export interface ConversionOptions {
  /** Scale factor for coordinates (default: 1) */
  scale: number;
  /** X offset on the Miro board */
  offsetX: number;
  /** Y offset on the Miro board */
  offsetY: number;
  /** Whether to create connectors (default: true) */
  createConnectors: boolean;
  /** Distance threshold for snapping disconnected arrows to nearby shapes */
  snapThreshold: number;
  /** Whether to skip freedraw elements without converting (default: false) */
  skipFreedraw: boolean;
  /** Whether to convert freedraw elements to SVG images (default: true) */
  convertFreedraw: boolean;
  /** Whether to convert image elements (default: true) */
  convertImages: boolean;
  /** Whether to convert frames (default: true) */
  convertFrames: boolean;
  /** Verbose logging */
  verbose: boolean;
  /** Dry run — parse and map without calling the Miro API */
  dryRun: boolean;
}

export interface PreviewElement {
  id: string;
  type: string;
  status: 'will_create' | 'will_skip' | 'degraded';
  miroType: string;
  reason?: string;
  fidelityNote?: string;
}

export interface PreviewResult {
  totalElements: number;
  willCreate: number;
  willSkip: number;
  degraded: number;
  elements: PreviewElement[];
  breakdown: {
    shapes: number;
    text: number;
    connectors: number;
    images: number;
    freedraw: number;
    frames: number;
  };
}

export const DEFAULT_OPTIONS: ConversionOptions = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  createConnectors: true,
  snapThreshold: 50,
  skipFreedraw: false,
  convertFreedraw: true,
  convertImages: true,
  convertFrames: true,
  verbose: false,
  dryRun: false,
};
