import { decryptWithSymmetricKey } from "@/crypto/encryption";
import type { EncryptedChange } from "@/proto/change";
import { EncryptedData } from "@/proto/encryption";
import type { EncryptedTemplate as ProtoTemplate } from "@/proto/encrypted_template";
import { ErrorCode } from "@/proto/errors";
import { RealtimeClient } from "@/realtime";
import { KeysAPI } from "@/resources/keys";
import { encryptDetails } from "@/resources/details";
import { optionalTimestampToDate, timestampToDate } from "@/utils/protobuf/timestamp";
import type { EncryptionKey, Template } from "@/types";
import {
  TemplateDetails,
  DeleteTemplateRequest,
  DeleteTemplateResponse,
  GetTemplateRequest,
  GetTemplateResponse,
  ListTemplatesRequest,
  ListTemplatesResponse,
  PutTemplateRequest,
  PutTemplateResponse,
  RestoreTemplateRequest,
  RestoreTemplateResponse,
} from "@/proto/template";

export interface CreateTemplateParams {
  content: string;
}

export type PutTemplateParams = CreateTemplateParams;

export interface DeleteTemplateOptions {
  soft?: boolean;
}

export class TemplatesAPI {
  constructor(
    private rpc: RealtimeClient,
    private keys: KeysAPI,
  ) {}

  async create(diaryId: string, params: CreateTemplateParams): Promise<Template> {
    return this.putChange(diaryId, crypto.randomUUID(), params);
  }

  async put(diaryId: string, templateId: string, params: PutTemplateParams): Promise<Template> {
    const current = await this.fetch(diaryId, templateId);

    return this.putChange(diaryId, templateId, params, current);
  }

  private async putChange(
    diaryId: string,
    templateId: string,
    params: PutTemplateParams,
    current?: ProtoTemplate,
  ): Promise<Template> {
    const key = await this.keys.getActive(diaryId);
    const encrypted = encryptDetails(
      { content: params.content },
      key.value,
      key.id,
      TemplateDetails,
    );

    const currentChange = current?.change?.change;
    if (current && !currentChange) throw new Error("template change is missing");

    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.template.put",
      {
        diaryId,
        templateId,
        encryptedChange: {
          change: {
            id: crypto.randomUUID(),
            objectId: current ? templateId : "",
            parentChangeIds: currentChange ? [currentChange.id] : [],
            payload: EncryptedData.encode(encrypted.details).finish(),
          },
          encryption: encrypted.encryption,
        },
      },
      PutTemplateRequest,
      PutTemplateResponse,
    );

    this.requireSuccess("put template", response.errorCode);

    if (!response.template) throw new Error("template is missing from response");

    return this.decrypt(response.template, key.value);
  }

  async get(diaryId: string, templateId: string): Promise<Template> {
    const [value, keys] = await Promise.all([
      this.fetch(diaryId, templateId),
      this.keys.list(diaryId),
    ]);

    return this.decryptWithKeys(value, keys);
  }

  async list(
    diaryId: string,
    nextPageToken?: string,
  ): Promise<{ templates: Template[]; next_page_token?: string }> {
    const [response, keys] = await Promise.all([
      this.rpc.rpc(
        "io.thingsdiary.v1.template.list",
        { diaryId, page: nextPageToken ? { limit: 0, pageToken: nextPageToken } : undefined },
        ListTemplatesRequest,
        ListTemplatesResponse,
      ),
      this.keys.list(diaryId),
    ]);

    return {
      templates: response.templates.map((value) => this.decryptWithKeys(value, keys)),
      next_page_token: response.page?.nextPageToken || undefined,
    };
  }

  async delete(
    diaryId: string,
    templateId: string,
    options?: DeleteTemplateOptions,
  ): Promise<void> {
    const current = await this.fetch(diaryId, templateId);
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.template.delete",
      {
        diaryId,
        templateId,
        soft: options?.soft ?? true,
        encryptedChange: this.nextStateChange(current),
      },
      DeleteTemplateRequest,
      DeleteTemplateResponse,
    );
    this.requireSuccess("delete template", response.errorCode);
  }

  async restore(diaryId: string, templateId: string): Promise<Template> {
    const [keys, current] = await Promise.all([
      this.keys.list(diaryId),
      this.fetch(diaryId, templateId),
    ]);
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.template.restore",
      { diaryId, templateId, encryptedChange: this.nextStateChange(current) },
      RestoreTemplateRequest,
      RestoreTemplateResponse,
    );

    this.requireSuccess("restore template", response.errorCode);

    if (!response.template) throw new Error("template is missing from response");

    return this.decryptWithKeys(response.template, keys);
  }

  private async fetch(diaryId: string, templateId: string): Promise<ProtoTemplate> {
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.template.get",
      { diaryId, templateId },
      GetTemplateRequest,
      GetTemplateResponse,
    );

    if (!response.template) throw new Error("template is missing from response");

    return response.template;
  }

  private nextStateChange(value: ProtoTemplate): EncryptedChange {
    const encryptedChange = value.change;
    if (!encryptedChange?.change || !encryptedChange.encryption) {
      throw new Error("template change is missing");
    }

    return {
      change: {
        id: crypto.randomUUID(),
        objectId: value.id,
        parentChangeIds: [encryptedChange.change.id],
        payload: encryptedChange.change.payload,
      },
      encryption: encryptedChange.encryption,
    };
  }

  private decryptWithKeys(value: ProtoTemplate, keys: EncryptionKey[]): Template {
    const keyId = value.change?.encryption?.diaryKeyId;
    const key = keys.find((candidate) => candidate.id === keyId);
    if (!key) throw new Error("template encryption key is missing");

    return this.decrypt(value, key.value);
  }

  private decrypt(value: ProtoTemplate, key: Uint8Array): Template {
    const encryptedChange = value.change;
    if (!encryptedChange?.change || !encryptedChange.encryption) {
      throw new Error("template change is missing");
    }

    const encryptedData = EncryptedData.decode(encryptedChange.change.payload);
    const entityKey = decryptWithSymmetricKey(
      encryptedChange.encryption.encryptedKeyNonce,
      encryptedChange.encryption.encryptedKeyData,
      key,
    );
    const details = TemplateDetails.decode(
      decryptWithSymmetricKey(encryptedData.nonce, encryptedData.data, entityKey),
    );

    return {
      id: value.id,
      diary_id: value.diaryId,
      content: details.content,
      created_at: timestampToDate(value.createdAt),
      updated_at: timestampToDate(value.updatedAt),
      deleted_at: optionalTimestampToDate(value.deletedAt),
      removed_at: optionalTimestampToDate(value.removedAt),
    };
  }

  private requireSuccess(action: string, errorCode: ErrorCode): void {
    if (errorCode === ErrorCode.ERROR_CODE_UNSPECIFIED) return;

    throw new Error(`${action} failed: ${ErrorCode[errorCode] ?? errorCode}`);
  }
}
