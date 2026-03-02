import {
  ExcalidrawElement,
  ExcalidrawFrame,
  MiroCreateFrameRequest,
  ConversionOptions,
} from '../types';
import { transformCoordinates } from './coordinate-transformer';

export function isConvertibleFrame(
  element: ExcalidrawElement
): element is ExcalidrawFrame {
  return element.type === 'frame';
}

/**
 * Convert an Excalidraw frame to a Miro frame create request.
 * Miro frames don't support rotation, so it is ignored with a warning.
 */
export function mapFrame(
  element: ExcalidrawFrame,
  options: ConversionOptions
): MiroCreateFrameRequest {
  const { x, y } = transformCoordinates(
    element.x + element.width / 2,
    element.y + element.height / 2,
    options
  );

  return {
    data: {
      title: element.name ?? 'Untitled Frame',
      format: 'custom',
      type: 'freeform',
    },
    position: { x, y, origin: 'center' },
    geometry: {
      width: element.width * options.scale,
      height: element.height * options.scale,
    },
  };
}

/**
 * Compute a child item's position relative to a frame's top-left corner
 * for use after attaching the child to the frame via updateItemParent.
 */
export function computeFrameRelativePosition(
  childAbsX: number,
  childAbsY: number,
  frameCenterX: number,
  frameCenterY: number,
  frameWidth: number,
  frameHeight: number
): { x: number; y: number } {
  const frameTopLeftX = frameCenterX - frameWidth / 2;
  const frameTopLeftY = frameCenterY - frameHeight / 2;

  return {
    x: childAbsX - frameTopLeftX,
    y: childAbsY - frameTopLeftY,
  };
}
