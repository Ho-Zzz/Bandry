import fs from "node:fs/promises";
import path from "node:path";
import type { SoulState, SoulUpdateInput, SoulOperationResult } from "../../shared/ipc";
import { DEFAULT_SOUL_TEMPLATE, DEFAULT_IDENTITY_TEMPLATE } from "./templates";

const SOUL_FILENAME = "SOUL.md";
const IDENTITY_FILENAME = "IDENTITY.md";

export class SoulService {
  constructor(private readonly soulDir: string) {}

  async get(): Promise<SoulState> {
    const [soulContent, identityContent] = await Promise.all([
      this.readSafe(path.join(this.soulDir, SOUL_FILENAME)),
      this.readSafe(path.join(this.soulDir, IDENTITY_FILENAME))
    ]);
    return {
      soulContent: soulContent ?? DEFAULT_SOUL_TEMPLATE,
      identityContent: identityContent ?? DEFAULT_IDENTITY_TEMPLATE
    };
  }

  async update(input: SoulUpdateInput): Promise<SoulOperationResult> {
    await fs.mkdir(this.soulDir, { recursive: true });

    if (input.soulContent !== undefined) {
      await fs.writeFile(path.join(this.soulDir, SOUL_FILENAME), input.soulContent, "utf-8");
    }
    if (input.identityContent !== undefined) {
      await fs.writeFile(path.join(this.soulDir, IDENTITY_FILENAME), input.identityContent, "utf-8");
    }

    return { ok: true, message: "Soul updated" };
  }

  async reset(): Promise<SoulOperationResult> {
    await fs.mkdir(this.soulDir, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(this.soulDir, SOUL_FILENAME), DEFAULT_SOUL_TEMPLATE, "utf-8"),
      fs.writeFile(path.join(this.soulDir, IDENTITY_FILENAME), DEFAULT_IDENTITY_TEMPLATE, "utf-8")
    ]);
    return { ok: true, message: "Soul reset to defaults" };
  }

  private async readSafe(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }
}
