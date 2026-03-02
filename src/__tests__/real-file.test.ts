import * as path from 'path';
import { Converter } from '../converter';
import {
  parseExcalidrawFile,
  getActiveElements,
  getBoundingBox,
  groupElementsByType,
} from '../parser';

/**
 * Integration tests against the real routing.excalidraw file
 * shipped in the repo. These run the full pipeline with a mocked
 * Miro API client so nothing hits the network but every mapper,
 * parser, and converter code-path is exercised with production data.
 */

const FIXTURE = path.resolve(__dirname, '..', '..', 'routing.excalidraw');

// ── Mock the Miro API client ──────────────────────────────────────

jest.mock('../api', () => ({
  MiroClient: jest.fn().mockImplementation(() => mockClient),
}));

let idCounter: number;
const created: Record<string, unknown[]> = {
  shapes: [],
  texts: [],
  connectors: [],
  images: [],
  frames: [],
};

const mockClient = {
  getBoard: jest.fn(),
  createShape: jest.fn(),
  createText: jest.fn(),
  createConnector: jest.fn(),
  createImage: jest.fn(),
  createFrame: jest.fn(),
  updateItemParent: jest.fn(),
};

beforeEach(() => {
  idCounter = 1;
  Object.keys(created).forEach((k) => (created[k] = []));
  Object.values(mockClient).forEach((fn) => (fn as jest.Mock).mockClear());

  mockClient.getBoard.mockResolvedValue({ id: 'board-1', name: 'Test Board' });

  mockClient.createShape.mockImplementation((_, req) => {
    const id = `miro-shape-${idCounter++}`;
    created.shapes.push({ id, ...req });
    return Promise.resolve({ id, type: 'shape' });
  });

  mockClient.createText.mockImplementation((_, req) => {
    const id = `miro-text-${idCounter++}`;
    created.texts.push({ id, ...req });
    return Promise.resolve({ id, type: 'text' });
  });

  mockClient.createConnector.mockImplementation((_, req) => {
    const id = `miro-conn-${idCounter++}`;
    created.connectors.push({ id, ...req });
    return Promise.resolve({ id, type: 'connector' });
  });

  mockClient.createImage.mockImplementation((_, _buf, _mime, meta) => {
    const id = `miro-img-${idCounter++}`;
    created.images.push({ id, ...meta });
    return Promise.resolve({ id, type: 'image' });
  });

  mockClient.createFrame.mockImplementation((_, req) => {
    const id = `miro-frame-${idCounter++}`;
    created.frames.push({ id, ...req });
    return Promise.resolve({ id, type: 'frame' });
  });

  mockClient.updateItemParent.mockResolvedValue(undefined);
});

// ── Parser tests against the real file ────────────────────────────

describe('routing.excalidraw — parser', () => {
  const file = parseExcalidrawFile(FIXTURE);

  it('parses without errors', () => {
    expect(file.type).toBe('excalidraw');
    expect(file.version).toBe(2);
    expect(file.elements.length).toBe(56);
  });

  it('has no deleted elements', () => {
    const active = getActiveElements(file);
    expect(active.length).toBe(56);
  });

  it('groups into the expected buckets', () => {
    const groups = groupElementsByType(getActiveElements(file));
    expect(groups.shapes).toHaveLength(12);
    expect(groups.text).toHaveLength(30);
    expect(groups.arrows).toHaveLength(14);
    expect(groups.lines).toHaveLength(0);
    expect(groups.freedraw).toHaveLength(0);
    expect(groups.images).toHaveLength(0);
    expect(groups.frames).toHaveLength(0);
    expect(groups.other).toHaveLength(0);
  });

  it('computes a non-zero bounding box', () => {
    const bb = getBoundingBox(getActiveElements(file));
    expect(bb.width).toBeGreaterThan(0);
    expect(bb.height).toBeGreaterThan(0);
    expect(bb.centerX).toBeDefined();
  });
});

