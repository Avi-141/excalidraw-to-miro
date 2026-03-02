export * from './excalidraw';
export * from './miro';

/**
 * Mapping between Excalidraw element IDs and created Miro item IDs
 */
export interface IdMap {
  [excalidrawId: string]: string; // miroItemId
}

/**
 * Post-import cleanup suggestion with actionable guidance.
 */
export interface CleanupSuggestion {
  category: 'connector' | 'text' | 'fidelity' | 'layout';
  severity: 'info' | 'warning' | 'action';
  message: string;
  elementId?: string;
  elementType?: string;
  suggestion: string;
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
  cleanupSuggestions: CleanupSuggestion[];
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
  /** Optional team style profile to normalize aesthetics */
  styleProfile?: StyleProfile;
  /** Import mode: create (default), update, or upsert */
  importMode: 'create' | 'update' | 'upsert';
  /** Path to a mapping file for re-import (read/write ID mappings) */
  mappingFile?: string;
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

/**
 * Team style profile for normalizing visual aesthetics.
 */
export interface StyleProfile {
  name: string;
  description?: string;
  overrides: {
    fontFamily?: string;
    fontSize?: string;
    textColor?: string;
    fillColor?: string;
    fillOpacity?: string;
    borderColor?: string;
    borderWidth?: string;
    borderStyle?: 'normal' | 'dashed' | 'dotted';
    connectorColor?: string;
    connectorStrokeWidth?: string;
  };
  /** When true, use the source file styles instead of overrides */
  preserveOriginalStyles?: boolean;
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
  importMode: 'create',
};
