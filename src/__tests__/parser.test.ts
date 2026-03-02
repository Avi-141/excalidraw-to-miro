import {
  parseExcalidrawJson,
  getActiveElements,
  getBoundingBox,
  groupElementsByType,
} from '../parser';
import {
  makeRect,
  makeEllipse,
  makeDiamond,
  makeText,
  makeArrow,
  makeLine,
  makeFreedraw,
  makeImage,
  makeFrame,
  makeExcalidrawFile,
} from './fixtures';

describe('parseExcalidrawJson', () => {
  it('parses valid JSON', () => {
    const file = parseExcalidrawJson(
      JSON.stringify({ type: 'excalidraw', version: 2, source: 'test', elements: [] })
    );
    expect(file.type).toBe('excalidraw');
    expect(file.version).toBe(2);
    expect(file.elements).toEqual([]);
  });

  it('rejects invalid JSON string', () => {
    expect(() => parseExcalidrawJson('not json')).toThrow('Invalid JSON');
  });

  it('rejects non-excalidraw object', () => {
    expect(() => parseExcalidrawJson(JSON.stringify({ type: 'other' }))).toThrow(
      'Invalid Excalidraw file format'
    );
  });

  it('rejects missing elements array', () => {
    expect(() =>
      parseExcalidrawJson(JSON.stringify({ type: 'excalidraw', version: 2 }))
    ).toThrow('Invalid Excalidraw file format');
  });
});

describe('getActiveElements', () => {
  it('filters out deleted elements', () => {
    const file = makeExcalidrawFile([
      makeRect({ id: 'a' }),
      makeRect({ id: 'b', isDeleted: true }),
      makeRect({ id: 'c' }),
    ]);
    const active = getActiveElements(file);
    expect(active).toHaveLength(2);
    expect(active.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('returns empty for file with only deleted elements', () => {
    const file = makeExcalidrawFile([makeRect({ isDeleted: true })]);
    expect(getActiveElements(file)).toHaveLength(0);
  });
});

describe('getBoundingBox', () => {
  it('returns zero-size box for empty array', () => {
    const bb = getBoundingBox([]);
    expect(bb.width).toBe(0);
    expect(bb.height).toBe(0);
  });

  it('computes correct bounds for a single rect', () => {
    const rect = makeRect({ x: 10, y: 20, width: 100, height: 50 });
    const bb = getBoundingBox([rect]);
    expect(bb.minX).toBe(10);
    expect(bb.minY).toBe(20);
    expect(bb.maxX).toBe(110);
    expect(bb.maxY).toBe(70);
    expect(bb.width).toBe(100);
    expect(bb.height).toBe(50);
    expect(bb.centerX).toBe(60);
    expect(bb.centerY).toBe(45);
  });

  it('handles arrows via their points', () => {
    const arrow = makeArrow({
      x: 10,
      y: 10,
      points: [[0, 0], [100, 50]],
    });
    const bb = getBoundingBox([arrow]);
    expect(bb.minX).toBe(10);
    expect(bb.minY).toBe(10);
    expect(bb.maxX).toBe(110);
    expect(bb.maxY).toBe(60);
  });

  it('spans multiple elements', () => {
    const r1 = makeRect({ x: 0, y: 0, width: 50, height: 50 });
    const r2 = makeRect({ x: 200, y: 300, width: 50, height: 50, id: 'r2' });
    const bb = getBoundingBox([r1, r2]);
    expect(bb.minX).toBe(0);
    expect(bb.minY).toBe(0);
    expect(bb.maxX).toBe(250);
    expect(bb.maxY).toBe(350);
  });
});

describe('groupElementsByType', () => {
  it('groups all element types correctly including frames', () => {
    const elements = [
      makeRect(),
      makeEllipse(),
      makeText(),
      makeArrow(),
      makeLine(),
      makeFreedraw(),
      makeImage(),
      makeFrame(),
    ];
    const groups = groupElementsByType(elements);

    expect(groups.shapes).toHaveLength(2);
    expect(groups.text).toHaveLength(1);
    expect(groups.arrows).toHaveLength(1);
    expect(groups.lines).toHaveLength(1);
    expect(groups.freedraw).toHaveLength(1);
    expect(groups.images).toHaveLength(1);
    expect(groups.frames).toHaveLength(1);
    expect(groups.other).toHaveLength(0);
  });

  it('routes diamond to shapes', () => {
    const groups = groupElementsByType([makeDiamond()]);
    expect(groups.shapes).toHaveLength(1);
    expect(groups.shapes[0].type).toBe('diamond');
  });

  it('puts unknown types in other', () => {
    const weird = { ...makeRect(), type: 'embeddable' as any };
    const groups = groupElementsByType([weird]);
    expect(groups.other).toHaveLength(1);
  });
});
