export function bytesToBase64(bytes: Uint8Array): string {
  // Fast path for Node.js / environments that provide Buffer.
  // (Browsers обычно сюда не попадают, если только Buffer не полифилится отдельно.)
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return Buffer.from(bytes).toString("base64");
  }

  return base64FromBytes(bytes);
}

export function base64ToBytes(base64: string): Uint8Array {
  // Fast path for Node.js / environments that provide Buffer.
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  return bytesFromBase64(base64);
}

// ---------------------------------------------------------------------------
// Browser-safe (and generally portable) Base64 implementation.
//
// Motivation:
// - Avoid `String.fromCharCode(...bytes)` which can throw on large arrays
//   (argument limit / stack size) and creates huge intermediate strings.
// - Avoid `binary.split("").map(...)` which is very allocation-heavy.
//
// This implementation is adapted from the widely-used approach in base64-js:
// it works in any JS runtime without relying on atob/btoa and is safe for
// large payload sizes.
// ---------------------------------------------------------------------------

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BASE64_LOOKUP = (() => {
  const table = new Uint8Array(256);
  table.fill(255);
  for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  // Support Base64URL characters too.
  table["-".charCodeAt(0)] = 62;
  table["_".charCodeAt(0)] = 63;
  // Padding.
  table["=".charCodeAt(0)] = 0;
  return table;
})();

function normalizeBase64Input(base64: string): string {
  // Accept unpadded base64 by adding the required '=' padding.
  const lenMod4 = base64.length & 3;
  if (lenMod4 === 0) return base64;
  if (lenMod4 === 1) {
    throw new Error("Invalid base64 string length");
  }
  return base64 + (lenMod4 === 2 ? "==" : "=");
}

function getBase64Code(charCode: number): number {
  const code = BASE64_LOOKUP[charCode];
  if (code === 255) {
    throw new Error(
      `Invalid character in base64 string: ${String.fromCharCode(charCode)}`,
    );
  }
  return code;
}

function base64FromBytes(bytes: Uint8Array): string {
  const len = bytes.length;
  if (len === 0) return "";

  const extraBytes = len % 3;
  const lenNoExtra = len - extraBytes;

  // Chunking reduces peak allocations and avoids quadratic string growth.
  // Must be a multiple of 3.
  const maxChunkLength = 16383; // 3 * 5461
  const parts: string[] = [];

  for (let i = 0; i < lenNoExtra; i += maxChunkLength) {
    const end = Math.min(i + maxChunkLength, lenNoExtra);
    parts.push(encodeChunk(bytes, i, end));
  }

  if (extraBytes === 1) {
    const tmp = bytes[lenNoExtra];
    parts.push(
      BASE64_ALPHABET[tmp >> 2] +
        BASE64_ALPHABET[(tmp << 4) & 0x3f] +
        "==",
    );
  } else if (extraBytes === 2) {
    const tmp = (bytes[lenNoExtra] << 8) | bytes[lenNoExtra + 1];
    parts.push(
      BASE64_ALPHABET[tmp >> 10] +
        BASE64_ALPHABET[(tmp >> 4) & 0x3f] +
        BASE64_ALPHABET[(tmp << 2) & 0x3f] +
        "=",
    );
  }

  return parts.join("");
}

function encodeChunk(bytes: Uint8Array, start: number, end: number): string {
  let output = "";
  for (let i = start; i < end; i += 3) {
    const tmp =
      (bytes[i] << 16) | (bytes[i + 1] << 8) | (bytes[i + 2] & 0xff);
    output +=
      BASE64_ALPHABET[(tmp >> 18) & 0x3f] +
      BASE64_ALPHABET[(tmp >> 12) & 0x3f] +
      BASE64_ALPHABET[(tmp >> 6) & 0x3f] +
      BASE64_ALPHABET[tmp & 0x3f];
  }
  return output;
}

function bytesFromBase64(base64: string): Uint8Array {
  if (base64.length === 0) return new Uint8Array(0);
  const b64 = normalizeBase64Input(base64);

  // Find padding.
  const validLen = b64.indexOf("=");
  const effectiveLen = validLen === -1 ? b64.length : validLen;

  // base64 length is multiple of 4 after normalization
  const placeHoldersLen =
    effectiveLen === b64.length ? 0 : 4 - (effectiveLen & 3);
  if (placeHoldersLen === 3) {
    // This corresponds to len % 4 === 1, which normalizeBase64Input rejects.
    throw new Error("Invalid base64 string");
  }

  const bytesLength =
    ((effectiveLen + placeHoldersLen) * 3) / 4 - placeHoldersLen;
  const bytes = new Uint8Array(bytesLength);

  let curByte = 0;

  // Decode all but the last (padded) chunk.
  const mainLen = placeHoldersLen > 0 ? effectiveLen - 4 : effectiveLen;
  let i = 0;
  for (; i < mainLen; i += 4) {
    const tmp =
      (getBase64Code(b64.charCodeAt(i)) << 18) |
      (getBase64Code(b64.charCodeAt(i + 1)) << 12) |
      (getBase64Code(b64.charCodeAt(i + 2)) << 6) |
      getBase64Code(b64.charCodeAt(i + 3));
    bytes[curByte++] = (tmp >> 16) & 0xff;
    bytes[curByte++] = (tmp >> 8) & 0xff;
    bytes[curByte++] = tmp & 0xff;
  }

  if (placeHoldersLen === 2) {
    // 1 byte of data, "xx=="
    const tmp =
      (getBase64Code(b64.charCodeAt(i)) << 2) |
      (getBase64Code(b64.charCodeAt(i + 1)) >> 4);
    bytes[curByte++] = tmp & 0xff;
  } else if (placeHoldersLen === 1) {
    // 2 bytes of data, "xxx="
    const tmp =
      (getBase64Code(b64.charCodeAt(i)) << 10) |
      (getBase64Code(b64.charCodeAt(i + 1)) << 4) |
      (getBase64Code(b64.charCodeAt(i + 2)) >> 2);
    bytes[curByte++] = (tmp >> 8) & 0xff;
    bytes[curByte++] = tmp & 0xff;
  }

  return bytes;
}
