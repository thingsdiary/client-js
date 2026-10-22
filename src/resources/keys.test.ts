import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "@/client";
import { newTestClient } from "@/testing/client";

describe("Keys API", () => {
  let client: Client;

  beforeAll(async () => {
    client = await newTestClient();
  });

  afterAll(() => client.close());

  it("should list all encryption keys for a diary", async () => {
    // Create a diary first
    const diary = await client.diaries.create({
      title: "Diary for Keys List Test",
      description: "Testing list keys functionality",
    });

    // Get all keys
    const keys = await client.keys.list(diary.id);

    expect(keys).toBeDefined();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);

    // Verify key structure
    const key = keys[0];
    expect(key.id).toBeDefined();
    expect(key.value).toBeInstanceOf(Uint8Array);
    expect(key.status).toBeDefined();
    expect(["active", "rotating"]).toContain(key.status);

    // Clean up
    await client.diaries.delete(diary.id);
  });

  it("should get active encryption key for a diary", async () => {
    // Create a diary
    const diary = await client.diaries.create({
      title: "Diary for GetActive Test",
      description: "Testing getActive functionality",
    });

    // Get active key
    const activeKey = await client.keys.getActive(diary.id);

    expect(activeKey).toBeDefined();
    expect(activeKey.id).toBeDefined();
    expect(activeKey.value).toBeInstanceOf(Uint8Array);
    expect(activeKey.status).toBe("active");

    // Clean up
    await client.diaries.delete(diary.id);
  });

  it("should return not found when getting keys for deleted diary", async () => {
    // Create a diary
    const diary = await client.diaries.create({
      title: "Diary to Delete for Keys Test",
      description: "This diary will be deleted",
    });

    // Verify we can get keys
    const keysBeforeDelete = await client.keys.list(diary.id);
    expect(keysBeforeDelete.length).toBeGreaterThan(0);

    // Delete the diary
    await client.diaries.delete(diary.id);

    await expect(client.keys.list(diary.id)).rejects.toMatchObject({
      code: 1004,
      message: "resource not found",
      temporary: false,
    });
  });

  it("should return not found when getting active key for deleted diary", async () => {
    // Create a diary
    const diary = await client.diaries.create({
      title: "Diary to Delete for GetActive Test",
      description: "This diary will be deleted",
    });

    // Verify we can get active key
    const keyBeforeDelete = await client.keys.getActive(diary.id);
    expect(keyBeforeDelete).toBeDefined();

    // Delete the diary
    await client.diaries.delete(diary.id);

    await expect(client.keys.getActive(diary.id)).rejects.toMatchObject({
      code: 1004,
      message: "resource not found",
      temporary: false,
    });
  });

  it("should decrypt keys correctly", async () => {
    // Create a diary
    const diary = await client.diaries.create({
      title: "Diary for Key Decryption Test",
      description: "Testing key decryption",
    });

    // Get keys using both methods
    const allKeys = await client.keys.list(diary.id);
    const activeKey = await client.keys.getActive(diary.id);

    // Active key should be in the list of all keys
    const foundKey = allKeys.find((k) => k.id === activeKey.id);
    expect(foundKey).toBeDefined();
    expect(foundKey?.status).toBe("active");

    // Keys should be decrypted (Uint8Array with non-zero length)
    expect(activeKey.value.length).toBeGreaterThan(0);
    expect(foundKey?.value.length).toBeGreaterThan(0);

    // The values should be equal
    expect(activeKey.value).toEqual(foundKey?.value);

    // Clean up
    await client.diaries.delete(diary.id);
  });
});
