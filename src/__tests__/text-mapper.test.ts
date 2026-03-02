import {
  isConvertibleText,
  isContainerBoundText,
  mapText,
  getBoundTextContent,
  findBoundTextElements,
} from '../mappers/text-mapper';
import { makeText, makeRect, makeOptions } from './fixtures';

const opts = makeOptions({ scale: 1, offsetX: 0, offsetY: 0 });

describe('isConvertibleText', () => {
  it('returns true for text', () => expect(isConvertibleText(makeText())).toBe(true));
  it('returns false for rect', () => expect(isConvertibleText(makeRect())).toBe(false));
});

describe('isContainerBoundText', () => {
  it('returns false when containerId is null', () => {
    expect(isContainerBoundText(makeText({ containerId: null }))).toBe(false);
  });

  it('returns true when containerId is set', () => {
    expect(isContainerBoundText(makeText({ containerId: 'rect-1' }))).toBe(true);
  });
});

describe('mapText', () => {
  it('positions at center of text element', () => {
    const req = mapText(makeText({ x: 0, y: 0, width: 200, height: 30 }), opts);
    expect(req.position.x).toBe(100);
    expect(req.position.y).toBe(15);
    expect(req.position.origin).toBe('center');
  });

  it('escapes HTML in content', () => {
    const req = mapText(makeText({ text: '<script>alert("xss")</script>' }), opts);
    expect(req.data.content).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  it('converts newlines to br tags', () => {
    const req = mapText(makeText({ text: 'line1\nline2\nline3' }), opts);
    expect(req.data.content).toBe('line1<br>line2<br>line3');
  });

  it('escapes ampersands', () => {
    const req = mapText(makeText({ text: 'A & B' }), opts);
    expect(req.data.content).toBe('A &amp; B');
  });

  it('sets text align from element', () => {
    const req = mapText(makeText({ textAlign: 'center' }), opts);
    expect(req.style?.textAlign).toBe('center');
  });

  it('handles rotation', () => {
    const req = mapText(makeText({ angle: Math.PI }), opts);
    expect(req.geometry?.rotation).toBeCloseTo(180);
  });
});

describe('getBoundTextContent', () => {
  it('returns formatted text for matching id', () => {
    const elements = [makeText({ id: 'txt-99', text: 'Bound label' })];
    expect(getBoundTextContent('txt-99', elements)).toBe('Bound label');
  });

  it('returns null for missing id', () => {
    expect(getBoundTextContent('nonexistent', [makeText()])).toBeNull();
  });

  it('returns null for non-text element with same id', () => {
    expect(getBoundTextContent('rect-1', [makeRect({ id: 'rect-1' })])).toBeNull();
  });
});

describe('findBoundTextElements', () => {
  it('finds text elements with matching containerId', () => {
    const texts = [
      makeText({ id: 't1', containerId: 'rect-1' }),
      makeText({ id: 't2', containerId: 'rect-2' }),
      makeText({ id: 't3', containerId: 'rect-1' }),
    ];
    const found = findBoundTextElements('rect-1', texts);
    expect(found).toHaveLength(2);
    expect(found.map((e) => e.id)).toEqual(['t1', 't3']);
  });
});
