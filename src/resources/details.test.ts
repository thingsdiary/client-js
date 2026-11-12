import { describe, expect, it } from "vitest";
import { decryptWithSymmetricKey, generateSymmetricKey } from "@/crypto/encryption";
import { DiaryDetails } from "@/proto/diary";
import { EntryDetails } from "@/proto/entry";
import { TopicDetails } from "@/proto/topic";
import { TemplateDetails } from "@/proto/template";
import { decryptDetails, encryptDetails } from "./details";

describe("encrypted protobuf payloads", () => {
  function check<T>(
    value: T,
    codec: { encode(value: T): { finish(): Uint8Array }; decode(data: Uint8Array): T },
    hex: string,
  ) {
    const diaryKey = generateSymmetricKey();
    const encrypted = encryptDetails(value, diaryKey, "key-1", codec);
    const plaintext = decryptWithSymmetricKey(
      encrypted.details.nonce,
      encrypted.details.data,
      encrypted.key,
    );
    expect(Buffer.from(plaintext).toString("hex")).toBe(hex);
    expect(decryptDetails(encrypted, diaryKey, codec)).toEqual(value);
  }

  it("encrypts diary protobuf bytes with Unicode", () => {
    check(
      { title: "Diary", description: "Личное" },
      DiaryDetails,
      "0a054469617279120cd09bd0b8d187d0bdd0bed0b5",
    );
  });

  it("encrypts entry details with true and false flags", () => {
    const value = { content: "Hello 🌍", archived: true, bookmarked: false, previewHidden: true };
    check(value, EntryDetails, "0a0a48656c6c6f20f09f8c8d10012001");
  });

  it("preserves explicit false in optional topic fields", () => {
    check({ title: "", description: "", color: "", entryPreviewable: false }, TopicDetails, "2000");
  });

  it("encrypts template protobuf bytes", () => {
    check({ content: "Line 1\nLine 2" }, TemplateDetails, "0a0d4c696e6520310a4c696e652032");
  });

  it("supports empty protobuf payloads", () => {
    check({ title: "", description: "" }, DiaryDetails, "");
    check(
      { content: "", archived: false, bookmarked: false, previewHidden: false },
      EntryDetails,
      "",
    );
    check({ title: "", description: "", color: "", entryPreviewable: undefined }, TopicDetails, "");
    check({ content: "" }, TemplateDetails, "");
  });
});
