import type { EncryptedDiary as ProtoDiary } from "@/proto/encrypted_diary";
import { Credentials } from "@/crypto/credentials";
import {
  decryptWithPrivateKey,
  encryptWithPublicKey,
  generateSymmetricKey,
} from "@/crypto/encryption";
import { RealtimeClient } from "@/realtime";
import { KeysAPI } from "@/resources/keys";
import { decryptDetails, encryptDetails } from "@/resources/details";
import { timestampToDate } from "@/utils/protobuf/timestamp";
import { NewVersion, Version } from "@/resources/version";
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

export interface CreateDiaryParams {
  title: string;
  description: string;
}

export interface PutDiaryParams extends CreateDiaryParams {
  version?: Version;
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

    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.diary.create",
      {
        encryptedDiaryKey,
        encryptedKeyNonce: entity.encryption.encryptedKeyNonce,
        encryptedKeyData: entity.encryption.encryptedKeyData,
        details: entity.details,
        change: undefined,
      },
      CreateDiaryRequest,
      CreateDiaryResponse,
    );

    if (!response.diary) throw new Error("diary is missing from response");

    return this.decrypt(response.diary);
  }

  async put(diaryId: string, params: PutDiaryParams): Promise<Diary> {
    const key = await this.keys.getActive(diaryId);
    const encrypted = encryptDetails(
      { title: params.title, description: params.description },
      key.value,
      key.id,
      DiaryDetails,
    );

    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.diary.put",
      {
        diaryId,
        version: BigInt(params.version ?? NewVersion()),
        encryption: encrypted.encryption,
        details: encrypted.details,
        change: undefined,
      },
      PutDiaryRequest,
      PutDiaryResponse,
    );

    if (!response.diary) throw new Error("diary is missing from response");

    return this.decrypt(response.diary);
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
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.diary.get",
      { diaryId },
      GetDiaryRequest,
      GetDiaryResponse,
    );

    if (!response!.diary) throw new Error("diary is missing from response");

    return this.decrypt(response!.diary);
  }

  private decrypt(value: ProtoDiary): Diary {
    if (!value.encryptionKeys.length) throw new Error("diary encryption key is missing");

    const diaryKey = decryptWithPrivateKey(
      value.encryptionKeys[0].value,
      this.credentials.encryptionPrivateKey,
      this.credentials.encryptionPublicKey,
    );

    const details = decryptDetails(value, diaryKey, DiaryDetails);

    return {
      id: value.id,
      title: details.title,
      description: details.description,
      created_at: timestampToDate(value.createdAt),
      updated_at: timestampToDate(value.updatedAt),
      version: Number(value.version),
    };
  }
}
