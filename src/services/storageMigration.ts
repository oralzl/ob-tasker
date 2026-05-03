import type { App, TFile } from "obsidian";
import {
  DEFAULT_SETTINGS,
  LEGACY_ARCHIVE_DIR,
  LEGACY_INBOX_PATH,
  LEGACY_PROJECT_DIR,
  type TaskerSettings,
} from "../types/settings";
import { basename, ensureMarkdownExtension, isDirectChildMarkdown, joinVaultPath } from "./path";
import { normalizeVaultPath, TaskerFiles } from "./taskerFiles";

export async function migrateLegacyStorage(
  app: App,
  files: TaskerFiles,
  settings: TaskerSettings,
): Promise<void> {
  await migrateLegacyInbox(files, settings);
  await migrateLegacyProjectFiles(app, files, LEGACY_ARCHIVE_DIR, settings.archiveDir);
  await migrateLegacyProjectFiles(app, files, LEGACY_PROJECT_DIR, settings.projectDir);
}

async function migrateLegacyInbox(files: TaskerFiles, settings: TaskerSettings): Promise<void> {
  if (normalizeVaultPath(settings.inboxPath) !== DEFAULT_SETTINGS.inboxPath) {
    return;
  }

  const source = files.getMarkdownFile(LEGACY_INBOX_PATH);
  if (!source || files.getMarkdownFile(settings.inboxPath)) {
    return;
  }

  await files.move(source.path, settings.inboxPath);
}

async function migrateLegacyProjectFiles(
  app: App,
  files: TaskerFiles,
  legacyDir: string,
  targetDir: string,
): Promise<void> {
  const isArchiveMigration = normalizeVaultPath(legacyDir) === LEGACY_ARCHIVE_DIR;
  const expectedTargetDir = isArchiveMigration
    ? DEFAULT_SETTINGS.archiveDir
    : DEFAULT_SETTINGS.projectDir;

  if (normalizeVaultPath(targetDir) !== expectedTargetDir) {
    return;
  }

  const legacyFiles = app.vault
    .getMarkdownFiles()
    .filter((file) => isDirectChildMarkdown(file.path, legacyDir))
    .filter((file) => {
      if (isArchiveMigration) {
        return true;
      }
      return !file.path.startsWith(`${LEGACY_ARCHIVE_DIR}/`);
    });

  for (const file of legacyFiles) {
    await moveToUniquePath(app, files, file, targetDir);
  }
}

async function moveToUniquePath(
  app: App,
  files: TaskerFiles,
  file: TFile,
  targetDir: string,
): Promise<void> {
  const targetPath = await uniquePathInDir(app, targetDir, basename(file.path));
  await files.move(file.path, targetPath);
}

async function uniquePathInDir(app: App, dir: string, fileName: string): Promise<string> {
  const normalizedName = ensureMarkdownExtension(fileName);
  const stem = normalizedName.replace(/\.md$/i, "");
  let candidate = joinVaultPath(dir, normalizedName);
  let suffix = 2;

  while (await app.vault.adapter.exists(candidate)) {
    candidate = joinVaultPath(dir, ensureMarkdownExtension(`${stem} ${suffix}`));
    suffix += 1;
  }

  return candidate;
}
