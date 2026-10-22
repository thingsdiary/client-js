import { Centrifuge } from "centrifuge/build/protobuf";

import { createEnvelope, signEnvelope } from "@/envelope";
import { SignedEnvelope } from "@/proto/envelope";

export interface MessageCodec<T> {
  encode(message: T): { finish(): Uint8Array };
  decode(data: Uint8Array): T;
}

export class RealtimeClient {
  private client?: Centrifuge;

  constructor(
    private readonly url: string,
    private readonly getToken: () => Promise<string>,
    private readonly signingPrivateKey: Uint8Array,
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

    const payload = requestCodec.encode(request).finish();
    const envelope = createEnvelope(method, payload);
    const data = SignedEnvelope.encode(signEnvelope(envelope, this.signingPrivateKey)).finish();

    const result = await this.client.rpc(method, data);

    if (!responseCodec) return undefined;

    return responseCodec.decode(result.data as Uint8Array);
  }
}
