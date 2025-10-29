import { argon2id } from "@noble/hashes/argon2.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { gcm } from "@noble/ciphers/aes.js";

const PASSWORD = "super-hero-123-hunter-444";
const SALT = "my-app-context";
const ARGON_TIME = 1;
const ARGON_MEM = 64 * 1024; // 64 MB in KB
const ARGON_PARALLELISM = 4;
const KEY_LEN = 32;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

function decryptAESGCM(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (key.length !== 32) {
    throw new Error("Key must be 32 bytes for AES-256");
  }

  // GCM nonce size is 12 bytes
  const nonceSize = 12;
  if (data.length < nonceSize) {
    throw new Error(
      `Data too short: expected at least ${nonceSize} bytes, got ${data.length}`
    );
  }

  const nonce = data.slice(0, nonceSize);
  const ciphertext = data.slice(nonceSize);

  // Create AES-GCM cipher
  const aesGcm = gcm(key, nonce);

  // Decrypt
  const plaintext = aesGcm.decrypt(ciphertext);

  return plaintext;
}

async function main() {
  console.log("=== TypeScript Argon2id Validator ===");

  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: npx tsx argon-validate.ts <nonce+ciphertext_base64> <signature_base64>");
    console.log("Example:");
    console.log("  npx tsx argon-validate.ts 'ABC...XYZ' 'DEF...123'");
    process.exit(1);
  }

  const dataBase64 = args[0];
  const signatureBase64 = args[1];

  // 1. Derive key from password using Argon2id
  const key = argon2id(PASSWORD, SALT, {
    t: ARGON_TIME,
    m: ARGON_MEM,
    p: ARGON_PARALLELISM,
  });
  console.log("Argon2id Key (hex):", bytesToHex(key));
  console.log();

  // 2. Generate Ed25519 public key for verification
  const ed25519PublicKey = ed25519.getPublicKey(key);
  console.log("Ed25519 Public Key (hex):", bytesToHex(ed25519PublicKey));
  console.log();

  // 3. Decode base64 inputs
  let data: Uint8Array;
  let signature: Uint8Array;

  try {
    data = base64ToBytes(dataBase64);
    signature = base64ToBytes(signatureBase64);
  } catch (err) {
    console.log("❌ Failed to decode base64 inputs:", err);
    process.exit(1);
  }

  console.log("Data length:", data.length, "bytes");
  console.log("Signature length:", signature.length, "bytes");
  console.log();

  // 4. Verify signature
  const isValid = ed25519.verify(signature, data, ed25519PublicKey);
  if (!isValid) {
    console.log("❌ Signature verification FAILED");
    process.exit(1);
  }

  console.log("✅ Signature verification PASSED");
  console.log();

  // 5. Decrypt data
  let plaintext: Uint8Array;
  try {
    plaintext = decryptAESGCM(data, key);
  } catch (err) {
    console.log("❌ Decryption failed:", err);
    process.exit(1);
  }

  console.log("✅ Decryption successful");
  console.log("Plaintext:", new TextDecoder().decode(plaintext));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

