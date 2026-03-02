import * as fs from 'fs';
import {
  ExcalidrawFile,
  ExcalidrawElement,
  ExcalidrawText,
  ExcalidrawImage,
  ExcalidrawFreedraw,
  ExcalidrawFrame,
  ConversionOptions,
  ConversionResult,
  CleanupSuggestion,
  PreviewElement,
  PreviewResult,
  IdMap,
  DEFAULT_OPTIONS,
} from '../types';
import {
  parseExcalidrawFile,
  parseExcalidrawJson,
  getActiveElements,
  getBoundingBox,
  groupElementsByType,
} from '../parser';
import { MiroClient } from '../api';
import {
  isConvertibleShape,
  mapShape,
  isConvertibleText,
  isContainerBoundText,
  mapText,
  getBoundTextContent,
  isConvertibleArrow,
  isConvertibleLine,
  mapConnector,
  canConvertToConnector,
  calculateCenteringOffset,
  isConvertibleImage,
  extractImageBuffer,
  mapImageMetadata,
  isConvertibleFreedraw,
  freedrawToSvg,
  mapFreedrawMetadata,
  isConvertibleFrame,
  mapFrame,
  computeFrameRelativePosition,
} from '../mappers';

export interface ConverterConfig {
  miroToken: string;
  boardId: string;
  options?: Partial<ConversionOptions>;
  verbose?: boolean;
}

export class Converter {
  private client: MiroClient;
  private boardId: string;
  private options: ConversionOptions;
  private verbose: boolean;

