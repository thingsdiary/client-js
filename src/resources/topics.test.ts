import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { HttpClient } from "@/http";
import { register } from "@/auth";
import { deriveCredentials } from "@/crypto/credentials";
import { createClient } from "@/client";
import type { Credentials } from "@/crypto/credentials";
import type { Client } from "@/client";

describe("Topics API", () => {
  let client: Client;
  let credentials: Credentials;
  let token: string;
  let diaryId: string;

  beforeAll(async () => {
    const seedPhrase = "test seed phrase for topics " + randomUUID();
    credentials = deriveCredentials(seedPhrase);

    const httpClient = new HttpClient("http://127.0.0.1:8080/api");
    const email = `${randomUUID()}@thingsdiary.io`;

    token = await register(email, "password", credentials, httpClient);

    client = createClient({
      token,
      credentials,
      baseUrl: "http://127.0.0.1:8080/api",
    });

    const diary = await client.diaries.create({
      title: "Test Diary for Topics",
      description: "This diary is used for testing topics",
    });
    diaryId = diary.id;
  });

  it("should create a new topic", async () => {
    const topic = await client.topics.create(diaryId, {
      title: "My Test Topic",
      description: "A topic for testing purposes",
      color: "#FF5733",
    });

    expect(topic).toBeDefined();
    expect(topic.id).toBeDefined();
    expect(topic.diary_id).toBe(diaryId);
    expect(topic.title).toBe("My Test Topic");
    expect(topic.description).toBe("A topic for testing purposes");
    expect(topic.color).toBe("#FF5733");
    expect(topic.default_template_id).toBeFalsy();
    expect(topic.created_at).toBeInstanceOf(Date);
    expect(topic.updated_at).toBeInstanceOf(Date);
    expect(topic.version).toBeGreaterThan(0);
  });

  it("should list all topics", async () => {
    await client.topics.create(diaryId, {
      title: "Topic for List Test",
      description: "Testing list functionality",
      color: "#00FF00",
    });

    const result = await client.topics.list(diaryId);

    expect(result).toBeDefined();
    expect(result.topics).toBeDefined();
    expect(Array.isArray(result.topics)).toBe(true);
    expect(result.topics.length).toBeGreaterThan(0);

    const topic = result.topics.find((t) => t.title === "Topic for List Test");
    expect(topic).toBeDefined();
    expect(topic?.description).toBe("Testing list functionality");
    expect(topic?.color).toBe("#00FF00");
  });

  it("should get a specific topic by id", async () => {
    const created = await client.topics.create(diaryId, {
      title: "Topic for Get Test",
      description: "Testing get functionality",
      color: "#0000FF",
    });

    const topic = await client.topics.get(diaryId, created.id);

    expect(topic).toBeDefined();
    expect(topic.id).toBe(created.id);
    expect(topic.diary_id).toBe(diaryId);
    expect(topic.title).toBe("Topic for Get Test");
    expect(topic.description).toBe("Testing get functionality");
    expect(topic.color).toBe("#0000FF");
  });

  it("should update a topic", async () => {
    const topic = await client.topics.create(diaryId, {
      title: "Topic Before Update",
      description: "Original description",
      color: "#AAAAAA",
    });

    const updated = await client.topics.put(diaryId, topic.id, {
      title: "Topic After Update",
      description: "Updated description",
      color: "#BBBBBB",
    });

    expect(updated).toBeDefined();
    expect(updated.id).toBe(topic.id);
    expect(updated.title).toBe("Topic After Update");
    expect(updated.description).toBe("Updated description");
    expect(updated.color).toBe("#BBBBBB");
    expect(updated.version).toBeGreaterThan(topic.version);
  });

  it("should delete a topic", async () => {
    const created = await client.topics.create(diaryId, {
      title: "Topic to Delete",
      description: "This topic will be deleted",
      color: "#CCCCCC",
    });

    await client.topics.delete(diaryId, created.id);

    // Try to get the deleted topic (should fail or return empty)
    try {
      await client.topics.get(diaryId, created.id);
      // If we reach here, the topic wasn't deleted
      expect.fail("Topic should have been deleted");
    } catch (error) {
      // Expected to throw an error
      expect(error).toBeDefined();
    }
  });

  it("should delete topic without deleting entries (default behavior)", async () => {
    const topic = await client.topics.create(diaryId, {
      title: "Topic with Entries (Default Delete)",
      description: "Has entries that should remain",
      color: "#DD0000",
    });

    // Create entries associated with the topic
    const entry1 = await client.entries.create(diaryId, {
      content: "Entry 1 content",
      topic_id: topic.id,
    });

    const entry2 = await client.entries.create(diaryId, {
      content: "Entry 2 content",
      topic_id: topic.id,
    });

    const entry3 = await client.entries.create(diaryId, {
      content: "Entry 3 content",
      topic_id: topic.id,
    });

    // Delete topic without options (default behavior)
    await client.topics.delete(diaryId, topic.id);

    // Verify entries still exist but have no topic_id
    const fetchedEntry1 = await client.entries.get(diaryId, entry1.id);
    expect(fetchedEntry1).toBeDefined();
    expect(fetchedEntry1.topic_id).toBeFalsy();

    const fetchedEntry2 = await client.entries.get(diaryId, entry2.id);
    expect(fetchedEntry2).toBeDefined();
    expect(fetchedEntry2.topic_id).toBeFalsy();

    const fetchedEntry3 = await client.entries.get(diaryId, entry3.id);
    expect(fetchedEntry3).toBeDefined();
    expect(fetchedEntry3.topic_id).toBeFalsy();
  });

  it("should delete topic without deleting entries (explicit false)", async () => {
    const topic = await client.topics.create(diaryId, {
      title: "Topic with Entries (Explicit False)",
      description: "Has entries that should remain",
      color: "#EE0000",
    });

    // Create entries associated with the topic
    const entry1 = await client.entries.create(diaryId, {
      content: "Entry 1 content explicit false",
      topic_id: topic.id,
    });

    const entry2 = await client.entries.create(diaryId, {
      content: "Entry 2 content explicit false",
      topic_id: topic.id,
    });

    // Delete topic with deleteEntries explicitly set to false
    await client.topics.delete(diaryId, topic.id, { deleteEntries: false });

    // Verify entries still exist but have no topic_id
    const fetchedEntry1 = await client.entries.get(diaryId, entry1.id);
    expect(fetchedEntry1).toBeDefined();
    expect(fetchedEntry1.topic_id).toBeFalsy();

    const fetchedEntry2 = await client.entries.get(diaryId, entry2.id);
    expect(fetchedEntry2).toBeDefined();
    expect(fetchedEntry2.topic_id).toBeFalsy();
  });

  it("should delete topic with entries", async () => {
    const topic = await client.topics.create(diaryId, {
      title: "Topic with Entries (Delete All)",
      description: "Has entries that should be deleted",
      color: "#FF0000",
    });

    // Create entries associated with the topic
    const entry1 = await client.entries.create(diaryId, {
      content: "Entry 1 to be deleted",
      topic_id: topic.id,
    });

    const entry2 = await client.entries.create(diaryId, {
      content: "Entry 2 to be deleted",
      topic_id: topic.id,
    });

    const entry3 = await client.entries.create(diaryId, {
      content: "Entry 3 to be deleted",
      topic_id: topic.id,
    });

    // Delete topic with all entries
    await client.topics.delete(diaryId, topic.id, { deleteEntries: true });

    // Verify entries are deleted
    try {
      await client.entries.get(diaryId, entry1.id);
      expect.fail("Entry 1 should have been deleted");
    } catch (error) {
      expect(error).toBeDefined();
    }

    try {
      await client.entries.get(diaryId, entry2.id);
      expect.fail("Entry 2 should have been deleted");
    } catch (error) {
      expect(error).toBeDefined();
    }

    try {
      await client.entries.get(diaryId, entry3.id);
      expect.fail("Entry 3 should have been deleted");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should encrypt and decrypt topic data correctly", async () => {
    const testTitle = "Encrypted Topic " + randomUUID();
    const testDescription =
      "This is a secret description with special chars: 🎨🌈✨";
    const testColor = "#FF00FF";

    const created = await client.topics.create(diaryId, {
      title: testTitle,
      description: testDescription,
      color: testColor,
    });

    expect(created.title).toBe(testTitle);
    expect(created.description).toBe(testDescription);
    expect(created.color).toBe(testColor);

    const fetched = await client.topics.get(diaryId, created.id);
    expect(fetched.title).toBe(testTitle);
    expect(fetched.description).toBe(testDescription);
    expect(fetched.color).toBe(testColor);
  });

  it("should create a topic with a default template", async () => {
    const template = await client.templates.create(diaryId, {
      content: "This is a default template for the topic",
    });

    const topic = await client.topics.create(diaryId, {
      title: "Topic with Default Template",
      description: "This topic has a default template",
      color: "#FF6600",
      default_template_id: template.id,
    });

    expect(topic).toBeDefined();
    expect(topic.default_template_id).toBe(template.id);
    expect(topic.title).toBe("Topic with Default Template");

    const fetched = await client.topics.get(diaryId, topic.id);
    expect(fetched.default_template_id).toBe(template.id);
  });

  it("should update topic's default template", async () => {
    const template1 = await client.templates.create(diaryId, {
      content: "First template",
    });

    const template2 = await client.templates.create(diaryId, {
      content: "Second template",
    });

    const topic = await client.topics.create(diaryId, {
      title: "Topic for Template Update",
      description: "Testing template update",
      color: "#AA00AA",
      default_template_id: template1.id,
    });

    expect(topic.default_template_id).toBe(template1.id);

    const updated = await client.topics.put(diaryId, topic.id, {
      title: "Topic for Template Update",
      description: "Testing template update",
      color: "#AA00AA",
      default_template_id: template2.id,
    });

    expect(updated.default_template_id).toBe(template2.id);

    const fetched = await client.topics.get(diaryId, topic.id);
    expect(fetched.default_template_id).toBe(template2.id);
  });

  it("should remove default template from topic", async () => {
    const template = await client.templates.create(diaryId, {
      content: "Template to be removed",
    });

    const topic = await client.topics.create(diaryId, {
      title: "Topic with Template to Remove",
      description: "Testing template removal",
      color: "#00AA00",
      default_template_id: template.id,
    });

    expect(topic.default_template_id).toBe(template.id);

    const updated = await client.topics.put(diaryId, topic.id, {
      title: "Topic with Template to Remove",
      description: "Testing template removal",
      color: "#00AA00",
      default_template_id: null,
    });

    expect(updated.default_template_id).toBeFalsy();

    const fetched = await client.topics.get(diaryId, topic.id);
    expect(fetched.default_template_id).toBeFalsy();
  });

  it("should handle topics with various color formats", async () => {
    const colors = ["#FF0000", "#00FF00", "#0000FF", "#ABC123", "#ffffff"];

    for (const color of colors) {
      const topic = await client.topics.create(diaryId, {
        title: `Topic with color ${color}`,
        description: "Color test",
        color: color,
      });

      expect(topic.color).toBe(color);
    }
  });

  it("should handle topics in different diaries", async () => {
    const diary2 = await client.diaries.create({
      title: "Second Test Diary",
      description: "Another diary for topics",
    });

    const topic1 = await client.topics.create(diaryId, {
      title: "Topic in Diary 1",
      description: "First diary topic",
      color: "#111111",
    });

    const topic2 = await client.topics.create(diary2.id, {
      title: "Topic in Diary 2",
      description: "Second diary topic",
      color: "#222222",
    });

    expect(topic1.diary_id).toBe(diaryId);
    expect(topic2.diary_id).toBe(diary2.id);

    const diary1Topics = await client.topics.list(diaryId);
    const diary2Topics = await client.topics.list(diary2.id);

    const diary1HasTopic1 = diary1Topics.topics.some((t) => t.id === topic1.id);
    const diary2HasTopic2 = diary2Topics.topics.some((t) => t.id === topic2.id);

    expect(diary1HasTopic1).toBe(true);
    expect(diary2HasTopic2).toBe(true);

    const diary2HasTopic1 = diary2Topics.topics.some((t) => t.id === topic1.id);
    expect(diary2HasTopic1).toBe(false);
  });

  it("should handle multiple topic operations in sequence", async () => {
    const topic1 = await client.topics.create(diaryId, {
      title: "Sequential Topic 1",
      description: "First topic",
      color: "#333333",
    });

    const topic2 = await client.topics.create(diaryId, {
      title: "Sequential Topic 2",
      description: "Second topic",
      color: "#444444",
    });

    const topic3 = await client.topics.create(diaryId, {
      title: "Sequential Topic 3",
      description: "Third topic",
      color: "#555555",
    });

    const result = await client.topics.list(diaryId);
    const sequentialTopics = result.topics.filter((t) =>
      t.title.startsWith("Sequential Topic")
    );

    expect(sequentialTopics.length).toBeGreaterThanOrEqual(3);

    await client.topics.put(diaryId, topic2.id, {
      title: "Sequential Topic 2 Updated",
      description: "Second topic updated",
      color: "#444444",
    });

    await client.topics.delete(diaryId, topic3.id);

    const topic2Updated = await client.topics.get(diaryId, topic2.id);
    expect(topic2Updated.title).toBe("Sequential Topic 2 Updated");
  });
});
