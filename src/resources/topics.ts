import { RealtimeClient } from "@/realtime";
import { KeysAPI } from "@/resources/keys";
import { decryptDetails, encryptDetails } from "@/resources/details";
import { timestampToDate } from "@/utils/protobuf/timestamp";
import { NewVersion, Version } from "@/resources/version";
import type { Topic } from "@/types";
import {
  DeleteTopicRequest,
  GetTopicRequest,
  GetTopicResponse,
  ListTopicsRequest,
  ListTopicsResponse,
  PutTopicRequest,
  RestoreTopicRequest,
  Topic as ProtoTopic,
} from "@/proto/topic";

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

export class TopicsAPI {
  constructor(
    private rpc: RealtimeClient,
    private keys: KeysAPI,
  ) {}

  async create(diaryId: string, params: CreateTopicParams): Promise<Topic> {
    return this.put(diaryId, crypto.randomUUID(), params);
  }

  async put(diaryId: string, topicId: string, params: PutTopicParams): Promise<Topic> {
    const key = await this.keys.getActive(diaryId);
    const encrypted = encryptDetails(
      { title: params.title, description: params.description, color: params.color },
      key.value,
      key.id,
    );

    // TODO: Sign the encoded request with credentials.signingPrivateKey before sending it.
    await this.rpc.rpc(
      "io.thingsdiary.v1.topic.put",
      {
        diaryId,
        topicId,
        version: BigInt(params.version ?? NewVersion()),
        defaultTemplateId:
          params.default_template_id === null ? undefined : params.default_template_id,
        encryption: encrypted.encryption,
        details: encrypted.details,
      },
      PutTopicRequest,
    );

    // TODO: Wait for the matching realtime event and return its payload instead of reading again.
    return this.get(diaryId, topicId);
  }

  async get(diaryId: string, topicId: string): Promise<Topic> {
    const key = await this.keys.getActive(diaryId);

    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.topic.get",
      { diaryId, topicId },
      GetTopicRequest,
      GetTopicResponse,
    );

    if (!response!.topic) throw new Error("topic is missing from response");

    return this.decrypt(response!.topic, key.value);
  }

  async list(
    diaryId: string,
    nextPageToken?: string,
  ): Promise<{ topics: Topic[]; next_page_token?: string }> {
    const key = await this.keys.getActive(diaryId);

    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.topic.list",
      { diaryId, page: nextPageToken ? { limit: 0, pageToken: nextPageToken } : undefined },
      ListTopicsRequest,
      ListTopicsResponse,
    );

    return {
      topics: response!.topics.map((value) => this.decrypt(value, key.value)),
      next_page_token: response!.page?.nextPageToken || undefined,
    };
  }

  async delete(diaryId: string, topicId: string, options?: DeleteTopicOptions): Promise<void> {
    // TODO: Sign the encoded request with credentials.signingPrivateKey before sending it.
    await this.rpc.rpc(
      "io.thingsdiary.v1.topic.delete",
      {
        diaryId,
        topicId,
        deleteEntries: options?.deleteEntries ?? false,
      },
      DeleteTopicRequest,
    );

    // TODO: Wait for the matching realtime event before returning.
  }

  async restore(diaryId: string, topicId: string): Promise<void> {
    // TODO: Sign the encoded request with credentials.signingPrivateKey before sending it.
    await this.rpc.rpc(
      "io.thingsdiary.v1.topic.restore",
      { diaryId, topicId },
      RestoreTopicRequest,
    );

    // TODO: Wait for the matching realtime event before returning.
  }

  private decrypt(value: ProtoTopic, key: Uint8Array): Topic {
    const details = decryptDetails(value, key);

    return {
      id: value.id,
      diary_id: value.diaryId,
      title: details.title,
      description: details.description,
      color: details.color,
      default_template_id: value.defaultTemplateId,
      created_at: timestampToDate(value.createdAt),
      updated_at: timestampToDate(value.updatedAt),
      version: Number(value.version),
    };
  }
}
