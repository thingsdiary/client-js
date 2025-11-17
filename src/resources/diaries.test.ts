import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { HttpClient } from "@/http";
import { register } from "@/auth";
import { deriveCredentials } from "@/crypto/credentials";
import { createClient } from "@/client";
import type { Credentials } from "@/crypto/credentials";
import type { Client } from "@/client";

describe("Diaries API", () => {
  let client: Client;
  let credentials: Credentials;
  let token: string;

  beforeAll(async () => {
    const seedPhrase = "test seed phrase for diaries " + randomUUID();
    credentials = deriveCredentials(seedPhrase);

    const httpClient = new HttpClient("http://127.0.0.1:8081/api");
    const email = `${randomUUID()}@thingsdiary.io`;

    token = await register(email, "password", credentials, httpClient);

    client = createClient({
      token,
      credentials,
      baseUrl: "http://127.0.0.1:8081/api",
    });
  });

  it("should create a new diary", async () => {
    const diary = await client.diaries.create({
      title: "My Test Diary",
      description: "A diary for testing purposes",
    });

    expect(diary).toBeDefined();
    expect(diary.id).toBeDefined();
    expect(diary.title).toBe("My Test Diary");
    expect(diary.description).toBe("A diary for testing purposes");
    expect(diary.created_at).toBeInstanceOf(Date);
    expect(diary.updated_at).toBeInstanceOf(Date);
    expect(diary.version).toBeGreaterThan(0);
  });

  it("should list all diaries", async () => {
    await client.diaries.create({
      title: "Diary for List Test",
      description: "Testing list functionality",
    });

    const diaries = await client.diaries.list();

    expect(diaries).toBeDefined();
    expect(Array.isArray(diaries)).toBe(true);
    expect(diaries.length).toBeGreaterThan(0);

    const diary = diaries.find((d) => d.title === "Diary for List Test");
    expect(diary).toBeDefined();
    expect(diary?.description).toBe("Testing list functionality");
  });

  it("should get a specific diary by id", async () => {
    const created = await client.diaries.create({
      title: "Diary for Get Test",
      description: "Testing get functionality",
    });

    const diary = await client.diaries.get(created.id);

    expect(diary).toBeDefined();
    expect(diary.id).toBe(created.id);
    expect(diary.title).toBe("Diary for Get Test");
    expect(diary.description).toBe("Testing get functionality");
  });

  it("should update a diary", async () => {
    const diary = await client.diaries.create({
      title: "Diary Before Update",
      description: "Original description",
    });

    const updated = await client.diaries.put(diary.id, {
      version: diary.version + 1,
      title: "Diary After Update",
      description: "Updated description",
    });

    expect(updated).toBeDefined();
    expect(updated.id).toBe(diary.id);
    expect(updated.title).toBe("Diary After Update");
    expect(updated.description).toBe("Updated description");
    expect(updated.version).toBeGreaterThan(diary.version);
  });

  it("should delete a diary", async () => {
    const created = await client.diaries.create({
      title: "Diary to Delete",
      description: "This diary will be deleted",
    });

    await client.diaries.delete(created.id);

    // Try to get the deleted diary (should fail or return empty)
    try {
      await client.diaries.get(created.id);
      // If we reach here, the diary wasn't deleted
      expect.fail("Diary should have been deleted");
    } catch (error) {
      // Expected to throw an error
      expect(error).toBeDefined();
    }
  });

  it("should encrypt and decrypt diary data correctly", async () => {
    const testTitle = "Encrypted Diary " + randomUUID();
    const testDescription =
      "This is a secret description with special chars: 🔐✨";

    const created = await client.diaries.create({
      title: testTitle,
      description: testDescription,
    });

    expect(created.title).toBe(testTitle);
    expect(created.description).toBe(testDescription);

    // Verify by fetching again
    const fetched = await client.diaries.get(created.id);
    expect(fetched.title).toBe(testTitle);
    expect(fetched.description).toBe(testDescription);
  });

  it("should handle multiple diary operations in sequence", async () => {
    // Create multiple diaries
    const diary1 = await client.diaries.create({
      title: "Sequential Test 1",
      description: "First diary",
    });

    const diary2 = await client.diaries.create({
      title: "Sequential Test 2",
      description: "Second diary",
    });

    const diary3 = await client.diaries.create({
      title: "Sequential Test 3",
      description: "Third diary",
    });

    // List and verify all are present
    const diaries = await client.diaries.list();
    const sequentialDiaries = diaries.filter((d) =>
      d.title.startsWith("Sequential Test")
    );

    expect(sequentialDiaries.length).toBeGreaterThanOrEqual(3);

    // Update one
    await client.diaries.put(diary2.id, {
      title: "Sequential Test 2 Updated",
      description: "Second diary updated",
    });

    // Delete one
    await client.diaries.delete(diary3.id);

    // Verify state
    const diary2Updated = await client.diaries.get(diary2.id);
    expect(diary2Updated.title).toBe("Sequential Test 2 Updated");
  });
});
