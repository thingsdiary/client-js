import { describe, expect, it } from "vitest";
import { signBytes, verifySignature } from "@/crypto/signature";
import { ed25519 } from "@noble/curves/ed25519.js";
import { randomBytes } from "@noble/ciphers/utils.js";

// Helper function to generate random private key (Ed25519 private key is 32 bytes)
function randomPrivateKey(): Uint8Array {
  return randomBytes(32);
}

describe("Signature utilities", () => {
  // Golden test data - known Ed25519 signatures for compatibility verification
  // These test vectors are from RFC 8032 (Ed25519 specification)
  const goldenData = [
    {
      description: "RFC 8032 Test 1 - empty message",
      privateKey: new Uint8Array([
        0x9d, 0x61, 0xb1, 0x9d, 0xef, 0xfd, 0x5a, 0x60, 0xba, 0x84, 0x4a, 0xf4,
        0x92, 0xec, 0x2c, 0xc4, 0x44, 0x49, 0xc5, 0x69, 0x7b, 0x32, 0x69, 0x19,
        0x70, 0x3b, 0xac, 0x03, 0x1c, 0xae, 0x7f, 0x60,
      ]),
      publicKey: new Uint8Array([
        0xd7, 0x5a, 0x98, 0x01, 0x82, 0xb1, 0x0a, 0xb7, 0xd5, 0x4b, 0xfe, 0xd3,
        0xc9, 0x64, 0x07, 0x3a, 0x0e, 0xe1, 0x72, 0xf3, 0xda, 0xa6, 0x23, 0x25,
        0xaf, 0x02, 0x1a, 0x68, 0xf7, 0x07, 0x51, 0x1a,
      ]),
      message: new Uint8Array([]),
      signature: new Uint8Array([
        0xe5, 0x56, 0x43, 0x00, 0xc3, 0x60, 0xac, 0x72, 0x90, 0x86, 0xe2, 0xcc,
        0x80, 0x6e, 0x82, 0x8a, 0x84, 0x87, 0x7f, 0x1e, 0xb8, 0xe5, 0xd9, 0x74,
        0xd8, 0x73, 0xe0, 0x65, 0x22, 0x49, 0x01, 0x55, 0x5f, 0xb8, 0x82, 0x15,
        0x90, 0xa3, 0x3b, 0xac, 0xc6, 0x1e, 0x39, 0x70, 0x1c, 0xf9, 0xb4, 0x6b,
        0xd2, 0x5b, 0xf5, 0xf0, 0x59, 0x5b, 0xbe, 0x24, 0x65, 0x51, 0x41, 0x43,
        0x8e, 0x7a, 0x10, 0x0b,
      ]),
    },
    {
      description: "RFC 8032 Test 2 - single byte message",
      privateKey: new Uint8Array([
        0x4c, 0xcd, 0x08, 0x9b, 0x28, 0xff, 0x96, 0xda, 0x9d, 0xb6, 0xc3, 0x46,
        0xec, 0x11, 0x4e, 0x0f, 0x5b, 0x8a, 0x31, 0x9f, 0x35, 0xab, 0xa6, 0x24,
        0xda, 0x8c, 0xf6, 0xed, 0x4f, 0xb8, 0xa6, 0xfb,
      ]),
      publicKey: new Uint8Array([
        0x3d, 0x40, 0x17, 0xc3, 0xe8, 0x43, 0x89, 0x5a, 0x92, 0xb7, 0x0a, 0xa7,
        0x4d, 0x1b, 0x7e, 0xbc, 0x9c, 0x98, 0x2c, 0xcf, 0x2e, 0xc4, 0x96, 0x8c,
        0xc0, 0xcd, 0x55, 0xf1, 0x2a, 0xf4, 0x66, 0x0c,
      ]),
      message: new Uint8Array([0x72]),
      signature: new Uint8Array([
        0x92, 0xa0, 0x09, 0xa9, 0xf0, 0xd4, 0xca, 0xb8, 0x72, 0x0e, 0x82, 0x0b,
        0x5f, 0x64, 0x25, 0x40, 0xa2, 0xb2, 0x7b, 0x54, 0x16, 0x50, 0x3f, 0x8f,
        0xb3, 0x76, 0x22, 0x23, 0xeb, 0xdb, 0x69, 0xda, 0x08, 0x5a, 0xc1, 0xe4,
        0x3e, 0x15, 0x99, 0x6e, 0x45, 0x8f, 0x36, 0x13, 0xd0, 0xf1, 0x1d, 0x8c,
        0x38, 0x7b, 0x2e, 0xae, 0xb4, 0x30, 0x2a, 0xee, 0xb0, 0x0d, 0x29, 0x16,
        0x12, 0xbb, 0x0c, 0x00,
      ]),
    },
    {
      description: "RFC 8032 Test 3 - two byte message",
      privateKey: new Uint8Array([
        0xc5, 0xaa, 0x8d, 0xf4, 0x3f, 0x9f, 0x83, 0x7b, 0xed, 0xb7, 0x44, 0x2f,
        0x31, 0xdc, 0xb7, 0xb1, 0x66, 0xd3, 0x85, 0x35, 0x07, 0x6f, 0x09, 0x4b,
        0x85, 0xce, 0x3a, 0x2e, 0x0b, 0x44, 0x58, 0xf7,
      ]),
      publicKey: new Uint8Array([
        0xfc, 0x51, 0xcd, 0x8e, 0x62, 0x18, 0xa1, 0xa3, 0x8d, 0xa4, 0x7e, 0xd0,
        0x02, 0x30, 0xf0, 0x58, 0x08, 0x16, 0xed, 0x13, 0xba, 0x33, 0x03, 0xac,
        0x5d, 0xeb, 0x91, 0x15, 0x48, 0x90, 0x80, 0x25,
      ]),
      message: new Uint8Array([0xaf, 0x82]),
      signature: new Uint8Array([
        0x62, 0x91, 0xd6, 0x57, 0xde, 0xec, 0x24, 0x02, 0x48, 0x27, 0xe6, 0x9c,
        0x3a, 0xbe, 0x01, 0xa3, 0x0c, 0xe5, 0x48, 0xa2, 0x84, 0x74, 0x3a, 0x44,
        0x5e, 0x36, 0x80, 0xd7, 0xdb, 0x5a, 0xc3, 0xac, 0x18, 0xff, 0x9b, 0x53,
        0x8d, 0x16, 0xf2, 0x90, 0xae, 0x67, 0xf7, 0x60, 0x98, 0x4d, 0xc6, 0x59,
        0x4a, 0x7c, 0x15, 0xe9, 0x71, 0x6e, 0xd2, 0x8d, 0xc0, 0x27, 0xbe, 0xce,
        0xea, 0x1e, 0xc4, 0x0a,
      ]),
    },
  ];

  describe("signBytes", () => {
    goldenData.forEach(
      ({ description, privateKey, message, signature: expectedSignature }) => {
        it(`should produce correct signature for ${description}`, () => {
          const signature = signBytes(message, privateKey);
          expect(signature).toEqual(expectedSignature);
        });
      }
    );

    it("should produce deterministic signatures", () => {
      const privateKey = randomPrivateKey();
      const message = new Uint8Array([1, 2, 3, 4, 5]);

      const sig1 = signBytes(message, privateKey);
      const sig2 = signBytes(message, privateKey);

      expect(sig1).toEqual(sig2);
    });

    it("should produce 64-byte signatures", () => {
      const privateKey = randomPrivateKey();
      const message = new Uint8Array([1, 2, 3]);

      const signature = signBytes(message, privateKey);

      expect(signature.length).toBe(64);
    });

    it("should handle different message sizes", () => {
      const privateKey = randomPrivateKey();
      const sizes = [0, 1, 16, 32, 64, 128, 256, 1024, 10000];

      sizes.forEach((size) => {
        const message = new Uint8Array(size);
        crypto.getRandomValues(message);

        const signature = signBytes(message, privateKey);

        expect(signature).toBeDefined();
        expect(signature.length).toBe(64);
      });
    });

    it("should produce different signatures for different messages", () => {
      const privateKey = randomPrivateKey();
      const message1 = new Uint8Array([1, 2, 3]);
      const message2 = new Uint8Array([1, 2, 4]);

      const sig1 = signBytes(message1, privateKey);
      const sig2 = signBytes(message2, privateKey);

      expect(sig1).not.toEqual(sig2);
    });

    it("should produce different signatures for different private keys", () => {
      const privateKey1 = randomPrivateKey();
      const privateKey2 = randomPrivateKey();
      const message = new Uint8Array([1, 2, 3]);

      const sig1 = signBytes(message, privateKey1);
      const sig2 = signBytes(message, privateKey2);

      expect(sig1).not.toEqual(sig2);
    });

    it("should handle empty message", () => {
      const privateKey = randomPrivateKey();
      const message = new Uint8Array([]);

      const signature = signBytes(message, privateKey);

      expect(signature).toBeDefined();
      expect(signature.length).toBe(64);
    });

    it("should handle large messages", () => {
      const privateKey = randomPrivateKey();
      const largeMessage = new Uint8Array(65000); // Close to crypto.getRandomValues limit
      crypto.getRandomValues(largeMessage);

      const signature = signBytes(largeMessage, privateKey);

      expect(signature).toBeDefined();
      expect(signature.length).toBe(64);
    });

    it("should handle JSON data", () => {
      const privateKey = randomPrivateKey();
      const jsonData = JSON.stringify({
        user: "test",
        data: { value: 123 },
        timestamp: Date.now(),
      });
      const message = new TextEncoder().encode(jsonData);

      const signature = signBytes(message, privateKey);

      expect(signature).toBeDefined();
      expect(signature.length).toBe(64);
    });
  });

  describe("verifySignature", () => {
    goldenData.forEach(({ description, publicKey, message, signature }) => {
      it(`should verify correct signature for ${description}`, () => {
        const isValid = verifySignature(message, signature, publicKey);
        expect(isValid).toBe(true);
      });
    });

    it("should verify signatures created by signBytes", () => {
      const privateKey = randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);
      const message = new Uint8Array([1, 2, 3, 4, 5]);

      const signature = signBytes(message, privateKey);
      const isValid = verifySignature(message, signature, publicKey);

      expect(isValid).toBe(true);
    });

    it("should reject invalid signature", () => {
      const privateKey = randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);
      const message = new Uint8Array([1, 2, 3, 4, 5]);

      const signature = signBytes(message, privateKey);
      // Tamper with signature
      signature[0] ^= 1;

      const isValid = verifySignature(message, signature, publicKey);

      expect(isValid).toBe(false);
    });

    it("should reject signature with modified message", () => {
      const privateKey = randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);
      const message = new Uint8Array([1, 2, 3, 4, 5]);

      const signature = signBytes(message, privateKey);

      // Try to verify with different message
      const modifiedMessage = new Uint8Array([1, 2, 3, 4, 6]);
      const isValid = verifySignature(modifiedMessage, signature, publicKey);

      expect(isValid).toBe(false);
    });

    it("should reject signature with wrong public key", () => {
      const privateKey1 = randomPrivateKey();
      const privateKey2 = randomPrivateKey();
      const publicKey2 = ed25519.getPublicKey(privateKey2);
      const message = new Uint8Array([1, 2, 3, 4, 5]);

      const signature = signBytes(message, privateKey1);
      const isValid = verifySignature(message, signature, publicKey2);

      expect(isValid).toBe(false);
    });

    it("should handle empty message verification", () => {
      const privateKey = randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);
      const message = new Uint8Array([]);

      const signature = signBytes(message, privateKey);
      const isValid = verifySignature(message, signature, publicKey);

      expect(isValid).toBe(true);
    });

    it("should handle large message verification", () => {
      const privateKey = randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);
      const largeMessage = new Uint8Array(65000);
      crypto.getRandomValues(largeMessage);

      const signature = signBytes(largeMessage, privateKey);
      const isValid = verifySignature(largeMessage, signature, publicKey);

      expect(isValid).toBe(true);
    });

    it("should detect single bit flip in signature", () => {
      const privateKey = randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);
      const message = new Uint8Array([1, 2, 3, 4, 5]);

      const signature = signBytes(message, privateKey);

      // Test flipping each bit in the signature
      for (let byteIndex = 0; byteIndex < signature.length; byteIndex++) {
        for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
          const tamperedSignature = new Uint8Array(signature);
          tamperedSignature[byteIndex] ^= 1 << bitIndex;

          const isValid = verifySignature(
            message,
            tamperedSignature,
            publicKey
          );
          expect(isValid).toBe(false);
        }
      }
    });

    it("should verify JSON data", () => {
      const privateKey = randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);
      const jsonData = JSON.stringify({
        user: "test",
        data: { value: 123 },
        timestamp: Date.now(),
      });
      const message = new TextEncoder().encode(jsonData);

      const signature = signBytes(message, privateKey);
      const isValid = verifySignature(message, signature, publicKey);

      expect(isValid).toBe(true);
    });
  });

  describe("sign/verify integration", () => {
    it("should work with multiple messages", () => {
      const privateKey = randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);

      const messages = [
        new Uint8Array([]),
        new Uint8Array([1]),
        new Uint8Array([1, 2, 3, 4, 5]),
        new Uint8Array(Array.from({ length: 100 }, (_, i) => i % 256)),
        new TextEncoder().encode("Hello, World!"),
        new TextEncoder().encode("Привет, мир!"),
        new TextEncoder().encode("🔐🔑"),
      ];

      messages.forEach((message) => {
        const signature = signBytes(message, privateKey);
        const isValid = verifySignature(message, signature, publicKey);
        expect(isValid).toBe(true);
      });
    });

    it("should maintain security with random data", () => {
      for (let i = 0; i < 50; i++) {
        const privateKey = randomPrivateKey();
        const publicKey = ed25519.getPublicKey(privateKey);

        const messageLength = Math.floor(Math.random() * 1000) + 1;
        const message = new Uint8Array(messageLength);
        crypto.getRandomValues(message);

        const signature = signBytes(message, privateKey);
        const isValid = verifySignature(message, signature, publicKey);

        expect(isValid).toBe(true);
      }
    });

    it("should handle multiple signatures on same message", () => {
      const message = new Uint8Array([1, 2, 3, 4, 5]);

      for (let i = 0; i < 10; i++) {
        const privateKey = randomPrivateKey();
        const publicKey = ed25519.getPublicKey(privateKey);

        const signature = signBytes(message, privateKey);
        const isValid = verifySignature(message, signature, publicKey);

        expect(isValid).toBe(true);
      }
    });

    it("should verify that signature from one key does not verify with another", () => {
      const privateKey1 = randomPrivateKey();
      const publicKey1 = ed25519.getPublicKey(privateKey1);

      const privateKey2 = randomPrivateKey();
      const publicKey2 = ed25519.getPublicKey(privateKey2);

      const message = new Uint8Array([1, 2, 3, 4, 5]);

      const signature1 = signBytes(message, privateKey1);
      const signature2 = signBytes(message, privateKey2);

      // Signature 1 should verify with public key 1
      expect(verifySignature(message, signature1, publicKey1)).toBe(true);
      // But not with public key 2
      expect(verifySignature(message, signature1, publicKey2)).toBe(false);

      // Signature 2 should verify with public key 2
      expect(verifySignature(message, signature2, publicKey2)).toBe(true);
      // But not with public key 1
      expect(verifySignature(message, signature2, publicKey1)).toBe(false);
    });

    it("should handle real-world API request signing scenario", () => {
      const privateKey = randomPrivateKey();
      const publicKey = ed25519.getPublicKey(privateKey);

      // Simulate an API request
      const request = {
        method: "POST",
        path: "/api/diaries",
        body: {
          title: "My Diary",
          description: "A test diary",
        },
        timestamp: Date.now(),
      };

      const requestJson = JSON.stringify(request);
      const message = new TextEncoder().encode(requestJson);

      // Sign the request
      const signature = signBytes(message, privateKey);

      // Verify on the server side
      const isValid = verifySignature(message, signature, publicKey);

      expect(isValid).toBe(true);

      // Simulate request tampering
      const tamperedRequest = {
        ...request,
        body: { ...request.body, title: "Hacked" },
      };
      const tamperedMessage = new TextEncoder().encode(
        JSON.stringify(tamperedRequest)
      );

      const isTamperedValid = verifySignature(
        tamperedMessage,
        signature,
        publicKey
      );

      expect(isTamperedValid).toBe(false);
    });
  });
});
