import type { Plugin } from "obsidian";
import {
  DEFAULT_AREAS,
  DEFAULT_SETTINGS,
  LEGACY_ARCHIVE_DIR,
  LEGACY_INBOX_PATH,
  LEGACY_PROJECT_DIR,
  normalizeAreaName,
  type TaskerSettings,
} from "../types/settings";

export class SettingsService {
  constructor(private readonly plugin: Plugin) {}

  async load(): Promise<TaskerSettings> {
    const saved = await this.plugin.loadData();
    return normalizeSettings(saved);
  }

  async save(settings: TaskerSettings): Promise<void> {
    await this.plugin.saveData(normalizeSettings(settings));
  }

  async update(updater: (settings: TaskerSettings) => TaskerSettings): Promise<TaskerSettings> {
    const current = await this.load();
    const next = normalizeSettings(updater(current));
    await this.save(next);
    return next;
  }
}

export function normalizeSettings(value: unknown): TaskerSettings {
  const raw = isRecord(value) ? value : {};
  const areas = normalizeAreas(raw.areas);
  const activeArea = areas.includes(normalizeAreaName(raw.activeArea as string | undefined))
    ? normalizeAreaName(raw.activeArea as string | undefined)
    : areas[0];

  return {
    projectDir: storagePathOrDefault(raw.projectDir, DEFAULT_SETTINGS.projectDir, LEGACY_PROJECT_DIR),
    archiveDir: storagePathOrDefault(raw.archiveDir, DEFAULT_SETTINGS.archiveDir, LEGACY_ARCHIVE_DIR),
    inboxPath: storagePathOrDefault(raw.inboxPath, DEFAULT_SETTINGS.inboxPath, LEGACY_INBOX_PATH),
    projectOrder: Array.isArray(raw.projectOrder)
      ? raw.projectOrder.filter((item): item is string => typeof item === "string")
      : DEFAULT_SETTINGS.projectOrder,
    projectOrders: normalizeProjectOrders(raw.projectOrders),
    lastView: raw.lastView === "archive" ||
      raw.lastView === "projectDetail"
      ? raw.lastView
      : DEFAULT_SETTINGS.lastView,
    areas,
    activeArea,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function storagePathOrDefault(value: unknown, fallback: string, legacyPath: string): string {
  const path = stringOrDefault(value, fallback);
  return trimOuterSlashes(path) === trimOuterSlashes(legacyPath) ? fallback : path;
}

function trimOuterSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

function normalizeAreas(value: unknown): string[] {
  const areas = Array.isArray(value)
    ? value
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizeAreaName(item))
      .filter(Boolean)
    : [...DEFAULT_AREAS];

  return Array.from(new Set([...areas, ...DEFAULT_AREAS]));
}

function normalizeProjectOrders(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS.projectOrders;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
      .map(([area, order]) => [
        normalizeAreaName(area),
        order.filter((item): item is string => typeof item === "string"),
      ]),
  );
}
