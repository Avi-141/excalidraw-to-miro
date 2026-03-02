import {
  ExcalidrawElement,
  ExcalidrawRectangle,
  ExcalidrawEllipse,
  ExcalidrawDiamond,
  MiroCreateShapeRequest,
  MiroShapeType,
  ConversionOptions,
} from '../types';
import { buildShapeStyle } from './style-mapper';
import { transformCoordinates } from './coordinate-transformer';

/**
 * Map Excalidraw element type to Miro shape type
 */
function mapShapeType(
  element: ExcalidrawRectangle | ExcalidrawEllipse | ExcalidrawDiamond
): MiroShapeType {
  switch (element.type) {
    case 'rectangle':
      // Check if it has rounded corners
      if (element.roundness) {
        return 'round_rectangle';
      }
      return 'rectangle';

    case 'ellipse':
      return 'circle'; // Miro's circle is actually an ellipse that scales

    case 'diamond':
      return 'rhombus';

    default:
      return 'rectangle';
  }
}

/**
 * Check if element is a shape we can convert
 */
export function isConvertibleShape(
  element: ExcalidrawElement
): element is ExcalidrawRectangle | ExcalidrawEllipse | ExcalidrawDiamond {
  return ['rectangle', 'ellipse', 'diamond'].includes(element.type);
}

/**
 * Convert Excalidraw shape to Miro shape request
 */
export function mapShape(
  element: ExcalidrawRectangle | ExcalidrawEllipse | ExcalidrawDiamond,
  options: ConversionOptions
): MiroCreateShapeRequest {
  const { x, y } = transformCoordinates(
    element.x + element.width / 2,
    element.y + element.height / 2,
    options
  );

  const request: MiroCreateShapeRequest = {
    data: {
      shape: mapShapeType(element),
    },
    position: {
      x,
      y,
      origin: 'center',
    },
    geometry: {
      width: element.width * options.scale,
      height: element.height * options.scale,
    },
    style: buildShapeStyle(element, options.styleProfile),
  };

  // Handle rotation (Excalidraw uses radians, Miro uses degrees)
  if (element.angle !== 0) {
    request.geometry!.rotation = (element.angle * 180) / Math.PI;
  }

  return request;
}

/**
 * Get the center point of a shape (for connector attachment)
 */
export function getShapeCenter(
  element: ExcalidrawElement,
  options: ConversionOptions
): { x: number; y: number } {
  return transformCoordinates(
    element.x + element.width / 2,
    element.y + element.height / 2,
    options
  );
}

/**
 * Get the bounding box of a shape in Miro coordinates
 */
export function getShapeBounds(
  element: ExcalidrawElement,
  options: ConversionOptions
): { minX: number; minY: number; maxX: number; maxY: number } {
  const topLeft = transformCoordinates(element.x, element.y, options);
  const bottomRight = transformCoordinates(
    element.x + element.width,
    element.y + element.height,
    options
  );

  return {
    minX: topLeft.x,
    minY: topLeft.y,
    maxX: bottomRight.x,
    maxY: bottomRight.y,
  };
}
