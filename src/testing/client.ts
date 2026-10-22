import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { login, register } from "@/auth";
import { createClient, type Client } from "@/client";
import { deriveCredentials, generateSalt } from "@/crypto/credentials";
import { HttpClient } from "@/http";

const baseUrl = "http://127.0.0.1:8081/api";

export async function newTestClient(): Promise<Client> {
  const seed = `client-js system test ${randomUUID()}`;
  const salt = generateSalt();
  const credentials = deriveCredentials(seed, salt);
  const loginName = `${randomUUID()}@thingsdiary.io`;
  const http = new HttpClient(baseUrl);

  await register(loginName, "password", credentials, salt, http);

  const token = await login(loginName, "password", seed, http);
  const client = createClient({
    token,
    credentials,
    baseUrl,
    realtimeUrl: process.env.REALTIME_URL ?? "ws://127.0.0.1:8000/connection/websocket",
    websocket: WebSocket,
  });

  await client.connect();

  return client;
}
