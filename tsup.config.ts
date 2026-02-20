import { defineConfig } from "tsup";
import fs from "fs";
import path from "path";

export default defineConfig((options) => ({
  entry: {
    main: "src/main/index.ts",
    preload: "src/preload/index.ts",
    "sub-agent-worker": "src/main/v2/workers/sub-agent-worker.ts"
  },
  outDir: "dist-electron",
  format: ["cjs"],
  platform: "node",
  target: "node22",
  sourcemap: true,
  external: ["electron"],
  clean: !options.watch,
  outExtension() {
    return {
      js: ".cjs"
    };
  },
  onSuccess: async () => {
    const src = path.join(process.cwd(), "src/main/v2/database/schema.sql");
    const dest = path.join(process.cwd(), "dist-electron/schema.sql");
    fs.copyFileSync(src, dest);
  }
}));
