import {
  ExcalidrawElement,
  ExcalidrawImage,
  ExcalidrawFile,
  MiroCreateImageMetadata,
  ConversionOptions,
} from '../types';
import { transformCoordinates } from './coordinate-transformer';

const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024; // Miro limit: 6 MB

export function isConvertibleImage(
  element: ExcalidrawElement
): element is ExcalidrawImage {
  return element.type === 'image';
}

export interface ExtractedImage {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Extract the image binary data from the Excalidraw files map.
 * Returns null if the file entry is missing, not yet saved, or exceeds the Miro upload limit.
 */
export function extractImageBuffer(
  element: ExcalidrawImage,
  files: ExcalidrawFile['files']
): ExtractedImage | null {
  if (!files) return null;

  const fileEntry = files[element.fileId];
  if (!fileEntry) return null;
  if (element.status !== 'saved') return null;

  const dataUrl = fileEntry.dataURL;
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return null;

  const base64Data = dataUrl.substring(commaIndex + 1);
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return null;
  }

  return {
    buffer,
    mimeType: fileEntry.mimeType,
  };
}

/**
 * Build Miro image metadata (position, geometry) from an Excalidraw image element.
 * Accounts for element scale and rotation.
 */
export function mapImageMetadata(
  element: ExcalidrawImage,
  options: ConversionOptions
): MiroCreateImageMetadata {
  const scaleX = element.scale[0];
  const scaleY = element.scale[1];

  const effectiveWidth = element.width * Math.abs(scaleX);
  const effectiveHeight = element.height * Math.abs(scaleY);

  const { x, y } = transformCoordinates(
    element.x + element.width / 2,
    element.y + element.height / 2,
    options
  );

  const metadata: MiroCreateImageMetadata = {
    title: 'Image',
    position: { x, y, origin: 'center' },
    geometry: {
      width: effectiveWidth * options.scale,
    },
  };

  if (element.angle !== 0) {
    metadata.geometry!.rotation = (element.angle * 180) / Math.PI;
  }

  return metadata;
}
