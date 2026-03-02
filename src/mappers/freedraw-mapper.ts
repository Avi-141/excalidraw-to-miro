import {
  ExcalidrawElement,
  ExcalidrawFreedraw,
  MiroCreateImageMetadata,
  ConversionOptions,
} from '../types';
import { transformCoordinates } from './coordinate-transformer';
import { mapColor, mapStrokeWidth } from './style-mapper';

export function isConvertibleFreedraw(
  element: ExcalidrawElement
): element is ExcalidrawFreedraw {
  return element.type === 'freedraw';
}

export interface FreedrawSvgResult {
  buffer: Buffer;
  mimeType: 'image/svg+xml';
  width: number;
  height: number;
}

/**
 * Convert a freedraw element's points into a smooth SVG path.
 * Uses quadratic bezier curves between midpoints for natural-looking strokes.
 */
function buildSvgPath(points: [number, number, number?][]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const [px, py] = points[0];
    return `M ${px} ${py} L ${px} ${py}`;
  }
  if (points.length === 2) {
    const [x0, y0] = points[0];
    const [x1, y1] = points[1];
    return `M ${x0} ${y0} L ${x1} ${y1}`;
  }

  let d = `M ${points[0][0]} ${points[0][1]}`;

  for (let i = 1; i < points.length - 1; i++) {
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const midX = (cx + nx) / 2;
    const midY = (cy + ny) / 2;
    d += ` Q ${cx} ${cy} ${midX} ${midY}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

function strokeDashArray(strokeStyle: string): string {
  switch (strokeStyle) {
    case 'dashed':
      return 'stroke-dasharray="8 4"';
    case 'dotted':
      return 'stroke-dasharray="2 4"';
    default:
      return '';
  }
}

/**
 * Convert a freedraw element to an SVG buffer for upload as a Miro image.
 * Simplifies paths with many points using Douglas-Peucker decimation.
 */
export function freedrawToSvg(element: ExcalidrawFreedraw): FreedrawSvgResult {
  let points = element.points;

  if (points.length > 500) {
    points = simplifyPoints(points, 1.0);
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of points) {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }

  const strokeW = parseFloat(mapStrokeWidth(element.strokeWidth));
  const padding = strokeW * 2;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const svgWidth = maxX - minX;
  const svgHeight = maxY - minY;

  const color = mapColor(element.strokeColor);
  const dash = strokeDashArray(element.strokeStyle);
  const opacity = element.opacity / 100;
  const pathData = buildSvgPath(points);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">`,
    `  <path d="${pathData}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" ${dash}/>`,
    `</svg>`,
  ].join('\n');

  return {
    buffer: Buffer.from(svg, 'utf-8'),
    mimeType: 'image/svg+xml',
    width: svgWidth,
    height: svgHeight,
  };
}

/**
 * Build Miro image metadata for a freedraw element.
 */
export function mapFreedrawMetadata(
  element: ExcalidrawFreedraw,
  svgResult: FreedrawSvgResult,
  options: ConversionOptions
): MiroCreateImageMetadata {
  const { x, y } = transformCoordinates(
    element.x + element.width / 2,
    element.y + element.height / 2,
    options
  );

  const metadata: MiroCreateImageMetadata = {
    title: 'Freedraw',
    position: { x, y, origin: 'center' },
    geometry: {
      width: element.width * options.scale,
    },
  };

  if (element.angle !== 0) {
    metadata.geometry!.rotation = (element.angle * 180) / Math.PI;
  }

  return metadata;
}

/**
 * Douglas-Peucker path simplification to reduce point count
 * while preserving shape fidelity.
 */
function simplifyPoints(
  points: [number, number, number?][],
  tolerance: number
): [number, number, number?][] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPoints(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(
  point: [number, number, number?],
  lineStart: [number, number, number?],
  lineEnd: [number, number, number?]
): number {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const ex = point[0] - lineStart[0];
    const ey = point[1] - lineStart[1];
    return Math.sqrt(ex * ex + ey * ey);
  }

  const num = Math.abs(
    dy * point[0] - dx * point[1] + lineEnd[0] * lineStart[1] - lineEnd[1] * lineStart[0]
  );
  return num / Math.sqrt(lenSq);
}
