export interface EncryptedData {
  nonce: string;
  data: string;
}

export interface DiaryEncryption {
  diary_key_id: string;
  encrypted_key_nonce: string;
  encrypted_key_data: string;
}
