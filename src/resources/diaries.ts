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
  CreateDiaryRequest,
  DeleteDiaryRequest,
  Diary as ProtoDiary,
  GetDiaryRequest,
  GetDiaryResponse,
  ListDiariesRequest,
  ListDiariesResponse,
  PutDiaryRequest,
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
    const entity = encryptDetails(params, diaryKey, "");
    const encryptedDiaryKey = encryptWithPublicKey(diaryKey, this.credentials.encryptionPublicKey);

    // TODO: Sign the encoded request with credentials.signingPrivateKey before sending it.
    await this.rpc.rpc(
      "io.thingsdiary.v1.diary.create",
      {
        encryptedDiaryKey,
        encryptedKeyNonce: entity.encryption.encryptedKeyNonce,
        encryptedKeyData: entity.encryption.encryptedKeyData,
        details: entity.details,
      },
      CreateDiaryRequest,
    );

    // TODO: Wait for the matching realtime event and return its payload instead of reading again.
    const diaries = await this.list();
    if (!diaries.length) throw new Error("created diary was not returned by list");

    return diaries.reduce((a, b) => (a.created_at > b.created_at ? a : b));
  }

  async put(diaryId: string, params: PutDiaryParams): Promise<Diary> {
    const key = await this.keys.getActive(diaryId);
    const encrypted = encryptDetails(
      { title: params.title, description: params.description },
      key.value,
      key.id,
    );

    // TODO: Sign the encoded request with credentials.signingPrivateKey before sending it.
    await this.rpc.rpc(
      "io.thingsdiary.v1.diary.put",
      {
        diaryId,
        version: BigInt(params.version ?? NewVersion()),
        encryption: encrypted.encryption,
        details: encrypted.details,
      },
      PutDiaryRequest,
    );

    // TODO: Wait for the matching realtime event and return its payload instead of reading again.
    return this.get(diaryId);
  }

  async delete(diaryId: string): Promise<void> {
    // TODO: Sign the encoded request with credentials.signingPrivateKey before sending it.
    await this.rpc.rpc("io.thingsdiary.v1.diary.delete", { diaryId }, DeleteDiaryRequest);

    // TODO: Wait for the matching realtime event before returning.
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

    const details = decryptDetails(value, diaryKey);

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
