import { encryptWithSymmetricKey } from "@/crypto/encryption";
import { RealtimeClient } from "@/realtime";
import { KeysAPI } from "@/resources/keys";
import { decryptDetails, encryptDetails } from "@/resources/details";
import { optionalTimestampToDate, timestampToDate } from "@/utils/protobuf/timestamp";
import { NewVersion, Version } from "@/resources/version";
import type { Entry } from "@/types";
import {
  DeleteEntryRequest,
  Entry as ProtoEntry,
  GetEntryRequest,
  GetEntryResponse,
  ListEntriesRequest,
  ListEntriesResponse,
  PutEntryRequest,
  RestoreEntryRequest,
} from "@/proto/entry";

export interface PutEntryParams {
  content: string;
  topic_id?: string | null;
  archived?: boolean;
  bookmarked?: boolean;
  preview_hidden?: boolean;
  version?: Version;
}

export interface DeleteEntryOptions {
  soft?: boolean;
}

export class EntriesAPI {
  constructor(
    private rpc: RealtimeClient,
    private keys: KeysAPI,
  ) {}

  async create(diaryId: string, params: PutEntryParams): Promise<Entry> {
    return this.put(diaryId, crypto.randomUUID(), params);
  }

  async put(diaryId: string, entryId: string, params: PutEntryParams): Promise<Entry> {
    const key = await this.keys.getActive(diaryId);
    const plain = {
      content: params.content,
      archived: params.archived ?? false,
      bookmarked: params.bookmarked ?? false,
      preview_hidden: params.preview_hidden ?? false,
    };
    const encrypted = encryptDetails(plain, key.value, key.id);
    const previewValue = encryptWithSymmetricKey(
      new TextEncoder().encode(JSON.stringify(plain)),
      encrypted.key,
    );

    await this.rpc.rpc(
      "io.thingsdiary.v1.entry.put",
      {
        diaryId,
        entryId,
        version: BigInt(params.version ?? NewVersion()),
        topicId: params.topic_id === null ? undefined : params.topic_id,
        encryption: encrypted.encryption,
        details: encrypted.details,
        preview: { nonce: previewValue.nonce, data: previewValue.ciphertext },
      },
      PutEntryRequest,
    );

    // TODO: Wait for the matching realtime event and return its payload instead of reading again.
    return this.get(diaryId, entryId);
  }

  async get(diaryId: string, entryId: string): Promise<Entry> {
    const key = await this.keys.getActive(diaryId);

    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.entry.get",
      { diaryId, entryId },
      GetEntryRequest,
      GetEntryResponse,
    );

    if (!response!.entry) throw new Error("entry is missing from response");

    return this.decrypt(response!.entry, key.value);
  }

  async list(
    diaryId: string,
    nextPageToken?: string,
  ): Promise<{ entries: Entry[]; next_page_token?: string }> {
    const key = await this.keys.getActive(diaryId);

    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.entry.list",
      { diaryId, page: nextPageToken ? { limit: 0, pageToken: nextPageToken } : undefined },
      ListEntriesRequest,
      ListEntriesResponse,
    );

    return {
      entries: response!.entries.map((value) => this.decrypt(value, key.value)),
      next_page_token: response!.page?.nextPageToken || undefined,
    };
  }

  async delete(diaryId: string, entryId: string, options?: DeleteEntryOptions): Promise<void> {
    await this.rpc.rpc(
      "io.thingsdiary.v1.entry.delete",
      { diaryId, entryId, soft: options?.soft ?? true },
      DeleteEntryRequest,
    );

    // TODO: Wait for the matching realtime event before returning.
  }

  async restore(diaryId: string, entryId: string): Promise<void> {
    await this.rpc.rpc(
      "io.thingsdiary.v1.entry.restore",
      { diaryId, entryId },
      RestoreEntryRequest,
    );

    // TODO: Wait for the matching realtime event before returning.
  }

  private decrypt(value: ProtoEntry, key: Uint8Array): Entry {
    const details = decryptDetails(value, key);

    return {
      id: value.id,
      diary_id: value.diaryId,
      content: details.content,
      topic_id: value.topicId,
      archived: details.archived,
      bookmarked: details.bookmarked,
      preview_hidden: details.preview_hidden,
      created_at: timestampToDate(value.createdAt),
      updated_at: timestampToDate(value.updatedAt),
      deleted_at: optionalTimestampToDate(value.deletedAt),
      removed_at: optionalTimestampToDate(value.removedAt),
      version: Number(value.version),
    };
  }
}
