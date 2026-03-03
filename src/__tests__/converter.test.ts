import * as fs from 'fs';
import * as path from 'path';
import { Converter } from '../converter';
import {
  makeRect,
  makeEllipse,
  makeText,
  makeArrow,
  makeFreedraw,
  makeImage,
  makeFrame,
  makeExcalidrawFile,
  makeFilesMap,
} from './fixtures';

jest.mock('../api', () => {
  return {
    MiroClient: jest.fn().mockImplementation(() => mockClient),
  };
});

let idCounter: number;
let groupIdCounter: number;
const mockClient = {
  getBoard: jest.fn(),
  createShape: jest.fn(),
  createText: jest.fn(),
  createConnector: jest.fn(),
  createImage: jest.fn(),
  createFrame: jest.fn(),
  createGroup: jest.fn(),
  updateItemParent: jest.fn(),
};

function resetMocks() {
  idCounter = 1;
  groupIdCounter = 1;
  mockClient.getBoard.mockResolvedValue({ id: 'board-1', name: 'Test Board' });
  mockClient.createShape.mockImplementation(() =>
    Promise.resolve({ id: `miro-shape-${idCounter++}`, type: 'shape' })
  );
  mockClient.createText.mockImplementation(() =>
    Promise.resolve({ id: `miro-text-${idCounter++}`, type: 'text' })
  );
  mockClient.createConnector.mockImplementation(() =>
    Promise.resolve({ id: `miro-conn-${idCounter++}`, type: 'connector' })
  );
  mockClient.createImage.mockImplementation(() =>
    Promise.resolve({ id: `miro-img-${idCounter++}`, type: 'image' })
  );
  mockClient.createFrame.mockImplementation(() =>
    Promise.resolve({ id: `miro-frame-${idCounter++}`, type: 'frame' })
  );
  mockClient.createGroup.mockImplementation(() =>
    Promise.resolve({ id: `miro-group-${groupIdCounter++}`, type: 'group' })
  );
  mockClient.updateItemParent.mockResolvedValue(undefined);
  Object.values(mockClient).forEach((fn) => (fn as jest.Mock).mockClear());
  mockClient.getBoard.mockResolvedValue({ id: 'board-1', name: 'Test Board' });
}

