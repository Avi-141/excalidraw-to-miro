import { isConvertibleShape, mapShape, getShapeCenter, getShapeBounds } from '../mappers/shape-mapper';
import { makeRect, makeEllipse, makeDiamond, makeText, makeOptions } from './fixtures';

const opts = makeOptions({ scale: 1, offsetX: 0, offsetY: 0 });

describe('isConvertibleShape', () => {
  it('returns true for rectangle', () => expect(isConvertibleShape(makeRect())).toBe(true));
  it('returns true for ellipse', () => expect(isConvertibleShape(makeEllipse())).toBe(true));
  it('returns true for diamond', () => expect(isConvertibleShape(makeDiamond())).toBe(true));
  it('returns false for text', () => expect(isConvertibleShape(makeText())).toBe(false));
});

describe('mapShape', () => {
  it('maps rectangle to Miro rectangle', () => {
    const req = mapShape(makeRect({ x: 0, y: 0, width: 100, height: 50 }), opts);
    expect(req.data.shape).toBe('rectangle');
    expect(req.position.x).toBe(50);
    expect(req.position.y).toBe(25);
    expect(req.position.origin).toBe('center');
    expect(req.geometry?.width).toBe(100);
    expect(req.geometry?.height).toBe(50);
  });

  it('maps rounded rectangle', () => {
    const req = mapShape(
      makeRect({ roundness: { type: 'proportional_radius' } }),
      opts
    );
    expect(req.data.shape).toBe('round_rectangle');
  });

  it('maps ellipse to circle', () => {
    const req = mapShape(makeEllipse(), opts);
    expect(req.data.shape).toBe('circle');
  });

  it('maps diamond to rhombus', () => {
    const req = mapShape(makeDiamond(), opts);
    expect(req.data.shape).toBe('rhombus');
  });

  it('applies scale factor', () => {
    const scaledOpts = makeOptions({ scale: 2, offsetX: 0, offsetY: 0 });
    const req = mapShape(makeRect({ x: 0, y: 0, width: 100, height: 50 }), scaledOpts);
    expect(req.position.x).toBe(100);
    expect(req.position.y).toBe(50);
    expect(req.geometry?.width).toBe(200);
    expect(req.geometry?.height).toBe(100);
  });

  it('applies offset', () => {
    const offsetOpts = makeOptions({ scale: 1, offsetX: 10, offsetY: 20 });
    const req = mapShape(makeRect({ x: 0, y: 0, width: 100, height: 50 }), offsetOpts);
    expect(req.position.x).toBe(60);
    expect(req.position.y).toBe(45);
  });

  it('converts rotation from radians to degrees', () => {
    const req = mapShape(makeRect({ angle: Math.PI / 2 }), opts);
    expect(req.geometry?.rotation).toBeCloseTo(90);
  });

  it('omits rotation when angle is 0', () => {
    const req = mapShape(makeRect(), opts);
    expect(req.geometry?.rotation).toBeUndefined();
  });
});

describe('getShapeCenter', () => {
  it('returns center coordinates', () => {
    const center = getShapeCenter(makeRect({ x: 0, y: 0, width: 100, height: 50 }), opts);
    expect(center.x).toBe(50);
    expect(center.y).toBe(25);
  });
});

describe('getShapeBounds', () => {
  it('returns Miro-space bounds', () => {
    const bounds = getShapeBounds(makeRect({ x: 10, y: 20, width: 100, height: 50 }), opts);
    expect(bounds.minX).toBe(10);
    expect(bounds.minY).toBe(20);
    expect(bounds.maxX).toBe(110);
    expect(bounds.maxY).toBe(70);
  });
});
