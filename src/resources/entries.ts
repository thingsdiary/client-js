import { decryptWithSymmetricKey } from "@/crypto/encryption";
import type { EncryptedChange } from "@/proto/change";
import { EncryptedData } from "@/proto/encryption";
import type { EncryptedEntry as ProtoEntry } from "@/proto/encrypted_entry";
import { ErrorCode } from "@/proto/errors";
import {
  DeleteEntryRequest,
  DeleteEntryResponse,
  EntryDetails,
  GetEntryRequest,
  GetEntryResponse,
  ListEntriesRequest,
  ListEntriesResponse,
  PutEntryRequest,
  PutEntryResponse,
  RestoreEntryRequest,
  RestoreEntryResponse,
} from "@/proto/entry";
import { RealtimeClient } from "@/realtime";
import { encryptDetails } from "@/resources/details";
import { KeysAPI } from "@/resources/keys";
import type { EncryptionKey, Entry } from "@/types";
import { optionalTimestampToDate, timestampToDate } from "@/utils/protobuf/timestamp";

export interface PutEntryParams {
  content: string;
  topic_id?: string | null;
  archived?: boolean;
  bookmarked?: boolean;
  preview_hidden?: boolean;
  parent_change_ids?: string[];
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
    return this.putChange(diaryId, crypto.randomUUID(), params);
  }

  async put(diaryId: string, entryId: string, params: PutEntryParams): Promise<Entry> {
    const current = await this.fetch(diaryId, entryId);

    return this.putChange(diaryId, entryId, params, current);
  }

  async get(diaryId: string, entryId: string): Promise<Entry> {
    const [value, keys] = await Promise.all([
      this.fetch(diaryId, entryId),
      this.keys.list(diaryId),
    ]);

    return this.decryptWithKeys(value, keys);
  }

  async list(
    diaryId: string,
    nextPageToken?: string,
  ): Promise<{ entries: Entry[]; next_page_token?: string }> {
    const [response, keys] = await Promise.all([
      this.rpc.rpc(
        "io.thingsdiary.v1.entry.list",
        { diaryId, page: nextPageToken ? { limit: 0, pageToken: nextPageToken } : undefined },
        ListEntriesRequest,
        ListEntriesResponse,
      ),
      this.keys.list(diaryId),
    ]);

    return {
      entries: response.entries.map((value) => this.decryptWithKeys(value, keys)),
      next_page_token: response.page?.nextPageToken || undefined,
    };
  }

  async delete(diaryId: string, entryId: string, options?: DeleteEntryOptions): Promise<void> {
    const current = await this.fetch(diaryId, entryId);
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.entry.delete",
      {
        diaryId,
        entryId,
        soft: options?.soft ?? true,
        encryptedChange: this.nextStateChange(current),
      },
      DeleteEntryRequest,
      DeleteEntryResponse,
    );

    this.requireSuccess("delete entry", response.errorCode);
  }

  async restore(diaryId: string, entryId: string): Promise<Entry> {
    const current = await this.fetch(diaryId, entryId);
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.entry.restore",
      { diaryId, entryId, encryptedChange: this.nextStateChange(current) },
      RestoreEntryRequest,
      RestoreEntryResponse,
    );

    this.requireSuccess("restore entry", response.errorCode);
    if (!response.entry) throw new Error("entry is missing from response");

    return this.decryptWithKeys(response.entry, await this.keys.list(diaryId));
  }

  private async putChange(
    diaryId: string,
    entryId: string,
    params: PutEntryParams,
    current?: ProtoEntry,
  ): Promise<Entry> {
    const key = await this.keys.getActive(diaryId);
    const encrypted = encryptDetails(
      {
        content: params.content,
        archived: params.archived ?? false,
        bookmarked: params.bookmarked ?? false,
        previewHidden: params.preview_hidden ?? false,
      },
      key.value,
      key.id,
      EntryDetails,
    );
    const payload = EncryptedData.encode(encrypted.details).finish();
    const currentChange = current?.change?.change;
    if (current && !currentChange) throw new Error("entry change is missing");

    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.entry.put",
      {
        diaryId,
        entryId,
        topicId: params.topic_id === null ? undefined : params.topic_id,
        encryptedChange: {
          change: {
            id: crypto.randomUUID(),
            objectId: current ? entryId : "",
            parentChangeIds: params.parent_change_ids ?? (currentChange ? [currentChange.id] : []),
            payload,
          },
          encryption: encrypted.encryption,
        },
      },
      PutEntryRequest,
      PutEntryResponse,
    );

    this.requireSuccess("put entry", response.errorCode);
    if (!response.entry) throw new Error("entry is missing from response");

    return this.decrypt(response.entry, key.value);
  }

  private async fetch(diaryId: string, entryId: string): Promise<ProtoEntry> {
    const response = await this.rpc.rpc(
      "io.thingsdiary.v1.entry.get",
      { diaryId, entryId },
      GetEntryRequest,
      GetEntryResponse,
    );

    if (!response.entry) throw new Error("entry is missing from response");

    return response.entry;
  }

  private nextStateChange(value: ProtoEntry): EncryptedChange {
    const encryptedChange = value.change;
    if (!encryptedChange?.change || !encryptedChange.encryption) {
      throw new Error("entry change is missing");
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

  private decryptWithKeys(value: ProtoEntry, keys: EncryptionKey[]): Entry {
    const keyId = value.change?.encryption?.diaryKeyId;
    const key = keys.find((candidate) => candidate.id === keyId);
    if (!key) throw new Error("entry encryption key is missing");

    return this.decrypt(value, key.value);
  }

  private decrypt(value: ProtoEntry, diaryKey: Uint8Array): Entry {
    const encryptedChange = value.change;
    if (!encryptedChange?.change || !encryptedChange.encryption) {
      throw new Error("entry change is missing");
    }

    const encryptedData = EncryptedData.decode(encryptedChange.change.payload);
    const entityKey = decryptWithSymmetricKey(
      encryptedChange.encryption.encryptedKeyNonce,
      encryptedChange.encryption.encryptedKeyData,
      diaryKey,
    );
    const details = EntryDetails.decode(
      decryptWithSymmetricKey(encryptedData.nonce, encryptedData.data, entityKey),
    );

    return {
      id: value.id,
      diary_id: value.diaryId,
      content: details.content,
      topic_id: value.topicId,
      archived: details.archived,
      bookmarked: details.bookmarked,
      preview_hidden: details.previewHidden,
      created_at: timestampToDate(value.createdAt),
      updated_at: timestampToDate(value.updatedAt),
      deleted_at: optionalTimestampToDate(value.deletedAt),
      removed_at: optionalTimestampToDate(value.removedAt),
    };
  }

  private requireSuccess(action: string, errorCode: ErrorCode): void {
    if (errorCode !== ErrorCode.ERROR_CODE_UNSPECIFIED) {
      throw new Error(`${action} failed: ${ErrorCode[errorCode] ?? errorCode}`);
    }
  }
}
