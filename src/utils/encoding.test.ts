import { describe, expect, it } from "vitest";
import { bytesToBase64, base64ToBytes } from "./encoding";

describe("Encoding utilities", () => {
  // Golden test data - known base64 encodings to verify compatibility
  const goldenData = [
    {
      description: "empty data",
      bytes: new Uint8Array([]),
      base64: "",
    },
    {
      description: "single byte",
      bytes: new Uint8Array([0]),
      base64: "AA==",
    },
    {
      description: "simple ASCII text 'Hello'",
      bytes: new Uint8Array([72, 101, 108, 108, 111]),
      base64: "SGVsbG8=",
    },
    {
      description: "simple ASCII text 'Hello, World!'",
      bytes: new Uint8Array([
        72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33,
      ]),
      base64: "SGVsbG8sIFdvcmxkIQ==",
    },
    {
      description: "UTF-8 text 'привет' (Russian)",
      bytes: new Uint8Array([
        208, 191, 209, 128, 208, 184, 208, 178, 208, 181, 209, 130,
      ]),
      base64: "0L/RgNC40LLQtdGC",
    },
    {
      description: "UTF-8 text '你好' (Chinese)",
      bytes: new Uint8Array([228, 189, 160, 229, 165, 189]),
      base64: "5L2g5aW9",
    },
    {
      description: "UTF-8 emoji '🔐'",
      bytes: new Uint8Array([240, 159, 148, 144]),
      base64: "8J+UkA==",
    },
    {
      description: "binary data with all byte values 0-255 sample",
      bytes: new Uint8Array([0, 1, 127, 128, 255]),
      base64: "AAF/gP8=",
    },
    {
      description: "JSON string",
      bytes: new Uint8Array(
        JSON.stringify({ key: "value", number: 42 })
          .split("")
          .map((c) => c.charCodeAt(0))
      ),
      base64: "eyJrZXkiOiJ2YWx1ZSIsIm51bWJlciI6NDJ9",
    },
    {
      description: "32 bytes of zeros",
      bytes: new Uint8Array(32),
      base64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    },
    {
      description: "padding test - 1 padding character",
      bytes: new Uint8Array([77, 97, 110]),
      base64: "TWFu",
    },
    {
      description: "padding test - 2 padding characters",
      bytes: new Uint8Array([77, 97]),
      base64: "TWE=",
    },
    {
      description: "the quick brown fox",
      bytes: new Uint8Array(
        "The quick brown fox jumps over the lazy dog"
          .split("")
          .map((c) => c.charCodeAt(0))
      ),
      base64: "VGhlIHF1aWNrIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZw==",
    },
  ];

  describe("bytesToBase64", () => {
    goldenData.forEach(({ description, bytes, base64 }) => {
      it(`should encode ${description} correctly`, () => {
        const result = bytesToBase64(bytes);
        expect(result).toBe(base64);
      });
    });

    it("should handle large data", () => {
      const largeData = new Uint8Array(10000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      const encoded = bytesToBase64(largeData);
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);
    });

    it("should produce valid base64 characters only", () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const result = bytesToBase64(bytes);

      // Valid base64 characters: A-Z, a-z, 0-9, +, /, =
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      expect(result).toMatch(base64Regex);
    });
  });

  describe("base64ToBytes", () => {
    goldenData.forEach(({ description, bytes, base64 }) => {
      it(`should decode ${description} correctly`, () => {
        const result = base64ToBytes(base64);
        expect(result).toEqual(bytes);
      });
    });

    it("should handle large data", () => {
      const largeData = new Uint8Array(10000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }

      const encoded = bytesToBase64(largeData);
      const decoded = base64ToBytes(encoded);

      expect(decoded).toEqual(largeData);
    });

    it("should decode standard base64 test vectors", () => {
      // RFC 4648 test vectors
      expect(base64ToBytes("")).toEqual(new Uint8Array([]));
      expect(base64ToBytes("Zg==")).toEqual(new Uint8Array([102]));
      expect(base64ToBytes("Zm8=")).toEqual(new Uint8Array([102, 111]));
      expect(base64ToBytes("Zm9v")).toEqual(new Uint8Array([102, 111, 111]));
      expect(base64ToBytes("Zm9vYg==")).toEqual(
        new Uint8Array([102, 111, 111, 98])
      );
      expect(base64ToBytes("Zm9vYmE=")).toEqual(
        new Uint8Array([102, 111, 111, 98, 97])
      );
      expect(base64ToBytes("Zm9vYmFy")).toEqual(
        new Uint8Array([102, 111, 111, 98, 97, 114])
      );
    });
  });

  describe("round-trip encoding/decoding", () => {
    it("should preserve data through encode/decode cycle", () => {
      const testCases = [
        new Uint8Array([]),
        new Uint8Array([0]),
        new Uint8Array([255]),
        new Uint8Array([1, 2, 3, 4, 5]),
        new Uint8Array(Array.from({ length: 256 }, (_, i) => i)),
        new Uint8Array([0, 0, 0, 1, 1, 1]),
        new Uint8Array([255, 255, 255, 254, 254, 254]),
      ];

      testCases.forEach((original) => {
        const encoded = bytesToBase64(original);
        const decoded = base64ToBytes(encoded);
        expect(decoded).toEqual(original);
      });
    });

    it("should handle random data", () => {
      for (let i = 0; i < 100; i++) {
        const length = Math.floor(Math.random() * 1000) + 1;
        const randomBytes = new Uint8Array(length);
        for (let j = 0; j < length; j++) {
          randomBytes[j] = Math.floor(Math.random() * 256);
        }

        const encoded = bytesToBase64(randomBytes);
        const decoded = base64ToBytes(encoded);

        expect(decoded).toEqual(randomBytes);
      }
    });

    it("should handle all possible byte values", () => {
      const allBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        allBytes[i] = i;
      }

      const encoded = bytesToBase64(allBytes);
      const decoded = base64ToBytes(encoded);

      expect(decoded).toEqual(allBytes);
    });

    it("should preserve UTF-8 encoded text", () => {
      const texts = [
        "Hello, World!",
        "Привет, мир!",
        "你好，世界！",
        "مرحبا بالعالم",
        "🌍🌎🌏",
        "Test with\nnewlines\tand\ttabs",
        JSON.stringify({ test: "data", nested: { value: 123 } }),
      ];

      texts.forEach((text) => {
        const bytes = new Uint8Array(new TextEncoder().encode(text));
        const encoded = bytesToBase64(bytes);
        const decoded = base64ToBytes(encoded);
        const decodedText = new TextDecoder().decode(decoded);

        expect(decodedText).toBe(text);
      });
    });
  });

  describe("edge cases", () => {
    it("should handle single byte values", () => {
      for (let i = 0; i < 256; i++) {
        const bytes = new Uint8Array([i]);
        const encoded = bytesToBase64(bytes);
        const decoded = base64ToBytes(encoded);
        expect(decoded).toEqual(bytes);
      }
    });

    it("should handle different lengths", () => {
      // Test lengths that result in different padding scenarios
      const lengths = [0, 1, 2, 3, 4, 5, 10, 15, 16, 31, 32, 33, 63, 64, 65];

      lengths.forEach((length) => {
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
          bytes[i] = i % 256;
        }

        const encoded = bytesToBase64(bytes);
        const decoded = base64ToBytes(encoded);
        expect(decoded).toEqual(bytes);
      });
    });

    it("should handle repeated patterns", () => {
      const patterns = [
        new Uint8Array([0, 0, 0, 0]),
        new Uint8Array([255, 255, 255, 255]),
        new Uint8Array([1, 2, 1, 2, 1, 2]),
        new Uint8Array([0, 255, 0, 255]),
      ];

      patterns.forEach((pattern) => {
        const encoded = bytesToBase64(pattern);
        const decoded = base64ToBytes(encoded);
        expect(decoded).toEqual(pattern);
      });
    });
  });

  describe("compatibility with crypto operations", () => {
    it("should work with encryption keys", () => {
      // Simulate a 32-byte encryption key
      const key = new Uint8Array(32);
      crypto.getRandomValues(key);

      const encoded = bytesToBase64(key);
      const decoded = base64ToBytes(encoded);

      expect(decoded).toEqual(key);
      expect(decoded.length).toBe(32);
    });

    it("should work with nonces", () => {
      // Simulate a 12-byte nonce (common for AES-GCM)
      const nonce = new Uint8Array(12);
      crypto.getRandomValues(nonce);

      const encoded = bytesToBase64(nonce);
      const decoded = base64ToBytes(encoded);

      expect(decoded).toEqual(nonce);
      expect(decoded.length).toBe(12);
    });

    it("should work with ciphertext", () => {
      // Simulate encrypted data
      const ciphertext = new Uint8Array(1000);
      crypto.getRandomValues(ciphertext);

      const encoded = bytesToBase64(ciphertext);
      const decoded = base64ToBytes(encoded);

      expect(decoded).toEqual(ciphertext);
      expect(decoded.length).toBe(1000);
    });
  });
});