  constructor(config: ConverterConfig) {
    this.client = new MiroClient({
      token: config.miroToken,
      verbose: config.verbose,
    });
    this.boardId = config.boardId;
    this.options = { ...DEFAULT_OPTIONS, ...config.options };
    this.verbose = config.verbose ?? false;
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[Converter] ${message}`);
    }
  }

  private loadExistingMappings(): IdMap {
    if (!this.options.mappingFile) return {};
    try {
      if (fs.existsSync(this.options.mappingFile)) {
        const content = fs.readFileSync(this.options.mappingFile, 'utf-8');
        const data = JSON.parse(content);
        this.log(`Loaded ${Object.keys(data.idMap || {}).length} existing mappings from ${this.options.mappingFile}`);
        return data.idMap || {};
      }
    } catch (error) {
      this.log(`Could not load mapping file: ${error instanceof Error ? error.message : error}`);
    }
    return {};
  }

  private saveMappings(idMap: IdMap): void {
    if (!this.options.mappingFile) return;
    try {
      const data = {
        boardId: this.boardId,
        updatedAt: new Date().toISOString(),
        idMap,
      };
      fs.writeFileSync(this.options.mappingFile, JSON.stringify(data, null, 2), 'utf-8');
      this.log(`Saved ${Object.keys(idMap).length} mappings to ${this.options.mappingFile}`);
    } catch (error) {
      this.log(`Could not save mapping file: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Generate a preview of what would happen without calling the Miro API.
   */
  preview(fileJson: string): PreviewResult {
    const file = parseExcalidrawJson(fileJson);
    const elements = getActiveElements(file);
    const groups = groupElementsByType(elements);
    const previewElements: PreviewElement[] = [];

    for (const el of groups.shapes) {
      if (isConvertibleShape(el)) {
        const shapeType = el.type === 'ellipse' ? 'circle'
          : el.type === 'diamond' ? 'rhombus'
          : 'rectangle';
        previewElements.push({
          id: el.id, type: el.type, status: 'will_create',
          miroType: `shape (${shapeType})`,
        });
      }
    }

    const mergeableTextIds = this.computeMergeableTexts(groups.shapes, groups.text);

    for (const el of groups.text) {
      const t = el as ExcalidrawText;
      if (isContainerBoundText(t)) {
        previewElements.push({
          id: el.id, type: 'text', status: 'will_create',
          miroType: 'merged into parent shape',
          fidelityNote: 'Text will be embedded in parent shape content',
        });
      } else if (mergeableTextIds.has(el.id)) {
        previewElements.push({
          id: el.id, type: 'text', status: 'will_create',
          miroType: 'merged into shape',
          fidelityNote: 'Text center is inside a shape — will merge',
        });
      } else {
        previewElements.push({
          id: el.id, type: 'text', status: 'will_create',
          miroType: 'text',
        });
      }
    }

    for (const el of [...groups.arrows, ...groups.lines]) {
      if (!this.options.createConnectors) {
        previewElements.push({
          id: el.id, type: el.type, status: 'will_skip',
          miroType: 'connector', reason: 'Connector creation disabled',
        });
      } else if (isConvertibleArrow(el) || isConvertibleLine(el)) {
        const hasStart = el.startBinding?.elementId;
        const hasEnd = el.endBinding?.elementId;
        if (hasStart && hasEnd && hasStart === hasEnd) {
          previewElements.push({
            id: el.id, type: el.type, status: 'will_skip',
            miroType: 'connector', reason: 'Self-referencing arrow',
          });
        } else if (!hasStart || !hasEnd) {
          previewElements.push({
            id: el.id, type: el.type, status: 'degraded',
            miroType: 'connector',
            fidelityNote: 'Unbound endpoint — will attempt snap to nearest shape',
          });
        } else {
          previewElements.push({
            id: el.id, type: el.type, status: 'will_create',
            miroType: 'connector',
          });
        }
      }
    }

    for (const el of groups.images) {
      if (!this.options.convertImages) {
        previewElements.push({
          id: el.id, type: 'image', status: 'will_skip',
          miroType: 'image', reason: 'Image conversion disabled',
        });
      } else if (isConvertibleImage(el)) {
        const imgEl = el as ExcalidrawImage;
        const hasData = file.files && file.files[imgEl.fileId];
        if (!hasData) {
          previewElements.push({
            id: el.id, type: 'image', status: 'will_skip',
            miroType: 'image', reason: 'Image data not found in file',
          });
        } else {
          previewElements.push({
            id: el.id, type: 'image', status: 'will_create',
            miroType: 'image',
          });
        }
      }
    }

    for (const el of groups.freedraw) {
      if (!this.options.convertFreedraw || this.options.skipFreedraw) {
        previewElements.push({
          id: el.id, type: 'freedraw', status: 'will_skip',
          miroType: 'image (SVG)', reason: 'Freedraw conversion disabled',
        });
      } else if (isConvertibleFreedraw(el)) {
        const fd = el as ExcalidrawFreedraw;
        if (fd.points.length < 2) {
          previewElements.push({
            id: el.id, type: 'freedraw', status: 'will_skip',
            miroType: 'image (SVG)', reason: 'Fewer than 2 points',
          });
        } else {
          previewElements.push({
            id: el.id, type: 'freedraw', status: 'degraded',
            miroType: 'image (SVG)',
            fidelityNote: 'Converted to static SVG image, not editable strokes',
          });
        }
      }
    }

    for (const el of groups.frames) {
      if (!this.options.convertFrames) {
        previewElements.push({
          id: el.id, type: 'frame', status: 'will_skip',
          miroType: 'frame', reason: 'Frame conversion disabled',
        });
      } else if (isConvertibleFrame(el)) {
        const degraded = el.angle !== 0;
        previewElements.push({
          id: el.id, type: 'frame',
          status: degraded ? 'degraded' : 'will_create',
          miroType: 'frame',
          fidelityNote: degraded ? 'Rotation will be lost — Miro frames do not support rotation' : undefined,
        });
      }
    }

    for (const el of groups.other) {
      previewElements.push({
        id: el.id, type: el.type, status: 'will_skip',
        miroType: 'unsupported', reason: 'Element type not supported',
      });
    }

    const willCreate = previewElements.filter((e) => e.status === 'will_create').length;
    const willSkip = previewElements.filter((e) => e.status === 'will_skip').length;
    const degraded = previewElements.filter((e) => e.status === 'degraded').length;

    return {
      totalElements: elements.length,
      willCreate,
      willSkip,
      degraded,
      elements: previewElements,
      breakdown: {
        shapes: groups.shapes.length,
        text: groups.text.length,
        connectors: groups.arrows.length + groups.lines.length,
        images: groups.images.length,
        freedraw: groups.freedraw.length,
        frames: groups.frames.length,
      },
    };
  }

  /**
   * Convert from a JSON string instead of a file path.
   */
  async convertJson(fileJson: string): Promise<ConversionResult> {
    const file = parseExcalidrawJson(fileJson);

    const existingMappings = this.loadExistingMappings();

    const result: ConversionResult = {
      success: false,
      itemsCreated: 0,
      connectorsCreated: 0,
      framesCreated: 0,
      imagesCreated: 0,
      freedrawConverted: 0,
      skippedElements: [],
      idMap: { ...existingMappings },
      errors: [],
      cleanupSuggestions: [],
    };

    try {
      const elements = getActiveElements(file);
      this.log(`Found ${elements.length} active elements (mode: ${this.options.importMode})`);

      if (elements.length === 0) {
        result.success = true;
        return result;
      }

      this.log(`Verifying access to board: ${this.boardId}`);
      const board = await this.client.getBoard(this.boardId);
      this.log(`Board found: ${board.name}`);

      if (this.options.offsetX === 0 && this.options.offsetY === 0) {
        const boundingBox = getBoundingBox(elements);
        const centering = calculateCenteringOffset(boundingBox, this.options.scale);
        this.options.offsetX = centering.offsetX;
        this.options.offsetY = centering.offsetY;
      }

      const groups = groupElementsByType(elements);

      if (this.options.convertFrames && groups.frames.length > 0) {
        await this.createFrames(groups.frames, result);
      }

      await this.createShapesAndText(groups.shapes, groups.text, elements, result);

      if (this.options.convertImages && groups.images.length > 0) {
        await this.createImages(groups.images, file, result);
      }

      if (this.options.convertFreedraw && !this.options.skipFreedraw && groups.freedraw.length > 0) {
        await this.createFreedrawImages(groups.freedraw, result);
      }

      if (this.options.convertFrames && groups.frames.length > 0) {
        await this.attachChildrenToFrames(elements, result);
      }

      const allArrowsAndLines = [...groups.arrows, ...groups.lines];
      if (this.options.createConnectors && allArrowsAndLines.length > 0) {
        await this.createConnectors(allArrowsAndLines, elements, result);
      }

      this.handleSkippedElements(groups, result);
      this.generateCleanupSuggestions(groups, elements, result);
      result.success = result.errors.length === 0;

      this.saveMappings(result.idMap);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(message);
    }

    return result;
  }

  async convert(inputPath: string): Promise<ConversionResult> {
    const existingMappings = this.loadExistingMappings();

    const result: ConversionResult = {
      success: false,
      itemsCreated: 0,
      connectorsCreated: 0,
      framesCreated: 0,
      imagesCreated: 0,
      freedrawConverted: 0,
      skippedElements: [],
      idMap: { ...existingMappings },
      errors: [],
      cleanupSuggestions: [],
    };

    try {
      this.log(`Parsing file: ${inputPath}`);
      const file = parseExcalidrawFile(inputPath);
      const elements = getActiveElements(file);

      this.log(`Found ${elements.length} active elements`);

      if (elements.length === 0) {
        result.success = true;
        return result;
      }

      this.log(`Verifying access to board: ${this.boardId}`);
      const board = await this.client.getBoard(this.boardId);
      this.log(`Board found: ${board.name}`);

      if (this.options.offsetX === 0 && this.options.offsetY === 0) {
        const boundingBox = getBoundingBox(elements);
        const centering = calculateCenteringOffset(
          boundingBox,
          this.options.scale
        );
        this.options.offsetX = centering.offsetX;
        this.options.offsetY = centering.offsetY;
        this.log(
          `Auto-centering: offset (${this.options.offsetX}, ${this.options.offsetY})`
        );
      }

      const groups = groupElementsByType(elements);

      if (this.options.convertFrames && groups.frames.length > 0) {
        this.log(`Creating ${groups.frames.length} frames...`);
        await this.createFrames(groups.frames, result);
      }

      this.log(
        `Creating ${groups.shapes.length} shapes + ${groups.text.length} text elements...`
      );
      await this.createShapesAndText(
        groups.shapes,
        groups.text,
        elements,
        result
      );

      if (this.options.convertImages && groups.images.length > 0) {
        this.log(`Creating ${groups.images.length} images...`);
        await this.createImages(groups.images, file, result);
      }

      if (this.options.convertFreedraw && !this.options.skipFreedraw && groups.freedraw.length > 0) {
        this.log(`Converting ${groups.freedraw.length} freedraw elements to SVG...`);
        await this.createFreedrawImages(groups.freedraw, result);
      }

      if (this.options.convertFrames && groups.frames.length > 0) {
        await this.attachChildrenToFrames(elements, result);
      }

      const allArrowsAndLines = [...groups.arrows, ...groups.lines];
      if (this.options.createConnectors && allArrowsAndLines.length > 0) {
        this.log(`Creating ${allArrowsAndLines.length} connectors...`);
        await this.createConnectors(allArrowsAndLines, elements, result);
      }

      this.handleSkippedElements(groups, result);
      this.generateCleanupSuggestions(groups, elements, result);

      result.success = result.errors.length === 0;

      this.saveMappings(result.idMap);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(message);
      console.error(`Conversion error: ${message}`);
    }

    return result;
  }

  private async createFrames(
    frames: ExcalidrawElement[],
    result: ConversionResult
  ): Promise<void> {
    for (const element of frames) {
      if (!isConvertibleFrame(element)) continue;

      try {
        if (element.angle !== 0) {
          this.log(`Warning: Frame "${(element as ExcalidrawFrame).name}" has rotation which Miro frames don't support; rotation will be ignored`);
        }

        const request = mapFrame(element as ExcalidrawFrame, this.options);
        const miroItem = await this.client.createFrame(this.boardId, request);
        result.idMap[element.id] = miroItem.id;
        result.framesCreated++;

        this.log(
          `Created frame "${(element as ExcalidrawFrame).name}" (${element.id} -> ${miroItem.id})`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to create frame ${element.id}: ${message}`);
      }
    }
  }

  private async createShapesAndText(
    shapes: ExcalidrawElement[],
    textElements: ExcalidrawElement[],
    allElements: ExcalidrawElement[],
    result: ConversionResult
  ): Promise<void> {
    const mergedTextIds = new Set<string>();

    for (const element of shapes) {
      if (!isConvertibleShape(element)) continue;

      try {
        let content: string | undefined;

        if (element.boundElements) {
          const boundText = element.boundElements.find(
            (be) => be.type === 'text'
          );
          if (boundText) {
            content =
              getBoundTextContent(boundText.id, allElements) ?? undefined;
          }
        }

        if (!content) {
          const overlapping = this.findOverlappingTexts(element, textElements);
          const mergeable = overlapping.filter((t) => this.shouldMergeText(t, element));
          if (mergeable.length > 0) {
            content = mergeable
              .map((t) => this.escapeText(t.text))
              .join('<br>');
            mergeable.forEach((t) => mergedTextIds.add(t.id));
            this.log(
              `Merged ${mergeable.length} text(s) into shape ${element.id}`
            );
          }
        }

        const request = mapShape(element, this.options);

        if (content) {
          request.data.content = content;
        }

        this.appendMetadataToContent(element, request.data);

        const existingMiroId = result.idMap[element.id];
        const mode = this.options.importMode;

        if (existingMiroId && existingMiroId !== 'merged' && (mode === 'update' || mode === 'upsert')) {
          const exists = await this.client.itemExists(this.boardId, existingMiroId);
          if (exists) {
            await this.client.updateShape(this.boardId, existingMiroId, request);
            this.log(`Updated shape ${element.type} (${element.id} -> ${existingMiroId})`);
            result.itemsCreated++;
            continue;
          } else if (mode === 'update') {
            result.skippedElements.push({ id: element.id, type: element.type, reason: 'Mapped Miro item no longer exists (update mode)' });
            continue;
          }
        } else if (mode === 'update' && !existingMiroId) {
          result.skippedElements.push({ id: element.id, type: element.type, reason: 'No existing mapping (update mode)' });
          continue;
        }

        const miroItem = await this.client.createShape(this.boardId, request);
        result.idMap[element.id] = miroItem.id;
        result.itemsCreated++;

        this.log(
          `Created shape ${element.type} (${element.id} -> ${miroItem.id})`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to create shape ${element.id}: ${message}`);
      }
    }

    for (const element of textElements) {
      if (!isConvertibleText(element)) continue;

      const textEl = element as ExcalidrawText;

      if (isContainerBoundText(textEl)) {
        this.log(`Skipping bound text: ${element.id}`);
        continue;
      }

      if (mergedTextIds.has(element.id)) {
        this.log(`Skipping text merged into shape: ${element.id}`);
        result.idMap[element.id] = 'merged';
        continue;
      }

      try {
        const request = mapText(textEl, this.options);
        this.appendMetadataToContent(element, request.data);

        const existingMiroId = result.idMap[element.id];
        const mode = this.options.importMode;

        if (existingMiroId && existingMiroId !== 'merged' && (mode === 'update' || mode === 'upsert')) {
          const exists = await this.client.itemExists(this.boardId, existingMiroId);
          if (exists) {
            await this.client.updateText(this.boardId, existingMiroId, request);
            this.log(`Updated text (${element.id} -> ${existingMiroId})`);
            result.itemsCreated++;
            continue;
          } else if (mode === 'update') {
            result.skippedElements.push({ id: element.id, type: 'text', reason: 'Mapped Miro item no longer exists (update mode)' });
            continue;
          }
        } else if (mode === 'update' && !existingMiroId) {
          result.skippedElements.push({ id: element.id, type: 'text', reason: 'No existing mapping (update mode)' });
          continue;
        }

        const miroItem = await this.client.createText(this.boardId, request);
        result.idMap[element.id] = miroItem.id;
        result.itemsCreated++;

        this.log(`Created text (${element.id} -> ${miroItem.id})`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to create text ${element.id}: ${message}`);
      }
    }
  }

  private appendMetadataToContent(
    element: ExcalidrawElement,
    data: { content?: string }
  ): void {
    const parts: string[] = [];

    if (element.link) {
      parts.push(`<a href="${this.escapeText(element.link)}">${this.escapeText(element.link)}</a>`);
    }

    if (element.customData) {
      const entries = Object.entries(element.customData);
      if (entries.length > 0) {
        const notes = entries
          .map(([key, value]) => `${this.escapeText(key)}: ${this.escapeText(String(value))}`)
          .join('<br>');
        parts.push(notes);
      }
    }

    if (parts.length > 0) {
      const metadata = parts.join('<br>');
      data.content = data.content
        ? `${data.content}<br><br>${metadata}`
        : metadata;
    }
  }

  /**
   * Pre-compute which texts would be merged, using the same heuristics
   * as the actual conversion. Returns a set of text element IDs that will merge.
   */
  private computeMergeableTexts(
    shapes: ExcalidrawElement[],
    textElements: ExcalidrawElement[]
  ): Set<string> {
    const mergeable = new Set<string>();

    for (const shape of shapes) {
      if (!isConvertibleShape(shape)) continue;
      if (shape.boundElements?.some((be) => be.type === 'text')) continue;

      const overlapping = this.findOverlappingTexts(shape, textElements);
      for (const t of overlapping) {
        if (this.shouldMergeText(t, shape)) {
          mergeable.add(t.id);
        }
      }
    }

    return mergeable;
  }

  private findOverlappingTexts(
    shape: ExcalidrawElement,
    textElements: ExcalidrawElement[]
  ): ExcalidrawText[] {
    const result: ExcalidrawText[] = [];

    for (const el of textElements) {
      if (el.type !== 'text') continue;
      const t = el as ExcalidrawText;

      if (isContainerBoundText(t)) continue;

      const tcx = t.x + t.width / 2;
      const tcy = t.y + t.height / 2;

      if (
        tcx >= shape.x &&
        tcx <= shape.x + shape.width &&
        tcy >= shape.y &&
        tcy <= shape.y + shape.height
      ) {
        result.push(t);
      }
    }

    result.sort((a, b) => a.y - b.y);
    return result;
  }

  /**
   * Determine whether an overlapping text should be merged into a shape.
   * Rejects merging when the shape is a table-row background or banner:
   * these are very wide, low-height rectangles with multiple small texts
   * positioned across columns. Labeled shapes (boxes with titles inside)
   * have moderate aspect ratios and text that fills a meaningful fraction.
   */
  private shouldMergeText(_text: ExcalidrawText, shape: ExcalidrawElement): boolean {
    if (shape.width === 0 || shape.height === 0) return false;

    const aspectRatio = shape.width / shape.height;

    // Shapes with aspect ratio > 6:1 are table rows / banners —
    // texts on them are column values, not labels for the shape.
    if (aspectRatio > 6) return false;

    return true;
  }

  private escapeText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  private async createImages(
    images: ExcalidrawElement[],
    file: ExcalidrawFile,
    result: ConversionResult
  ): Promise<void> {
    for (const element of images) {
      if (!isConvertibleImage(element)) continue;

      const imgElement = element as ExcalidrawImage;
      const extracted = extractImageBuffer(imgElement, file.files);

      if (!extracted) {
        const reason = !file.files
          ? 'No embedded files in .excalidraw file'
          : !file.files[imgElement.fileId]
            ? 'Image file data not found in .excalidraw'
            : imgElement.status !== 'saved'
              ? `Image status is "${imgElement.status}", not saved`
              : 'Image exceeds 6 MB Miro upload limit';

        result.skippedElements.push({
          id: element.id,
          type: element.type,
          reason,
        });
        continue;
      }

      try {
        const metadata = mapImageMetadata(imgElement, this.options);
        const miroItem = await this.client.createImage(
          this.boardId,
          extracted.buffer,
          extracted.mimeType,
          metadata
        );
        result.idMap[element.id] = miroItem.id;
        result.imagesCreated++;

        this.log(`Created image (${element.id} -> ${miroItem.id})`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to create image ${element.id}: ${message}`);
      }
    }
  }

  private async createFreedrawImages(
    freedrawElements: ExcalidrawElement[],
    result: ConversionResult
  ): Promise<void> {
    for (const element of freedrawElements) {
      if (!isConvertibleFreedraw(element)) continue;

      const fdElement = element as ExcalidrawFreedraw;

      if (fdElement.points.length < 2) {
        result.skippedElements.push({
          id: element.id,
          type: element.type,
          reason: 'Freedraw has fewer than 2 points',
        });
        continue;
      }

      try {
        const svgResult = freedrawToSvg(fdElement);
        const metadata = mapFreedrawMetadata(fdElement, svgResult, this.options);
        const miroItem = await this.client.createImage(
          this.boardId,
          svgResult.buffer,
          svgResult.mimeType,
          metadata
        );
        result.idMap[element.id] = miroItem.id;
        result.freedrawConverted++;

        this.log(`Created freedraw SVG (${element.id} -> ${miroItem.id})`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(
          `Failed to convert freedraw ${element.id}: ${message}`
        );
      }
    }
  }

  /**
   * After all items are created, attach items that belong to frames
   * using the Excalidraw frameId -> Miro frame ID mapping.
   */
  private async attachChildrenToFrames(
    allElements: ExcalidrawElement[],
    result: ConversionResult
  ): Promise<void> {
    for (const element of allElements) {
      if (element.type === 'frame') continue;
      if (!element.frameId) continue;

      const miroFrameId = result.idMap[element.frameId];
      const miroItemId = result.idMap[element.id];

      if (!miroFrameId || !miroItemId) continue;

      try {
        await this.client.updateItemParent(this.boardId, miroItemId, {
          parent: { id: miroFrameId },
        });
        this.log(`Attached ${element.id} to frame ${element.frameId}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(
          `Failed to attach ${element.id} to frame: ${message}`
        );
      }
    }
  }

  private async createConnectors(
    arrowsAndLines: ExcalidrawElement[],
    allElements: ExcalidrawElement[],
    result: ConversionResult
  ): Promise<void> {
    for (const element of arrowsAndLines) {
      if (!isConvertibleArrow(element) && !isConvertibleLine(element)) continue;

      if (!canConvertToConnector(element, result.idMap)) {
        result.skippedElements.push({
          id: element.id,
          type: element.type,
          reason: 'Cannot convert to connector',
        });
        continue;
      }

      try {
        const request = mapConnector(
          element,
          result.idMap,
          allElements,
          this.options
        );

        if (!request) {
          result.skippedElements.push({
            id: element.id,
            type: element.type,
            reason: 'Invalid connector configuration',
          });
          continue;
        }

        const miroItem = await this.client.createConnector(
          this.boardId,
          request
        );
        result.idMap[element.id] = miroItem.id;
        result.connectorsCreated++;

        this.log(`Created connector (${element.id} -> ${miroItem.id})`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(
          `Failed to create connector ${element.id}: ${message}`
        );
      }
    }
  }

  private handleSkippedElements(
    groups: ReturnType<typeof groupElementsByType>,
    result: ConversionResult
  ): void {
    // Freedraw: only skip if not converted
    if (!this.options.convertFreedraw || this.options.skipFreedraw) {
      for (const el of groups.freedraw) {
        if (!result.idMap[el.id]) {
          result.skippedElements.push({
            id: el.id,
            type: el.type,
            reason: 'Freedraw conversion disabled',
          });
        }
      }
    }

    // Images: only skip those that weren't converted
    if (!this.options.convertImages) {
      for (const el of groups.images) {
        result.skippedElements.push({
          id: el.id,
          type: el.type,
          reason: 'Image conversion disabled',
        });
      }
    }

    // Frames: only skip if not converted
    if (!this.options.convertFrames) {
      for (const el of groups.frames) {
        result.skippedElements.push({
          id: el.id,
          type: el.type,
          reason: 'Frame conversion disabled',
        });
      }
    }

    for (const el of groups.other) {
      result.skippedElements.push({
        id: el.id,
        type: el.type,
        reason: 'Element type not supported',
      });
    }

    if (result.skippedElements.length > 0 && this.verbose) {
      console.log(`\nSkipped ${result.skippedElements.length} elements:`);
      for (const skipped of result.skippedElements) {
        console.log(`  - ${skipped.type} (${skipped.id}): ${skipped.reason}`);
      }
    }
  }

  private generateCleanupSuggestions(
    groups: ReturnType<typeof groupElementsByType>,
    allElements: ExcalidrawElement[],
    result: ConversionResult
  ): void {
    const skippedConnectors = result.skippedElements.filter(
      (s) => s.type === 'arrow' || s.type === 'line'
    );
    if (skippedConnectors.length > 0) {
      for (const sc of skippedConnectors) {
        const original = allElements.find((el) => el.id === sc.id);
        if (!original) continue;

        const nearbyShapes: string[] = [];
        for (const shape of groups.shapes) {
          const dx = Math.abs((shape.x + shape.width / 2) - (original.x + original.width / 2));
          const dy = Math.abs((shape.y + shape.height / 2) - (original.y + original.height / 2));
          if (dx < 300 && dy < 300) {
            nearbyShapes.push(`${shape.type} (${shape.id.slice(0, 8)}...)`);
          }
        }

        result.cleanupSuggestions.push({
          category: 'connector',
          severity: 'action',
          message: `Connector ${sc.id.slice(0, 8)}... was skipped: ${sc.reason}`,
          elementId: sc.id,
          elementType: sc.type,
          suggestion: nearbyShapes.length > 0
            ? `Nearby shapes: ${nearbyShapes.slice(0, 3).join(', ')}. Manually connect them in Miro.`
            : 'No nearby shapes found. This connector may have been orphaned in the source.',
        });
      }
    }

    const orphanTexts = result.skippedElements.filter(
      (s) => s.type === 'text' && s.reason.includes('merge')
    );
    const allTexts = groups.text;
    for (const t of allTexts) {
      const textEl = t as ExcalidrawText;
      if (isContainerBoundText(textEl)) continue;

      const miroId = result.idMap[t.id];
      if (miroId && miroId !== 'merged') {
        const isNearShape = groups.shapes.some((s) => {
          const dx = Math.abs((s.x + s.width / 2) - (t.x + t.width / 2));
          const dy = Math.abs((s.y + s.height / 2) - (t.y + t.height / 2));
          return dx < 200 && dy < 200;
        });

        if (!isNearShape) {
          result.cleanupSuggestions.push({
            category: 'text',
            severity: 'info',
            message: `Standalone text "${textEl.text.slice(0, 30)}${textEl.text.length > 30 ? '...' : ''}" was not merged into any shape`,
            elementId: t.id,
            elementType: 'text',
            suggestion: 'Review this text on the Miro board — it may need to be manually grouped with nearby elements.',
          });
        }
      }
    }

    const degradedFrames = groups.frames.filter((f) => f.angle !== 0);
    for (const frame of degradedFrames) {
      result.cleanupSuggestions.push({
        category: 'fidelity',
        severity: 'warning',
        message: `Frame "${(frame as ExcalidrawFrame).name || frame.id.slice(0, 8)}" had rotation (${Math.round((frame.angle * 180) / Math.PI)}°) that was dropped`,
        elementId: frame.id,
        elementType: 'frame',
        suggestion: 'Miro frames do not support rotation. Review child element positions on the board.',
      });
    }

    const freedrawCount = groups.freedraw.filter((fd) => result.idMap[fd.id]).length;
    if (freedrawCount > 0) {
      result.cleanupSuggestions.push({
        category: 'fidelity',
        severity: 'info',
        message: `${freedrawCount} freedraw element(s) were converted to static SVG images`,
        suggestion: 'These are not editable as strokes in Miro. Use "Ungroup" in Miro if you need to modify them.',
      });
    }

    if (orphanTexts.length > 0) {
      result.cleanupSuggestions.push({
        category: 'text',
        severity: 'info',
        message: `${orphanTexts.length} text element(s) were skipped during merge`,
        suggestion: 'Check the board for text that may be positioned incorrectly.',
      });
    }

    const totalIssues = result.cleanupSuggestions.filter((s) => s.severity !== 'info').length;
    if (totalIssues > 0) {
      result.cleanupSuggestions.push({
        category: 'layout',
        severity: 'info',
        message: `${totalIssues} item(s) may need attention on the board`,
        suggestion: 'Open the Miro board to review flagged elements and make manual adjustments.',
      });
    }
  }
}
