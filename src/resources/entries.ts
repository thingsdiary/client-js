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

export interface CreateEntryParams {
  content: string;
  topic_id?: string | null;
  archived?: boolean;
  bookmarked?: boolean;
  preview_hidden?: boolean;
}

export interface PutEntryParams extends CreateEntryParams {
  version?: Version;
}

export interface PutEntryResponse {
  entry: ApiEntry;
}

export interface GetEntryResponse {
  entry: ApiEntry;
}

export interface GetEntriesResponse {
  entries: ApiEntry[];
  next_page_token?: string;
}

export interface ApiEntry {
  id: string;
  diary_id: string;
  topic_id?: string;

  created_at: string;
  updated_at: string;
  deleted_at?: string;
  version: number;

  // todo: to be declared
  encryption: any;
  encryption_keys: EncryptionKey[];
  preview: any;
  details: any;
}

export interface Entry {
  id: string;
  diary_id: string;
  content: string;
  topic_id?: string;
  archived: boolean;
  bookmarked: boolean;
  preview_hidden: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  version: number;
}

export class EntriesAPI {
  constructor(
    private http: HttpClient,
    private credentials: Credentials,
    private keysAPI: KeysAPI
  ) {}

  async create(diaryId: string, params: CreateEntryParams): Promise<Entry> {
    return this.put(diaryId, crypto.randomUUID(), params);
  }

  async put(
    diaryId: string,
    entryId: string,
    params: PutEntryParams
  ): Promise<Entry> {
    const encryptionKey = await this.keysAPI.getActive(diaryId);
    const diaryKey = encryptionKey.value;

    const entityKey = generateSymmetricKey();

    const details = {
      content: params.content,
      archived: params.archived ?? false,
      bookmarked: params.bookmarked ?? false,
      preview_hidden: params.preview_hidden ?? false,
    };
    const detailsJson = new TextEncoder().encode(JSON.stringify(details));
    const { nonce: detailsNonce, ciphertext: encryptedDetails } =
      encryptWithSymmetricKey(detailsJson, entityKey);

    // Encrypt preview (same as details in this implementation)
    const { nonce: previewNonce, ciphertext: encryptedPreview } =
      encryptWithSymmetricKey(detailsJson, entityKey);

    const { nonce: keyNonce, ciphertext: encryptedEntityKey } =
      encryptWithSymmetricKey(entityKey, diaryKey);

    const request = {
      version: params.version ?? NewVersion(),
      topic_id: params.topic_id,
      encryption: {
        diary_key_id: encryptionKey.id,
        encrypted_key_nonce: bytesToBase64(keyNonce),
        encrypted_key_data: bytesToBase64(encryptedEntityKey),
      },
      details: {
        nonce: bytesToBase64(detailsNonce),
        data: bytesToBase64(encryptedDetails),
      },
      preview: {
        nonce: bytesToBase64(previewNonce),
        data: bytesToBase64(encryptedPreview),
      },
    };

    const requestJson = new TextEncoder().encode(JSON.stringify(request));
    const signature = signBytes(
      requestJson,
      this.credentials.signingPrivateKey
    );

    const response = await this.http.request<PutEntryResponse>(
      `/v1/diaries/${diaryId}/entries/${entryId}`,
      {
        method: "PUT",
        body: request,
        headers: { "X-Signature": bytesToBase64(signature) },
      }
    );

    return this.decryptEntry(response.entry, diaryKey);
  }

  async delete(diaryId: string, entryId: string): Promise<void> {
    await this.http.request<void>(`/v1/diaries/${diaryId}/entries/${entryId}`, {
      method: "DELETE",
    });
  }

  async list(
    diaryId: string,
    nextPageToken?: string
  ): Promise<{ entries: Entry[]; next_page_token?: string }> {
    const encryptionKey = await this.keysAPI.getActive(diaryId);
    const diaryKey = encryptionKey.value;

    const query = nextPageToken ? `?next_page_token=${nextPageToken}` : "";
    const response = await this.http.request<GetEntriesResponse>(
      `/v1/diaries/${diaryId}/entries${query}`,
      { method: "GET" }
    );

    const entries: Entry[] = [];
    for (const apiEntry of response.entries) {
      const entry = this.decryptEntry(apiEntry, diaryKey);
      entries.push(entry);
    }

    return {
      entries,
      next_page_token: response.next_page_token,
    };
  }

  async get(diaryId: string, entryId: string): Promise<Entry> {
    const encryptionKey = await this.keysAPI.getActive(diaryId);
    const diaryKey = encryptionKey.value;

    const response = await this.http.request<GetEntryResponse>(
      `/v1/diaries/${diaryId}/entries/${entryId}`,
      { method: "GET" }
    );

    return this.decryptEntry(response.entry, diaryKey);
  }

  private decryptEntry(apiEntry: ApiEntry, diaryKey: Uint8Array): Entry {
    const entityKey = decryptWithSymmetricKey(
      base64ToBytes(apiEntry.encryption.encrypted_key_nonce),
      base64ToBytes(apiEntry.encryption.encrypted_key_data),
      diaryKey
    );

    const detailsBytes = decryptWithSymmetricKey(
      base64ToBytes(apiEntry.details.nonce),
      base64ToBytes(apiEntry.details.data),
      entityKey
    );

    const details = JSON.parse(new TextDecoder().decode(detailsBytes));

    return {
      id: apiEntry.id,
      diary_id: apiEntry.diary_id,
      content: details.content,
      topic_id: apiEntry.topic_id,
      archived: details.archived,
      bookmarked: details.bookmarked,
      preview_hidden: details.preview_hidden,
      created_at: new Date(apiEntry.created_at),
      updated_at: new Date(apiEntry.updated_at),
      deleted_at: apiEntry.deleted_at
        ? new Date(apiEntry.deleted_at)
        : undefined,
      version: apiEntry.version,
    };
  }
}
