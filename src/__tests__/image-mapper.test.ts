import {
  isConvertibleImage,
  extractImageBuffer,
  mapImageMetadata,
} from '../mappers/image-mapper';
import { makeImage, makeRect, makeFilesMap, makeOptions } from './fixtures';

describe('isConvertibleImage', () => {
  it('returns true for image elements', () => {
    expect(isConvertibleImage(makeImage())).toBe(true);
  });

  it('returns false for non-image elements', () => {
    expect(isConvertibleImage(makeRect())).toBe(false);
  });
});

describe('extractImageBuffer', () => {
  it('extracts buffer from valid data URL', () => {
    const img = makeImage();
    const files = makeFilesMap('file-abc');
    const result = extractImageBuffer(img, files);

    expect(result).not.toBeNull();
    expect(result!.buffer).toBeInstanceOf(Buffer);
    expect(result!.buffer.length).toBeGreaterThan(0);
    expect(result!.mimeType).toBe('image/png');
  });

  it('returns null when files map is undefined', () => {
    expect(extractImageBuffer(makeImage(), undefined)).toBeNull();
  });

  it('returns null when fileId is not in files map', () => {
    const img = makeImage({ fileId: 'nonexistent' });
    expect(extractImageBuffer(img, makeFilesMap('other-id'))).toBeNull();
  });

  it('returns null when image status is pending', () => {
    const img = makeImage({ status: 'pending' });
    expect(extractImageBuffer(img, makeFilesMap())).toBeNull();
  });

  it('returns null when image status is error', () => {
    const img = makeImage({ status: 'error' });
    expect(extractImageBuffer(img, makeFilesMap())).toBeNull();
  });

  it('returns null when dataURL has no comma', () => {
    const files = {
      'file-abc': {
        mimeType: 'image/png',
        id: 'file-abc',
        dataURL: 'malformed-no-comma',
        created: Date.now(),
      },
    };
    expect(extractImageBuffer(makeImage(), files)).toBeNull();
  });

  it('returns null when decoded buffer exceeds 6 MB', () => {
    const bigBase64 = Buffer.alloc(7 * 1024 * 1024).toString('base64');
    const files = {
      'file-abc': {
        mimeType: 'image/png',
        id: 'file-abc',
        dataURL: `data:image/png;base64,${bigBase64}`,
        created: Date.now(),
      },
    };
    expect(extractImageBuffer(makeImage(), files)).toBeNull();
  });
});

describe('mapImageMetadata', () => {
  const opts = makeOptions({ scale: 1, offsetX: 0, offsetY: 0 });

  it('positions at center of image element', () => {
    const img = makeImage({ x: 0, y: 0, width: 400, height: 300 });
    const meta = mapImageMetadata(img, opts);
    expect(meta.position?.x).toBe(200);
    expect(meta.position?.y).toBe(150);
    expect(meta.position?.origin).toBe('center');
  });

  it('uses effective width with element scale', () => {
    const img = makeImage({ width: 400, height: 300, scale: [2, 2] });
    const meta = mapImageMetadata(img, opts);
    expect(meta.geometry?.width).toBe(800);
  });

  it('handles negative scale (flipped)', () => {
    const img = makeImage({ width: 400, height: 300, scale: [-1, 1] });
    const meta = mapImageMetadata(img, opts);
    expect(meta.geometry?.width).toBe(400);
  });

  it('applies options scale', () => {
    const img = makeImage({ width: 400, height: 300, scale: [1, 1] });
    const meta = mapImageMetadata(img, makeOptions({ scale: 2, offsetX: 0, offsetY: 0 }));
    expect(meta.geometry?.width).toBe(800);
  });

  it('sets rotation when angle is non-zero', () => {
    const img = makeImage({ angle: Math.PI / 4 });
    const meta = mapImageMetadata(img, opts);
    expect(meta.geometry?.rotation).toBeCloseTo(45);
  });

  it('omits rotation when angle is 0', () => {
    const meta = mapImageMetadata(makeImage(), opts);
    expect(meta.geometry?.rotation).toBeUndefined();
  });

  it('sets title to Image', () => {
    const meta = mapImageMetadata(makeImage(), opts);
    expect(meta.title).toBe('Image');
  });
});
