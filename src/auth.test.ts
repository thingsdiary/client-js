import { describe, expect, it } from "vitest";
import { HttpClient } from "@/http";
import { login, register } from "@/auth";
import { deriveCredentials } from "@/crypto/credentials";
import { randomUUID } from "node:crypto";

describe("Auth resource", () => {
  it("should register a new user", async () => {
    const seedPhrase = "test seed phrase for user " + randomUUID();
    const credentials = deriveCredentials(seedPhrase);

    const httpClient = new HttpClient("http://127.0.0.1:8080/api/v1");
    const email = `${randomUUID()}@thingsdiary.io`;

    // Register new user
    const token = await register(email, "password", credentials, httpClient);

    expect(token).toBeDefined();

    // Login with same credentials
    const loginToken = await login(email, "password", credentials, httpClient);

    expect(loginToken).toBeDefined();
  });
});
