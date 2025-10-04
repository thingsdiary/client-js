import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { HttpClient } from "@/http";
import { register } from "@/auth";
import { deriveCredentials } from "@/crypto/credentials";
import { createClient } from "@/client";
import type { Credentials } from "@/crypto/credentials";
import type { Client } from "@/client";

describe("Entries API", () => {
  let client: Client;
  let credentials: Credentials;
  let token: string;
  let diaryId: string;

  beforeAll(async () => {
    const seedPhrase = "test seed phrase for entries " + randomUUID();
    credentials = deriveCredentials(seedPhrase);

    const httpClient = new HttpClient("http://127.0.0.1:8080/api/v1");
    const email = `${randomUUID()}@thingsdiary.io`;

    token = await register(email, "password", credentials, httpClient);

    client = createClient({
      token,
      credentials,
      baseUrl: "http://127.0.0.1:8080/api/v1",
    });

    const diary = await client.diaries.create({
      title: "Test Diary for Entries",
      description: "This diary is used for testing entries",
    });
    diaryId = diary.id;
  });

  it("should create a new entry", async () => {
    const entry = await client.entries.create(diaryId, {
      content: "This is my first test entry",
    });

    expect(entry).toBeDefined();
    expect(entry.id).toBeDefined();
    expect(entry.diary_id).toBe(diaryId);
    expect(entry.content).toBe("This is my first test entry");
    expect(entry.topic_id).toBeFalsy();
    expect(entry.archived).toBe(false);
    expect(entry.bookmarked).toBe(false);
    expect(entry.preview_hidden).toBe(false);
    expect(entry.created_at).toBeInstanceOf(Date);
    expect(entry.updated_at).toBeInstanceOf(Date);
    expect(entry.version).toBeGreaterThan(0);
  });

  it("should list all entries", async () => {
    await client.entries.create(diaryId, {
      content: "Entry for List Test",
    });

    const result = await client.entries.list(diaryId);

    expect(result).toBeDefined();
    expect(result.entries).toBeDefined();
    expect(Array.isArray(result.entries)).toBe(true);
    expect(result.entries.length).toBeGreaterThan(0);

    const entry = result.entries.find(
      (e) => e.content === "Entry for List Test"
    );
    expect(entry).toBeDefined();
    expect(entry?.diary_id).toBe(diaryId);
  });

  it("should get a specific entry by id", async () => {
    const created = await client.entries.create(diaryId, {
      content: "Entry for Get Test",
    });

    const entry = await client.entries.get(diaryId, created.id);

    expect(entry).toBeDefined();
    expect(entry.id).toBe(created.id);
    expect(entry.diary_id).toBe(diaryId);
    expect(entry.content).toBe("Entry for Get Test");
  });

  it("should update an entry", async () => {
    const entry = await client.entries.create(diaryId, {
      content: "Entry Before Update",
    });

    const updated = await client.entries.put(diaryId, entry.id, {
      content: "Entry After Update",
    });

    expect(updated).toBeDefined();
    expect(updated.id).toBe(entry.id);
    expect(updated.content).toBe("Entry After Update");
    expect(updated.version).toBeGreaterThan(entry.version);
  });

  it("should delete an entry", async () => {
    const created = await client.entries.create(diaryId, {
      content: "Entry to Delete",
    });

    await client.entries.delete(diaryId, created.id);

    try {
      await client.entries.get(diaryId, created.id);
      expect.fail("Entry should have been deleted");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should encrypt and decrypt entry data correctly", async () => {
    const testContent =
      "Encrypted entry content with special chars: 📝✨🔐\nMultiline content\n\twith tabs and unicode: 你好世界";

    const created = await client.entries.create(diaryId, {
      content: testContent,
    });

    expect(created.content).toBe(testContent);

    const fetched = await client.entries.get(diaryId, created.id);
    expect(fetched.content).toBe(testContent);
  });

  it("should create an entry with archived flag", async () => {
    const entry = await client.entries.create(diaryId, {
      content: "Archived entry",
      archived: true,
    });

    expect(entry.archived).toBe(true);
    expect(entry.bookmarked).toBe(false);
    expect(entry.preview_hidden).toBe(false);

    const fetched = await client.entries.get(diaryId, entry.id);
    expect(fetched.archived).toBe(true);
  });

  it("should create an entry with bookmarked flag", async () => {
    const entry = await client.entries.create(diaryId, {
      content: "Bookmarked entry",
      bookmarked: true,
    });

    expect(entry.bookmarked).toBe(true);
    expect(entry.archived).toBe(false);
    expect(entry.preview_hidden).toBe(false);

    const fetched = await client.entries.get(diaryId, entry.id);
    expect(fetched.bookmarked).toBe(true);
  });

  it("should create an entry with preview_hidden flag", async () => {
    const entry = await client.entries.create(diaryId, {
      content: "Entry with hidden preview",
      preview_hidden: true,
    });

    expect(entry.preview_hidden).toBe(true);
    expect(entry.archived).toBe(false);
    expect(entry.bookmarked).toBe(false);

    const fetched = await client.entries.get(diaryId, entry.id);
    expect(fetched.preview_hidden).toBe(true);
  });

  it("should create an entry with all flags enabled", async () => {
    const entry = await client.entries.create(diaryId, {
      content: "Entry with all flags",
      archived: true,
      bookmarked: true,
      preview_hidden: true,
    });

    expect(entry.archived).toBe(true);
    expect(entry.bookmarked).toBe(true);
    expect(entry.preview_hidden).toBe(true);
  });

  it("should update entry flags", async () => {
    const entry = await client.entries.create(diaryId, {
      content: "Entry for flag updates",
      archived: false,
      bookmarked: false,
    });

    expect(entry.archived).toBe(false);
    expect(entry.bookmarked).toBe(false);

    const updated = await client.entries.put(diaryId, entry.id, {
      content: "Entry for flag updates",
      archived: true,
      bookmarked: true,
    });

    expect(updated.archived).toBe(true);
    expect(updated.bookmarked).toBe(true);
  });

  it("should create an entry in a topic", async () => {
    const topic = await client.topics.create(diaryId, {
      title: "Test Topic for Entry",
      description: "Topic to test entry association",
      color: "#FF5733",
    });

    const entry = await client.entries.create(diaryId, {
      content: "Entry in a topic",
      topic_id: topic.id,
    });

    expect(entry).toBeDefined();
    expect(entry.topic_id).toBe(topic.id);
    expect(entry.content).toBe("Entry in a topic");

    const fetched = await client.entries.get(diaryId, entry.id);
    expect(fetched.topic_id).toBe(topic.id);
  });

  it("should move entry between topics", async () => {
    const topic1 = await client.topics.create(diaryId, {
      title: "First Topic",
      description: "First topic",
      color: "#111111",
    });

    const topic2 = await client.topics.create(diaryId, {
      title: "Second Topic",
      description: "Second topic",
      color: "#222222",
    });

    const entry = await client.entries.create(diaryId, {
      content: "Entry to move between topics",
      topic_id: topic1.id,
    });

    expect(entry.topic_id).toBe(topic1.id);

    const updated = await client.entries.put(diaryId, entry.id, {
      content: "Entry to move between topics",
      topic_id: topic2.id,
    });

    expect(updated.topic_id).toBe(topic2.id);

    const fetched = await client.entries.get(diaryId, entry.id);
    expect(fetched.topic_id).toBe(topic2.id);
  });

  it("should remove topic from entry", async () => {
    const topic = await client.topics.create(diaryId, {
      title: "Topic to Remove",
      description: "Topic to be removed from entry",
      color: "#333333",
    });

    const entry = await client.entries.create(diaryId, {
      content: "Entry with topic to remove",
      topic_id: topic.id,
    });

    expect(entry.topic_id).toBe(topic.id);

    const updated = await client.entries.put(diaryId, entry.id, {
      content: "Entry with topic to remove",
      topic_id: null,
    });

    expect(updated.topic_id).toBeFalsy();

    const fetched = await client.entries.get(diaryId, entry.id);
    expect(fetched.topic_id).toBeFalsy();
  });

  it("should filter entries by topic", async () => {
    const topic1 = await client.topics.create(diaryId, {
      title: "Topic for Filtering 1",
      description: "First filtering topic",
      color: "#AA0000",
    });

    const topic2 = await client.topics.create(diaryId, {
      title: "Topic for Filtering 2",
      description: "Second filtering topic",
      color: "#00AA00",
    });

    await client.entries.create(diaryId, {
      content: "Entry in topic 1 - item A",
      topic_id: topic1.id,
    });

    await client.entries.create(diaryId, {
      content: "Entry in topic 1 - item B",
      topic_id: topic1.id,
    });

    await client.entries.create(diaryId, {
      content: "Entry in topic 2",
      topic_id: topic2.id,
    });

    await client.entries.create(diaryId, {
      content: "Entry without topic",
    });

    const allEntries = await client.entries.list(diaryId);

    const topic1Entries = allEntries.entries.filter(
      (e) => e.topic_id === topic1.id
    );
    const topic2Entries = allEntries.entries.filter(
      (e) => e.topic_id === topic2.id
    );
    const noTopicEntries = allEntries.entries.filter((e) => !e.topic_id);

    expect(topic1Entries.length).toBeGreaterThanOrEqual(2);
    expect(topic2Entries.length).toBeGreaterThanOrEqual(1);
    expect(noTopicEntries.length).toBeGreaterThan(0);
  });

  it("should handle entries with different content types", async () => {
    const emptyEntry = await client.entries.create(diaryId, {
      content: "",
    });
    expect(emptyEntry.content).toBe("");

    const longContent = "A".repeat(50000);
    const longEntry = await client.entries.create(diaryId, {
      content: longContent,
    });
    expect(longEntry.content).toBe(longContent);

    const jsonContent = JSON.stringify({
      type: "note",
      data: { title: "Test", items: ["item1", "item2"] },
    });
    const jsonEntry = await client.entries.create(diaryId, {
      content: jsonContent,
    });
    expect(jsonEntry.content).toBe(jsonContent);

    const markdownContent = `# Heading\n\n## Subheading\n\n- Item 1\n- Item 2\n\n**Bold** and *italic*`;
    const markdownEntry = await client.entries.create(diaryId, {
      content: markdownContent,
    });
    expect(markdownEntry.content).toBe(markdownContent);
  });

  it("should handle entries in different diaries", async () => {
    const diary2 = await client.diaries.create({
      title: "Second Test Diary",
      description: "Another diary for entries",
    });

    const entry1 = await client.entries.create(diaryId, {
      content: "Entry in Diary 1",
    });

    const entry2 = await client.entries.create(diary2.id, {
      content: "Entry in Diary 2",
    });

    expect(entry1.diary_id).toBe(diaryId);
    expect(entry2.diary_id).toBe(diary2.id);

    const diary1Entries = await client.entries.list(diaryId);
    const diary2Entries = await client.entries.list(diary2.id);

    const diary1HasEntry1 = diary1Entries.entries.some(
      (e) => e.id === entry1.id
    );
    const diary2HasEntry2 = diary2Entries.entries.some(
      (e) => e.id === entry2.id
    );

    expect(diary1HasEntry1).toBe(true);
    expect(diary2HasEntry2).toBe(true);

    const diary2HasEntry1 = diary2Entries.entries.some(
      (e) => e.id === entry1.id
    );
    expect(diary2HasEntry1).toBe(false);
  });

  it("should handle complex entry with topic and all flags", async () => {
    const topic = await client.topics.create(diaryId, {
      title: "Complex Test Topic",
      description: "Topic for complex entry test",
      color: "#ABCDEF",
    });

    const entry = await client.entries.create(diaryId, {
      content:
        "Complex entry with everything\n\nMultiple lines\nEmojis: 🎉🎨\nUnicode: 测试",
      topic_id: topic.id,
      archived: true,
      bookmarked: true,
      preview_hidden: true,
    });

    expect(entry.topic_id).toBe(topic.id);
    expect(entry.archived).toBe(true);
    expect(entry.bookmarked).toBe(true);
    expect(entry.preview_hidden).toBe(true);

    const fetched = await client.entries.get(diaryId, entry.id);
    expect(fetched.topic_id).toBe(topic.id);
    expect(fetched.archived).toBe(true);
    expect(fetched.bookmarked).toBe(true);
    expect(fetched.preview_hidden).toBe(true);
    expect(fetched.content).toBe(entry.content);
  });

  it("should handle multiple entry operations in sequence", async () => {
    const topic = await client.topics.create(diaryId, {
      title: "Sequential Topic",
      description: "Topic for sequential tests",
      color: "#444444",
    });

    const entry1 = await client.entries.create(diaryId, {
      content: "Sequential Entry 1",
      topic_id: topic.id,
    });

    const entry2 = await client.entries.create(diaryId, {
      content: "Sequential Entry 2",
    });

    const entry3 = await client.entries.create(diaryId, {
      content: "Sequential Entry 3",
      bookmarked: true,
    });

    const result = await client.entries.list(diaryId);
    const sequentialEntries = result.entries.filter((e) =>
      e.content.startsWith("Sequential Entry")
    );

    expect(sequentialEntries.length).toBeGreaterThanOrEqual(3);

    await client.entries.put(diaryId, entry2.id, {
      content: "Sequential Entry 2 Updated",
      archived: true,
    });

    await client.entries.delete(diaryId, entry3.id);

    const entry2Updated = await client.entries.get(diaryId, entry2.id);
    expect(entry2Updated.content).toBe("Sequential Entry 2 Updated");
    expect(entry2Updated.archived).toBe(true);
  });
});
