import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";
import { readFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  plugins: [
    tsconfigPaths(), // Must be first to resolve path aliases
  ],

  define: {
    __VERSION__: JSON.stringify(packageJson.version),
  },

  build: {
    target: "es2020",
    cssCodeSplit: false,

    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ThingsDiaryClient",
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format}.js`,
      // Note: preserveModules: false keeps single output file index.*
      // This ensures tsc doesn't overwrite .d.ts files
    },

    rollupOptions: {
      external: [
        /^@noble\/ciphers/,
        /^@noble\/curves/,
        /^@noble\/hashes/,
        "@stablelib/nacl",
      ],
      output: {
        exports: "named",
      },
    },

    sourcemap: process.env.NODE_ENV !== "production",
    minify: process.env.NODE_ENV === "production" ? "esbuild" : false,
    emptyOutDir: true,
  },

  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
