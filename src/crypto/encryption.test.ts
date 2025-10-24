import { describe, it, expect } from "vitest";
import {
  generateSymmetricKey,
  encryptWithSymmetricKey,
  decryptWithSymmetricKey,
  encryptWithPublicKey,
  decryptWithPrivateKey,
} from "@/crypto/encryption";
import { generateKeyPair } from "@stablelib/nacl";
import { randomBytes } from "@noble/ciphers/utils.js";

function generateLargeRandomData(size: number): Uint8Array {
  const data = new Uint8Array(size);
  const chunkSize = 65536;

  for (let i = 0; i < size; i += chunkSize) {
    const chunk = randomBytes(Math.min(chunkSize, size - i));
    data.set(chunk, i);
  }

  return data;
}

describe("Encryption", () => {
  describe("generateSymmetricKey", () => {
    it("should generate a 32-byte key", () => {
      const key = generateSymmetricKey();
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });

    it("should generate different keys each time", () => {
      const key1 = generateSymmetricKey();
      const key2 = generateSymmetricKey();
      expect(key1).not.toEqual(key2);
    });
  });

  describe("Symmetric encryption", () => {
    it("should encrypt and decrypt data correctly", () => {
      const key = generateSymmetricKey();
      const data = new TextEncoder().encode("Hello, World!");

      const { nonce, ciphertext } = encryptWithSymmetricKey(data, key);

      expect(nonce).toBeInstanceOf(Uint8Array);
      expect(nonce.length).toBe(12);
      expect(ciphertext).toBeInstanceOf(Uint8Array);
      expect(ciphertext.length).toBeGreaterThan(0);

      const decrypted = decryptWithSymmetricKey(nonce, ciphertext, key);
      expect(decrypted).toEqual(data);

      const decryptedText = new TextDecoder().decode(decrypted);
      expect(decryptedText).toBe("Hello, World!");
    });

    it("should fail to decrypt with wrong key", () => {
      const key1 = generateSymmetricKey();
      const key2 = generateSymmetricKey();
      const data = new TextEncoder().encode("Secret message");

      const { nonce, ciphertext } = encryptWithSymmetricKey(data, key1);

      expect(() => decryptWithSymmetricKey(nonce, ciphertext, key2)).toThrow();
    });

    it("should produce different ciphertext for same data", () => {
      const key = generateSymmetricKey();
      const data = new TextEncoder().encode("Same data");

      const result1 = encryptWithSymmetricKey(data, key);
      const result2 = encryptWithSymmetricKey(data, key);

      // Nonces should be different
      expect(result1.nonce).not.toEqual(result2.nonce);

      // Ciphertexts should be different due to different nonces
      expect(result1.ciphertext).not.toEqual(result2.ciphertext);
    });
  });

  describe("Public key encryption", () => {
    it("should encrypt and decrypt with public/private key pair", () => {
      const keyPair = generateKeyPair();
      const data = new TextEncoder().encode("Confidential data");

      const encrypted = encryptWithPublicKey(data, keyPair.publicKey);

      expect(encrypted).toBeInstanceOf(Uint8Array);

      // length of ephemeral key + ciphertext = 32
      expect(encrypted.length).toBeGreaterThan(32);

      const decrypted = decryptWithPrivateKey(
        encrypted,
        keyPair.secretKey,
        keyPair.publicKey
      );

      expect(decrypted).toEqual(data);

      const decryptedText = new TextDecoder().decode(decrypted);
      expect(decryptedText).toBe("Confidential data");
    });

    it("should fail to decrypt with wrong private key", () => {
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();
      const data = new TextEncoder().encode("Secret");

      const encrypted = encryptWithPublicKey(data, keyPair1.publicKey);

      expect(() =>
        decryptWithPrivateKey(encrypted, keyPair2.secretKey, keyPair2.publicKey)
      ).toThrow("Failed to decrypt");
    });

    it("should throw error for invalid sealed box format", () => {
      const keyPair = generateKeyPair();
      const invalidData = new Uint8Array(10); // Too short

      expect(() =>
        decryptWithPrivateKey(invalidData, keyPair.secretKey, keyPair.publicKey)
      ).toThrow("Invalid sealed box: too short");
    });

    it("should produce different ciphertext each time (ephemeral keys)", () => {
      const keyPair = generateKeyPair();
      const data = new TextEncoder().encode("Same plaintext");

      const encrypted1 = encryptWithPublicKey(data, keyPair.publicKey);
      const encrypted2 = encryptWithPublicKey(data, keyPair.publicKey);

      // Should be different due to different ephemeral keys
      expect(encrypted1).not.toEqual(encrypted2);

      // But both should decrypt to the same data
      const decrypted1 = decryptWithPrivateKey(
        encrypted1,
        keyPair.secretKey,
        keyPair.publicKey
      );
      const decrypted2 = decryptWithPrivateKey(
        encrypted2,
        keyPair.secretKey,
        keyPair.publicKey
      );

      expect(decrypted1).toEqual(data);
      expect(decrypted2).toEqual(data);
    });
  });

  it("should handle large data with symmetric encryption", () => {
    const size = 1 * 1024 * 1024;
    const key = generateSymmetricKey();
    const largeData = generateLargeRandomData(size);

    const { nonce, ciphertext } = encryptWithSymmetricKey(largeData, key);

    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(ciphertext.length).toBeGreaterThan(0);

    const decrypted = decryptWithSymmetricKey(nonce, ciphertext, key);

    expect(decrypted).toEqual(largeData);
    expect(decrypted.length).toBe(size);
  });
});
