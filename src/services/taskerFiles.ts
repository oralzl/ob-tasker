import { App, normalizePath, TFile } from "obsidian";
import type { TaskerFileParseResult } from "../types/project";
import { FileWriteQueue } from "./fileQueue";
import { parseTaskerMarkdown } from "./taskerMarkdown";

export interface RecentSelfWrite {
  timestamp: number;
  hash: string;
}

export class TaskerFiles {
  private readonly recentSelfWrites = new Map<string, RecentSelfWrite>();

  constructor(
    private readonly app: App,
    private readonly queue = new FileWriteQueue(),
  ) {}

  async ensureFolder(path: string): Promise<void> {
    const normalized = normalizeVaultPath(path);
    if (!normalized) {
      return;
    }

    const parts = normalized.split("/");
    let current = "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!(await this.app.vault.adapter.exists(current))) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  async ensureMarkdownFile(path: string, initialContent: string): Promise<TFile> {
    const normalized = normalizeVaultPath(path);
    const existing = this.getMarkdownFile(normalized);
    if (existing) {
      return existing;
    }

    const folderPath = parentPath(normalized);
    if (folderPath) {
      await this.ensureFolder(folderPath);
    }

    this.recordSelfWrite(normalized, initialContent);
    const file = await this.app.vault.create(normalized, initialContent);
    return file;
  }

  getMarkdownFile(path: string): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(normalizeVaultPath(path));
    return file instanceof TFile ? file : null;
  }

  async read(path: string): Promise<string> {
    const file = this.requireMarkdownFile(path);
    return this.app.vault.read(file);
  }

  async write(path: string, content: string): Promise<void> {
    const normalized = normalizeVaultPath(path);
    await this.queue.enqueue(normalized, async () => {
      const existing = this.getMarkdownFile(normalized);

      this.recordSelfWrite(normalized, content);
      if (existing) {
        await this.app.vault.modify(existing, content);
      } else {
        const folderPath = parentPath(normalized);
        if (folderPath) {
          await this.ensureFolder(folderPath);
        }
        await this.app.vault.create(normalized, content);
      }
    });
  }

  async move(path: string, targetPath: string): Promise<TFile> {
    const normalizedSource = normalizeVaultPath(path);
    const normalizedTarget = normalizeVaultPath(targetPath);
    const file = this.requireMarkdownFile(normalizedSource);
    const folderPath = parentPath(normalizedTarget);

    if (folderPath) {
      await this.ensureFolder(folderPath);
    }

    await this.app.vault.rename(file, normalizedTarget);
    const movedFile = this.requireMarkdownFile(normalizedTarget);
    const content = await this.app.vault.read(movedFile);
    this.recordSelfWrite(normalizedTarget, content);
    return movedFile;
  }

  async update(path: string, updater: (content: string) => string | Promise<string>): Promise<string> {
    const normalized = normalizeVaultPath(path);
    return this.queue.enqueue(normalized, async () => {
      const existing = this.getMarkdownFile(normalized);
      const current = existing ? await this.app.vault.read(existing) : "";
      const next = await updater(current);

      this.recordSelfWrite(normalized, next);
      if (existing) {
        await this.app.vault.modify(existing, next);
      } else {
        const folderPath = parentPath(normalized);
        if (folderPath) {
          await this.ensureFolder(folderPath);
        }
        await this.app.vault.create(normalized, next);
      }
      return next;
    });
  }

  async parseTaskerFile(path: string): Promise<TaskerFileParseResult> {
    const content = await this.read(path);
    const parsed = parseTaskerMarkdown(content);

    if (parsed.normalizedMarkdown !== content) {
      await this.write(path, parsed.normalizedMarkdown);
    }

    return parsed;
  }

  isSelfWrite(path: string, content: string, windowMs = 3000): boolean {
    const record = this.recentSelfWrites.get(normalizeVaultPath(path));
    if (!record) {
      return false;
    }

    const isRecent = Date.now() - record.timestamp <= windowMs;
    return isRecent && record.hash === hashContent(content);
  }

  getRecentSelfWrite(path: string): RecentSelfWrite | undefined {
    return this.recentSelfWrites.get(normalizeVaultPath(path));
  }

  requireMarkdownFile(path: string): TFile {
    const file = this.getMarkdownFile(path);
    if (!file) {
      throw new Error(`Markdown file not found: ${path}`);
    }
    return file;
  }

  private recordSelfWrite(path: string, content: string): void {
    this.recentSelfWrites.set(normalizeVaultPath(path), {
      timestamp: Date.now(),
      hash: hashContent(content),
    });
  }
}

export function normalizeVaultPath(path: string): string {
  return normalizePath(path).replace(/^\/+/, "");
}

export function parentPath(path: string): string {
  const normalized = normalizeVaultPath(path);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

export function hashContent(content: string): string {
  let hash = 5381;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 33) ^ content.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}
