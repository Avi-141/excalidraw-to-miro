import {
  isConvertibleFrame,
  mapFrame,
  computeFrameRelativePosition,
} from '../mappers/frame-mapper';
import { makeFrame, makeRect, makeOptions } from './fixtures';

describe('isConvertibleFrame', () => {
  it('returns true for frame', () => {
    expect(isConvertibleFrame(makeFrame())).toBe(true);
  });

  it('returns false for non-frame', () => {
    expect(isConvertibleFrame(makeRect())).toBe(false);
  });
});

describe('mapFrame', () => {
  const opts = makeOptions({ scale: 1, offsetX: 0, offsetY: 0 });

  it('produces correct Miro frame request', () => {
    const frame = makeFrame({ x: 0, y: 0, width: 800, height: 600, name: 'My Frame' });
    const req = mapFrame(frame, opts);

    expect(req.data.title).toBe('My Frame');
    expect(req.data.format).toBe('custom');
    expect(req.data.type).toBe('freeform');
    expect(req.position?.x).toBe(400);
    expect(req.position?.y).toBe(300);
    expect(req.position?.origin).toBe('center');
    expect(req.geometry?.width).toBe(800);
    expect(req.geometry?.height).toBe(600);
  });

  it('defaults null name to Untitled Frame', () => {
    const frame = makeFrame({ name: null });
    const req = mapFrame(frame, opts);
    expect(req.data.title).toBe('Untitled Frame');
  });

  it('applies scale to geometry', () => {
    const frame = makeFrame({ x: 0, y: 0, width: 400, height: 300 });
    const scaledOpts = makeOptions({ scale: 2, offsetX: 0, offsetY: 0 });
    const req = mapFrame(frame, scaledOpts);
    expect(req.geometry?.width).toBe(800);
    expect(req.geometry?.height).toBe(600);
    expect(req.position?.x).toBe(400);
    expect(req.position?.y).toBe(300);
  });

  it('applies offset to position', () => {
    const frame = makeFrame({ x: 0, y: 0, width: 100, height: 100 });
    const offsetOpts = makeOptions({ scale: 1, offsetX: 50, offsetY: -50 });
    const req = mapFrame(frame, offsetOpts);
    expect(req.position?.x).toBe(100);
    expect(req.position?.y).toBe(0);
  });
});

describe('computeFrameRelativePosition', () => {
  it('computes correct relative coordinates', () => {
    const pos = computeFrameRelativePosition(
      250, 200,
      200, 150,
      400, 300
    );
    expect(pos.x).toBe(250);
    expect(pos.y).toBe(200);
  });

  it('returns (0, 0) when child is at frame top-left', () => {
    const pos = computeFrameRelativePosition(
      0, 0,
      200, 150,
      400, 300
    );
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it('returns frame dimensions when child is at frame bottom-right', () => {
    const pos = computeFrameRelativePosition(
      400, 300,
      200, 150,
      400, 300
    );
    expect(pos.x).toBe(400);
    expect(pos.y).toBe(300);
  });
});
