import { RealtimeClient } from "@/realtime";
import { KeysAPI } from "@/resources/keys";
import { decryptDetails, encryptDetails } from "@/resources/details";
import { optionalTimestampToDate, timestampToDate } from "@/utils/protobuf/timestamp";
import { NewVersion, Version } from "@/resources/version";
import type { Template } from "@/types";
import {
  DeleteTemplateRequest,
  GetTemplateRequest,
  GetTemplateResponse,
  ListTemplatesRequest,
  ListTemplatesResponse,
  PutTemplateRequest,
  RestoreTemplateRequest,
  Template as ProtoTemplate,
} from "@/proto/template";

export interface CreateTemplateParams {
  content: string;
}

export interface PutTemplateParams extends CreateTemplateParams {
  version?: Version;
}

export interface DeleteTemplateOptions {
  soft?: boolean;
}

export class TemplatesAPI {
  constructor(
    private rpc: RealtimeClient,
    private keys: KeysAPI,
  ) {}

  async create(diaryId: string, params: CreateTemplateParams): Promise<Template> {
    return this.put(diaryId, crypto.randomUUID(), params);
  }

  async put(diaryId: string, templateId: string, params: PutTemplateParams): Promise<Template> {
    const key = await this.keys.getActive(diaryId);
    const encrypted = encryptDetails({ content: params.content }, key.value, key.id);

    // TODO: Sign the encoded request with credentials.signingPrivateKey before sending it.
    await this.rpc.rpc(
      "io.thingsdiary.v1.template.put",
      {
        diaryId,
        templateId,
        version: BigInt(params.version ?? NewVersion()),
        encryption: encrypted.encryption,
        details: encrypted.details,
      },
      PutTemplateRequest,
    );

    // TODO: Wait for the matching realtime event and return its payload instead of reading again.
    return this.get(diaryId, templateId);
  }

  async get(diaryId: string, templateId: string): Promise<Template> {
    const key = await this.keys.getActive(diaryId);

    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.template.get",
      { diaryId, templateId },
      GetTemplateRequest,
      GetTemplateResponse,
    );

    if (!response!.template) throw new Error("template is missing from response");

    return this.decrypt(response!.template, key.value);
  }

  async list(
    diaryId: string,
    nextPageToken?: string,
  ): Promise<{ templates: Template[]; next_page_token?: string }> {
    const key = await this.keys.getActive(diaryId);

    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.template.list",
      { diaryId, page: nextPageToken ? { limit: 0, pageToken: nextPageToken } : undefined },
      ListTemplatesRequest,
      ListTemplatesResponse,
    );

    return {
      templates: response!.templates.map((value) => this.decrypt(value, key.value)),
      next_page_token: response!.page?.nextPageToken || undefined,
    };
  }

  async delete(
    diaryId: string,
    templateId: string,
    options?: DeleteTemplateOptions,
  ): Promise<void> {
    // TODO: Sign the encoded request with credentials.signingPrivateKey before sending it.
    await this.rpc.rpc(
      "io.thingsdiary.v1.template.delete",
      { diaryId, templateId, soft: options?.soft ?? true },
      DeleteTemplateRequest,
    );

    // TODO: Wait for the matching realtime event before returning.
  }

  async restore(diaryId: string, templateId: string): Promise<void> {
    // TODO: Sign the encoded request with credentials.signingPrivateKey before sending it.
    await this.rpc.rpc(
      "io.thingsdiary.v1.template.restore",
      { diaryId, templateId },
      RestoreTemplateRequest,
    );

    // TODO: Wait for the matching realtime event before returning.
  }

  private decrypt(value: ProtoTemplate, key: Uint8Array): Template {
    const details = decryptDetails(value, key);

    return {
      id: value.id,
      diary_id: value.diaryId,
      content: details.content,
      created_at: timestampToDate(value.createdAt),
      updated_at: timestampToDate(value.updatedAt),
      deleted_at: optionalTimestampToDate(value.deletedAt),
      removed_at: optionalTimestampToDate(value.removedAt),
      version: Number(value.version),
    };
  }
}
