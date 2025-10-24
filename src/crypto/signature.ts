import { ed25519 } from "@noble/curves/ed25519.js";

export function signBytes(
  data: Uint8Array,
  privateKey: Uint8Array
): Uint8Array {
  return ed25519.sign(data, privateKey);
}

export function verifySignature(
  data: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  return ed25519.verify(signature, data, publicKey);
}
