import type { EncryptedData, Encryption } from "@/proto/encryption";
import {
  decryptWithSymmetricKey,
  encryptWithSymmetricKey,
  generateSymmetricKey,
} from "@/crypto/encryption";

interface PayloadCodec<T> {
  encode(value: T): { finish(): Uint8Array };
  decode(data: Uint8Array): T;
}

export function encryptDetails<T>(
  value: T,
  diaryKey: Uint8Array,
  diaryKeyId: string,
  codec: PayloadCodec<T>,
): { encryption: Encryption; details: EncryptedData; key: Uint8Array } {
  const key = generateSymmetricKey();
  const details = encryptWithSymmetricKey(codec.encode(value).finish(), key);
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

export function decryptDetails<T>(
  value: { encryption?: Encryption; details?: EncryptedData },
  diaryKey: Uint8Array,
  codec: PayloadCodec<T>,
): T {
  if (!value.encryption || !value.details) throw new Error("encrypted details are missing");

  const key = decryptWithSymmetricKey(
    value.encryption.encryptedKeyNonce,
    value.encryption.encryptedKeyData,
    diaryKey,
  );

  const data = decryptWithSymmetricKey(value.details.nonce, value.details.data, key);

  return codec.decode(data);
}
