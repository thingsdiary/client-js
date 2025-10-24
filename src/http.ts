import { ApiError } from "@/errors";
import { USER_AGENT } from "@/user-agent";

export class HttpClient {
  constructor(private readonly baseUrl: string, private authToken?: string) {}

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
      ...(extra || {}),
    };
  }

  async request<T>(
    path: string,
    options: {
      method: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = { method: "GET" }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const body = options.body ? JSON.stringify(options.body) : undefined;

    const res = await fetch(url, {
      method: options.method,
      headers: this.headers(options.headers),
      body,
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorData: any;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      throw new ApiError(
        res.status,
        errorData.error_code,
        errorData.error_reason
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
