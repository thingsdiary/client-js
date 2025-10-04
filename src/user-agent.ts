// Note: The User-Agent header is no longer a forbidden header in the spec,
// but some browsers (like Chrome) may still silently drop it from Fetch requests.
// See: https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_request_header
// We provide the correct User-Agent value, but it may not always be sent.

function buildUserAgent(): string {
  const version = __VERSION__;

  // Browser
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const platform =
      typeof navigator !== "undefined" ? navigator.platform : "unknown";
    return `thingsdiary-client/${version} (browser; ${platform})`;
  }

  // Deno
  if (typeof Deno !== "undefined") {
    return `thingsdiary-client/${version} (deno/${Deno.version.deno})`;
  }

  // Bun
  if (typeof Bun !== "undefined") {
    return `thingsdiary-client/${version} (bun/${Bun.version})`;
  }

  // Node.js (ESM or CommonJS)
  if (typeof process !== "undefined" && process.version) {
    const { version: nodeVersion, platform, arch } = process;
    return `thingsdiary-client/${version} (node/${nodeVersion}; ${platform}; ${arch})`;
  }

  // Fallback for unknown environment
  return `thingsdiary-client/${version} (unknown)`;
}

export const USER_AGENT = buildUserAgent();
