import { hkdf } from "@noble/hashes/hkdf.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { x25519 } from "@noble/curves/ed25519.js";

export interface Credentials {
  encryptionPublicKey: Uint8Array; // 32 bytes (X25519)
  encryptionPrivateKey: Uint8Array; // 32 bytes (X25519)
  signingPublicKey: Uint8Array; // 32 bytes (Ed25519)
  signingPrivateKey: Uint8Array; // 32 bytes (Ed25519 seed)
}

const PBKDF2_ITERATIONS = 650_000;
const PBKDF2_DK_LEN = 32;

// Domain separation info for HKDF (RFC 5869)
// These ensure signing and encryption keys are cryptographically independent
const encoder = new TextEncoder();
const HKDF_INFO_SIGNING = encoder.encode("thingsdiary-ed25519-v1");
const HKDF_INFO_ENCRYPTION = encoder.encode("thingsdiary-x25519-v1");

/**
 * Generate a cryptographically secure random salt
 * @param length - Length of the salt in characters (default: 32)
 * @returns ASCII-safe string salt
 */
export function generateSalt(length = 32): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Derive cryptographic credentials from a seed phrase using domain separation.
 *
 * Key derivation hierarchy:
 *   seedPhrase + salt
 *       ↓ PBKDF2-SHA256 (650K iterations)
 *   masterSeed (32 bytes)
 *       ↓ HKDF-SHA256
 *   ├── signingPrivateKey   (info: "thingsdiary-ed25519-v1")
 *   └── encryptionPrivateKey (info: "thingsdiary-x25519-v1")
 *
 * Domain separation ensures that signing and encryption keys are
 * cryptographically independent per RFC 5869.
 *
 * @param seedPhrase - User's seed phrase (mnemonic or any string)
 * @param salt - Salt for PBKDF2 (ASCII-safe string)
 * @returns Credentials object with encryption and signing key pairs
 */
export function deriveCredentials(seedPhrase: string, salt: string): Credentials {
  // Step 1: Derive master seed from seedPhrase using PBKDF2
  const masterSeed = pbkdf2(sha256, seedPhrase, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: PBKDF2_DK_LEN,
  });

  // Step 2: Derive domain-separated keys using HKDF
  // Using undefined salt for HKDF since PBKDF2 already applied the salt
  const signingPrivateKey = hkdf(sha256, masterSeed, undefined, HKDF_INFO_SIGNING, 32);
  const encryptionPrivateKey = hkdf(sha256, masterSeed, undefined, HKDF_INFO_ENCRYPTION, 32);

  return {
    encryptionPublicKey: x25519.getPublicKey(encryptionPrivateKey),
    encryptionPrivateKey,
    signingPublicKey: ed25519.getPublicKey(signingPrivateKey),
    signingPrivateKey,
  };
}