function writeFixtureFile(file: ReturnType<typeof makeExcalidrawFile>): string {
  const tmpDir = path.join(__dirname, '..', '..', '.test-tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const filePath = path.join(tmpDir, `test-${Date.now()}.excalidraw`);
  fs.writeFileSync(filePath, JSON.stringify(file));
  return filePath;
}

afterAll(() => {
  const tmpDir = path.join(__dirname, '..', '..', '.test-tmp');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('Converter', () => {
  beforeEach(() => resetMocks());

  describe('basic conversion', () => {
    it('converts shapes and text', async () => {
      const file = makeExcalidrawFile([makeRect(), makeEllipse(), makeText()]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({
        miroToken: 'test-token',
        boardId: 'board-1',
      });
      const result = await converter.convert(filePath);

      expect(result.success).toBe(true);
      expect(result.itemsCreated).toBe(3);
      expect(mockClient.createShape).toHaveBeenCalledTimes(2);
      expect(mockClient.createText).toHaveBeenCalledTimes(1);
    });

    it('returns success with 0 items for empty file', async () => {
      const file = makeExcalidrawFile([]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.success).toBe(true);
      expect(result.itemsCreated).toBe(0);
      expect(mockClient.getBoard).not.toHaveBeenCalled();
    });

    it('filters out deleted elements', async () => {
      const file = makeExcalidrawFile([
        makeRect({ id: 'a' }),
        makeRect({ id: 'b', isDeleted: true }),
      ]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.itemsCreated).toBe(1);
      expect(mockClient.createShape).toHaveBeenCalledTimes(1);
    });
  });

  describe('bound text', () => {
    it('includes bound text as shape content', async () => {
      const rect = makeRect({
        id: 'rect-1',
        boundElements: [{ id: 'txt-1', type: 'text' }],
      });
      const text = makeText({ id: 'txt-1', text: 'Inside', containerId: 'rect-1' });
      const file = makeExcalidrawFile([rect, text]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(mockClient.createShape).toHaveBeenCalledTimes(1);
      const shapeCall = mockClient.createShape.mock.calls[0][1];
      expect(shapeCall.data.content).toBe('Inside');
      expect(mockClient.createText).not.toHaveBeenCalled();
      expect(result.itemsCreated).toBe(1);
    });
  });

  describe('connectors', () => {
    it('creates connectors for arrows', async () => {
      const r1 = makeRect({ id: 'r1', x: 0, y: 0, width: 100, height: 100 });
      const r2 = makeRect({ id: 'r2', x: 300, y: 0, width: 100, height: 100 });
      const arrow = makeArrow({
        id: 'a1',
        x: 100, y: 50,
        points: [[0, 0], [200, 0]],
        startBinding: { elementId: 'r1', focus: 0, gap: 5 },
        endBinding: { elementId: 'r2', focus: 0, gap: 5 },
      });
      const file = makeExcalidrawFile([r1, r2, arrow]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.connectorsCreated).toBe(1);
      expect(mockClient.createConnector).toHaveBeenCalledTimes(1);
    });

    it('skips connectors when --no-connectors', async () => {
      const file = makeExcalidrawFile([
        makeRect({ id: 'r1' }),
        makeArrow({ id: 'a1' }),
      ]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({
        miroToken: 'test',
        boardId: 'b',
        options: { createConnectors: false },
      });
      const result = await converter.convert(filePath);

      expect(result.connectorsCreated).toBe(0);
      expect(mockClient.createConnector).not.toHaveBeenCalled();
    });
  });

  describe('image support', () => {
    it('uploads embedded images', async () => {
      const img = makeImage({ id: 'img-1', fileId: 'file-abc' });
      const file = makeExcalidrawFile([img], makeFilesMap('file-abc'));
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.imagesCreated).toBe(1);
      expect(mockClient.createImage).toHaveBeenCalledTimes(1);

      const [, buffer, mimeType, metadata] = mockClient.createImage.mock.calls[0];
      expect(buffer).toBeInstanceOf(Buffer);
      expect(mimeType).toBe('image/png');
      expect(metadata.title).toBe('Image');
    });

    it('skips images when convertImages is false', async () => {
      const img = makeImage({ id: 'img-1' });
      const file = makeExcalidrawFile([img], makeFilesMap());
      const filePath = writeFixtureFile(file);

      const converter = new Converter({
        miroToken: 'test',
        boardId: 'b',
        options: { convertImages: false },
      });
      const result = await converter.convert(filePath);

      expect(result.imagesCreated).toBe(0);
      expect(result.skippedElements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'image', reason: 'Image conversion disabled' }),
        ])
      );
    });

    it('skips images with missing file data', async () => {
      const img = makeImage({ id: 'img-1', fileId: 'nonexistent' });
      const file = makeExcalidrawFile([img], makeFilesMap('other-id'));
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.imagesCreated).toBe(0);
      expect(result.skippedElements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'img-1', reason: 'Image file data not found in .excalidraw' }),
        ])
      );
    });
  });

  describe('freedraw support', () => {
    it('converts freedraw to SVG and uploads', async () => {
      const fd = makeFreedraw({ id: 'fd-1' });
      const file = makeExcalidrawFile([fd]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.freedrawConverted).toBe(1);
      expect(mockClient.createImage).toHaveBeenCalledTimes(1);

      const [, buffer, mimeType] = mockClient.createImage.mock.calls[0];
      expect(mimeType).toBe('image/svg+xml');
      const svg = buffer.toString('utf-8');
      expect(svg).toContain('<svg');
    });

    it('skips freedraw when convertFreedraw is false', async () => {
      const fd = makeFreedraw({ id: 'fd-1' });
      const file = makeExcalidrawFile([fd]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({
        miroToken: 'test',
        boardId: 'b',
        options: { convertFreedraw: false },
      });
      const result = await converter.convert(filePath);

      expect(result.freedrawConverted).toBe(0);
      expect(result.skippedElements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'freedraw', reason: 'Freedraw conversion disabled' }),
        ])
      );
    });

    it('skips freedraw when skipFreedraw is true', async () => {
      const fd = makeFreedraw({ id: 'fd-1' });
      const file = makeExcalidrawFile([fd]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({
        miroToken: 'test',
        boardId: 'b',
        options: { skipFreedraw: true },
      });
      const result = await converter.convert(filePath);

      expect(result.freedrawConverted).toBe(0);
    });

    it('skips freedraw with fewer than 2 points', async () => {
      const fd = makeFreedraw({ id: 'fd-1', points: [[0, 0]] });
      const file = makeExcalidrawFile([fd]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.freedrawConverted).toBe(0);
      expect(result.skippedElements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'fd-1', reason: 'Freedraw has fewer than 2 points' }),
        ])
      );
    });
  });

  describe('frame support', () => {
    it('creates frames and attaches children', async () => {
      const frame = makeFrame({ id: 'frame-1' });
      const rect = makeRect({ id: 'rect-1', frameId: 'frame-1' });
      const text = makeText({ id: 'txt-1', frameId: 'frame-1' });
      const file = makeExcalidrawFile([frame, rect, text]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.framesCreated).toBe(1);
      expect(mockClient.createFrame).toHaveBeenCalledTimes(1);
      expect(mockClient.updateItemParent).toHaveBeenCalledTimes(2);

      const parentCalls = mockClient.updateItemParent.mock.calls;
      for (const call of parentCalls) {
        expect(call[2]).toEqual(
          expect.objectContaining({ parent: expect.objectContaining({ id: expect.any(String) }) })
        );
      }
    });

    it('skips frames when convertFrames is false', async () => {
      const frame = makeFrame({ id: 'frame-1' });
      const file = makeExcalidrawFile([frame]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({
        miroToken: 'test',
        boardId: 'b',
        options: { convertFrames: false },
      });
      const result = await converter.convert(filePath);

      expect(result.framesCreated).toBe(0);
      expect(mockClient.createFrame).not.toHaveBeenCalled();
      expect(result.skippedElements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'frame', reason: 'Frame conversion disabled' }),
        ])
      );
    });

    it('does not attach items without frameId', async () => {
      const frame = makeFrame({ id: 'frame-1' });
      const rect = makeRect({ id: 'rect-1', frameId: null });
      const file = makeExcalidrawFile([frame, rect]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.framesCreated).toBe(1);
      expect(mockClient.updateItemParent).not.toHaveBeenCalled();
    });
  });

  describe('conversion phase ordering', () => {
    it('creates frames before shapes', async () => {
      const callOrder: string[] = [];
      mockClient.createFrame.mockImplementation(() => {
        callOrder.push('frame');
        return Promise.resolve({ id: `miro-frame-${idCounter++}`, type: 'frame' });
      });
      mockClient.createShape.mockImplementation(() => {
        callOrder.push('shape');
        return Promise.resolve({ id: `miro-shape-${idCounter++}`, type: 'shape' });
      });

      const frame = makeFrame({ id: 'frame-1' });
      const rect = makeRect({ id: 'rect-1', frameId: 'frame-1' });
      const file = makeExcalidrawFile([frame, rect]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      await converter.convert(filePath);

      expect(callOrder.indexOf('frame')).toBeLessThan(callOrder.indexOf('shape'));
    });
  });

  describe('error handling', () => {
    it('records errors for failed shape creation', async () => {
      mockClient.createShape.mockRejectedValueOnce(new Error('API 500'));
      const file = makeExcalidrawFile([makeRect()]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('API 500');
    });

    it('records error when board access fails', async () => {
      mockClient.getBoard.mockRejectedValue(new Error('Unauthorized'));
      const file = makeExcalidrawFile([makeRect()]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Unauthorized');
    });

    it('continues creating items after a single failure', async () => {
      mockClient.createShape
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce({ id: 'miro-2', type: 'shape' });

      const file = makeExcalidrawFile([
        makeRect({ id: 'r1' }),
        makeEllipse({ id: 'r2' }),
      ]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.itemsCreated).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('group mapping', () => {
    it('creates Miro groups from Excalidraw groupIds', async () => {
      const r1 = makeRect({ id: 'r1', groupIds: ['g1'] });
      const r2 = makeEllipse({ id: 'r2', groupIds: ['g1'] });
      const file = makeExcalidrawFile([r1, r2]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.groupsCreated).toBe(1);
      expect(mockClient.createGroup).toHaveBeenCalledTimes(1);
      const groupCall = mockClient.createGroup.mock.calls[0][1];
      expect(groupCall.data.items).toHaveLength(2);
    });

    it('skips groups with fewer than 2 resolvable items', async () => {
      const r1 = makeRect({ id: 'r1', groupIds: ['g1'] });
      const file = makeExcalidrawFile([r1]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.groupsCreated).toBe(0);
      expect(mockClient.createGroup).not.toHaveBeenCalled();
    });

    it('creates multiple groups for separate groupIds', async () => {
      const r1 = makeRect({ id: 'r1', groupIds: ['g1'] });
      const r2 = makeEllipse({ id: 'r2', groupIds: ['g1'] });
      const t1 = makeText({ id: 't1', groupIds: ['g2'] });
      const t2 = makeText({ id: 't2', text: 'Another', groupIds: ['g2'], x: 400, y: 400 });
      const file = makeExcalidrawFile([r1, r2, t1, t2]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.groupsCreated).toBe(2);
      expect(mockClient.createGroup).toHaveBeenCalledTimes(2);
    });

    it('handles nested groups (element in multiple groupIds)', async () => {
      const r1 = makeRect({ id: 'r1', groupIds: ['inner', 'outer'] });
      const r2 = makeEllipse({ id: 'r2', groupIds: ['inner', 'outer'] });
      const r3 = makeRect({ id: 'r3', x: 500, y: 500, width: 100, height: 100, groupIds: ['outer'] });
      const file = makeExcalidrawFile([r1, r2, r3]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.groupsCreated).toBe(2);
      expect(mockClient.createGroup).toHaveBeenCalledTimes(2);

      const firstCall = mockClient.createGroup.mock.calls[0][1];
      const secondCall = mockClient.createGroup.mock.calls[1][1];
      expect(firstCall.data.items).toHaveLength(2);
      expect(secondCall.data.items).toHaveLength(3);
    });

    it('does not group items with empty groupIds', async () => {
      const r1 = makeRect({ id: 'r1', groupIds: [] });
      const r2 = makeEllipse({ id: 'r2', groupIds: [] });
      const file = makeExcalidrawFile([r1, r2]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.groupsCreated).toBe(0);
      expect(mockClient.createGroup).not.toHaveBeenCalled();
    });

    it('records error when group API call fails', async () => {
      mockClient.createGroup.mockRejectedValueOnce(new Error('Group API error'));
      const r1 = makeRect({ id: 'r1', groupIds: ['g1'] });
      const r2 = makeEllipse({ id: 'r2', groupIds: ['g1'] });
      const file = makeExcalidrawFile([r1, r2]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.groupsCreated).toBe(0);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Failed to create group')])
      );
    });

    it('groups are created after connectors (Phase 3)', async () => {
      const callOrder: string[] = [];
      mockClient.createConnector.mockImplementation(() => {
        callOrder.push('connector');
        return Promise.resolve({ id: `miro-conn-${idCounter++}`, type: 'connector' });
      });
      mockClient.createGroup.mockImplementation(() => {
        callOrder.push('group');
        return Promise.resolve({ id: `miro-group-${groupIdCounter++}`, type: 'group' });
      });

      const r1 = makeRect({ id: 'r1', groupIds: ['g1'] });
      const r2 = makeEllipse({ id: 'r2', groupIds: ['g1'] });
      const arrow = makeArrow({
        id: 'a1',
        startBinding: { elementId: 'r1', focus: 0, gap: 5 },
        endBinding: { elementId: 'r2', focus: 0, gap: 5 },
      });
      const file = makeExcalidrawFile([r1, r2, arrow]);
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      await converter.convert(filePath);

      expect(callOrder.indexOf('connector')).toBeLessThan(callOrder.indexOf('group'));
    });
  });

  describe('group preview', () => {
    it('includes groups in preview breakdown', () => {
      const r1 = makeRect({ id: 'r1', groupIds: ['g1'] });
      const r2 = makeEllipse({ id: 'r2', groupIds: ['g1'] });
      const file = makeExcalidrawFile([r1, r2]);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const preview = converter.preview(JSON.stringify(file));

      expect(preview.breakdown.groups).toBe(1);
      const groupEl = preview.elements.find((e) => e.type === 'group');
      expect(groupEl).toBeDefined();
      expect(groupEl!.status).toBe('will_create');
    });

    it('marks groups as will_skip when insufficient members', () => {
      const r1 = makeRect({ id: 'r1', groupIds: ['g1'] });
      const file = makeExcalidrawFile([r1]);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const preview = converter.preview(JSON.stringify(file));

      const groupEl = preview.elements.find((e) => e.type === 'group');
      expect(groupEl).toBeDefined();
      expect(groupEl!.status).toBe('will_skip');
    });
  });

  describe('full pipeline', () => {
    it('converts a complex drawing with all element types', async () => {
      const frame = makeFrame({ id: 'frame-1', name: 'Architecture' });
      const rect = makeRect({ id: 'r1', frameId: 'frame-1' });
      const ellipse = makeEllipse({ id: 'e1', frameId: 'frame-1' });
      const text = makeText({ id: 't1' });
      const boundText = makeText({ id: 'bt1', text: 'Label', containerId: 'r1' });
      const arrow = makeArrow({
        id: 'a1',
        startBinding: { elementId: 'r1', focus: 0, gap: 5 },
        endBinding: { elementId: 'e1', focus: 0, gap: 5 },
      });
      const img = makeImage({ id: 'img1', fileId: 'f1' });
      const fd = makeFreedraw({ id: 'fd1' });
      const files = makeFilesMap('f1');
      const file = makeExcalidrawFile(
        [frame, rect, ellipse, text, boundText, arrow, img, fd],
        files
      );
      const filePath = writeFixtureFile(file);

      const converter = new Converter({ miroToken: 'test', boardId: 'b' });
      const result = await converter.convert(filePath);

      expect(result.framesCreated).toBe(1);
      expect(result.itemsCreated).toBe(3);
      expect(result.imagesCreated).toBe(1);
      expect(result.freedrawConverted).toBe(1);
      expect(result.connectorsCreated).toBe(1);

      expect(mockClient.createFrame).toHaveBeenCalledTimes(1);
      expect(mockClient.createShape).toHaveBeenCalledTimes(2);
      expect(mockClient.createText).toHaveBeenCalledTimes(1);
      expect(mockClient.createImage).toHaveBeenCalledTimes(2);
      expect(mockClient.createConnector).toHaveBeenCalledTimes(1);
      expect(mockClient.updateItemParent).toHaveBeenCalledTimes(2);
    });
  });
});