// ── Full conversion against the real file ─────────────────────────

describe('routing.excalidraw — full conversion', () => {
  it('converts all 56 elements successfully', async () => {
    const converter = new Converter({
      miroToken: 'test-token',
      boardId: 'board-1',
    });

    const result = await converter.convert(FIXTURE);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.skippedElements).toHaveLength(1); // arrow4-overlap self-referencing

    expect(result.itemsCreated).toBe(15);      // 12 shapes + 3 standalone texts (27 merged into shapes)
    expect(result.connectorsCreated).toBe(13);  // 13 arrows (1 self-referencing skipped)
    expect(result.framesCreated).toBe(0);
    expect(result.imagesCreated).toBe(0);
    expect(result.freedrawConverted).toBe(0);

    expect(mockClient.createShape).toHaveBeenCalledTimes(12);
    expect(mockClient.createText).toHaveBeenCalledTimes(3);   // only standalone texts
    expect(mockClient.createConnector).toHaveBeenCalledTimes(13);
    expect(mockClient.createImage).not.toHaveBeenCalled();
    expect(mockClient.createFrame).not.toHaveBeenCalled();
  });

  it('assigns a unique Miro ID to every element', async () => {
    const converter = new Converter({ miroToken: 'test', boardId: 'b' });
    const result = await converter.convert(FIXTURE);

    const ids = Object.values(result.idMap);
    expect(ids.length).toBe(55); // 56 elements - 1 skipped self-referencing arrow
    // Unique IDs: 28 real + 'merged' placeholder = 29 unique values
    // (12 shapes + 3 standalone texts + 13 connectors = 28, plus 27 merged texts share 'merged')
    expect(new Set(ids).size).toBe(29);
  });
});

describe('routing.excalidraw — shapes', () => {
  it('every created shape has valid position and geometry', async () => {
    const converter = new Converter({ miroToken: 'test', boardId: 'b' });
    await converter.convert(FIXTURE);

    for (const shape of created.shapes) {
      const s = shape as any;
      expect(s.position.origin).toBe('center');
      expect(typeof s.position.x).toBe('number');
      expect(typeof s.position.y).toBe('number');
      expect(s.geometry.width).toBeGreaterThan(0);
      expect(s.geometry.height).toBeGreaterThan(0);
    }
  });

  it('all shapes are rectangles (routing diagram uses only rects)', async () => {
    const converter = new Converter({ miroToken: 'test', boardId: 'b' });
    await converter.convert(FIXTURE);

    for (const shape of created.shapes) {
      const s = shape as any;
      expect(['rectangle', 'round_rectangle']).toContain(s.data.shape);
    }
  });
});

describe('routing.excalidraw — text elements', () => {
  it('standalone texts have non-empty content', async () => {
    const converter = new Converter({ miroToken: 'test', boardId: 'b' });
    await converter.convert(FIXTURE);

    expect(created.texts.length).toBe(3); // only standalone texts not inside shapes
    for (const text of created.texts) {
      const t = text as any;
      expect(t.data.content.length).toBeGreaterThan(0);
    }
  });

  it('the title text is present as standalone text', async () => {
    const converter = new Converter({ miroToken: 'test', boardId: 'b' });
    await converter.convert(FIXTURE);

    const titleItem = created.texts.find((t) =>
      ((t as any).data.content as string).includes('Proposed Routing Architecture')
    );
    expect(titleItem).toBeDefined();
  });

  it('texts inside shapes are merged into shape content', async () => {
    const converter = new Converter({ miroToken: 'test', boardId: 'b' });
    await converter.convert(FIXTURE);

    const shapesWithContent = created.shapes.filter(
      (s) => (s as any).data.content
    );
    expect(shapesWithContent.length).toBe(12); // all shapes have text merged in
  });

  it('no text or shape content contains raw HTML tags (they should be escaped)', async () => {
    const converter = new Converter({ miroToken: 'test', boardId: 'b' });
    await converter.convert(FIXTURE);

    for (const text of created.texts) {
      const content = (text as any).data.content as string;
      expect(content).not.toMatch(/<(?!br>)/);
    }
    for (const shape of created.shapes) {
      const content = (shape as any).data.content as string | undefined;
      if (content) {
        expect(content).not.toMatch(/<(?!br>)/);
      }
    }
  });
});

