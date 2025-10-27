import { Credentials } from "@/crypto/credentials";
import {
  generateSymmetricKey,
  encryptWithSymmetricKey,
  encryptWithPublicKey,
  decryptWithSymmetricKey,
  decryptWithPrivateKey,
} from "@/crypto/encryption";
import { signBytes } from "@/crypto/signature";
import { HttpClient } from "@/http";
import { base64ToBytes, bytesToBase64 } from "@/utils/encoding";
import { KeysAPI } from "@/resources/keys";
import { NewVersion, Version } from "@/resources/version";

// todo: moveout models?

export interface Diary {
  id: string;
  title: string;
  description: string;
  created_at: Date;
  updated_at: Date;
  version: number;
}

export interface ApiDiary {
  id: string;
  created_at: string;
  updated_at: string;
  version: number;

  // todo: to be declared
  encryption: any;
  encryption_keys: EncryptionKey[];
  details: any;
}

export interface EncryptionKey {
  id: string;
  value: string;
}

export interface CreateDiaryParams {
  title: string;
  description: string;
}

export interface PutDiaryParams extends CreateDiaryParams {
  version?: Version;
}

export interface CreateDiaryResponse {
  diary: ApiDiary;
}

export interface PutDiaryResponse {
  diary: ApiDiary;
}

export interface GetDiaryResponse {
  diary: ApiDiary;
}

export interface GetDiariesResponse {
  diaries: ApiDiary[];
}

export class DiariesAPI {
  constructor(
    private http: HttpClient,
    private credentials: Credentials,
    private keysAPI: KeysAPI
  ) {}

  async create(params: CreateDiaryParams): Promise<Diary> {
    const diaryKey = generateSymmetricKey();
    const entityKey = generateSymmetricKey();

    const details = { title: params.title, description: params.description };
    const detailsJson = new TextEncoder().encode(JSON.stringify(details));
    const { nonce: detailsNonce, ciphertext: encryptedDetails } =
      encryptWithSymmetricKey(detailsJson, entityKey);

    const { nonce: keyNonce, ciphertext: encryptedEntityKey } =
      encryptWithSymmetricKey(entityKey, diaryKey);

    const encryptedDiaryKey = encryptWithPublicKey(
      diaryKey,
      this.credentials.encryptionPublicKey
    );

    const request = {
      encrypted_diary_key: bytesToBase64(encryptedDiaryKey),
      details: {
        nonce: bytesToBase64(detailsNonce),
        data: bytesToBase64(encryptedDetails),
      },
      encryption: {
        encrypted_key_nonce: bytesToBase64(keyNonce),
        encrypted_key_data: bytesToBase64(encryptedEntityKey),
      },
    };

    const requestJson = new TextEncoder().encode(JSON.stringify(request));
    const signature = signBytes(
      requestJson,
      this.credentials.signingPrivateKey
    );

    const response = await this.http.request<CreateDiaryResponse>("/v1/diaries", {
      method: "POST",
      body: request,
      headers: { "X-Signature": bytesToBase64(signature) },
    });

    return this.decryptDiary(response.diary);
  }

  async put(diaryId: string, params: PutDiaryParams): Promise<Diary> {
    const encryptionKey = await this.keysAPI.getActive(diaryId);
    const diaryKey = encryptionKey.value;

    const entityKey = generateSymmetricKey();

    const details = { title: params.title, description: params.description };
    const detailsJson = new TextEncoder().encode(JSON.stringify(details));
    const { nonce: detailsNonce, ciphertext: encryptedDetails } =
      encryptWithSymmetricKey(detailsJson, entityKey);

    const { nonce: keyNonce, ciphertext: encryptedEntityKey } =
      encryptWithSymmetricKey(entityKey, diaryKey);

    const request = {
      version: params.version ?? NewVersion(),
      details: {
        nonce: bytesToBase64(detailsNonce),
        data: bytesToBase64(encryptedDetails),
      },
      encryption: {
        diary_key_id: encryptionKey.id,
        encrypted_key_nonce: bytesToBase64(keyNonce),
        encrypted_key_data: bytesToBase64(encryptedEntityKey),
      },
    };

    const requestJson = new TextEncoder().encode(JSON.stringify(request));
    const signature = signBytes(
      requestJson,
      this.credentials.signingPrivateKey
    );

    const response = await this.http.request<PutDiaryResponse>(
      `/v1/diaries/${diaryId}`,
      {
        method: "PUT",
        body: request,
        headers: { "X-Signature": bytesToBase64(signature) },
      }
    );

    return this.decryptDiary(response.diary);
  }

  async delete(diaryId: string): Promise<void> {
    await this.http.request<void>(`/v1/diaries/${diaryId}`, {
      method: "DELETE",
    });
  }

  async list(): Promise<Diary[]> {
    const response = await this.http.request<GetDiariesResponse>("/v1/diaries", {
      method: "GET",
    });

    const diaries: Diary[] = [];
    for (const encryptedDiary of response.diaries) {
      const diary = this.decryptDiary(encryptedDiary);
      diaries.push(diary);
    }

    return diaries;
  }

  async get(diaryId: string): Promise<Diary> {
    const response = await this.http.request<GetDiaryResponse>(
      `/v1/diaries/${diaryId}`,
      { method: "GET" }
    );

    return this.decryptDiary(response.diary);
  }

  private decryptDiary(apiDiary: ApiDiary): Diary {
    const diaryKey = this.getDiaryKey(apiDiary);

    const entityKey = decryptWithSymmetricKey(
      base64ToBytes(apiDiary.encryption.encrypted_key_nonce),
      base64ToBytes(apiDiary.encryption.encrypted_key_data),
      diaryKey
    );

    const detailsBytes = decryptWithSymmetricKey(
      base64ToBytes(apiDiary.details.nonce),
      base64ToBytes(apiDiary.details.data),
      entityKey
    );

    const details = JSON.parse(new TextDecoder().decode(detailsBytes));

    return {
      id: apiDiary.id,
      title: details.title,
      description: details.description,
      // todo: will it work with golang string?
      created_at: new Date(apiDiary.created_at),
      updated_at: new Date(apiDiary.updated_at),
      version: apiDiary.version,
    };
  }

  private getDiaryKey(apiDiary: ApiDiary): Uint8Array {
    const encryptedKey = base64ToBytes(apiDiary.encryption_keys[0].value);

    const diaryKey = decryptWithPrivateKey(
      encryptedKey,
      this.credentials.encryptionPrivateKey,
      this.credentials.encryptionPublicKey
    );

    return diaryKey;
  }
}
