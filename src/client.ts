import { Credentials } from "@/crypto/credentials";
import { HttpClient } from "@/http";
import { RealtimeClient } from "@/realtime";
import { DiariesAPI } from "@/resources/diaries";
import { EntriesAPI } from "@/resources/entries";
import { KeysAPI } from "@/resources/keys";
import { TemplatesAPI } from "@/resources/templates";
import { TopicsAPI } from "@/resources/topics";

export interface ClientOptions {
  token: string;
  credentials: Credentials;
  baseUrl: string;
  realtimeUrl?: string;
  websocket?: any;
}

export class Client {
  private http: HttpClient;
  private credentials: Credentials;
  private realtime: RealtimeClient;

  readonly keys: KeysAPI;
  readonly diaries: DiariesAPI;
  readonly entries: EntriesAPI;
  readonly topics: TopicsAPI;
  readonly templates: TemplatesAPI;

  constructor(options: ClientOptions) {
    this.http = new HttpClient(options.baseUrl, options.token);
    this.credentials = options.credentials;
    const realtimeUrl = options.realtimeUrl ?? realtimeUrlFromBaseUrl(options.baseUrl);
    this.realtime = new RealtimeClient(
      realtimeUrl,
      async () => {
        const response = await this.http.request<{ token: string }>("/v1/realtime/token", {
          method: "POST",
        });
        return response.token;
      },
      this.credentials.signingPrivateKey,
      options.websocket,
    );

    this.keys = new KeysAPI(this.realtime, this.credentials);
    this.diaries = new DiariesAPI(this.realtime, this.credentials, this.keys);
    this.entries = new EntriesAPI(this.realtime, this.keys);
    this.topics = new TopicsAPI(this.realtime, this.keys);
    this.templates = new TemplatesAPI(this.realtime, this.keys);
  }

  connect(): Promise<void> {
    return this.realtime.connect();
  }

  close(): void {
    this.realtime.close();
  }

  // todo: how to build client with credentials?
  //   static async create(seedPhrase: string, baseUrl?: string): Promise<Client> {
  //     const credentials = await Credentials.fromSeedPhrase(seedPhrase);
  //     return new Client({ baseUrl, credentials });
  //   }
}

export interface CreateClientOptions {
  token: string;
  credentials: Credentials;
  baseUrl?: string;
  realtimeUrl?: string;
  websocket?: any;
}

export function createClient(options: CreateClientOptions): Client {
  return new Client({
    baseUrl: options.baseUrl ?? "https://cloud.thingsdiary.com/api",
    credentials: options.credentials,
    token: options.token,
    realtimeUrl: options.realtimeUrl,
    websocket: options.websocket,
  });
}

function realtimeUrlFromBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/connection/websocket";
  url.search = "";
  return url.toString();
}
