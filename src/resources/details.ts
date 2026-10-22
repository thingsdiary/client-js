import type { EncryptedData, Encryption } from "@/proto/encryption";
import {
  decryptWithSymmetricKey,
  encryptWithSymmetricKey,
  generateSymmetricKey,
} from "@/crypto/encryption";

export function encryptDetails(
  value: unknown,
  diaryKey: Uint8Array,
  diaryKeyId: string,
): { encryption: Encryption; details: EncryptedData; key: Uint8Array } {
  const key = generateSymmetricKey();
  const details = encryptWithSymmetricKey(new TextEncoder().encode(JSON.stringify(value)), key);
  const encryptedKey = encryptWithSymmetricKey(key, diaryKey);

  return {
    key,
    encryption: {
      diaryKeyId,
      encryptedKeyNonce: encryptedKey.nonce,
      encryptedKeyData: encryptedKey.ciphertext,
    },
    details: { nonce: details.nonce, data: details.ciphertext },
  };
}

export function decryptDetails(
  value: { encryption?: Encryption; details?: EncryptedData },
  diaryKey: Uint8Array,
): any {
  if (!value.encryption || !value.details) throw new Error("encrypted details are missing");

  const key = decryptWithSymmetricKey(
    value.encryption.encryptedKeyNonce,
    value.encryption.encryptedKeyData,
    diaryKey,
  );

  const data = decryptWithSymmetricKey(value.details.nonce, value.details.data, key);

  return JSON.parse(new TextDecoder().decode(data));
}
