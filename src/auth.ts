import { Credentials } from "./crypto/credentials";
import { signBytes } from "./crypto/signature";
import { HttpClient } from "./http";
import { base64ToBytes } from "./utils/encoding";

const defaultHttpClient = new HttpClient(
  "https://cloud.thingsdiary.com/api/v1"
);

export interface RegisterResponse {
  token: string;
}

export interface LoginResponse {
  challenge_id: string;
  nonce: string;
}

export interface LoginVerifyResponse {
  token: string;
}

export async function register(
  login: string,
  password: string,
  credentials: Credentials,
  httpClient?: HttpClient
): Promise<string> {
  const body = {
    login,
    password,
    signature_public_key: Array.from(credentials.signingPublicKey),
    encryption_public_key: Array.from(credentials.encryptionPublicKey),
  };

  const client = httpClient ?? defaultHttpClient;

  const response = await client.request<RegisterResponse>("/auth/register", {
    method: "POST",
    body,
  });

  return response.token;
}

export async function login(
  login: string,
  password: string,
  credentials: Credentials,
  httpClient?: HttpClient
): Promise<string> {
  const client = httpClient ?? defaultHttpClient;

  // Step 1: Login to get challenge
  const loginResp = await client.request<LoginResponse>("/auth/login", {
    method: "POST",
    body: { login, password },
  });

  // Step 2: Sign nonce
  const nonce = base64ToBytes(loginResp.nonce);
  const signedNonce = signBytes(nonce, credentials.signingPrivateKey);

  // Step 3: Verify challenge
  const verifyResp = await client.request<LoginVerifyResponse>(
    "/auth/login/verify",
    {
      method: "POST",
      body: {
        challenge_id: loginResp.challenge_id,
        signed_nonce: Array.from(signedNonce),
      },
    }
  );

  return verifyResp.token;
}
