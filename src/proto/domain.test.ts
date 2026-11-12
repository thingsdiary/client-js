import { describe, expect, it } from "vitest";
import { DiaryDetails } from "./diary";
import { EntryDetails, EntryPreview } from "./entry";
import { EncryptedEntry } from "./encrypted_entry";
import { EncryptedTemplate } from "./encrypted_template";
import { EncryptedTopic } from "./encrypted_topic";
import { TopicDetails } from "./topic";
import { TemplateDetails } from "./template";

// The Go and Swift SDK tests use the same wire vectors.
describe("domain payload wire format", () => {
  const entry = { content: "Hello 🌍", archived: true, bookmarked: false, previewHidden: true };

  function check<T>(codec: { encode(value: T): { finish(): Uint8Array }; decode(bytes: Uint8Array): T }, value: T, hex: string) {
    const wire = Uint8Array.from(Buffer.from(hex, "hex"));
    expect(codec.encode(value).finish()).toEqual(wire);
    expect(codec.decode(wire)).toEqual(value);
  }

  it("serializes diary details", () => {
    check(DiaryDetails, { title: "Diary", description: "Личное" }, "0a054469617279120cd09bd0b8d187d0bdd0bed0b5");
  });

  it("serializes entry details and preview", () => {
    check(EntryDetails, entry, "0a0a48656c6c6f20f09f8c8d10012001");
    check(EntryPreview, entry, "0a0a48656c6c6f20f09f8c8d10012001");
  });

  it("serializes topic details", () => {
    check(TopicDetails, { title: "Topic", description: "", color: "#123456", entryPreviewable: undefined }, "0a05546f7069631a0723313233343536");
  });

  it("serializes template details", () => {
    check(TemplateDetails, { content: "Line 1\nLine 2" }, "0a0d4c696e6520310a4c696e652032");
  });
});

it.each([EncryptedEntry, EncryptedTopic, EncryptedTemplate])(
  "preserves absent and present encrypted resource timestamps",
  ({ decode }) => {
    // Field 6 is absent and field 7 contains a Timestamp of one second.
    const decoded = decode(Uint8Array.of(0x3a, 0x02, 0x08, 0x01));
    expect(decoded.deletedAt).toBeUndefined();
    expect(decoded.removedAt).toEqual({ seconds: 1n, nanos: 0 });
  },
);
