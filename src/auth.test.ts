import { describe, expect, it } from "vitest";
import { HttpClient } from "@/http";
import { login, register } from "@/auth";
import { deriveCredentials, generateSalt } from "@/crypto/credentials";
import { randomUUID } from "node:crypto";

describe("Auth resource", () => {
  it("should register a new user", async () => {
    const seedPhrase = "test seed phrase for user " + randomUUID();
    const kdfSalt = generateSalt();
    const credentials = deriveCredentials(seedPhrase, kdfSalt);

    const httpClient = new HttpClient("http://127.0.0.1:8081/api");
    const email = `${randomUUID()}@thingsdiary.io`;

    // Register new user
    const token = await register(
      email,
      "password",
      credentials,
      kdfSalt,
      httpClient
    );

    expect(token).toBeDefined();

    // Login with same credentials (server returns kdf_salt)
    const loginToken = await login(email, "password", seedPhrase, httpClient);

    expect(loginToken).toBeDefined();
  });
});
