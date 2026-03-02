/**
 * Excalidraw to Miro Converter
 *
 * Converts Excalidraw drawings to editable Miro board objects
 * via the Miro REST API v2.
 */

// Core converter
export { Converter, ConverterConfig } from './converter';

// Types
export * from './types';

// Parser utilities
export {
  parseExcalidrawFile,
  parseExcalidrawJson,
  getActiveElements,
  getBoundingBox,
  groupElementsByType,
} from './parser';

// API client
export { MiroClient, MiroClientOptions } from './api';

// Mappers (for advanced usage)
export {
  mapShape,
  mapText,
  mapConnector,
  mapFrame,
  mapImageMetadata,
  mapFreedrawMetadata,
  freedrawToSvg,
  extractImageBuffer,
  transformCoordinates,
  calculateCenteringOffset,
  computeFrameRelativePosition,
} from './mappers';
