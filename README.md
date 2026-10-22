# thingsdiary/client-js

Official TypeScript/JavaScript client for thingsdiary cloud API with built-in end-to-end encryption.

## Features

- 📘 **TypeScript support** — Full type definitions included
- 🔐 **End-to-end encryption** — All data is encrypted on the client side
- 🔑 **Cryptographic security** — Uses modern cryptographic primitives (ChaCha20-Poly1305, Curve25519, Ed25519)
- 📦 **Dual package** — Supports both ESM and CommonJS
- 🌐 **Universal** — Works in Node.js and browsers

## Installation

```bash
npm install @thingsdiary/client
```

After registration or login, create the client with the HTTP auth token and
derived credentials, then open the realtime connection before calling resource
methods:

```ts
const client = createClient({ token, credentials });
await client.connect();

const diaries = await client.diaries.list();

client.close();
```

Authentication and realtime-token requests use HTTP. Diary, key, entry, topic,
and template operations use protobuf RPC over the realtime connection.
