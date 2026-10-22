import { Centrifuge } from "centrifuge/build/protobuf";

export interface MessageCodec<T> {
  encode(message: T): { finish(): Uint8Array };
  decode(data: Uint8Array): T;
}

export class RealtimeClient {
  private client?: Centrifuge;

  constructor(
    private readonly url: string,
    private readonly getToken: () => Promise<string>,
    private readonly websocket: any = globalThis.WebSocket,
  ) {}

  async connect(): Promise<void> {
    if (this.client) {
      await this.client.ready();
      return;
    }

    const client = new Centrifuge(this.url, {
      getToken: this.getToken,
      websocket: this.websocket,
    });
    this.client = client;
    client.connect();

    try {
      await client.ready();
    } catch (error) {
      client.disconnect();
      this.client = undefined;
      throw error;
    }
  }

  close(): void {
    this.client?.disconnect();
    this.client = undefined;
  }

  async rpc<Request, Response>(
    method: string,
    request: Request,
    requestCodec: MessageCodec<Request>,
    responseCodec?: MessageCodec<Response>,
  ): Promise<Response | undefined> {
    if (!this.client) throw new Error("realtime client is not connected");
    const result = await this.client.rpc(method, requestCodec.encode(request).finish());
    if (!responseCodec) return undefined;
    return responseCodec.decode(result.data as Uint8Array);
  }
}
