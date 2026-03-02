import {
  mapStrokeStyle,
  mapColor,
  mapOpacity,
  mapStrokeWidth,
  mapFontFamily,
  mapFontSize,
  buildShapeStyle,
  buildTextStyle,
} from '../mappers/style-mapper';
import { makeRect, makeText } from './fixtures';

describe('mapStrokeStyle', () => {
  it('maps solid to normal', () => expect(mapStrokeStyle('solid')).toBe('normal'));
  it('maps dashed to dashed', () => expect(mapStrokeStyle('dashed')).toBe('dashed'));
  it('maps dotted to dotted', () => expect(mapStrokeStyle('dotted')).toBe('dotted'));
});

describe('mapColor', () => {
  it('passes through hex colors', () => expect(mapColor('#ff0000')).toBe('#ff0000'));
  it('maps transparent', () => expect(mapColor('transparent')).toBe('transparent'));
  it('maps empty string to transparent', () => expect(mapColor('')).toBe('transparent'));
});

describe('mapOpacity', () => {
  it('maps 100 to 1.0', () => expect(mapOpacity(100)).toBe('1.0'));
  it('maps 0 to 0.0', () => expect(mapOpacity(0)).toBe('0.0'));
  it('maps 50 to 0.5', () => expect(mapOpacity(50)).toBe('0.5'));
});

describe('mapStrokeWidth', () => {
  it('maps thin (1) to 1.0', () => expect(mapStrokeWidth(1)).toBe('1.0'));
  it('maps bold (2) to 2.0', () => expect(mapStrokeWidth(2)).toBe('2.0'));
  it('maps extra bold (4) to 4.0', () => expect(mapStrokeWidth(4)).toBe('4.0'));
  it('maps large values to 6.0', () => expect(mapStrokeWidth(8)).toBe('6.0'));
});

describe('mapFontFamily', () => {
  it('maps 1 (Virgil) to caveat', () => expect(mapFontFamily(1)).toBe('caveat'));
  it('maps 2 (Helvetica) to arial', () => expect(mapFontFamily(2)).toBe('arial'));
  it('maps 3 (Cascadia) to roboto_mono', () => expect(mapFontFamily(3)).toBe('roboto_mono'));
  it('maps 4 (Liberation Sans) to arial', () => expect(mapFontFamily(4)).toBe('arial'));
  it('defaults to arial', () => expect(mapFontFamily(99)).toBe('arial'));
});

describe('mapFontSize', () => {
  it('returns integer string', () => expect(mapFontSize(20)).toBe('20'));
  it('rounds floats', () => expect(mapFontSize(14.7)).toBe('15'));
});

describe('buildShapeStyle', () => {
  it('sets transparent fill when bg is transparent', () => {
    const style = buildShapeStyle(makeRect());
    expect(style.fillOpacity).toBe('0.0');
    expect(style.fillColor).toBeUndefined();
  });

  it('sets fill color and opacity when bg is colored', () => {
    const style = buildShapeStyle(makeRect({ backgroundColor: '#ff0000', opacity: 80 }));
    expect(style.fillColor).toBe('#ff0000');
    expect(style.fillOpacity).toBe('0.8');
  });

  it('sets border properties', () => {
    const style = buildShapeStyle(
      makeRect({ strokeColor: '#0000ff', strokeWidth: 2, strokeStyle: 'dashed', opacity: 100 })
    );
    expect(style.borderColor).toBe('#0000ff');
    expect(style.borderWidth).toBe('2.0');
    expect(style.borderStyle).toBe('dashed');
    expect(style.borderOpacity).toBe('1.0');
  });
});

describe('buildTextStyle', () => {
  it('sets color from strokeColor', () => {
    const style = buildTextStyle(makeText({ strokeColor: '#333333' }));
    expect(style.color).toBe('#333333');
  });

  it('maps font properties', () => {
    const style = buildTextStyle(makeText({ fontSize: 24, fontFamily: 2 }));
    expect(style.fontSize).toBe('24');
    expect(style.fontFamily).toBe('arial');
  });
});
