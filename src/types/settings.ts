export type TaskerViewId = "home" | "archive" | "projectDetail";

export const DEFAULT_AREA = "工作";
export const DEFAULT_AREAS = [DEFAULT_AREA, "家庭"] as const;

export interface TaskerSettings {
  projectDir: string;
  archiveDir: string;
  inboxPath: string;
  projectOrder: string[];
  projectOrders: Record<string, string[]>;
  lastView: TaskerViewId;
  areas: string[];
  activeArea: string;
}

export const LEGACY_PROJECT_DIR = "projects";
export const LEGACY_ARCHIVE_DIR = "projects/archive";
export const LEGACY_INBOX_PATH = "Tasker Inbox.md";

export const DEFAULT_SETTINGS: TaskerSettings = {
  projectDir: "ob-tasker/projects",
  archiveDir: "ob-tasker/projects/archive",
  inboxPath: "ob-tasker/inbox.md",
  projectOrder: [],
  projectOrders: {},
  lastView: "home",
  areas: [...DEFAULT_AREAS],
  activeArea: DEFAULT_AREA,
};

export function normalizeAreaName(area: string | undefined): string {
  const trimmed = area?.trim();
  return trimmed || DEFAULT_AREA;
}

export function areaMatches(value: string | undefined, area: string): boolean {
  return normalizeAreaName(value) === normalizeAreaName(area);
}

export function getActiveProjectOrder(settings: TaskerSettings): string[] {
  return settings.projectOrders[settings.activeArea] ?? settings.projectOrder;
}

export function withActiveProjectOrder(
  settings: TaskerSettings,
  projectOrder: string[],
): TaskerSettings {
  return {
    ...settings,
    projectOrder: settings.activeArea === DEFAULT_AREA ? projectOrder : settings.projectOrder,
    projectOrders: {
      ...settings.projectOrders,
      [settings.activeArea]: projectOrder,
    },
  };
}
