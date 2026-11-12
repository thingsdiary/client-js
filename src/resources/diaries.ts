import type { EncryptedDiary as ProtoDiary } from "@/proto/encrypted_diary";
import { Credentials } from "@/crypto/credentials";
import {
  decryptWithSymmetricKey,
  decryptWithPrivateKey,
  encryptWithPublicKey,
  generateSymmetricKey,
} from "@/crypto/encryption";
import { RealtimeClient } from "@/realtime";
import { KeysAPI } from "@/resources/keys";
import { encryptDetails } from "@/resources/details";
import { timestampToDate } from "@/utils/protobuf/timestamp";
import type { Version } from "@/resources/version";
import type { Diary } from "@/types";
import {
  DiaryDetails,
  CreateDiaryRequest,
  CreateDiaryResponse,
  DeleteDiaryRequest,
  DeleteDiaryResponse,
  GetDiaryRequest,
  GetDiaryResponse,
  ListDiariesRequest,
  ListDiariesResponse,
  PutDiaryRequest,
  PutDiaryResponse,
} from "@/proto/diary";
import { EncryptedData } from "@/proto/encryption";

export interface CreateDiaryParams {
  title: string;
  description: string;
}

export interface PutDiaryParams extends CreateDiaryParams {
  version?: Version;
  parentChangeIds?: string[];
}

export class DiariesAPI {
  constructor(
    private rpc: RealtimeClient,
    private credentials: Credentials,
    private keys: KeysAPI,
  ) {}

  async create(params: CreateDiaryParams): Promise<Diary> {
    const diaryKey = generateSymmetricKey();
    const entity = encryptDetails(params, diaryKey, "", DiaryDetails);
    const encryptedDiaryKey = encryptWithPublicKey(diaryKey, this.credentials.encryptionPublicKey);

    const payload = EncryptedData.encode(entity.details).finish();
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.diary.create",
      {
        encryptedDiaryKey,
        encryptedChange: {
          change: { id: crypto.randomUUID(), objectId: "", parentChangeIds: [], payload },
          encryption: entity.encryption,
        },
      },
      CreateDiaryRequest,
      CreateDiaryResponse,
    );

    return this.decrypt(await this.fetch(response.diaryId));
  }

  async put(diaryId: string, params: PutDiaryParams): Promise<Diary> {
    const current = await this.fetch(diaryId);
    if (!current.change?.change) throw new Error("diary change is missing");
    const key = await this.keys.getActive(diaryId);
    const encrypted = encryptDetails(
      { title: params.title, description: params.description },
      key.value,
      key.id,
      DiaryDetails,
    );

    const payload = EncryptedData.encode(encrypted.details).finish();
    await this.rpc.rpc(
      "io.thingsdiary.v1.diary.put",
      {
        diaryId,
        encryptedChange: {
          change: {
            id: crypto.randomUUID(),
            objectId: diaryId,
            parentChangeIds: params.parentChangeIds ?? [current.change.change.id],
            payload,
          },
          encryption: encrypted.encryption,
        },
      },
      PutDiaryRequest,
      PutDiaryResponse,
    );

    return this.decrypt(await this.fetch(diaryId));
  }

  async delete(diaryId: string): Promise<void> {
    await this.rpc.rpc(
      "io.thingsdiary.v1.diary.delete",
      { diaryId },
      DeleteDiaryRequest,
      DeleteDiaryResponse,
    );
  }

  async list(): Promise<Diary[]> {
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.diary.list",
      { page: undefined },
      ListDiariesRequest,
      ListDiariesResponse,
    );

    return response!.diaries.map((value) => this.decrypt(value));
  }

  async get(diaryId: string): Promise<Diary> {
    return this.decrypt(await this.fetch(diaryId));
  }

  private async fetch(diaryId: string): Promise<ProtoDiary> {
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.diary.get",
      { diaryId },
      GetDiaryRequest,
      GetDiaryResponse,
    );

    if (!response?.diary) throw new Error("diary is missing from response");

    return response.diary;
  }

  private decrypt(value: ProtoDiary): Diary {
    if (!value.encryptionKeys.length) throw new Error("diary encryption key is missing");

    const diaryKey = decryptWithPrivateKey(
      value.encryptionKeys[0].value,
      this.credentials.encryptionPrivateKey,
      this.credentials.encryptionPublicKey,
    );

    const change = value.change;
    if (!change?.change || !change.encryption) throw new Error("diary change is missing");

    const encryptedData = EncryptedData.decode(change.change.payload);
    const entityKey = decryptWithSymmetricKey(
      change.encryption.encryptedKeyNonce,
      change.encryption.encryptedKeyData,
      diaryKey,
    );
    const details = DiaryDetails.decode(
      decryptWithSymmetricKey(encryptedData.nonce, encryptedData.data, entityKey),
    );
    const updatedAt = timestampToDate(value.updatedAt);

    return {
      id: value.id,
      title: details.title,
      description: details.description,
      created_at: timestampToDate(value.createdAt),
      updated_at: updatedAt,
      version: updatedAt.getTime(),
    };
  }
}
