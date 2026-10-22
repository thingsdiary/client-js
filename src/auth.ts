import { Credentials, deriveCredentials } from "@/crypto/credentials";
import { signBytes } from "@/crypto/signature";
import { HttpClient } from "@/http";
import { base64ToBytes, bytesToBase64 } from "@/utils/encoding";

const defaultHttpClient = new HttpClient("https://cloud.thingsdiary.com/api");

export interface RegisterResponse {
  token: string;
}

export interface LoginResponse {
  challenge_id: string;
  nonce: string;
  kdf_salt: string;
}

export interface LoginVerifyResponse {
  token: string;
}

export async function register(
  login: string,
  password: string,
  credentials: Credentials,
  kdfSalt: string,
  httpClient?: HttpClient,
): Promise<string> {
  const body = {
    login,
    password,
    signature_public_key: bytesToBase64(credentials.signingPublicKey),
    encryption_public_key: bytesToBase64(credentials.encryptionPublicKey),
    kdf_salt: kdfSalt,
  };

  const client = httpClient ?? defaultHttpClient;

  const response = await client.request<RegisterResponse>("/v1/auth/register", {
    method: "POST",
    body,
  });

  return response.token;
}

export async function login(
  login: string,
  password: string,
  seedPhrase: string,
  httpClient?: HttpClient,
): Promise<string> {
  const client = httpClient ?? defaultHttpClient;

  // Step 1: Login to get challenge and kdf_salt
  const loginResp = await client.request<LoginResponse>("/v1/auth/login", {
    method: "POST",
    body: { login, password },
  });

  // Step 2: Derive credentials using salt from server
  const credentials = deriveCredentials(seedPhrase, loginResp.kdf_salt);

  // Step 3: Sign nonce
  const nonce = base64ToBytes(loginResp.nonce);
  const signedNonce = signBytes(nonce, credentials.signingPrivateKey);

  // Step 4: Verify challenge
  const verifyResp = await client.request<LoginVerifyResponse>("/v1/auth/login/verify", {
    method: "POST",
    body: {
      challenge_id: loginResp.challenge_id,
      signed_nonce: bytesToBase64(signedNonce),
    },
  });

  return verifyResp.token;
}
