import { describe, expect, it } from "vitest";
import { deriveCredentials, generateSalt } from "@/crypto/credentials";

describe("Credentials", () => {
  const testSalt = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";

  it("should derive correct key sizes", () => {
    const seedPhrase = "test seed phrase";
    const credentials = deriveCredentials(seedPhrase, testSalt);

    expect(credentials.encryptionPublicKey).toBeInstanceOf(Uint8Array);
    expect(credentials.encryptionPublicKey.length).toBe(32);

    expect(credentials.encryptionPrivateKey).toBeInstanceOf(Uint8Array);
    expect(credentials.encryptionPrivateKey.length).toBe(32);

    expect(credentials.signingPublicKey).toBeInstanceOf(Uint8Array);
    expect(credentials.signingPublicKey.length).toBe(32);

    expect(credentials.signingPrivateKey).toBeInstanceOf(Uint8Array);
    expect(credentials.signingPrivateKey.length).toBe(32);
  });

  it("should derive deterministic keys from same seed and salt", () => {
    const seedPhrase = "test seed phrase";
    const creds1 = deriveCredentials(seedPhrase, testSalt);
    const creds2 = deriveCredentials(seedPhrase, testSalt);

    expect(creds1.encryptionPublicKey).toEqual(creds2.encryptionPublicKey);
    expect(creds1.encryptionPrivateKey).toEqual(creds2.encryptionPrivateKey);
    expect(creds1.signingPublicKey).toEqual(creds2.signingPublicKey);
    expect(creds1.signingPrivateKey).toEqual(creds2.signingPrivateKey);
  });

  it("should derive different keys from different seeds", () => {
    const creds1 = deriveCredentials("seed1", testSalt);
    const creds2 = deriveCredentials("seed2", testSalt);

    expect(creds1.encryptionPublicKey).not.toEqual(creds2.encryptionPublicKey);
    expect(creds1.signingPublicKey).not.toEqual(creds2.signingPublicKey);
  });

  it("should derive different keys from different salts", () => {
    const seedPhrase = "test seed phrase";
    const salt1 = "salt1ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const salt2 = "salt2ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const creds1 = deriveCredentials(seedPhrase, salt1);
    const creds2 = deriveCredentials(seedPhrase, salt2);

    expect(creds1.encryptionPublicKey).not.toEqual(creds2.encryptionPublicKey);
    expect(creds1.signingPublicKey).not.toEqual(creds2.signingPublicKey);
  });
});

describe("generateSalt", () => {
  it("should generate salt of default length (32)", () => {
    const salt = generateSalt();
    expect(salt.length).toBe(32);
  });

  it("should generate salt of custom length", () => {
    const salt = generateSalt(64);
    expect(salt.length).toBe(64);
  });

  it("should generate ASCII-safe characters only", () => {
    const salt = generateSalt();
    const validChars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (const char of salt) {
      expect(validChars).toContain(char);
    }
  });

  it("should generate unique salts", () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).not.toEqual(salt2);
  });
});