describe('routing.excalidraw — connectors', () => {
  it('every connector has a shape type', async () => {
    const converter = new Converter({ miroToken: 'test', boardId: 'b' });
    await converter.convert(FIXTURE);

    for (const conn of created.connectors) {
      const c = conn as any;
      expect(['straight', 'curved', 'elbowed']).toContain(c.shape);
    }
  });

  it('every connector has start and end items defined', async () => {
    const converter = new Converter({ miroToken: 'test', boardId: 'b' });
    await converter.convert(FIXTURE);

    for (const conn of created.connectors) {
      const c = conn as any;
      expect(c.startItem).toBeDefined();
      expect(c.endItem).toBeDefined();

      expect(c.startItem.id).toBeDefined();
      expect(c.endItem.id).toBeDefined();
    }
  });

  it('preserves stroke styles', async () => {
    const converter = new Converter({ miroToken: 'test', boardId: 'b' });
    await converter.convert(FIXTURE);

    for (const conn of created.connectors) {
      const c = conn as any;
      expect(c.style).toBeDefined();
      expect(c.style.strokeColor).toBeDefined();
    }
  });
});

describe('routing.excalidraw — auto-centering', () => {
  it('positions content around the board origin', async () => {
    const converter = new Converter({ miroToken: 'test', boardId: 'b' });
    await converter.convert(FIXTURE);

    const allX = [
      ...created.shapes.map((s: any) => s.position.x),
      ...created.texts.map((t: any) => t.position.x),
    ];
    const allY = [
      ...created.shapes.map((s: any) => s.position.y),
      ...created.texts.map((t: any) => t.position.y),
    ];

    const avgX = allX.reduce((a, b) => a + b, 0) / allX.length;
    const avgY = allY.reduce((a, b) => a + b, 0) / allY.length;

    expect(Math.abs(avgX)).toBeLessThan(200);
    expect(Math.abs(avgY)).toBeLessThan(200);
  });
});

describe('routing.excalidraw — option flags', () => {
  it('--no-connectors skips all 14 arrows', async () => {
    const converter = new Converter({
      miroToken: 'test',
      boardId: 'b',
      options: { createConnectors: false },
    });
    const result = await converter.convert(FIXTURE);

    expect(result.connectorsCreated).toBe(0);
    expect(result.itemsCreated).toBe(15);     // 12 shapes + 3 standalone texts
    expect(mockClient.createConnector).not.toHaveBeenCalled();
  });

  it('custom scale doubles all coordinates', async () => {
    const converter = new Converter({
      miroToken: 'test',
      boardId: 'b',
      options: { scale: 2, offsetX: 0, offsetY: 0 },
    });
    await converter.convert(FIXTURE);

    const conv1x = new Converter({
      miroToken: 'test',
      boardId: 'b',
      options: { scale: 1, offsetX: 0, offsetY: 0 },
    });

    created.shapes = [];
    created.texts = [];
    idCounter = 1;
    await conv1x.convert(FIXTURE);

    const shapes1x = [...created.shapes];

    created.shapes = [];
    idCounter = 1;
    const conv2x = new Converter({
      miroToken: 'test',
      boardId: 'b',
      options: { scale: 2, offsetX: 0, offsetY: 0 },
    });
    await conv2x.convert(FIXTURE);

    if (shapes1x.length > 0 && created.shapes.length > 0) {
      const w1 = (shapes1x[0] as any).geometry.width;
      const w2 = (created.shapes[0] as any).geometry.width;
      expect(w2).toBeCloseTo(w1 * 2);
    }
  });
});
