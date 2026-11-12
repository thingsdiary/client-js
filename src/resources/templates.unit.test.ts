import { describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/proto/errors";
import type { RealtimeClient } from "@/realtime";
import type { KeysAPI } from "@/resources/keys";
import { TemplatesAPI } from "@/resources/templates";

describe("Templates DAG mutations", () => {
  it("appends the canonical change when deleting a template", async () => {
    const rpc = vi.fn(async (method: string, request: Record<string, unknown>) => {
      if (method === "io.thingsdiary.v1.template.get") {
        return {
          template: {
            id: "template-1",
            diaryId: "diary-1",
            change: {
              change: {
                id: "head-1",
                objectId: "template-1",
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
        templateId: "template-1",
        encryptedChange: {
          change: {
            objectId: "template-1",
            parentChangeIds: ["head-1"],
            payload: new Uint8Array([1, 2, 3]),
          },
        },
      });
      return { errorCode: ErrorCode.ERROR_CODE_UNSPECIFIED };
    });
    const templates = new TemplatesAPI({ rpc } as unknown as RealtimeClient, {} as KeysAPI);

    await templates.delete("diary-1", "template-1");

    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
