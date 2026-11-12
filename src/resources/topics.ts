import { decryptWithSymmetricKey } from "@/crypto/encryption";
import type { EncryptedChange } from "@/proto/change";
import { EncryptedData } from "@/proto/encryption";
import type { EncryptedTopic as ProtoTopic } from "@/proto/encrypted_topic";
import { ErrorCode } from "@/proto/errors";
import { RealtimeClient } from "@/realtime";
import { KeysAPI } from "@/resources/keys";
import { encryptDetails } from "@/resources/details";
import { optionalTimestampToDate, timestampToDate } from "@/utils/protobuf/timestamp";
import type { EncryptionKey, Topic } from "@/types";
import {
  TopicDetails,
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
} from "@/proto/topic";

export interface CreateTopicParams {
  title: string;
  description: string;
  color: string;
  default_template_id?: string | null;
}

export type PutTopicParams = CreateTopicParams;

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
    return this.putChange(diaryId, crypto.randomUUID(), params);
  }

  async put(diaryId: string, topicId: string, params: PutTopicParams): Promise<Topic> {
    const current = await this.fetch(diaryId, topicId);

    return this.putChange(diaryId, topicId, params, current);
  }

  private async putChange(
    diaryId: string,
    topicId: string,
    params: PutTopicParams,
    current?: ProtoTopic,
  ): Promise<Topic> {
    const key = await this.keys.getActive(diaryId);
    const encrypted = encryptDetails(
      {
        title: params.title,
        description: params.description,
        color: params.color,
        entryPreviewable: undefined,
      },
      key.value,
      key.id,
      TopicDetails,
    );

    const currentChange = current?.change?.change;
    if (current && !currentChange) throw new Error("topic change is missing");

    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.topic.put",
      {
        diaryId,
        topicId,
        defaultTemplateId:
          params.default_template_id === null ? undefined : params.default_template_id,
        encryptedChange: {
          change: {
            id: crypto.randomUUID(),
            objectId: current ? topicId : "",
            parentChangeIds: currentChange ? [currentChange.id] : [],
            payload: EncryptedData.encode(encrypted.details).finish(),
          },
          encryption: encrypted.encryption,
        },
      },
      PutTopicRequest,
      PutTopicResponse,
    );

    this.requireSuccess("put topic", response.errorCode);
    if (!response.topic) throw new Error("topic is missing from response");

    return this.decrypt(response.topic, key.value);
  }

  async get(diaryId: string, topicId: string): Promise<Topic> {
    const [value, keys] = await Promise.all([
      this.fetch(diaryId, topicId),
      this.keys.list(diaryId),
    ]);

    return this.decryptWithKeys(value, keys);
  }

  async list(
    diaryId: string,
    nextPageToken?: string,
  ): Promise<{ topics: Topic[]; next_page_token?: string }> {
    const [response, keys] = await Promise.all([
      this.rpc.rpc(
        "io.thingsdiary.v1.topic.list",
        { diaryId, page: nextPageToken ? { limit: 0, pageToken: nextPageToken } : undefined },
        ListTopicsRequest,
        ListTopicsResponse,
      ),
      this.keys.list(diaryId),
    ]);

    return {
      topics: response.topics.map((value) => this.decryptWithKeys(value, keys)),
      next_page_token: response.page?.nextPageToken || undefined,
    };
  }

  async delete(diaryId: string, topicId: string, options?: DeleteTopicOptions): Promise<void> {
    const current = await this.fetch(diaryId, topicId);
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.topic.delete",
      {
        diaryId,
        topicId,
        soft: options?.soft ?? true,
        deleteEntries: options?.deleteEntries ?? false,
        encryptedChange: this.nextStateChange(current),
      },
      DeleteTopicRequest,
      DeleteTopicResponse,
    );

    this.requireSuccess("delete topic", response.errorCode);
  }

  async restore(diaryId: string, topicId: string): Promise<Topic> {
    const current = await this.fetch(diaryId, topicId);
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.topic.restore",
      { diaryId, topicId, encryptedChange: this.nextStateChange(current) },
      RestoreTopicRequest,
      RestoreTopicResponse,
    );

    this.requireSuccess("restore topic", response.errorCode);
    if (!response.topic) throw new Error("topic is missing from response");

    return this.decryptWithKeys(response.topic, await this.keys.list(diaryId));
  }

  private async fetch(diaryId: string, topicId: string): Promise<ProtoTopic> {
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.topic.get",
      { diaryId, topicId },
      GetTopicRequest,
      GetTopicResponse,
    );

    if (!response.topic) throw new Error("topic is missing from response");

    return response.topic;
  }

  private nextStateChange(value: ProtoTopic): EncryptedChange {
    const encryptedChange = value.change;
    if (!encryptedChange?.change || !encryptedChange.encryption) {
      throw new Error("topic change is missing");
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

  private decryptWithKeys(value: ProtoTopic, keys: EncryptionKey[]): Topic {
    const keyId = value.change?.encryption?.diaryKeyId;
    const key = keys.find((candidate) => candidate.id === keyId);
    if (!key) throw new Error("topic encryption key is missing");

    return this.decrypt(value, key.value);
  }

  private decrypt(value: ProtoTopic, key: Uint8Array): Topic {
    const encryptedChange = value.change;
    if (!encryptedChange?.change || !encryptedChange.encryption) {
      throw new Error("topic change is missing");
    }

    const encryptedData = EncryptedData.decode(encryptedChange.change.payload);
    const entityKey = decryptWithSymmetricKey(
      encryptedChange.encryption.encryptedKeyNonce,
      encryptedChange.encryption.encryptedKeyData,
      key,
    );
    const details = TopicDetails.decode(
      decryptWithSymmetricKey(encryptedData.nonce, encryptedData.data, entityKey),
    );

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
    };
  }

  private requireSuccess(action: string, errorCode: ErrorCode): void {
    if (errorCode === ErrorCode.ERROR_CODE_UNSPECIFIED) return;
    if (errorCode === ErrorCode.ERROR_CODE_FAILED_PRECONDITION) {
      throw new Error("deleting topic entries requires encrypted entry changes");
    }

    throw new Error(`${action} failed: ${ErrorCode[errorCode] ?? errorCode}`);
  }
}
