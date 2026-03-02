import {
  ExcalidrawText,
  ExcalidrawElement,
  MiroCreateTextRequest,
  ConversionOptions,
} from '../types';
import { buildTextStyle } from './style-mapper';
import { transformCoordinates } from './coordinate-transformer';

/**
 * Check if element is a text element we can convert
 */
export function isConvertibleText(
  element: ExcalidrawElement
): element is ExcalidrawText {
  return element.type === 'text';
}

/**
 * Check if text is bound to a container (and should be skipped as standalone)
 * Bound text is rendered as part of the parent shape's content
 */
export function isContainerBoundText(element: ExcalidrawText): boolean {
  return element.containerId != null && element.containerId !== '';
}

/**
 * Convert Excalidraw text to Miro text request
 */
export function mapText(
  element: ExcalidrawText,
  options: ConversionOptions
): MiroCreateTextRequest {
  // Transform coordinates
  // For text, Excalidraw uses top-left, Miro also uses center for positioning
  const { x, y } = transformCoordinates(
    element.x + element.width / 2,
    element.y + element.height / 2,
    options
  );

  // Escape HTML in text content and convert newlines
  const content = escapeHtmlAndFormatText(element.text);

  const request: MiroCreateTextRequest = {
    data: {
      content,
    },
    position: {
      x,
      y,
      origin: 'center',
    },
    style: {
      ...buildTextStyle(element),
      textAlign: element.textAlign,
    },
  };

  // Add geometry for rotation
  if (element.angle !== 0) {
    request.geometry = {
      rotation: (element.angle * 180) / Math.PI,
    };
  }

  return request;
}

/**
 * Get text content for a shape that contains bound text
 */
export function getBoundTextContent(
  boundTextId: string,
  allElements: ExcalidrawElement[]
): string | null {
  const textElement = allElements.find(
    (el) => el.id === boundTextId && el.type === 'text'
  ) as ExcalidrawText | undefined;

  if (!textElement) {
    return null;
  }

  return escapeHtmlAndFormatText(textElement.text);
}

/**
 * Escape HTML special characters and format text for Miro
 * Miro supports basic HTML in text content
 */
function escapeHtmlAndFormatText(text: string): string {
  // Escape HTML entities
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert newlines to <br> for Miro
  // Miro text supports <br> for line breaks
  escaped = escaped.replace(/\n/g, '<br>');

  return escaped;
}

/**
 * Find all text elements bound to a specific container
 */
export function findBoundTextElements(
  containerId: string,
  allElements: ExcalidrawElement[]
): ExcalidrawText[] {
  return allElements.filter(
    (el): el is ExcalidrawText =>
      el.type === 'text' && (el as ExcalidrawText).containerId === containerId
  );
}
