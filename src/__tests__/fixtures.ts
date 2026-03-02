import {
  ExcalidrawRectangle,
  ExcalidrawEllipse,
  ExcalidrawDiamond,
  ExcalidrawText,
  ExcalidrawArrow,
  ExcalidrawLine,
  ExcalidrawFreedraw,
  ExcalidrawImage,
  ExcalidrawFrame,
  ExcalidrawFile,
  ConversionOptions,
  DEFAULT_OPTIONS,
} from '../types';

const BASE = {
  angle: 0,
  strokeColor: '#000000',
  backgroundColor: 'transparent',
  fillStyle: 'solid' as const,
  strokeWidth: 1,
  strokeStyle: 'solid' as const,
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: 123,
  version: 1,
  versionNonce: 456,
  isDeleted: false,
  boundElements: null,
  updated: Date.now(),
  link: null,
  locked: false,
};

export function makeRect(overrides: Partial<ExcalidrawRectangle> = {}): ExcalidrawRectangle {
  return {
    ...BASE,
    id: 'rect-1',
    type: 'rectangle',
    x: 100,
    y: 200,
    width: 300,
    height: 150,
    ...overrides,
  } as ExcalidrawRectangle;
}

export function makeEllipse(overrides: Partial<ExcalidrawEllipse> = {}): ExcalidrawEllipse {
  return {
    ...BASE,
    id: 'ellipse-1',
    type: 'ellipse',
    x: 500,
    y: 200,
    width: 200,
    height: 200,
    ...overrides,
  } as ExcalidrawEllipse;
}

export function makeDiamond(overrides: Partial<ExcalidrawDiamond> = {}): ExcalidrawDiamond {
  return {
    ...BASE,
    id: 'diamond-1',
    type: 'diamond',
    x: 100,
    y: 500,
    width: 150,
    height: 150,
    ...overrides,
  } as ExcalidrawDiamond;
}

export function makeText(overrides: Partial<ExcalidrawText> = {}): ExcalidrawText {
  return {
    ...BASE,
    id: 'text-1',
    type: 'text',
    x: 100,
    y: 100,
    width: 200,
    height: 30,
    text: 'Hello World',
    fontSize: 20,
    fontFamily: 2,
    textAlign: 'left',
    verticalAlign: 'top',
    baseline: 18,
    containerId: null,
    originalText: 'Hello World',
    lineHeight: 1.25,
    ...overrides,
  } as ExcalidrawText;
}

export function makeArrow(overrides: Partial<ExcalidrawArrow> = {}): ExcalidrawArrow {
  return {
    ...BASE,
    id: 'arrow-1',
    type: 'arrow',
    x: 400,
    y: 275,
    width: 100,
    height: 0,
    points: [[0, 0], [100, 0]] as [number, number][],
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    ...overrides,
  } as ExcalidrawArrow;
}

export function makeLine(overrides: Partial<ExcalidrawLine> = {}): ExcalidrawLine {
  return {
    ...BASE,
    id: 'line-1',
    type: 'line',
    x: 100,
    y: 400,
    width: 200,
    height: 0,
    points: [[0, 0], [200, 0]] as [number, number][],
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
    ...overrides,
  } as ExcalidrawLine;
}

export function makeFreedraw(overrides: Partial<ExcalidrawFreedraw> = {}): ExcalidrawFreedraw {
  return {
    ...BASE,
    id: 'freedraw-1',
    type: 'freedraw',
    x: 50,
    y: 50,
    width: 100,
    height: 80,
    points: [
      [0, 0], [10, 15], [25, 30], [50, 45],
      [70, 60], [85, 70], [100, 80],
    ] as [number, number][],
    pressures: [],
    simulatePressure: true,
    ...overrides,
  } as ExcalidrawFreedraw;
}

export function makeImage(overrides: Partial<ExcalidrawImage> = {}): ExcalidrawImage {
  return {
    ...BASE,
    id: 'image-1',
    type: 'image',
    x: 200,
    y: 300,
    width: 400,
    height: 300,
    fileId: 'file-abc',
    status: 'saved',
    scale: [1, 1],
    ...overrides,
  } as ExcalidrawImage;
}

export function makeFrame(overrides: Partial<ExcalidrawFrame> = {}): ExcalidrawFrame {
  return {
    ...BASE,
    id: 'frame-1',
    type: 'frame',
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    name: 'Test Frame',
    ...overrides,
  } as ExcalidrawFrame;
}

export function makeExcalidrawFile(
  elements: ExcalidrawFile['elements'],
  files?: ExcalidrawFile['files']
): ExcalidrawFile {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'test',
    elements,
    files,
  };
}

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
  'Nl7BcQAAAABJRU5ErkJggg==';

export function makePngDataUrl(): string {
  return `data:image/png;base64,${TINY_PNG_BASE64}`;
}

export function makeFilesMap(fileId = 'file-abc'): ExcalidrawFile['files'] {
  return {
    [fileId]: {
      mimeType: 'image/png',
      id: fileId,
      dataURL: makePngDataUrl(),
      created: Date.now(),
    },
  };
}

export function makeOptions(overrides: Partial<ConversionOptions> = {}): ConversionOptions {
  return { ...DEFAULT_OPTIONS, ...overrides };
}
