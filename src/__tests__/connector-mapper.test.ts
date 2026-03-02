import {
  isConvertibleArrow,
  isConvertibleLine,
  canConvertToConnector,
  mapConnector,
} from '../mappers/connector-mapper';
import { makeArrow, makeLine, makeRect, makeOptions } from './fixtures';

const opts = makeOptions({ scale: 1, offsetX: 0, offsetY: 0, snapThreshold: 50 });

describe('isConvertibleArrow', () => {
  it('returns true for arrow', () => expect(isConvertibleArrow(makeArrow())).toBe(true));
  it('returns false for line', () => expect(isConvertibleArrow(makeLine())).toBe(false));
  it('returns false for rect', () => expect(isConvertibleArrow(makeRect())).toBe(false));
});

describe('isConvertibleLine', () => {
  it('returns true for line', () => expect(isConvertibleLine(makeLine())).toBe(true));
  it('returns false for arrow', () => expect(isConvertibleLine(makeArrow())).toBe(false));
});

describe('canConvertToConnector', () => {
  it('returns true when arrow has >= 2 points', () => {
    expect(canConvertToConnector(makeArrow(), {})).toBe(true);
  });

  it('returns false when arrow has < 2 points', () => {
    const arrow = makeArrow({ points: [[0, 0]] });
    expect(canConvertToConnector(arrow, {})).toBe(false);
  });
});

