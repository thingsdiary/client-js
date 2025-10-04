import { describe, expect, it } from "vitest";
import { deriveCredentials } from "@/crypto/credentials";

describe("Credentials", () => {
  it("should derive correct key sizes", () => {
    const seedPhrase = "test seed phrase";
    const credentials = deriveCredentials(seedPhrase);

    expect(credentials.encryptionPublicKey).toBeInstanceOf(Uint8Array);
    expect(credentials.encryptionPublicKey.length).toBe(32);

    expect(credentials.encryptionPrivateKey).toBeInstanceOf(Uint8Array);
    expect(credentials.encryptionPrivateKey.length).toBe(32);

    expect(credentials.signingPublicKey).toBeInstanceOf(Uint8Array);
    expect(credentials.signingPublicKey.length).toBe(32);

    expect(credentials.signingPrivateKey).toBeInstanceOf(Uint8Array);
    expect(credentials.signingPrivateKey.length).toBe(32);
  });

  it("should derive deterministic keys from same seed", () => {
    const seedPhrase = "test seed phrase";
    const creds1 = deriveCredentials(seedPhrase);
    const creds2 = deriveCredentials(seedPhrase);

    expect(creds1.encryptionPublicKey).toEqual(creds2.encryptionPublicKey);
    expect(creds1.encryptionPrivateKey).toEqual(creds2.encryptionPrivateKey);
    expect(creds1.signingPublicKey).toEqual(creds2.signingPublicKey);
    expect(creds1.signingPrivateKey).toEqual(creds2.signingPrivateKey);
  });

  it("should derive different keys from different seeds", () => {
    const creds1 = deriveCredentials("seed1");
    const creds2 = deriveCredentials("seed2");

    expect(creds1.encryptionPublicKey).not.toEqual(creds2.encryptionPublicKey);
    expect(creds1.signingPublicKey).not.toEqual(creds2.signingPublicKey);
  });
});
