import { ConversionOptions, ExcalidrawElement } from '../types';

/**
 * Transform Excalidraw coordinates to Miro board coordinates
 *
 * Excalidraw:
 * - Uses its own canvas coordinate system
 * - Origin can be anywhere (usually based on first element)
 * - Y increases downward
 *
 * Miro:
 * - Uses board coordinates
 * - Origin is typically at center of view
 * - Y increases downward (same as Excalidraw)
 *
 * We apply:
 * 1. Scale factor
 * 2. Offset to position content on the Miro board
 */
export function transformCoordinates(
  x: number,
  y: number,
  options: ConversionOptions
): { x: number; y: number } {
  return {
    x: x * options.scale + options.offsetX,
    y: y * options.scale + options.offsetY,
  };
}

/**
 * Transform a point from Excalidraw element-relative coordinates
 * (like arrow points which are relative to element origin)
 */
export function transformRelativePoint(
  elementX: number,
  elementY: number,
  pointX: number,
  pointY: number,
  options: ConversionOptions
): { x: number; y: number } {
  const absoluteX = elementX + pointX;
  const absoluteY = elementY + pointY;
  return transformCoordinates(absoluteX, absoluteY, options);
}

/**
 * Calculate optimal offset to center Excalidraw content on Miro board
 * Based on the bounding box of all elements
 */
export function calculateCenteringOffset(
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    centerX: number;
    centerY: number;
  },
  scale: number
): { offsetX: number; offsetY: number } {
  // Center the content around Miro's origin (0, 0)
  // First, find the center of the Excalidraw content
  const excalidrawCenterX = boundingBox.centerX;
  const excalidrawCenterY = boundingBox.centerY;

  // The offset should move the content so its center is at (0, 0)
  return {
    offsetX: -excalidrawCenterX * scale,
    offsetY: -excalidrawCenterY * scale,
  };
}

/**
 * Find the closest point on an element's boundary to a given point
 * Used for snapping disconnected arrow endpoints
 */
export function findClosestPointOnElement(
  element: ExcalidrawElement,
  pointX: number,
  pointY: number
): { x: number; y: number; distance: number } {
  const elementCenterX = element.x + element.width / 2;
  const elementCenterY = element.y + element.height / 2;

  // For simplicity, we'll find the closest edge center point
  // This works well for most diagram use cases
  const edgePoints = [
    { x: elementCenterX, y: element.y }, // Top
    { x: element.x + element.width, y: elementCenterY }, // Right
    { x: elementCenterX, y: element.y + element.height }, // Bottom
    { x: element.x, y: elementCenterY }, // Left
  ];

  let closest = edgePoints[0];
  let minDistance = distance(pointX, pointY, closest.x, closest.y);

  for (const point of edgePoints.slice(1)) {
    const d = distance(pointX, pointY, point.x, point.y);
    if (d < minDistance) {
      minDistance = d;
      closest = point;
    }
  }

  return { ...closest, distance: minDistance };
}

/**
 * Calculate distance between two points
 */
export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Determine snap position based on which side of the element is closest
 */
export function determineSnapPosition(
  elementX: number,
  elementY: number,
  elementWidth: number,
  elementHeight: number,
  pointX: number,
  pointY: number
): 'top' | 'right' | 'bottom' | 'left' | 'auto' {
  const centerX = elementX + elementWidth / 2;
  const centerY = elementY + elementHeight / 2;

  const dx = pointX - centerX;
  const dy = pointY - centerY;

  // Normalize by element dimensions to handle non-square shapes
  const normalizedDx = dx / (elementWidth / 2);
  const normalizedDy = dy / (elementHeight / 2);

  if (Math.abs(normalizedDx) > Math.abs(normalizedDy)) {
    return normalizedDx > 0 ? 'right' : 'left';
  } else {
    return normalizedDy > 0 ? 'bottom' : 'top';
  }
}
