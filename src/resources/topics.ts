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

export interface CreateTopicParams {
  title: string;
  description: string;
  color: string;
  default_template_id?: string | null;
}

export interface PutTopicParams extends CreateTopicParams {
  version?: Version;
}

export interface DeleteTopicOptions {
  deleteEntries?: boolean;
}

export interface PutTopicResponse {
  topic: ApiTopic;
}

export interface GetTopicResponse {
  topic: ApiTopic;
}

export interface GetTopicsResponse {
  topics: ApiTopic[];
  next_page_token?: string;
}

export interface ApiTopic {
  id: string;
  diary_id: string;
  default_template_id?: string;

  created_at: string;
  updated_at: string;
  deleted_at?: string;
  version: number;

  // todo: to be declared
  encryption: any;
  encryption_keys: EncryptionKey[];
  details: any;
}

export interface Topic {
  id: string;
  diary_id: string;
  title: string;
  description: string;
  color: string;
  default_template_id?: string;
  created_at: Date;
  updated_at: Date;
  version: number;
}

export class TopicsAPI {
  constructor(
    private http: HttpClient,
    private credentials: Credentials,
    private keysAPI: KeysAPI
  ) {}

  async create(diaryId: string, params: CreateTopicParams): Promise<Topic> {
    return this.put(diaryId, crypto.randomUUID(), params);
  }

  async put(
    diaryId: string,
    topicId: string,
    params: PutTopicParams
  ): Promise<Topic> {
    const encryptionKey = await this.keysAPI.getActive(diaryId);
    const diaryKey = encryptionKey.value;

    const entityKey = generateSymmetricKey();

    const details = {
      title: params.title,
      description: params.description,
      color: params.color,
    };
    const detailsJson = new TextEncoder().encode(JSON.stringify(details));
    const { nonce: detailsNonce, ciphertext: encryptedDetails } =
      encryptWithSymmetricKey(detailsJson, entityKey);

    const { nonce: keyNonce, ciphertext: encryptedEntityKey } =
      encryptWithSymmetricKey(entityKey, diaryKey);

    const request = {
      version: params.version ?? NewVersion(),
      default_template_id: params.default_template_id,
      encryption: {
        diary_key_id: encryptionKey.id,
        encrypted_key_nonce: bytesToBase64(keyNonce),
        encrypted_key_data: bytesToBase64(encryptedEntityKey),
      },
      details: {
        nonce: bytesToBase64(detailsNonce),
        data: bytesToBase64(encryptedDetails),
      },
    };

    const requestJson = new TextEncoder().encode(JSON.stringify(request));
    const signature = signBytes(
      requestJson,
      this.credentials.signingPrivateKey
    );

    const response = await this.http.request<PutTopicResponse>(
      `/v1/diaries/${diaryId}/topics/${topicId}`,
      {
        method: "PUT",
        body: request,
        headers: { "X-Signature": bytesToBase64(signature) },
      }
    );

    return this.decryptTopic(response.topic, diaryKey);
  }

  async delete(
    diaryId: string,
    topicId: string,
    options?: DeleteTopicOptions
  ): Promise<void> {
    const deleteEntries = options?.deleteEntries ?? false;
    const query = deleteEntries ? "?delete_entries=true" : "";
    await this.http.request<void>(
      `/v1/diaries/${diaryId}/topics/${topicId}${query}`,
      {
        method: "DELETE",
      }
    );
  }

  async list(
    diaryId: string,
    nextPageToken?: string
  ): Promise<{ topics: Topic[]; next_page_token?: string }> {
    const encryptionKey = await this.keysAPI.getActive(diaryId);
    const diaryKey = encryptionKey.value;

    const query = nextPageToken ? `?next_page_token=${nextPageToken}` : "";
    const response = await this.http.request<GetTopicsResponse>(
      `/v1/diaries/${diaryId}/topics${query}`,
      { method: "GET" }
    );

    const topics: Topic[] = [];
    for (const apiTopic of response.topics) {
      const topic = this.decryptTopic(apiTopic, diaryKey);
      topics.push(topic);
    }

    return {
      topics,
      next_page_token: response.next_page_token,
    };
  }

  async get(diaryId: string, topicId: string): Promise<Topic> {
    const encryptionKey = await this.keysAPI.getActive(diaryId);
    const diaryKey = encryptionKey.value;

    const response = await this.http.request<GetTopicResponse>(
      `/v1/diaries/${diaryId}/topics/${topicId}`,
      { method: "GET" }
    );

    return this.decryptTopic(response.topic, diaryKey);
  }

  private decryptTopic(apiTopic: ApiTopic, diaryKey: Uint8Array): Topic {
    const entityKey = decryptWithSymmetricKey(
      base64ToBytes(apiTopic.encryption.encrypted_key_nonce),
      base64ToBytes(apiTopic.encryption.encrypted_key_data),
      diaryKey
    );

    const detailsBytes = decryptWithSymmetricKey(
      base64ToBytes(apiTopic.details.nonce),
      base64ToBytes(apiTopic.details.data),
      entityKey
    );

    const details = JSON.parse(new TextDecoder().decode(detailsBytes));

    return {
      id: apiTopic.id,
      diary_id: apiTopic.diary_id,
      title: details.title,
      description: details.description,
      color: details.color,
      default_template_id: apiTopic.default_template_id,
      created_at: new Date(apiTopic.created_at),
      updated_at: new Date(apiTopic.updated_at),
      version: apiTopic.version,
    };
  }
}
