import { App } from "obsidian";
import type { Project } from "../types/project";
import { withActiveProjectOrder, type TaskerSettings } from "../types/settings";
import { formatDate } from "./date";
import { removeFrontmatterFields, upsertFrontmatterFields } from "./frontmatter";
import { basename, ensureMarkdownExtension, joinVaultPath } from "./path";
import {
  countIncompleteTasks,
  normalizeProjectMarkdown,
  PROJECT_ARCHIVED_AT_FIELD,
  ProjectService,
} from "./projectService";
import { SettingsService } from "./settingsService";
import { normalizeVaultPath, TaskerFiles } from "./taskerFiles";

export interface ArchiveResult {
  project: Project;
  archivedPath: string;
  incompleteTaskCount: number;
}

export class ArchiveService {
  constructor(
    private readonly app: App,
    private readonly files: TaskerFiles,
    private readonly projectService: ProjectService,
    private readonly settingsService: SettingsService,
    private readonly settings: TaskerSettings,
  ) {}

  async listArchivedProjects(): Promise<Project[]> {
    return this.projectService.listArchivedProjects();
  }

  async archiveProject(projectPath: string, today = formatDate()): Promise<ArchiveResult> {
    const project = await this.projectService.readProject(projectPath);
    const incompleteTaskCount = countIncompleteTasks(project);

    await this.files.update(project.path, (content) => {
      const normalized = normalizeProjectMarkdown(project.path, content);
      return upsertFrontmatterFields(normalized.markdown, {
        [PROJECT_ARCHIVED_AT_FIELD]: today,
      });
    });

    const archivedPath = await this.uniquePathInDir(this.settings.archiveDir, basename(project.path));
    await this.files.move(project.path, archivedPath);
    await this.removeProjectFromOrder(project.id);

    return {
      project: {
        ...project,
        path: archivedPath,
        archivedAt: today,
      },
      archivedPath,
      incompleteTaskCount,
    };
  }

  async restoreProject(archivedPath: string): Promise<Project> {
    const archivedFile = this.files.requireMarkdownFile(archivedPath);
    const archivedContent = await this.app.vault.read(archivedFile);
    const normalized = normalizeProjectMarkdown(archivedPath, archivedContent);
    const restoredContent = removeFrontmatterFields(normalized.markdown, [PROJECT_ARCHIVED_AT_FIELD]);
    await this.files.write(archivedPath, restoredContent);

    const restoredPath = await this.uniquePathInDir(this.settings.projectDir, basename(archivedPath));
    await this.files.move(archivedPath, restoredPath);

    await this.appendProjectToOrderEnd(normalized.project.id);

    return this.projectService.readProject(restoredPath);
  }

  private async removeProjectFromOrder(projectId: string): Promise<void> {
    const currentOrder = this.settings.projectOrders[this.settings.activeArea] ?? this.settings.projectOrder;
    const nextOrder = currentOrder.filter((item) => item !== projectId);
    const nextSettings = withActiveProjectOrder(this.settings, nextOrder);
    Object.assign(this.settings, nextSettings);
    await this.settingsService.update((settings) => withActiveProjectOrder(settings, nextOrder));
  }

  private async appendProjectToOrderEnd(projectId: string): Promise<void> {
    const currentOrder = this.settings.projectOrders[this.settings.activeArea] ?? this.settings.projectOrder;
    const nextOrder = [
      ...currentOrder.filter((item) => item !== projectId),
      projectId,
    ];
    const nextSettings = withActiveProjectOrder(this.settings, nextOrder);
    Object.assign(this.settings, nextSettings);
    await this.settingsService.update((settings) => withActiveProjectOrder(settings, nextOrder));
  }

  private async uniquePathInDir(dir: string, fileName: string): Promise<string> {
    const normalizedDir = normalizeVaultPath(dir);
    const baseName = ensureMarkdownExtension(fileName).replace(/\.md$/i, "");
    let candidate = joinVaultPath(normalizedDir, ensureMarkdownExtension(baseName));
    let suffix = 2;

    while (await this.app.vault.adapter.exists(candidate)) {
      candidate = joinVaultPath(normalizedDir, ensureMarkdownExtension(`${baseName} ${suffix}`));
      suffix += 1;
    }

    return candidate;
  }
}
