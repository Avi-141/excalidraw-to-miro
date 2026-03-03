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
  SkipCode,
  SKIP_REMEDIATION,
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

  private addSkipped(
    result: ConversionResult,
    id: string,
    type: string,
    code: SkipCode,
    reasonOverride?: string
  ): void {
    result.skippedElements.push({
      id,
      type,
      code,
      reason: reasonOverride ?? this.getSkipReason(code),
      remediation: SKIP_REMEDIATION[code],
    });
  }

  private getSkipReason(code: SkipCode): string {
    switch (code) {
      case 'CONNECTOR_SELF_REF':
        return 'Self-referencing connector';
      case 'CONNECTOR_NO_TARGET':
        return 'Connector endpoint did not resolve to a target shape';
      case 'CONNECTOR_INVALID':
        return 'Invalid connector configuration';
      case 'CONNECTOR_DISABLED':
        return 'Connector creation disabled';
      case 'IMAGE_NOT_FOUND':
        return 'Image file data not found in .excalidraw';
      case 'IMAGE_NOT_SAVED':
        return 'Image status is not "saved"';
      case 'IMAGE_TOO_LARGE':
        return 'Image exceeds 6 MB Miro upload limit';
      case 'IMAGE_NO_FILES':
        return 'No embedded files in .excalidraw file';
      case 'FREEDRAW_TOO_SHORT':
        return 'Freedraw has fewer than 2 points';
      case 'FREEDRAW_DISABLED':
        return 'Freedraw conversion disabled';
      case 'IMAGE_DISABLED':
        return 'Image conversion disabled';
      case 'FRAME_DISABLED':
        return 'Frame conversion disabled';
      case 'TYPE_UNSUPPORTED':
        return 'Element type not supported';
      case 'MAPPED_ITEM_MISSING_UPDATE':
        return 'Mapped Miro item no longer exists (update mode)';
      case 'MAPPING_MISSING_UPDATE':
        return 'No existing mapping (update mode)';
      default:
        return 'Element skipped';
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
          miroType: 'connector',
          code: 'CONNECTOR_DISABLED',
          reason: this.getSkipReason('CONNECTOR_DISABLED'),
          remediation: SKIP_REMEDIATION['CONNECTOR_DISABLED'],
        });
      } else if (isConvertibleArrow(el) || isConvertibleLine(el)) {
        const hasStart = el.startBinding?.elementId;
        const hasEnd = el.endBinding?.elementId;
        if (hasStart && hasEnd && hasStart === hasEnd) {
          previewElements.push({
            id: el.id, type: el.type, status: 'will_skip',
            miroType: 'connector',
            code: 'CONNECTOR_SELF_REF',
            reason: this.getSkipReason('CONNECTOR_SELF_REF'),
            remediation: SKIP_REMEDIATION['CONNECTOR_SELF_REF'],
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
          miroType: 'image',
          code: 'IMAGE_DISABLED',
          reason: this.getSkipReason('IMAGE_DISABLED'),
          remediation: SKIP_REMEDIATION['IMAGE_DISABLED'],
        });
      } else if (isConvertibleImage(el)) {
        const imgEl = el as ExcalidrawImage;
        const hasData = file.files && file.files[imgEl.fileId];
        if (!hasData) {
          previewElements.push({
            id: el.id, type: 'image', status: 'will_skip',
            miroType: 'image',
            code: 'IMAGE_NOT_FOUND',
            reason: this.getSkipReason('IMAGE_NOT_FOUND'),
            remediation: SKIP_REMEDIATION['IMAGE_NOT_FOUND'],
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
          miroType: 'image (SVG)',
          code: 'FREEDRAW_DISABLED',
          reason: this.getSkipReason('FREEDRAW_DISABLED'),
          remediation: SKIP_REMEDIATION['FREEDRAW_DISABLED'],
        });
      } else if (isConvertibleFreedraw(el)) {
        const fd = el as ExcalidrawFreedraw;
        if (fd.points.length < 2) {
          previewElements.push({
            id: el.id, type: 'freedraw', status: 'will_skip',
            miroType: 'image (SVG)',
            code: 'FREEDRAW_TOO_SHORT',
            reason: this.getSkipReason('FREEDRAW_TOO_SHORT'),
            remediation: SKIP_REMEDIATION['FREEDRAW_TOO_SHORT'],
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
          miroType: 'frame',
          code: 'FRAME_DISABLED',
          reason: this.getSkipReason('FRAME_DISABLED'),
          remediation: SKIP_REMEDIATION['FRAME_DISABLED'],
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
        miroType: 'unsupported',
        code: 'TYPE_UNSUPPORTED',
        reason: this.getSkipReason('TYPE_UNSUPPORTED'),
        remediation: SKIP_REMEDIATION['TYPE_UNSUPPORTED'],
      });
    }

    const excalidrawGroups = this.resolveExcalidrawGroups(elements);
    for (const [gid, members] of excalidrawGroups) {
      const resolvableCount = [...members].filter((eid) =>
        previewElements.some((pe) => pe.id === eid && pe.status !== 'will_skip')
      ).length;

      if (resolvableCount >= 2) {
        previewElements.push({
          id: gid, type: 'group', status: 'will_create',
          miroType: 'group',
          fidelityNote: `${resolvableCount} of ${members.size} member(s) will be grouped`,
        });
      } else {
        previewElements.push({
          id: gid, type: 'group', status: 'will_skip',
          miroType: 'group',
          reason: `Need at least 2 created items, only ${resolvableCount} available`,
        });
      }
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
        groups: excalidrawGroups.size,
      },
    };
  }

  async convertJson(fileJson: string): Promise<ConversionResult> {
    const file = parseExcalidrawJson(fileJson);

    const existingMappings = this.loadExistingMappings();

    const result: ConversionResult = {
      success: false,
      itemsCreated: 0,
      connectorsCreated: 0,
      framesCreated: 0,
      groupsCreated: 0,
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

      await this.createGroups(elements, result);

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
      groupsCreated: 0,
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

      await this.createGroups(elements, result);

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
            this.addSkipped(result, element.id, element.type, 'MAPPED_ITEM_MISSING_UPDATE');
            continue;
          }
        } else if (mode === 'update' && !existingMiroId) {
          this.addSkipped(result, element.id, element.type, 'MAPPING_MISSING_UPDATE');
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
            this.addSkipped(result, element.id, 'text', 'MAPPED_ITEM_MISSING_UPDATE');
            continue;
          }
        } else if (mode === 'update' && !existingMiroId) {
          this.addSkipped(result, element.id, 'text', 'MAPPING_MISSING_UPDATE');
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

  private shouldMergeText(_text: ExcalidrawText, shape: ExcalidrawElement): boolean {
    if (shape.width === 0 || shape.height === 0) return false;

    const aspectRatio = shape.width / shape.height;

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
        const code: SkipCode = !file.files
          ? 'IMAGE_NO_FILES'
          : !file.files[imgElement.fileId]
            ? 'IMAGE_NOT_FOUND'
            : imgElement.status !== 'saved'
              ? 'IMAGE_NOT_SAVED'
              : 'IMAGE_TOO_LARGE';
        const statusReason = imgElement.status !== 'saved'
          ? `Image status is "${imgElement.status}", not saved`
          : undefined;
        this.addSkipped(result, element.id, element.type, code, statusReason);
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
        this.addSkipped(result, element.id, element.type, 'FREEDRAW_TOO_SHORT');
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
        this.addSkipped(result, element.id, element.type, 'CONNECTOR_INVALID');
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
          const isSelfRef =
            element.type === 'arrow' &&
            Boolean(element.startBinding?.elementId) &&
            Boolean(element.endBinding?.elementId) &&
            element.startBinding?.elementId === element.endBinding?.elementId;
          this.addSkipped(
            result,
            element.id,
            element.type,
            isSelfRef ? 'CONNECTOR_SELF_REF' : 'CONNECTOR_NO_TARGET'
          );
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

  private resolveExcalidrawGroups(
    elements: ExcalidrawElement[]
  ): Map<string, Set<string>> {
    const groupMap = new Map<string, Set<string>>();

    for (const el of elements) {
      if (!el.groupIds || el.groupIds.length === 0) continue;

      for (const gid of el.groupIds) {
        let members = groupMap.get(gid);
        if (!members) {
          members = new Set<string>();
          groupMap.set(gid, members);
        }
        members.add(el.id);
      }
    }

    return groupMap;
  }

  /**
   * Phase 3: Create Miro groups from Excalidraw groupIds.
   * Processes innermost groups first (fewer members) so nested groups work.
   */
  private async createGroups(
    allElements: ExcalidrawElement[],
    result: ConversionResult
  ): Promise<void> {
    const excalidrawGroups = this.resolveExcalidrawGroups(allElements);

    if (excalidrawGroups.size === 0) return;

    this.log(`Found ${excalidrawGroups.size} Excalidraw group(s) to create`);

    const sortedGroupIds = [...excalidrawGroups.entries()]
      .sort((a, b) => a[1].size - b[1].size)
      .map(([gid]) => gid);

    for (const groupId of sortedGroupIds) {
      const memberExcalidrawIds = excalidrawGroups.get(groupId)!;

      const miroItemIds: string[] = [];
      const missingIds: string[] = [];

      for (const eid of memberExcalidrawIds) {
        const miroId = result.idMap[eid];
        if (miroId && miroId !== 'merged') {
          miroItemIds.push(miroId);
        } else {
          missingIds.push(eid);
        }
      }

      if (miroItemIds.length < 2) {
        this.log(
          `Skipping group ${groupId}: need at least 2 Miro items, got ${miroItemIds.length}` +
          (missingIds.length > 0 ? ` (${missingIds.length} member(s) not created)` : '')
        );
        continue;
      }

      try {
        const miroGroup = await this.client.createGroup(this.boardId, {
          data: { items: miroItemIds },
        });

        result.idMap[`group:${groupId}`] = miroGroup.id;
        result.groupsCreated++;

        this.log(
          `Created group (${groupId} -> ${miroGroup.id}) with ${miroItemIds.length} items`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to create group ${groupId}: ${message}`);
      }
    }
  }

  private handleSkippedElements(
    groups: ReturnType<typeof groupElementsByType>,
    result: ConversionResult
  ): void {
    if (!this.options.convertFreedraw || this.options.skipFreedraw) {
      for (const el of groups.freedraw) {
        if (!result.idMap[el.id]) {
          this.addSkipped(result, el.id, el.type, 'FREEDRAW_DISABLED');
        }
      }
    }

    if (!this.options.convertImages) {
      for (const el of groups.images) {
        this.addSkipped(result, el.id, el.type, 'IMAGE_DISABLED');
      }
    }

    if (!this.options.convertFrames) {
      for (const el of groups.frames) {
        this.addSkipped(result, el.id, el.type, 'FRAME_DISABLED');
      }
    }

    for (const el of groups.other) {
      this.addSkipped(result, el.id, el.type, 'TYPE_UNSUPPORTED');
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

    const excalidrawGrps = this.resolveExcalidrawGroups(allElements);
    for (const [groupId, members] of excalidrawGrps) {
      const miroGroupId = result.idMap[`group:${groupId}`];
      if (miroGroupId) continue;

      const createdCount = [...members].filter((eid) => {
        const mid = result.idMap[eid];
        return mid && mid !== 'merged';
      }).length;

      if (createdCount > 0 && createdCount < 2) {
        result.cleanupSuggestions.push({
          category: 'layout',
          severity: 'info',
          message: `Group ${groupId.slice(0, 8)}... could not be created: only ${createdCount} of ${members.size} member(s) were imported`,
          suggestion: 'Select the items on the Miro board and group them manually.',
        });
      }
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
