import * as fs from 'fs';
import * as path from 'path';
import { ExcalidrawFile, ExcalidrawElement } from '../types';

/**
 * Parse an Excalidraw JSON file
 */
export function parseExcalidrawFile(filePath: string): ExcalidrawFile {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  return parseExcalidrawJson(content);
}

/**
 * Parse Excalidraw JSON string
 */
export function parseExcalidrawJson(json: string): ExcalidrawFile {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  if (!isExcalidrawFile(parsed)) {
    throw new Error('Invalid Excalidraw file format');
  }

  return parsed;
}

/**
 * Type guard for ExcalidrawFile
 */
function isExcalidrawFile(obj: unknown): obj is ExcalidrawFile {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const file = obj as Record<string, unknown>;

  // Check required fields
  if (file.type !== 'excalidraw') {
    return false;
  }

  if (typeof file.version !== 'number') {
    return false;
  }

  if (!Array.isArray(file.elements)) {
    return false;
  }

  return true;
}

/**
 * Filter out deleted elements
 */
export function getActiveElements(file: ExcalidrawFile): ExcalidrawElement[] {
  return file.elements.filter((el) => !el.isDeleted);
}

/**
 * Get bounding box of all elements
 */
export function getBoundingBox(elements: ExcalidrawElement[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  if (elements.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    // Handle elements with points (arrows, lines, freedraw)
    if ('points' in el && Array.isArray(el.points)) {
      for (const point of el.points) {
        const px = el.x + point[0];
        const py = el.y + point[1];
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    } else {
      // Standard bounding box elements
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

/**
 * Group elements by type for ordered processing
 */
export function groupElementsByType(elements: ExcalidrawElement[]): {
  shapes: ExcalidrawElement[];
  text: ExcalidrawElement[];
  arrows: ExcalidrawElement[];
  lines: ExcalidrawElement[];
  freedraw: ExcalidrawElement[];
  images: ExcalidrawElement[];
  frames: ExcalidrawElement[];
  other: ExcalidrawElement[];
} {
  const groups = {
    shapes: [] as ExcalidrawElement[],
    text: [] as ExcalidrawElement[],
    arrows: [] as ExcalidrawElement[],
    lines: [] as ExcalidrawElement[],
    freedraw: [] as ExcalidrawElement[],
    images: [] as ExcalidrawElement[],
    frames: [] as ExcalidrawElement[],
    other: [] as ExcalidrawElement[],
  };

  for (const el of elements) {
    switch (el.type) {
      case 'rectangle':
      case 'ellipse':
      case 'diamond':
        groups.shapes.push(el);
        break;
      case 'text':
        groups.text.push(el);
        break;
      case 'arrow':
        groups.arrows.push(el);
        break;
      case 'line':
        groups.lines.push(el);
        break;
      case 'freedraw':
        groups.freedraw.push(el);
        break;
      case 'image':
        groups.images.push(el);
        break;
      case 'frame':
        groups.frames.push(el);
        break;
      default:
        groups.other.push(el);
    }
  }

  return groups;
}
