import { RealtimeClient } from "@/realtime";
import { KeysAPI } from "@/resources/keys";
import { decryptDetails, encryptDetails } from "@/resources/details";
import { optionalTimestampToDate, timestampToDate } from "@/utils/protobuf/timestamp";
import { NewVersion, Version } from "@/resources/version";
import type { Topic } from "@/types";
import {
  DeleteTopicRequest,
  DeleteTopicResponse,
  GetTopicRequest,
  GetTopicResponse,
  ListTopicsRequest,
  ListTopicsResponse,
  PutTopicRequest,
  PutTopicResponse,
  RestoreTopicRequest,
  RestoreTopicResponse,
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
  soft?: boolean;
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

    const response = await this.rpc.rpc(
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
      PutTopicResponse,
    );

    if (!response.topic) throw new Error("topic is missing from response");

    return this.decrypt(response.topic, key.value);
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
      topics: response.topics.map((value) => this.decrypt(value, key.value)),
      next_page_token: response.page?.nextPageToken || undefined,
    };
  }

  async delete(diaryId: string, topicId: string, options?: DeleteTopicOptions): Promise<void> {
    await this.rpc.rpc(
      "io.thingsdiary.v1.topic.delete",
      {
        diaryId,
        topicId,
        soft: options?.soft ?? true,
        deleteEntries: options?.deleteEntries ?? false,
      },
      DeleteTopicRequest,
      DeleteTopicResponse,
    );
  }

  async restore(diaryId: string, topicId: string): Promise<Topic> {
    const keys = await this.keys.list(diaryId);
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.topic.restore",
      { diaryId, topicId },
      RestoreTopicRequest,
      RestoreTopicResponse,
    );

    if (!response.topic) throw new Error("topic is missing from response");

    const key = keys.find((value) => value.id === response.topic?.encryption?.diaryKeyId);
    if (!key) throw new Error("Topic encryption key is missing");

    return this.decrypt(response.topic, key.value);
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
      deleted_at: optionalTimestampToDate(value.deletedAt),
      removed_at: optionalTimestampToDate(value.removedAt),
      version: Number(value.version),
    };
  }
}
