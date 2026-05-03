import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../services/settingsService";
import { DEFAULT_SETTINGS } from "../types/settings";

describe("normalizeSettings", () => {
  it("uses the ob-tasker storage folder by default", () => {
    expect(normalizeSettings({})).toMatchObject({
      projectDir: "ob-tasker/projects",
      archiveDir: "ob-tasker/projects/archive",
      inboxPath: "ob-tasker/inbox.md",
    });
  });

  it("maps legacy default storage paths to the ob-tasker folder", () => {
    expect(normalizeSettings({
      projectDir: "projects",
      archiveDir: "projects/archive",
      inboxPath: "Tasker Inbox.md",
    })).toMatchObject({
      projectDir: DEFAULT_SETTINGS.projectDir,
      archiveDir: DEFAULT_SETTINGS.archiveDir,
      inboxPath: DEFAULT_SETTINGS.inboxPath,
    });
  });

  it("preserves custom storage paths", () => {
    expect(normalizeSettings({
      projectDir: "custom/projects",
      archiveDir: "custom/archive",
      inboxPath: "custom/inbox.md",
    })).toMatchObject({
      projectDir: "custom/projects",
      archiveDir: "custom/archive",
      inboxPath: "custom/inbox.md",
    });
  });
});