describe('mapConnector', () => {
  it('returns null for arrows with < 2 points', () => {
    const arrow = makeArrow({ points: [[0, 0]] });
    expect(mapConnector(arrow, {}, [], opts)).toBeNull();
  });

  it('creates straight connector for 2-point arrow between two shapes', () => {
    const rect1 = makeRect({ id: 'r1', x: 0, y: 0, width: 50, height: 50 });
    const rect2 = makeRect({ id: 'r2', x: 150, y: 0, width: 50, height: 50 });
    const arrow = makeArrow({ x: 40, y: 25, points: [[0, 0], [120, 0]] });
    const idMap = { r1: 'miro-r1', r2: 'miro-r2' };
    const req = mapConnector(arrow, idMap, [rect1, rect2, arrow], opts);
    expect(req).not.toBeNull();
    expect(req!.shape).toBe('straight');
  });

  it('creates curved connector for multi-point arrow between two shapes', () => {
    const rect1 = makeRect({ id: 'r1', x: 0, y: 0, width: 50, height: 50 });
    const rect2 = makeRect({ id: 'r2', x: 150, y: 0, width: 50, height: 50 });
    const arrow = makeArrow({ x: 40, y: 25, points: [[0, 0], [60, 30], [120, 0]] });
    const idMap = { r1: 'miro-r1', r2: 'miro-r2' };
    const req = mapConnector(arrow, idMap, [rect1, rect2, arrow], opts);
    expect(req).not.toBeNull();
    expect(req!.shape).toBe('curved');
  });

  it('maps arrowhead styles', () => {
    const rect1 = makeRect({ id: 'r1', x: 0, y: 0, width: 50, height: 50 });
    const rect2 = makeRect({ id: 'r2', x: 150, y: 0, width: 50, height: 50 });
    const arrow = makeArrow({
      x: 40, y: 25, points: [[0, 0], [120, 0]],
      startArrowhead: null,
      endArrowhead: 'arrow',
    });
    const idMap = { r1: 'miro-r1', r2: 'miro-r2' };
    const req = mapConnector(arrow, idMap, [rect1, rect2, arrow], opts);
    expect(req!.style?.startStrokeCap).toBe('none');
    expect(req!.style?.endStrokeCap).toBe('arrow');
  });

  it('maps triangle arrowhead to filled_triangle', () => {
    const rect1 = makeRect({ id: 'r1', x: 0, y: 0, width: 50, height: 50 });
    const rect2 = makeRect({ id: 'r2', x: 150, y: 0, width: 50, height: 50 });
    const arrow = makeArrow({
      x: 40, y: 25, points: [[0, 0], [120, 0]],
      endArrowhead: 'triangle',
    });
    const idMap = { r1: 'miro-r1', r2: 'miro-r2' };
    const req = mapConnector(arrow, idMap, [rect1, rect2, arrow], opts);
    expect(req!.style?.endStrokeCap).toBe('filled_triangle');
  });

  it('maps dot arrowhead to filled_oval', () => {
    const rect1 = makeRect({ id: 'r1', x: 0, y: 0, width: 50, height: 50 });
    const rect2 = makeRect({ id: 'r2', x: 150, y: 0, width: 50, height: 50 });
    const arrow = makeArrow({
      x: 40, y: 25, points: [[0, 0], [120, 0]],
      endArrowhead: 'dot',
    });
    const idMap = { r1: 'miro-r1', r2: 'miro-r2' };
    const req = mapConnector(arrow, idMap, [rect1, rect2, arrow], opts);
    expect(req!.style?.endStrokeCap).toBe('filled_oval');
  });

  it('maps bar arrowhead to stealth', () => {
    const rect1 = makeRect({ id: 'r1', x: 0, y: 0, width: 50, height: 50 });
    const rect2 = makeRect({ id: 'r2', x: 150, y: 0, width: 50, height: 50 });
    const arrow = makeArrow({
      x: 40, y: 25, points: [[0, 0], [120, 0]],
      endArrowhead: 'bar',
    });
    const idMap = { r1: 'miro-r1', r2: 'miro-r2' };
    const req = mapConnector(arrow, idMap, [rect1, rect2, arrow], opts);
    expect(req!.style?.endStrokeCap).toBe('stealth');
  });

  it('uses bound endpoint when binding exists and idMap has entry', () => {
    const rect1 = makeRect({ id: 'rect-1', x: 0, y: 0, width: 100, height: 100 });
    const rect2 = makeRect({ id: 'rect-2', x: 250, y: 0, width: 100, height: 100 });
    const arrow = makeArrow({
      x: 100, y: 50,
      points: [[0, 0], [150, 0]],
      startBinding: { elementId: 'rect-1', focus: 0, gap: 5 },
      endBinding: { elementId: 'rect-2', focus: 0, gap: 5 },
    });
    const idMap = { 'rect-1': 'miro-rect-1', 'rect-2': 'miro-rect-2' };
    const req = mapConnector(arrow, idMap, [rect1, rect2, arrow], opts);
    expect(req!.startItem?.id).toBe('miro-rect-1');
    expect(req!.startItem?.snapTo).toBeDefined();
  });

  it('returns null when no binding and no nearby shapes', () => {
    const arrow = makeArrow({
      x: 1000, y: 1000,
      points: [[0, 0], [50, 50]],
    });
    const req = mapConnector(arrow, {}, [], opts);
    expect(req).toBeNull();
  });

  it('snaps unbound arrow to nearby shapes within threshold', () => {
    const rect1 = makeRect({ id: 'rect-1', x: 0, y: 0, width: 100, height: 100 });
    const rect2 = makeRect({ id: 'rect-2', x: 250, y: 0, width: 100, height: 100 });
    const arrow = makeArrow({
      x: 90, y: 50,
      points: [[0, 0], [200, 0]],
    });
    const idMap = { 'rect-1': 'miro-rect-1', 'rect-2': 'miro-rect-2' };
    const req = mapConnector(arrow, idMap, [rect1, rect2, arrow], opts);
    expect(req).not.toBeNull();
    expect(req!.startItem?.id).toBe('miro-rect-1');
    expect(req!.endItem?.id).toBe('miro-rect-2');
  });

  it('returns null when startItem and endItem would be the same shape', () => {
    const rect = makeRect({ id: 'rect-1', x: 0, y: 0, width: 200, height: 200 });
    const arrow = makeArrow({
      x: 50, y: 50,
      points: [[0, 0], [30, 30]],
    });
    const idMap = { 'rect-1': 'miro-rect-1' };
    const req = mapConnector(arrow, idMap, [rect, arrow], opts);
    expect(req).toBeNull();
  });

  it('preserves stroke style', () => {
    const rect1 = makeRect({ id: 'r1', x: 0, y: 0, width: 50, height: 50 });
    const rect2 = makeRect({ id: 'r2', x: 150, y: 0, width: 50, height: 50 });
    const arrow = makeArrow({
      x: 40, y: 25, points: [[0, 0], [120, 0]],
      strokeColor: '#ff0000', strokeStyle: 'dashed', strokeWidth: 2,
    });
    const idMap = { r1: 'miro-r1', r2: 'miro-r2' };
    const req = mapConnector(arrow, idMap, [rect1, rect2, arrow], opts);
    expect(req!.style?.strokeColor).toBe('#ff0000');
    expect(req!.style?.strokeStyle).toBe('dashed');
    expect(req!.style?.strokeWidth).toBe('2.0');
  });

  it('handles line elements with arrowheads', () => {
    const rect1 = makeRect({ id: 'r1', x: 0, y: 0, width: 50, height: 50 });
    const rect2 = makeRect({ id: 'r2', x: 150, y: 0, width: 50, height: 50 });
    const line = makeLine({
      x: 40, y: 25, points: [[0, 0], [120, 0]],
      startArrowhead: 'arrow',
      endArrowhead: 'triangle',
    });
    const idMap = { r1: 'miro-r1', r2: 'miro-r2' };
    const req = mapConnector(line, idMap, [rect1, rect2, line], opts);
    expect(req!.style?.startStrokeCap).toBe('arrow');
    expect(req!.style?.endStrokeCap).toBe('filled_triangle');
  });
});
