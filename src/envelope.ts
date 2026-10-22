import { signBytes } from "@/crypto/signature";
import { Envelope, SignedEnvelope } from "@/proto/envelope";

const ENVELOPE_VERSION = 1;

export function createEnvelope(method: string, payload: Uint8Array): Envelope {
  return {
    version: ENVELOPE_VERSION,
    method,
    payload,
    operationId: globalThis.crypto.randomUUID(),
  };
}

export function signEnvelope(envelope: Envelope, signingPrivateKey: Uint8Array): SignedEnvelope {
  const data = Envelope.encode(envelope).finish();

  return {
    envelope: data,
    signature: signBytes(data, signingPrivateKey),
  };
}
