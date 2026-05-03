import type { Plugin } from "obsidian";
import { ArchiveService } from "../services/archiveService";
import { InboxService } from "../services/inboxService";
import { ProjectService } from "../services/projectService";
import { SettingsService } from "../services/settingsService";
import { migrateLegacyStorage } from "../services/storageMigration";
import { TaskerFiles } from "../services/taskerFiles";
import type { TaskerSettings } from "../types/settings";

export interface TaskerRuntime {
  plugin: Plugin;
  settings: TaskerSettings;
  settingsService: SettingsService;
  files: TaskerFiles;
  projectService: ProjectService;
  inboxService: InboxService;
  archiveService: ArchiveService;
}

export async function createTaskerRuntime(plugin: Plugin): Promise<TaskerRuntime> {
  const settingsService = new SettingsService(plugin);
  const settings = await settingsService.load();
  const files = new TaskerFiles(plugin.app);

  await migrateLegacyStorage(plugin.app, files, settings);

  const projectService = new ProjectService(plugin.app, files, settings);
  const inboxService = new InboxService(files, projectService, settings);
  const archiveService = new ArchiveService(
    plugin.app,
    files,
    projectService,
    settingsService,
    settings,
  );

  await projectService.ensureProjectDirs();
  await inboxService.ensureInbox();

  return {
    plugin,
    settings,
    settingsService,
    files,
    projectService,
    inboxService,
    archiveService,
  };
}
