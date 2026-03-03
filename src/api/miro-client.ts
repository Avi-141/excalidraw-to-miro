import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData = require('form-data');
import {
  MiroCreateShapeRequest,
  MiroCreateTextRequest,
  MiroCreateStickyNoteRequest,
  MiroCreateConnectorRequest,
  MiroCreateFrameRequest,
  MiroCreateImageMetadata,
  MiroCreateGroupRequest,
  MiroUpdateItemRequest,
  MiroShapeItem,
  MiroTextItem,
  MiroStickyNoteItem,
  MiroConnectorItem,
  MiroImageItem,
  MiroFrameItem,
  MiroGroupItem,
} from '../types';

const MIRO_API_BASE = 'https://api.miro.com/v2';

export interface MiroClientOptions {
  token: string;
  verbose?: boolean;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  retryJitterMs?: number;
}

export class MiroClient {
  private client: AxiosInstance;
  private verbose: boolean;
  private maxRetries: number;
  private initialRetryDelayMs: number;
  private retryJitterMs: number;
  private readonly retryableStatuses = new Set([429, 500, 502, 503, 504]);

  constructor(options: MiroClientOptions) {
    this.verbose = options.verbose ?? false;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialRetryDelayMs = options.initialRetryDelayMs ?? 1000;
    this.retryJitterMs = options.retryJitterMs ?? 250;

    this.client = axios.create({
      baseURL: MIRO_API_BASE,
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
    });

  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[MiroClient] ${message}`);
    }
  }

  async getBoard(boardId: string): Promise<{ id: string; name: string }> {
    this.log(`Getting board info: ${boardId}`);
    const response = await this.requestWithRetry(() =>
      this.client.get(`/boards/${boardId}`)
    );
    return response.data;
  }

  async createShape(
    boardId: string,
    request: MiroCreateShapeRequest
  ): Promise<MiroShapeItem> {
    this.log(`Creating shape: ${request.data.shape}`);
    const response = await this.requestWithRetry(() =>
      this.client.post(`/boards/${boardId}/shapes`, request)
    );
    return response.data;
  }

  async createText(
    boardId: string,
    request: MiroCreateTextRequest
  ): Promise<MiroTextItem> {
    this.log(`Creating text: ${request.data.content.substring(0, 30)}...`);
    const response = await this.requestWithRetry(() =>
      this.client.post(`/boards/${boardId}/texts`, request)
    );
    return response.data;
  }

  async createStickyNote(
    boardId: string,
    request: MiroCreateStickyNoteRequest
  ): Promise<MiroStickyNoteItem> {
    this.log(
      `Creating sticky note: ${request.data.content.substring(0, 30)}...`
    );
    const response = await this.requestWithRetry(() =>
      this.client.post(`/boards/${boardId}/sticky_notes`, request)
    );
    return response.data;
  }

  async createConnector(
    boardId: string,
    request: MiroCreateConnectorRequest
  ): Promise<MiroConnectorItem> {
    this.log(`Creating connector`);
    const response = await this.requestWithRetry(() =>
      this.client.post(`/boards/${boardId}/connectors`, request)
    );
    return response.data;
  }

  async createImage(
    boardId: string,
    imageBuffer: Buffer,
    mimeType: string,
    metadata: MiroCreateImageMetadata
  ): Promise<MiroImageItem> {
    this.log(`Creating image: ${metadata.title ?? 'untitled'}`);

    const form = new FormData();
    form.append(
      'data',
      JSON.stringify({
        title: metadata.title,
        position: metadata.position,
        geometry: metadata.geometry,
        parent: metadata.parent,
      }),
      { contentType: 'application/json' }
    );

    const extension = mimeType.split('/')[1] || 'png';
    form.append('resource', imageBuffer, {
      filename: `image.${extension}`,
      contentType: mimeType,
    });

    const response = await this.requestWithRetry(() =>
      this.client.post(
        `/boards/${boardId}/images`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: this.client.defaults.headers.common['Authorization'] as string,
          },
        }
      )
    );
    return response.data;
  }

  async createFrame(
    boardId: string,
    request: MiroCreateFrameRequest
  ): Promise<MiroFrameItem> {
    this.log(`Creating frame: ${request.data.title ?? 'untitled'}`);
    const response = await this.requestWithRetry(() =>
      this.client.post(`/boards/${boardId}/frames`, request)
    );
    return response.data;
  }

  /**
   * Create a group of items on the board
   * @see https://developers.miro.com/reference/creategroup
   */
  async createGroup(
    boardId: string,
    request: MiroCreateGroupRequest
  ): Promise<MiroGroupItem> {
    this.log(`Creating group with ${request.data.items.length} items`);
    const response = await this.requestWithRetry(() =>
      this.client.post(`/boards/${boardId}/groups`, request)
    );
    return response.data;
  }

  async updateItemParent(
    boardId: string,
    itemId: string,
    request: MiroUpdateItemRequest
  ): Promise<void> {
    this.log(`Updating item ${itemId} parent`);
    await this.requestWithRetry(() =>
      this.client.patch(`/boards/${boardId}/items/${itemId}`, request)
    );
  }

  async updateShape(
    boardId: string,
    itemId: string,
    request: Partial<MiroCreateShapeRequest>
  ): Promise<MiroShapeItem> {
    this.log(`Updating shape: ${itemId}`);
    const response = await this.requestWithRetry(() =>
      this.client.patch(`/boards/${boardId}/shapes/${itemId}`, request)
    );
    return response.data;
  }

  async updateText(
    boardId: string,
    itemId: string,
    request: Partial<MiroCreateTextRequest>
  ): Promise<MiroTextItem> {
    this.log(`Updating text: ${itemId}`);
    const response = await this.requestWithRetry(() =>
      this.client.patch(`/boards/${boardId}/texts/${itemId}`, request)
    );
    return response.data;
  }

  async deleteItem(boardId: string, itemId: string): Promise<void> {
    this.log(`Deleting item: ${itemId}`);
    await this.requestWithRetry(() =>
      this.client.delete(`/boards/${boardId}/items/${itemId}`)
    );
  }

  async itemExists(boardId: string, itemId: string): Promise<boolean> {
    try {
      await this.requestWithRetry(() =>
        this.client.get(`/boards/${boardId}/items/${itemId}`)
      );
      return true;
    } catch {
      return false;
    }
  }

  async batchCreate<T>(
    items: Array<() => Promise<T>>,
    options: { delayMs?: number } = {}
  ): Promise<T[]> {
    const delayMs = options.delayMs ?? 100;
    const results: T[] = [];

    for (let i = 0; i < items.length; i++) {
      const result = await items[i]();
      results.push(result);

      if (i < items.length - 1 && delayMs > 0) {
        await this.delay(delayMs);
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRetryable(error: AxiosError): boolean {
    const status = error.response?.status;
    return status ? this.retryableStatuses.has(status) : false;
  }

  private parseRetryAfterMs(headerValue?: string): number | null {
    if (!headerValue) return null;
    const asSeconds = Number(headerValue);
    if (!Number.isNaN(asSeconds)) {
      return Math.max(0, asSeconds * 1000);
    }

    const retryDate = Date.parse(headerValue);
    if (Number.isNaN(retryDate)) return null;
    return Math.max(0, retryDate - Date.now());
  }

  private computeBackoffDelayMs(attempt: number): number {
    const base = this.initialRetryDelayMs * Math.pow(2, Math.max(0, attempt - 1));
    const jitter = Math.floor(Math.random() * this.retryJitterMs);
    return base + jitter;
  }

  private toErrorMessage(error: unknown): string {
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error.message : String(error);
    }

    const status = error.response?.status;
    const data = error.response?.data as Record<string, unknown> | undefined;
    const apiMessage = data?.message;
    const message = typeof apiMessage === 'string' ? apiMessage : error.message;

    if (status) {
      return `Miro API error (${status}): ${message}`;
    }

    return `Miro API error: ${message}`;
  }

  private async requestWithRetry<T>(requestFn: () => Promise<T>): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await requestFn();
      } catch (error) {
        if (!axios.isAxiosError(error)) {
          throw new Error(this.toErrorMessage(error));
        }

        attempt += 1;
        const shouldRetry = this.isRetryable(error) && attempt <= this.maxRetries;
        if (!shouldRetry) {
          throw new Error(this.toErrorMessage(error));
        }

        const retryAfterMs = this.parseRetryAfterMs(
          error.response?.headers?.['retry-after'] as string | undefined
        );
        const delayMs = retryAfterMs ?? this.computeBackoffDelayMs(attempt);
        const status = error.response?.status ?? 'unknown';
        this.log(`Retry ${attempt}/${this.maxRetries} after status ${status} in ${delayMs}ms`);
        await this.delay(delayMs);
      }
    }
  }
}
