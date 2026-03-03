export * from './excalidraw';
export * from './miro';

export type SkipCode =
  | 'CONNECTOR_SELF_REF'
  | 'CONNECTOR_NO_TARGET'
  | 'CONNECTOR_INVALID'
  | 'CONNECTOR_DISABLED'
  | 'IMAGE_NOT_FOUND'
  | 'IMAGE_NOT_SAVED'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_NO_FILES'
  | 'FREEDRAW_TOO_SHORT'
  | 'FREEDRAW_DISABLED'
  | 'IMAGE_DISABLED'
  | 'FRAME_DISABLED'
  | 'TYPE_UNSUPPORTED'
  | 'MAPPED_ITEM_MISSING_UPDATE'
  | 'MAPPING_MISSING_UPDATE';

export interface SkippedElement {
  id: string;
  type: string;
  code: SkipCode;
  reason: string;
  remediation: string;
}

export const SKIP_REMEDIATION: Record<SkipCode, string> = {
  CONNECTOR_SELF_REF: 'Rebind one connector endpoint in Excalidraw.',
  CONNECTOR_NO_TARGET: 'Move endpoint(s) closer to shapes or increase --snap-threshold.',
  CONNECTOR_INVALID: 'Ensure connector has at least two points and valid bindings.',
  CONNECTOR_DISABLED: 'Re-run without --no-connectors.',
  IMAGE_NOT_FOUND: 'Re-save the image in Excalidraw so embedded data is included.',
  IMAGE_NOT_SAVED: 'Set image status to "saved" in Excalidraw and export again.',
  IMAGE_TOO_LARGE: 'Resize or compress the image below 6 MB.',
  IMAGE_NO_FILES: 'Export with embedded files/data included.',
  FREEDRAW_TOO_SHORT: 'Redraw the stroke with at least two points.',
  FREEDRAW_DISABLED: 'Re-run without --no-freedraw or --skip-freedraw.',
  IMAGE_DISABLED: 'Re-run without --no-images.',
  FRAME_DISABLED: 'Re-run without --no-frames.',
  TYPE_UNSUPPORTED: 'No automatic remediation available for this element type.',
  MAPPED_ITEM_MISSING_UPDATE: 'Re-run in upsert mode or regenerate mapping file.',
  MAPPING_MISSING_UPDATE: 'Provide a mapping file or switch import mode to create/upsert.',
};

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
  groupsCreated: number;
  imagesCreated: number;
  freedrawConverted: number;
  skippedElements: SkippedElement[];
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
  code?: SkipCode;
  reason?: string;
  remediation?: string;
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
    groups: number;
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
