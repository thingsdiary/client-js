import { Credentials } from "@/crypto/credentials";
import { HttpClient } from "@/http";
import { DiariesAPI } from "@/resources/diaries";
import { EntriesAPI } from "@/resources/entries";
import { KeysAPI } from "@/resources/keys";
import { TemplatesAPI } from "@/resources/templates";
import { TopicsAPI } from "@/resources/topics";

export interface ClientOptions {
  token: string;
  credentials: Credentials;
  baseUrl: string;
}

export class Client {
  private http: HttpClient;
  private credentials: Credentials;

  readonly keys: KeysAPI;
  readonly diaries: DiariesAPI;
  readonly entries: EntriesAPI;
  readonly topics: TopicsAPI;
  readonly templates: TemplatesAPI;

  constructor(options: ClientOptions) {
    this.http = new HttpClient(options.baseUrl, options.token);
    this.credentials = options.credentials;

    this.keys = new KeysAPI(this.http, this.credentials);
    this.diaries = new DiariesAPI(this.http, this.credentials, this.keys);
    this.entries = new EntriesAPI(this.http, this.credentials, this.keys);
    this.topics = new TopicsAPI(this.http, this.credentials, this.keys);
    this.templates = new TemplatesAPI(this.http, this.credentials, this.keys);
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
}

export function createClient(options: CreateClientOptions): Client {
  return new Client({
    baseUrl: options.baseUrl ?? "https://cloud.thingsdiary.com/api/v1",
    credentials: options.credentials,
    token: options.token,
  });
}
