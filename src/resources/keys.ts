import { Credentials } from "@/crypto/credentials";
import { decryptWithPrivateKey } from "@/crypto/encryption";
import { RealtimeClient } from "@/realtime";
import { DiaryKeyStatus, ListDiaryKeysRequest, ListDiaryKeysResponse } from "@/proto/diary_key";
import type { EncryptionKey } from "@/types";

export class KeysAPI {
  constructor(
    private rpc: RealtimeClient,
    private credentials: Credentials,
  ) {}

  async getActive(diaryId: string): Promise<EncryptionKey> {
    const key = (await this.list(diaryId)).find((value) => value.status === "active");

    if (!key) throw new Error("No active encryption key found");

    return key;
  }

  async list(diaryId: string): Promise<EncryptionKey[]> {
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.diary_key.list",
      { diaryId },
      ListDiaryKeysRequest,
      ListDiaryKeysResponse,
    );

    return response!.keys.map((key) => ({
      id: key.id,
      value: decryptWithPrivateKey(
        key.value,
        this.credentials.encryptionPrivateKey,
        this.credentials.encryptionPublicKey,
      ),
      status:
        key.status === DiaryKeyStatus.DIARY_KEY_STATUS_ACTIVE
          ? "active"
          : key.status === DiaryKeyStatus.DIARY_KEY_STATUS_ROTATING
            ? "rotating"
            : "rotated",
    }));
  }
}
