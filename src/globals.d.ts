// Global types for runtime detection
declare global {
  // Deno runtime
  const Deno:
    | {
        version: {
          deno: string;
        };
      }
    | undefined;

  // Bun runtime
  const Bun:
    | {
        version: string;
      }
    | undefined;
}

export {};
