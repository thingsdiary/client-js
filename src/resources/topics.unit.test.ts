import { describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/proto/errors";
import type { RealtimeClient } from "@/realtime";
import type { KeysAPI } from "@/resources/keys";
import { TopicsAPI } from "@/resources/topics";

describe("Topics DAG mutations", () => {
  it("appends the canonical change when deleting a topic", async () => {
    const rpc = vi.fn(async (method: string, request: Record<string, unknown>) => {
      if (method === "io.thingsdiary.v1.topic.get") {
        return {
          topic: {
            id: "topic-1",
            diaryId: "diary-1",
            change: {
              change: {
                id: "head-1",
                objectId: "topic-1",
                parentChangeIds: [],
                payload: new Uint8Array([1, 2, 3]),
              },
              encryption: {
                diaryKeyId: "key-1",
                encryptedKeyNonce: new Uint8Array([4]),
                encryptedKeyData: new Uint8Array([5]),
              },
            },
          },
        };
      }

      expect(request).toMatchObject({
        diaryId: "diary-1",
        topicId: "topic-1",
        encryptedChange: {
          change: {
            objectId: "topic-1",
            parentChangeIds: ["head-1"],
            payload: new Uint8Array([1, 2, 3]),
          },
        },
      });
      return { errorCode: ErrorCode.ERROR_CODE_UNSPECIFIED };
    });
    const topics = new TopicsAPI(
      { rpc } as unknown as RealtimeClient,
      {} as KeysAPI,
    );

    await topics.delete("diary-1", "topic-1");

    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("reports that cascading entry deletion needs entry changes", async () => {
    const rpc = vi.fn(async (method: string) => {
      if (method === "io.thingsdiary.v1.topic.get") {
        return {
          topic: {
            id: "topic-1",
            diaryId: "diary-1",
            change: {
              change: { id: "head-1", objectId: "topic-1", parentChangeIds: [], payload: new Uint8Array() },
              encryption: { diaryKeyId: "key-1", encryptedKeyNonce: new Uint8Array(), encryptedKeyData: new Uint8Array() },
            },
          },
        };
      }

      return { errorCode: ErrorCode.ERROR_CODE_FAILED_PRECONDITION };
    });
    const topics = new TopicsAPI(
      { rpc } as unknown as RealtimeClient,
      {} as KeysAPI,
    );

    await expect(
      topics.delete("diary-1", "topic-1", { deleteEntries: true }),
    ).rejects.toThrow("deleting topic entries requires encrypted entry changes");
  });
});
