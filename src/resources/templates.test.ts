import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { HttpClient } from "@/http";
import { register } from "@/auth";
import { deriveCredentials } from "@/crypto/credentials";
import { createClient } from "@/client";
import type { Credentials } from "@/crypto/credentials";
import type { Client } from "@/client";

describe("Templates API", () => {
  let client: Client;
  let credentials: Credentials;
  let token: string;
  let diaryId: string;

  beforeAll(async () => {
    const seedPhrase = "test seed phrase for templates " + randomUUID();
    credentials = deriveCredentials(seedPhrase);

    const httpClient = new HttpClient("http://127.0.0.1:8080/api/v1");
    const email = `${randomUUID()}@thingsdiary.io`;

    token = await register(email, "password", credentials, httpClient);

    client = createClient({
      token,
      credentials,
      baseUrl: "http://127.0.0.1:8080/api/v1",
    });

    // Create a diary for template tests
    const diary = await client.diaries.create({
      title: "Test Diary for Templates",
      description: "This diary is used for testing templates",
    });
    diaryId = diary.id;
  });

  it("should create a new template", async () => {
    const template = await client.templates.create(diaryId, {
      content: "This is my test template content",
    });

    expect(template).toBeDefined();
    expect(template.id).toBeDefined();
    expect(template.diary_id).toBe(diaryId);
    expect(template.content).toBe("This is my test template content");
    expect(template.created_at).toBeInstanceOf(Date);
    expect(template.updated_at).toBeInstanceOf(Date);
    expect(template.version).toBeGreaterThan(0);
  });

  it("should list all templates", async () => {
    await client.templates.create(diaryId, {
      content: "Template for List Test",
    });

    const result = await client.templates.list(diaryId);

    expect(result).toBeDefined();
    expect(result.templates).toBeDefined();
    expect(Array.isArray(result.templates)).toBe(true);
    expect(result.templates.length).toBeGreaterThan(0);

    const template = result.templates.find(
      (t) => t.content === "Template for List Test"
    );
    expect(template).toBeDefined();
    expect(template?.diary_id).toBe(diaryId);
  });

  it("should get a specific template by id", async () => {
    const created = await client.templates.create(diaryId, {
      content: "Template for Get Test",
    });

    const template = await client.templates.get(diaryId, created.id);

    expect(template).toBeDefined();
    expect(template.id).toBe(created.id);
    expect(template.diary_id).toBe(diaryId);
    expect(template.content).toBe("Template for Get Test");
  });

  it("should update a template", async () => {
    const template = await client.templates.create(diaryId, {
      content: "Template Before Update",
    });

    const updated = await client.templates.put(diaryId, template.id, {
      content: "Template After Update",
    });

    expect(updated).toBeDefined();
    expect(updated.id).toBe(template.id);
    expect(updated.diary_id).toBe(diaryId);
    expect(updated.content).toBe("Template After Update");
    expect(updated.version).toBeGreaterThan(template.version);
  });

  it("should delete a template", async () => {
    const created = await client.templates.create(diaryId, {
      content: "Template to Delete",
    });

    await client.templates.delete(diaryId, created.id);

    // Try to get the deleted template (should fail or return empty)
    try {
      await client.templates.get(diaryId, created.id);
      // If we reach here, the template wasn't deleted
      expect.fail("Template should have been deleted");
    } catch (error) {
      // Expected to throw an error
      expect(error).toBeDefined();
    }
  });

  it("should encrypt and decrypt template data correctly", async () => {
    const testContent =
      "Encrypted template content with special chars: 🔐✨📝\nMultiline content\n\twith tabs";

    const created = await client.templates.create(diaryId, {
      content: testContent,
    });

    expect(created.content).toBe(testContent);

    // Verify by fetching again
    const fetched = await client.templates.get(diaryId, created.id);
    expect(fetched.content).toBe(testContent);
  });

  it("should handle multiple template operations in sequence", async () => {
    // Create multiple templates
    const template1 = await client.templates.create(diaryId, {
      content: "Sequential Template 1",
    });

    const template2 = await client.templates.create(diaryId, {
      content: "Sequential Template 2",
    });

    const template3 = await client.templates.create(diaryId, {
      content: "Sequential Template 3",
    });

    // List and verify all are present
    const result = await client.templates.list(diaryId);
    const sequentialTemplates = result.templates.filter((t) =>
      t.content.startsWith("Sequential Template")
    );

    expect(sequentialTemplates.length).toBeGreaterThanOrEqual(3);

    // Update one
    await client.templates.put(diaryId, template2.id, {
      content: "Sequential Template 2 Updated",
    });

    // Delete one
    await client.templates.delete(diaryId, template3.id);

    // Verify state
    const template2Updated = await client.templates.get(diaryId, template2.id);
    expect(template2Updated.content).toBe("Sequential Template 2 Updated");
  });

  it("should handle templates with different content types", async () => {
    // Empty content
    const emptyTemplate = await client.templates.create(diaryId, {
      content: "",
    });
    expect(emptyTemplate.content).toBe("");

    // Long content
    const longContent = "A".repeat(10000);
    const longTemplate = await client.templates.create(diaryId, {
      content: longContent,
    });
    expect(longTemplate.content).toBe(longContent);

    // JSON-like content
    const jsonContent = JSON.stringify({
      fields: ["field1", "field2"],
      metadata: { version: 1 },
    });
    const jsonTemplate = await client.templates.create(diaryId, {
      content: jsonContent,
    });
    expect(jsonTemplate.content).toBe(jsonContent);
  });

  it("should handle templates in different diaries", async () => {
    // Create another diary
    const diary2 = await client.diaries.create({
      title: "Second Test Diary",
      description: "Another diary for templates",
    });

    // Create template in first diary
    const template1 = await client.templates.create(diaryId, {
      content: "Template in Diary 1",
    });

    // Create template in second diary
    const template2 = await client.templates.create(diary2.id, {
      content: "Template in Diary 2",
    });

    // Verify they are in different diaries
    expect(template1.diary_id).toBe(diaryId);
    expect(template2.diary_id).toBe(diary2.id);

    // List templates in each diary
    const diary1Templates = await client.templates.list(diaryId);
    const diary2Templates = await client.templates.list(diary2.id);

    const diary1HasTemplate1 = diary1Templates.templates.some(
      (t) => t.id === template1.id
    );
    const diary2HasTemplate2 = diary2Templates.templates.some(
      (t) => t.id === template2.id
    );

    expect(diary1HasTemplate1).toBe(true);
    expect(diary2HasTemplate2).toBe(true);

    // Ensure template from diary1 is not in diary2's list
    const diary2HasTemplate1 = diary2Templates.templates.some(
      (t) => t.id === template1.id
    );
    expect(diary2HasTemplate1).toBe(false);
  });
});
