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

/**
 * Derive cryptographic credentials from a seed phrase
 * @param seedPhrase - User's seed phrase (mnemonic or any string)
 * @returns Credentials object with encryption and signing key pairs
 */
export function deriveCredentials(seedPhrase: string): Credentials {
  // Derive a 32-byte seed from the seed phrase using PBKDF2
  const seed = pbkdf2(sha256, seedPhrase, "my-app-context", {
    c: 100_000,
    dkLen: 32,
  });

  // Generate Ed25519 signing keys from seed
  const signingPublicKey = ed25519.getPublicKey(seed);
  // Ed25519 private key in @noble/curves is the 32-byte seed
  const signingPrivateKey = new Uint8Array(seed);

  // Generate X25519 encryption keys from the same seed
  const encryptionPublicKey = x25519.getPublicKey(seed);
  const encryptionPrivateKey = new Uint8Array(seed);

  return {
    encryptionPublicKey,
    encryptionPrivateKey,
    signingPublicKey,
    signingPrivateKey,
  };
}
