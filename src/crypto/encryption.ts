import { gcm } from "@noble/ciphers/aes.js";
import { box, openBox, generateKeyPair } from "@stablelib/nacl";
import { blake2b } from "@noble/hashes/blake2.js";
import { randomBytes } from "@noble/ciphers/utils.js";

/**
 * Generate a random 32-byte symmetric key
 */
export function generateSymmetricKey(): Uint8Array {
  return randomBytes(32);
}

/**
 * Encrypt data with AES-256-GCM
 * @param data - Data to encrypt
 * @param key - 32-byte encryption key
 * @returns Object containing nonce and ciphertext
 */
export function encryptWithSymmetricKey(
  data: Uint8Array,
  key: Uint8Array
): { nonce: Uint8Array; ciphertext: Uint8Array } {
  const nonce = randomBytes(12);
  const aes = gcm(key, nonce);
  const ciphertext = aes.encrypt(data);

  return {
    nonce,
    ciphertext,
  };
}

/**
 * Decrypt data with AES-256-GCM
 * @param nonce - 12-byte nonce used for encryption
 * @param ciphertext - Encrypted data
 * @param key - 32-byte decryption key
 * @returns Decrypted data
 */
export function decryptWithSymmetricKey(
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  key: Uint8Array
): Uint8Array {
  const aes = gcm(key, nonce);
  const plaintext = aes.decrypt(ciphertext);
  return plaintext;
}

/**
 * Encrypt data using NaCl sealed box (anonymous encryption with X25519-XSalsa20-Poly1305)
 * Sealed box format: ephemeral_public_key (32 bytes) + encrypted_data
 * @param data - Data to encrypt
 * @param publicKey - Recipient's 32-byte public key
 * @returns Encrypted data (ephemeral public key + ciphertext)
 */
export function encryptWithPublicKey(
  data: Uint8Array,
  publicKey: Uint8Array
): Uint8Array {
  // Generate ephemeral keypair
  const ephemeralKeyPair = generateKeyPair();

  // Create nonce from ephemeral public key and recipient public key.
  // Must match golang.org/x/crypto/nacl/box.SealAnonymous/OpenAnonymous:
  // nonce = blake2b-24(ephemeral_pk || recipient_pk)
  const combined = new Uint8Array(64);
  combined.set(ephemeralKeyPair.publicKey);
  combined.set(publicKey, 32);

  const nonce = blake2b(combined, { dkLen: 24 });

  // Encrypt using NaCl box
  const encrypted = box(publicKey, ephemeralKeyPair.secretKey, nonce, data);

  // Combine ephemeral public key + encrypted data
  const result = new Uint8Array(32 + encrypted.length);
  result.set(ephemeralKeyPair.publicKey);
  result.set(encrypted, 32);

  return result;
}

/**
 * Decrypt data using NaCl sealed box
 * @param encrypted - Encrypted data (ephemeral public key + ciphertext)
 * @param privateKey - Recipient's 32-byte private key
 * @param publicKey - Recipient's 32-byte public key
 * @returns Decrypted data
 */
export function decryptWithPrivateKey(
  encrypted: Uint8Array,
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Uint8Array {
  // Extract ephemeral public key (first 32 bytes)
  if (encrypted.length < 32) {
    throw new Error("Invalid sealed box: too short");
  }

  const ephemeralPublicKey = encrypted.slice(0, 32);
  const ciphertext = encrypted.slice(32);

  // Recreate nonce (must match encryptWithPublicKey and Go sealed box)
  const combined = new Uint8Array(64);
  combined.set(ephemeralPublicKey);
  combined.set(publicKey, 32);

  const nonce = blake2b(combined, { dkLen: 24 });

  // Decrypt using NaCl box
  const plaintext = openBox(ephemeralPublicKey, privateKey, nonce, ciphertext);

  if (!plaintext) {
    throw new Error("Failed to decrypt: invalid ciphertext or keys");
  }

  return plaintext;
}
