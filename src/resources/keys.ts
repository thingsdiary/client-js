import { HttpClient } from "@/http";
import { Credentials } from "@/crypto/credentials";
import { base64ToBytes } from "@/utils/encoding";
import { decryptWithPrivateKey } from "@/crypto/encryption";

export interface GetKeyResponse {
  keys: ApiKey[];
}

export interface ApiKey {
  id: string;
  value: string;
  status: "active" | "rotating";
}

export interface EncryptionKey {
  id: string;
  value: Uint8Array;
  status: "active" | "rotating";
}

export class KeysAPI {
  constructor(private http: HttpClient, private credentials: Credentials) {}

  async getActive(diaryId: string): Promise<EncryptionKey> {
    // TODO: Implement client-side caching for keys (TTL ~5min)
    const keys = await this.list(diaryId);

    const activeKey = keys.find((k) => k.status === "active");
    if (!activeKey) {
      throw new Error("No active encryption key found");
    }

    return activeKey;
  }

  async list(diaryId: string): Promise<EncryptionKey[]> {
    const response = await this.http.request<GetKeyResponse>(
      `/diaries/${diaryId}/keys`,
      {
        method: "GET",
      }
    );

    return response.keys.map((k) => this.decryptKey(k));
  }

  private decryptKey(apiKey: ApiKey): EncryptionKey {
    const encryptedKey = base64ToBytes(apiKey.value);
    const key = decryptWithPrivateKey(
      encryptedKey,
      this.credentials.encryptionPrivateKey,
      this.credentials.encryptionPublicKey
    );

    return { id: apiKey.id, value: key, status: apiKey.status };
  }
}
