export { Client, createClient } from "@/client";
export type { ClientOptions, CreateClientOptions } from "@/client";
export { deriveCredentials, generateSalt } from "@/crypto/credentials";
export type { Credentials } from "@/crypto/credentials";
export type { Diary, EncryptionKey, Entry, Template, Topic } from "@/types";
export { register, login } from "@/auth";
