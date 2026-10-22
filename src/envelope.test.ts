import { ed25519 } from "@noble/curves/ed25519.js";
import { describe, expect, it } from "vitest";

import { verifySignature } from "@/crypto/signature";
import { createEnvelope, signEnvelope } from "@/envelope";
import { Envelope } from "@/proto/envelope";

describe("RPC envelope", () => {
  it("binds method, payload, and operation ID to the signature", () => {
    const privateKey = new Uint8Array(32);
    const publicKey = ed25519.getPublicKey(privateKey);
    const envelope = createEnvelope("io.thingsdiary.v1.diary.get", new Uint8Array([1, 2, 3]));

    const signed = signEnvelope(envelope, privateKey);
    const decoded = Envelope.decode(signed.envelope);

    expect(decoded).toEqual(envelope);
    expect(decoded.version).toBe(1);
    expect(decoded.operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(verifySignature(signed.envelope, signed.signature, publicKey)).toBe(true);

    const tampered = new Uint8Array(signed.envelope);
    tampered[tampered.length - 1] ^= 1;
    expect(verifySignature(tampered, signed.signature, publicKey)).toBe(false);
  });
});
