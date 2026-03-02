import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData = require('form-data');
import {
  MiroCreateShapeRequest,
  MiroCreateTextRequest,
  MiroCreateStickyNoteRequest,
  MiroCreateConnectorRequest,
  MiroCreateFrameRequest,
  MiroCreateImageMetadata,
  MiroUpdateItemRequest,
  MiroShapeItem,
  MiroTextItem,
  MiroStickyNoteItem,
  MiroConnectorItem,
  MiroImageItem,
  MiroFrameItem,
} from '../types';

const MIRO_API_BASE = 'https://api.miro.com/v2';

export interface MiroClientOptions {
  token: string;
  verbose?: boolean;
}

export class MiroClient {
  private client: AxiosInstance;
  private verbose: boolean;

  constructor(options: MiroClientOptions) {
    this.verbose = options.verbose ?? false;

    this.client = axios.create({
      baseURL: MIRO_API_BASE,
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const data = error.response.data as Record<string, unknown>;
          const message = data?.message || error.message;
          throw new Error(
            `Miro API error (${error.response.status}): ${message}`
          );
        }
        throw error;
      }
    );
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[MiroClient] ${message}`);
    }
  }

  /**
   * Verify the token and get board info
   */
  async getBoard(boardId: string): Promise<{ id: string; name: string }> {
    this.log(`Getting board info: ${boardId}`);
    const response = await this.client.get(`/boards/${boardId}`);
    return response.data;
  }

  /**
   * Create a shape on the board
   */
  async createShape(
    boardId: string,
    request: MiroCreateShapeRequest
  ): Promise<MiroShapeItem> {
    this.log(`Creating shape: ${request.data.shape}`);
    const response = await this.client.post(
      `/boards/${boardId}/shapes`,
      request
    );
    return response.data;
  }

  /**
   * Create a text item on the board
   */
  async createText(
    boardId: string,
    request: MiroCreateTextRequest
  ): Promise<MiroTextItem> {
    this.log(`Creating text: ${request.data.content.substring(0, 30)}...`);
    const response = await this.client.post(
      `/boards/${boardId}/texts`,
      request
    );
    return response.data;
  }

  /**
   * Create a sticky note on the board
   */
  async createStickyNote(
    boardId: string,
    request: MiroCreateStickyNoteRequest
  ): Promise<MiroStickyNoteItem> {
    this.log(
      `Creating sticky note: ${request.data.content.substring(0, 30)}...`
    );
    const response = await this.client.post(
      `/boards/${boardId}/sticky_notes`,
      request
    );
    return response.data;
  }

  /**
   * Create a connector between items
   */
  async createConnector(
    boardId: string,
    request: MiroCreateConnectorRequest
  ): Promise<MiroConnectorItem> {
    this.log(`Creating connector`);
    const response = await this.client.post(
      `/boards/${boardId}/connectors`,
      request
    );
    return response.data;
  }

  /**
   * Create an image on the board via multipart/form-data upload
   */
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

    const response = await this.client.post(
      `/boards/${boardId}/images`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: this.client.defaults.headers.common['Authorization'] as string,
        },
      }
    );
    return response.data;
  }

  /**
   * Create a frame on the board
   */
  async createFrame(
    boardId: string,
    request: MiroCreateFrameRequest
  ): Promise<MiroFrameItem> {
    this.log(`Creating frame: ${request.data.title ?? 'untitled'}`);
    const response = await this.client.post(
      `/boards/${boardId}/frames`,
      request
    );
    return response.data;
  }

  /**
   * Update an item's parent (attach to a frame) or position
   */
  async updateItemParent(
    boardId: string,
    itemId: string,
    request: MiroUpdateItemRequest
  ): Promise<void> {
    this.log(`Updating item ${itemId} parent`);
    await this.client.patch(
      `/boards/${boardId}/items/${itemId}`,
      request
    );
  }

  /**
   * Batch create multiple items (respects rate limits)
   */
  async batchCreate<T>(
    items: Array<() => Promise<T>>,
    options: { delayMs?: number } = {}
  ): Promise<T[]> {
    const delayMs = options.delayMs ?? 100; // Default 100ms between requests
    const results: T[] = [];

    for (let i = 0; i < items.length; i++) {
      const result = await items[i]();
      results.push(result);

      // Add delay between requests to respect rate limits
      if (i < items.length - 1 && delayMs > 0) {
        await this.delay(delayMs);
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
