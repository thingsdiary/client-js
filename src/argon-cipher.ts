import { argon2id } from "@noble/hashes/argon2.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";

const PASSWORD = "super-hero-123-hunter-444";
const SALT = "my-app-context";
const PLAINTEXT = "hello, world";
const ARGON_TIME = 1;
const ARGON_MEM = 64 * 1024; // 64 MB in KB
const ARGON_PARALLELISM = 4;
const KEY_LEN = 32;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function encryptAESGCM(
  plaintext: Uint8Array,
  key: Uint8Array
): { nonce: Uint8Array; ciphertext: Uint8Array } {
  if (key.length !== 32) {
    throw new Error("Key must be 32 bytes for AES-256");
  }

  // Generate random 12-byte nonce for GCM
  const nonce = randomBytes(12);

  // Create AES-GCM cipher
  const aesGcm = gcm(key, nonce);

  // Encrypt
  const ciphertext = aesGcm.encrypt(plaintext);

  return { nonce, ciphertext };
}

async function main() {
  console.log("=== TypeScript Argon2id Cipher ===");
  console.log("Password:", PASSWORD);
  console.log();

  // 1. Derive key from password using Argon2id
  const key = argon2id(PASSWORD, SALT, {
    t: ARGON_TIME,
    m: ARGON_MEM,
    p: ARGON_PARALLELISM,
  });
  console.log("Argon2id Key (hex):", bytesToHex(key));
  console.log();

  // 2. Generate Curve25519 (X25519) encryption keys
  const curve25519PublicKey = x25519.getPublicKey(key);
  console.log("Curve25519 Public Key (hex): ", bytesToHex(curve25519PublicKey));
  console.log("Curve25519 Private Key (hex):", bytesToHex(key));
  console.log();

  // 3. Generate Ed25519 signing keys
  const ed25519PublicKey = ed25519.getPublicKey(key);
  console.log("Ed25519 Public Key (hex): ", bytesToHex(ed25519PublicKey));
  console.log("Ed25519 Private Key (hex):", bytesToHex(key));
  console.log();

  // 4. Encrypt plaintext using AES-256-GCM
  const plaintextBytes = new TextEncoder().encode(PLAINTEXT);
  const { nonce, ciphertext } = encryptAESGCM(plaintextBytes, key);
  console.log("Plaintext:", PLAINTEXT);
  console.log("Nonce (hex):     ", bytesToHex(nonce));
  console.log("Ciphertext (hex):", bytesToHex(ciphertext));
  console.log();

  // 5. Combine nonce + ciphertext
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce);
  combined.set(ciphertext, nonce.length);
  const combinedBase64 = bytesToBase64(combined);
  console.log("Nonce+Ciphertext (base64):", combinedBase64);
  console.log();

  // 6. Sign nonce+ciphertext with Ed25519
  const signature = ed25519.sign(combined, key);
  const signatureBase64 = bytesToBase64(signature);
  console.log("Signature (hex):   ", bytesToHex(signature));
  console.log("Signature (base64):", signatureBase64);
  console.log();

  // Output for validation script
  console.log("=== Copy these values for validation ===");
  console.log("Data:", combinedBase64);
  console.log("Signature:", signatureBase64);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

