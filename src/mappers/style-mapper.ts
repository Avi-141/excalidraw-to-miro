import {
  ExcalidrawElement,
  StrokeStyle,
  MiroShapeStyle,
  MiroTextStyle,
} from '../types';

/**
 * Convert Excalidraw stroke style to Miro border style
 */
export function mapStrokeStyle(
  strokeStyle: StrokeStyle
): 'normal' | 'dashed' | 'dotted' {
  switch (strokeStyle) {
    case 'solid':
      return 'normal';
    case 'dashed':
      return 'dashed';
    case 'dotted':
      return 'dotted';
    default:
      return 'normal';
  }
}

/**
 * Convert Excalidraw color to Miro hex color
 * Excalidraw uses hex colors like "#000000" or "transparent"
 */
export function mapColor(color: string): string {
  if (color === 'transparent' || color === '') {
    return 'transparent';
  }
  // Miro expects colors without the # prefix in some cases,
  // but the API generally accepts both formats
  return color;
}

/**
 * Convert opacity (0-100) to Miro opacity string ("0.0" to "1.0")
 */
export function mapOpacity(opacity: number): string {
  return (opacity / 100).toFixed(1);
}

/**
 * Convert stroke width to Miro border width
 * Excalidraw uses 1, 2, 4 for thin, bold, extra bold
 */
export function mapStrokeWidth(strokeWidth: number): string {
  // Map to reasonable Miro values
  if (strokeWidth <= 1) return '1.0';
  if (strokeWidth <= 2) return '2.0';
  if (strokeWidth <= 4) return '4.0';
  return '6.0';
}

/**
 * Map Excalidraw font family to Miro font family
 * Excalidraw: 1 = Virgil (hand-drawn), 2 = Helvetica, 3 = Cascadia (code)
 */
export function mapFontFamily(fontFamily: number): string {
  switch (fontFamily) {
    case 1: // Virgil - hand-drawn style
      return 'caveat';
    case 2: // Helvetica
      return 'arial';
    case 3: // Cascadia - code font
      return 'roboto_mono';
    case 4: // Liberation Sans (added in newer Excalidraw)
      return 'arial';
    default:
      return 'arial';
  }
}

/**
 * Map Excalidraw font size to Miro font size
 */
export function mapFontSize(fontSize: number): string {
  // Miro accepts font sizes as strings
  // Scale appropriately - Excalidraw default is 20
  return Math.round(fontSize).toString();
}

/**
 * Build Miro shape style from Excalidraw element
 */
export function buildShapeStyle(element: ExcalidrawElement): MiroShapeStyle {
  const style: MiroShapeStyle = {};

  // Background/fill
  if (element.backgroundColor !== 'transparent') {
    style.fillColor = mapColor(element.backgroundColor);
    style.fillOpacity = mapOpacity(element.opacity);
  } else {
    style.fillOpacity = '0.0';
  }

  // Border/stroke
  style.borderColor = mapColor(element.strokeColor);
  style.borderWidth = mapStrokeWidth(element.strokeWidth);
  style.borderStyle = mapStrokeStyle(element.strokeStyle);
  style.borderOpacity = mapOpacity(element.opacity);

  return style;
}

/**
 * Build Miro text style from Excalidraw text element
 */
export function buildTextStyle(
  element: ExcalidrawElement & { fontSize?: number; fontFamily?: number }
): MiroTextStyle {
  const style: MiroTextStyle = {};

  style.color = mapColor(element.strokeColor);

  if (element.fontSize) {
    style.fontSize = mapFontSize(element.fontSize);
  }

  if (element.fontFamily) {
    style.fontFamily = mapFontFamily(element.fontFamily);
  }

  return style;
}
