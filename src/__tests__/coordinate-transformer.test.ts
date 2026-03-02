import {
  transformCoordinates,
  transformRelativePoint,
  calculateCenteringOffset,
  findClosestPointOnElement,
  distance,
  determineSnapPosition,
} from '../mappers/coordinate-transformer';
import { makeRect, makeOptions } from './fixtures';

describe('transformCoordinates', () => {
  it('applies scale and offset', () => {
    const opts = makeOptions({ scale: 2, offsetX: 10, offsetY: 20 });
    const { x, y } = transformCoordinates(5, 10, opts);
    expect(x).toBe(20);
    expect(y).toBe(40);
  });

  it('returns identity with scale=1, offset=0', () => {
    const opts = makeOptions({ scale: 1, offsetX: 0, offsetY: 0 });
    const { x, y } = transformCoordinates(42, 99, opts);
    expect(x).toBe(42);
    expect(y).toBe(99);
  });

  it('handles negative offsets', () => {
    const opts = makeOptions({ scale: 1, offsetX: -100, offsetY: -200 });
    const { x, y } = transformCoordinates(100, 200, opts);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });
});

describe('transformRelativePoint', () => {
  it('adds element origin then applies transform', () => {
    const opts = makeOptions({ scale: 1, offsetX: 0, offsetY: 0 });
    const { x, y } = transformRelativePoint(100, 200, 50, 30, opts);
    expect(x).toBe(150);
    expect(y).toBe(230);
  });
});

describe('calculateCenteringOffset', () => {
  it('computes offset to center content at origin', () => {
    const bbox = {
      minX: 100, minY: 200, maxX: 300, maxY: 400,
      width: 200, height: 200, centerX: 200, centerY: 300,
    };
    const { offsetX, offsetY } = calculateCenteringOffset(bbox, 1);
    expect(offsetX).toBe(-200);
    expect(offsetY).toBe(-300);
  });

  it('accounts for scale', () => {
    const bbox = {
      minX: 0, minY: 0, maxX: 100, maxY: 100,
      width: 100, height: 100, centerX: 50, centerY: 50,
    };
    const { offsetX, offsetY } = calculateCenteringOffset(bbox, 2);
    expect(offsetX).toBe(-100);
    expect(offsetY).toBe(-100);
  });
});

describe('distance', () => {
  it('computes euclidean distance', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });

  it('returns 0 for same point', () => {
    expect(distance(5, 5, 5, 5)).toBe(0);
  });
});

describe('findClosestPointOnElement', () => {
  it('finds top edge as closest', () => {
    const rect = makeRect({ x: 0, y: 0, width: 100, height: 100 });
    const result = findClosestPointOnElement(rect, 50, -10);
    expect(result.x).toBe(50);
    expect(result.y).toBe(0);
  });

  it('finds right edge as closest', () => {
    const rect = makeRect({ x: 0, y: 0, width: 100, height: 100 });
    const result = findClosestPointOnElement(rect, 120, 50);
    expect(result.x).toBe(100);
    expect(result.y).toBe(50);
  });
});

describe('determineSnapPosition', () => {
  it('returns top for point above element', () => {
    expect(determineSnapPosition(0, 0, 100, 100, 50, -20)).toBe('top');
  });

  it('returns bottom for point below element', () => {
    expect(determineSnapPosition(0, 0, 100, 100, 50, 120)).toBe('bottom');
  });

  it('returns left for point to the left', () => {
    expect(determineSnapPosition(0, 0, 100, 100, -20, 50)).toBe('left');
  });

  it('returns right for point to the right', () => {
    expect(determineSnapPosition(0, 0, 100, 100, 120, 50)).toBe('right');
  });

  it('handles non-square elements correctly', () => {
    const result = determineSnapPosition(0, 0, 200, 50, 100, -10);
    expect(result).toBe('top');
  });
});
