import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SOUL_TEMPLATE, DEFAULT_IDENTITY_TEMPLATE } from "./templates";

const writeIfMissing = async (filePath: string, content: string): Promise<void> => {
  try {
    await fs.writeFile(filePath, content, { flag: "wx" });
    console.log(`[Soul] Created ${path.basename(filePath)}`);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      return;
    }
    throw error;
  }
};

export const ensureSoulFiles = async (soulDir: string): Promise<void> => {
  await fs.mkdir(soulDir, { recursive: true });
  await writeIfMissing(path.join(soulDir, "SOUL.md"), DEFAULT_SOUL_TEMPLATE);
  await writeIfMissing(path.join(soulDir, "IDENTITY.md"), DEFAULT_IDENTITY_TEMPLATE);
};
