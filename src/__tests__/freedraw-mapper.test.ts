import {
  isConvertibleFreedraw,
  freedrawToSvg,
  mapFreedrawMetadata,
} from '../mappers/freedraw-mapper';
import { makeFreedraw, makeRect, makeOptions } from './fixtures';

describe('isConvertibleFreedraw', () => {
  it('returns true for freedraw', () => {
    expect(isConvertibleFreedraw(makeFreedraw())).toBe(true);
  });

  it('returns false for non-freedraw', () => {
    expect(isConvertibleFreedraw(makeRect())).toBe(false);
  });
});

describe('freedrawToSvg', () => {
  it('produces valid SVG with correct mime type', () => {
    const result = freedrawToSvg(makeFreedraw());
    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.buffer).toBeInstanceOf(Buffer);

    const svg = result.buffer.toString('utf-8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<path');
    expect(svg).toContain('</svg>');
  });

  it('includes stroke color in SVG', () => {
    const fd = makeFreedraw({ strokeColor: '#ff0000' });
    const svg = freedrawToSvg(fd).buffer.toString('utf-8');
    expect(svg).toContain('stroke="#ff0000"');
  });

  it('includes stroke-dasharray for dashed style', () => {
    const fd = makeFreedraw({ strokeStyle: 'dashed' });
    const svg = freedrawToSvg(fd).buffer.toString('utf-8');
    expect(svg).toContain('stroke-dasharray="8 4"');
  });

  it('includes stroke-dasharray for dotted style', () => {
    const fd = makeFreedraw({ strokeStyle: 'dotted' });
    const svg = freedrawToSvg(fd).buffer.toString('utf-8');
    expect(svg).toContain('stroke-dasharray="2 4"');
  });

  it('omits stroke-dasharray for solid style', () => {
    const fd = makeFreedraw({ strokeStyle: 'solid' });
    const svg = freedrawToSvg(fd).buffer.toString('utf-8');
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('computes positive width and height', () => {
    const result = freedrawToSvg(makeFreedraw());
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('uses quadratic bezier for 3+ points', () => {
    const fd = makeFreedraw({
      points: [[0, 0], [10, 10], [20, 5], [30, 15]],
    });
    const svg = freedrawToSvg(fd).buffer.toString('utf-8');
    expect(svg).toContain(' Q ');
  });

  it('handles 2-point freedraw as simple line', () => {
    const fd = makeFreedraw({ points: [[0, 0], [50, 50]] });
    const svg = freedrawToSvg(fd).buffer.toString('utf-8');
    expect(svg).toContain('M 0 0 L 50 50');
  });

  it('applies opacity', () => {
    const fd = makeFreedraw({ opacity: 50 });
    const svg = freedrawToSvg(fd).buffer.toString('utf-8');
    expect(svg).toContain('opacity="0.5"');
  });

  it('simplifies paths with > 500 points', () => {
    const points: [number, number][] = [];
    for (let i = 0; i <= 600; i++) {
      points.push([i, Math.sin(i / 10) * 50]);
    }
    const fd = makeFreedraw({ points, width: 600, height: 100 });
    const result = freedrawToSvg(fd);

    const svg = result.buffer.toString('utf-8');
    expect(svg).toContain('<path');
    expect(result.width).toBeGreaterThan(0);
  });
});

describe('mapFreedrawMetadata', () => {
  const opts = makeOptions({ scale: 1, offsetX: 0, offsetY: 0 });

  it('positions at center of element bounding box', () => {
    const fd = makeFreedraw({ x: 0, y: 0, width: 100, height: 80 });
    const svgResult = freedrawToSvg(fd);
    const meta = mapFreedrawMetadata(fd, svgResult, opts);
    expect(meta.position?.x).toBe(50);
    expect(meta.position?.y).toBe(40);
  });

  it('sets title to Freedraw', () => {
    const fd = makeFreedraw();
    const meta = mapFreedrawMetadata(fd, freedrawToSvg(fd), opts);
    expect(meta.title).toBe('Freedraw');
  });

  it('applies scale to geometry width', () => {
    const fd = makeFreedraw({ width: 100, height: 80 });
    const scaledOpts = makeOptions({ scale: 2, offsetX: 0, offsetY: 0 });
    const meta = mapFreedrawMetadata(fd, freedrawToSvg(fd), scaledOpts);
    expect(meta.geometry?.width).toBe(200);
  });

  it('sets rotation for rotated element', () => {
    const fd = makeFreedraw({ angle: Math.PI / 3 });
    const meta = mapFreedrawMetadata(fd, freedrawToSvg(fd), opts);
    expect(meta.geometry?.rotation).toBeCloseTo(60);
  });
});
