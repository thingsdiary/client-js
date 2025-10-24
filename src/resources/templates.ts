import { Credentials } from "@/crypto/credentials";
import {
  generateSymmetricKey,
  encryptWithSymmetricKey,
  decryptWithSymmetricKey,
} from "@/crypto/encryption";
import { signBytes } from "@/crypto/signature";
import { HttpClient } from "@/http";
import { base64ToBytes, bytesToBase64 } from "@/utils/encoding";
import { KeysAPI, EncryptionKey } from "@/resources/keys";
import { NewVersion, Version } from "@/resources/version";

export interface CreateTemplateParams {
  content: string;
}

export interface PutTemplateParams extends CreateTemplateParams {
  version?: Version;
}

export interface PutTemplateResponse {
  template: ApiTemplate;
}

export interface GetTemplateResponse {
  template: ApiTemplate;
}

export interface GetTemplatesResponse {
  templates: ApiTemplate[];
  next_page_token?: string;
}

export interface ApiTemplate {
  id: string;
  diary_id: string;

  created_at: string;
  updated_at: string;
  deleted_at?: string;
  version: number;

  // todo: to be declared
  encryption: any;
  encryption_keys: EncryptionKey[];
  details: any;
}

export interface Template {
  id: string;
  diary_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  version: number;
}

export class TemplatesAPI {
  constructor(
    private http: HttpClient,
    private credentials: Credentials,
    private keysAPI: KeysAPI
  ) {}

  async create(
    diaryId: string,
    params: CreateTemplateParams
  ): Promise<Template> {
    return this.put(diaryId, crypto.randomUUID(), params);
  }

  async put(
    diaryId: string,
    templateId: string,
    params: PutTemplateParams
  ): Promise<Template> {
    const encryptionKey = await this.keysAPI.getActive(diaryId);
    const diaryKey = encryptionKey.value;

    const entityKey = generateSymmetricKey();

    const details = { content: params.content };
    const detailsJson = new TextEncoder().encode(JSON.stringify(details));
    const { nonce: detailsNonce, ciphertext: encryptedDetails } =
      encryptWithSymmetricKey(detailsJson, entityKey);

    const { nonce: keyNonce, ciphertext: encryptedEntityKey } =
      encryptWithSymmetricKey(entityKey, diaryKey);

    const request = {
      version: params.version ?? NewVersion(),
      encryption: {
        diary_key_id: encryptionKey.id,
        encrypted_key_nonce: Array.from(keyNonce),
        encrypted_key_data: Array.from(encryptedEntityKey),
      },
      details: {
        nonce: Array.from(detailsNonce),
        data: Array.from(encryptedDetails),
      },
    };

    const requestJson = new TextEncoder().encode(JSON.stringify(request));
    const signature = signBytes(
      requestJson,
      this.credentials.signingPrivateKey
    );

    const response = await this.http.request<PutTemplateResponse>(
      `/diaries/${diaryId}/templates/${templateId}`,
      {
        method: "PUT",
        body: request,
        headers: { "X-Signature": bytesToBase64(signature) },
      }
    );

    return this.decryptTemplate(response.template, diaryKey);
  }

  async delete(diaryId: string, templateId: string): Promise<void> {
    await this.http.request<void>(
      `/diaries/${diaryId}/templates/${templateId}`,
      {
        method: "DELETE",
      }
    );
  }

  async list(
    diaryId: string,
    nextPageToken?: string
  ): Promise<{ templates: Template[]; next_page_token?: string }> {
    const encryptionKey = await this.keysAPI.getActive(diaryId);
    const diaryKey = encryptionKey.value;

    const query = nextPageToken ? `?next_page_token=${nextPageToken}` : "";
    const response = await this.http.request<GetTemplatesResponse>(
      `/diaries/${diaryId}/templates${query}`,
      { method: "GET" }
    );

    const templates: Template[] = [];
    for (const apiTemplate of response.templates) {
      const template = this.decryptTemplate(apiTemplate, diaryKey);
      templates.push(template);
    }

    return {
      templates,
      next_page_token: response.next_page_token,
    };
  }

  async get(diaryId: string, templateId: string): Promise<Template> {
    const encryptionKey = await this.keysAPI.getActive(diaryId);
    const diaryKey = encryptionKey.value;

    const response = await this.http.request<GetTemplateResponse>(
      `/diaries/${diaryId}/templates/${templateId}`,
      { method: "GET" }
    );

    return this.decryptTemplate(response.template, diaryKey);
  }

  private decryptTemplate(
    apiTemplate: ApiTemplate,
    diaryKey: Uint8Array
  ): Template {
    const entityKey = decryptWithSymmetricKey(
      base64ToBytes(apiTemplate.encryption.encrypted_key_nonce),
      base64ToBytes(apiTemplate.encryption.encrypted_key_data),
      diaryKey
    );

    const detailsBytes = decryptWithSymmetricKey(
      base64ToBytes(apiTemplate.details.nonce),
      base64ToBytes(apiTemplate.details.data),
      entityKey
    );

    const details = JSON.parse(new TextDecoder().decode(detailsBytes));

    return {
      id: apiTemplate.id,
      diary_id: apiTemplate.diary_id,
      content: details.content,
      created_at: new Date(apiTemplate.created_at),
      updated_at: new Date(apiTemplate.updated_at),
      version: apiTemplate.version,
    };
  }
}
