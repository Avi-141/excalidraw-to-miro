import {
  ExcalidrawArrow,
  ExcalidrawLine,
  ExcalidrawElement,
  MiroCreateConnectorRequest,
  MiroConnectorEndpoint,
  MiroStrokeCap,
  IdMap,
  ConversionOptions,
  ArrowheadType,
} from '../types';
import {
  distance,
  determineSnapPosition,
} from './coordinate-transformer';
import { mapStrokeStyle, mapColor, mapStrokeWidth } from './style-mapper';

/**
 * Check if element is an arrow we can convert to a connector
 */
export function isConvertibleArrow(
  element: ExcalidrawElement
): element is ExcalidrawArrow {
  return element.type === 'arrow';
}

/**
 * Check if element is a line (may or may not have arrowheads)
 */
export function isConvertibleLine(
  element: ExcalidrawElement
): element is ExcalidrawLine {
  return element.type === 'line';
}

function mapArrowhead(arrowhead: ArrowheadType): MiroStrokeCap {
  switch (arrowhead) {
    case 'arrow':
      return 'arrow';
    case 'triangle':
      return 'filled_triangle';
    case 'bar':
      return 'stealth';
    case 'dot':
      return 'filled_oval';
    case null:
      return 'none';
    default:
      return 'none';
  }
}

/**
 * Convert Excalidraw arrow to Miro connector request.
 * Returns null if both endpoints can't be resolved to Miro items
 * (Miro connectors require startItem.id and endItem.id).
 */
export function mapConnector(
  element: ExcalidrawArrow | ExcalidrawLine,
  idMap: IdMap,
  allElements: ExcalidrawElement[],
  options: ConversionOptions
): MiroCreateConnectorRequest | null {
  const points = element.points;
  if (points.length < 2) {
    return null;
  }

  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  const startEndpoint = resolveEndpoint(
    element,
    startPoint,
    element.type === 'arrow' ? (element as ExcalidrawArrow).startBinding : null,
    idMap,
    allElements,
    options
  );

  const endEndpoint = resolveEndpoint(
    element,
    endPoint,
    element.type === 'arrow' ? (element as ExcalidrawArrow).endBinding : null,
    idMap,
    allElements,
    options
  );

  if (!startEndpoint || !endEndpoint) {
    return null;
  }

  if (startEndpoint.id === endEndpoint.id) {
    return null;
  }

  const request: MiroCreateConnectorRequest = {
    startItem: startEndpoint,
    endItem: endEndpoint,
    shape: determineConnectorShape(element),
    style: {
      strokeColor: mapColor(element.strokeColor),
      strokeStyle: mapStrokeStyle(element.strokeStyle),
      strokeWidth: mapStrokeWidth(element.strokeWidth),
    },
  };

  if (element.type === 'arrow') {
    const arrow = element as ExcalidrawArrow;
    request.style!.startStrokeCap = mapArrowhead(arrow.startArrowhead);
    request.style!.endStrokeCap = mapArrowhead(arrow.endArrowhead);
  } else {
    const line = element as ExcalidrawLine;
    request.style!.startStrokeCap = mapArrowhead(line.startArrowhead);
    request.style!.endStrokeCap = mapArrowhead(line.endArrowhead);
  }

  return request;
}

/**
 * Resolve a connector endpoint to a Miro item.
 * Returns null if no item can be found (Miro requires both endpoints to reference items).
 */
function resolveEndpoint(
  element: ExcalidrawArrow | ExcalidrawLine,
  point: [number, number],
  binding: { elementId: string; focus: number; gap: number } | null,
  idMap: IdMap,
  allElements: ExcalidrawElement[],
  options: ConversionOptions
): MiroConnectorEndpoint | null {
  if (binding && idMap[binding.elementId]) {
    const miroItemId = idMap[binding.elementId];
    const boundElement = allElements.find((el) => el.id === binding.elementId);

    if (boundElement) {
      const absX = element.x + point[0];
      const absY = element.y + point[1];
      const snapTo = determineSnapPosition(
        boundElement.x,
        boundElement.y,
        boundElement.width,
        boundElement.height,
        absX,
        absY
      );

      return { id: miroItemId, snapTo };
    }

    return { id: miroItemId, snapTo: 'auto' };
  }

  // No binding -- try to snap to a nearby item
  const nearby = findNearbyItem(
    element,
    point,
    allElements,
    idMap,
    options.snapThreshold
  );

  return nearby;
}

/**
 * Find a nearby item to snap an unbound arrow endpoint to
 */
function findNearbyItem(
  element: ExcalidrawArrow | ExcalidrawLine,
  point: [number, number],
  allElements: ExcalidrawElement[],
  idMap: IdMap,
  threshold: number
): MiroConnectorEndpoint | null {
  const absX = element.x + point[0];
  const absY = element.y + point[1];

  let closestElement: ExcalidrawElement | null = null;
  let closestDistance = Infinity;

  // Only consider shape elements that have been converted
  const convertibleTypes = ['rectangle', 'ellipse', 'diamond'];

  for (const el of allElements) {
    if (!convertibleTypes.includes(el.type)) continue;
    if (!idMap[el.id]) continue;

    // Check distance to element center
    const centerX = el.x + el.width / 2;
    const centerY = el.y + el.height / 2;
    const d = distance(absX, absY, centerX, centerY);

    // Check if point is inside or near the element
    const isNear =
      d < threshold ||
      (absX >= el.x - threshold &&
        absX <= el.x + el.width + threshold &&
        absY >= el.y - threshold &&
        absY <= el.y + el.height + threshold);

    if (isNear && d < closestDistance) {
      closestDistance = d;
      closestElement = el;
    }
  }

  if (closestElement) {
    const snapTo = determineSnapPosition(
      closestElement.x,
      closestElement.y,
      closestElement.width,
      closestElement.height,
      absX,
      absY
    );

    return {
      id: idMap[closestElement.id],
      snapTo,
    };
  }

  return null;
}

/**
 * Determine connector shape based on arrow path complexity
 */
function determineConnectorShape(
  element: ExcalidrawArrow | ExcalidrawLine
): 'straight' | 'elbowed' | 'curved' {
  const points = element.points;

  // Simple two-point arrows are straight
  if (points.length <= 2) {
    return 'straight';
  }

  // Multi-point arrows could be elbowed or curved
  // Check if points form roughly right angles (elbowed)
  // For simplicity, default to curved for complex paths
  return 'curved';
}

/**
 * Check if an arrow can be converted to a Miro connector
 * (both endpoints must connect to converted items, or at least have positions)
 */
export function canConvertToConnector(
  element: ExcalidrawArrow | ExcalidrawLine,
  idMap: IdMap
): boolean {
  // All arrows can be converted - they either connect to items or use absolute positions
  return element.points.length >= 2;
}
