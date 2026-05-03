import { App, TFile } from "obsidian";
import type { Project } from "../types/project";
import type { Task } from "../types/task";
import {
  areaMatches,
  DEFAULT_AREA,
  getActiveProjectOrder,
  normalizeAreaName,
  type TaskerSettings,
} from "../types/settings";
import { createProjectId, createTaskId } from "./id";
import {
  basenameWithoutExtension,
  isDirectChildMarkdown,
  projectFilePath,
  sanitizeProjectFileName,
} from "./path";
import { readFrontmatterFields, upsertFrontmatterFields } from "./frontmatter";
import { buildTaskerMarkdown, parseTaskerMarkdown } from "./taskerMarkdown";
import { normalizeVaultPath, TaskerFiles } from "./taskerFiles";

const PROJECT_ID_FIELD = "taskerProjectId";
const PROJECT_NAME_FIELD = "taskerProjectName";
const PROJECT_ARCHIVED_AT_FIELD = "taskerArchivedAt";
const PROJECT_AREA_FIELD = "taskerArea";

export class ProjectService {
  constructor(
    private readonly app: App,
    private readonly files: TaskerFiles,
    private readonly settings: TaskerSettings,
  ) {}

  async ensureProjectDirs(): Promise<void> {
    await this.files.ensureFolder(this.settings.projectDir);
    await this.files.ensureFolder(this.settings.archiveDir);
  }

  async listProjects(): Promise<Project[]> {
    await this.ensureProjectDirs();
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => isDirectChildMarkdown(file.path, this.settings.projectDir))
      .filter((file) => !file.path.startsWith(`${this.settings.archiveDir}/`));

    const projects = await Promise.all(files.map((file) => this.readProject(file)));
    return sortProjectsByOrder(
      projects.filter((project) => areaMatches(project.area, this.settings.activeArea)),
      getActiveProjectOrder(this.settings),
    );
  }

  async listArchivedProjects(): Promise<Project[]> {
    await this.ensureProjectDirs();
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => isDirectChildMarkdown(file.path, this.settings.archiveDir));

    const projects = await Promise.all(files.map((file) => this.readProject(file)));
    return projects
      .filter((project) => areaMatches(project.area, this.settings.activeArea))
      .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));
  }

  async readProject(pathOrFile: string | TFile): Promise<Project> {
    const file = typeof pathOrFile === "string"
      ? this.files.requireMarkdownFile(pathOrFile)
      : pathOrFile;
    const content = await this.app.vault.read(file);
    const normalized = normalizeProjectMarkdown(file.path, content);

    if (normalized.markdown !== content) {
      await this.files.write(file.path, normalized.markdown);
    }

    return normalized.project;
  }

  async createProject(projectName: string, initialTaskTitle?: string): Promise<Project> {
    await this.ensureProjectDirs();
    const path = await this.uniqueProjectPath(projectName, this.settings.projectDir);
    const projectId = createProjectId();
    const tasks: Task[] = initialTaskTitle?.trim()
      ? [{
        id: createTaskId(),
        title: initialTaskTitle.trim(),
        status: "待处理",
      }]
      : [];
    const body = upsertFrontmatterFields(`# ${projectName.trim()}\n`, {
      [PROJECT_ID_FIELD]: projectId,
      [PROJECT_NAME_FIELD]: projectName.trim(),
      [PROJECT_AREA_FIELD]: this.settings.activeArea,
    });
    const markdown = buildTaskerMarkdown(body, tasks);

    await this.files.ensureMarkdownFile(path, markdown);
    return this.readProject(path);
  }

  async findProjectByName(projectName: string): Promise<Project | null> {
    const trimmed = projectName.trim();
    if (!trimmed) {
      return null;
    }

    const projects = await this.listProjects();
    return projects.find((project) => project.name === trimmed) ?? null;
  }

  async appendTask(projectPath: string, task: Task): Promise<Project> {
    await this.files.update(projectPath, (content) => {
      const normalized = normalizeProjectMarkdown(projectPath, content);
      return buildTaskerMarkdown(normalized.project.body, [...normalized.project.tasks, task]);
    });

    return this.readProject(projectPath);
  }

  async replaceTasks(projectPath: string, tasks: Task[]): Promise<Project> {
    await this.files.update(projectPath, (content) => {
      const normalized = normalizeProjectMarkdown(projectPath, content);
      return buildTaskerMarkdown(normalized.project.body, tasks);
    });

    return this.readProject(projectPath);
  }

  async updateProjectName(projectPath: string, projectName: string): Promise<Project> {
    await this.files.update(projectPath, (content) => {
      const normalized = normalizeProjectMarkdown(projectPath, content);
      const body = upsertFrontmatterFields(updateFirstHeading(normalized.project.body, projectName), {
        [PROJECT_NAME_FIELD]: projectName,
      });
      return buildTaskerMarkdown(body, normalized.project.tasks);
    });

    return this.readProject(projectPath);
  }

  async updateProjectBody(projectPath: string, body: string): Promise<Project> {
    await this.files.update(projectPath, (content) => {
      const normalized = normalizeProjectMarkdown(projectPath, content);
      const bodyWithMetadata = upsertFrontmatterFields(body, {
        [PROJECT_ID_FIELD]: normalized.project.id,
        [PROJECT_NAME_FIELD]: normalized.project.name,
        [PROJECT_ARCHIVED_AT_FIELD]: normalized.project.archivedAt,
        [PROJECT_AREA_FIELD]: normalized.project.area,
      });
      return buildTaskerMarkdown(bodyWithMetadata, normalized.project.tasks);
    });

    return this.readProject(projectPath);
  }

  async uniqueProjectPath(projectName: string, dir: string): Promise<string> {
    const baseName = sanitizeProjectFileName(projectName);
    let candidate = projectFilePath(dir, baseName);
    let suffix = 2;

    while (await this.app.vault.adapter.exists(candidate)) {
      candidate = projectFilePath(dir, `${baseName} ${suffix}`);
      suffix += 1;
    }

    return candidate;
  }
}

export function normalizeProjectMarkdown(path: string, content: string): {
  markdown: string;
  project: Project;
} {
  const fields = readFrontmatterFields(content);
  const projectId = fields[PROJECT_ID_FIELD] || createProjectId();
  const projectName = fields[PROJECT_NAME_FIELD] || firstHeading(content) || basenameWithoutExtension(path);
  const projectArea = normalizeAreaName(fields[PROJECT_AREA_FIELD] || DEFAULT_AREA);
  const withMetadata = upsertFrontmatterFields(content, {
    [PROJECT_ID_FIELD]: projectId,
    [PROJECT_NAME_FIELD]: projectName,
    [PROJECT_ARCHIVED_AT_FIELD]: fields[PROJECT_ARCHIVED_AT_FIELD],
    [PROJECT_AREA_FIELD]: projectArea,
  });
  const parsed = parseTaskerMarkdown(withMetadata);
  const archivedAt = fields[PROJECT_ARCHIVED_AT_FIELD];

  return {
    markdown: parsed.normalizedMarkdown,
    project: {
      id: projectId,
      name: projectName,
      path: normalizeVaultPath(path),
      body: parsed.body,
      tasks: parsed.tasks,
      archivedAt,
      area: projectArea,
    },
  };
}

export function sortProjectsByOrder(projects: Project[], order: string[]): Project[] {
  const orderMap = new Map(order.map((projectId, index) => [projectId, index]));
  return [...projects].sort((a, b) => {
    const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.name.localeCompare(b.name);
  });
}

export function projectHasIncompleteTasks(project: Project): boolean {
  return project.tasks.some((task) => task.status !== "完成");
}

export function countIncompleteTasks(project: Project): number {
  return project.tasks.filter((task) => task.status !== "完成").length;
}

export { PROJECT_ARCHIVED_AT_FIELD, PROJECT_AREA_FIELD, PROJECT_ID_FIELD, PROJECT_NAME_FIELD };

function firstHeading(markdown: string): string | undefined {
  const line = markdown.split(/\r?\n/).find((item) => /^#\s+\S/.test(item));
  return line?.replace(/^#\s+/, "").trim();
}

function updateFirstHeading(markdown: string, projectName: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const index = lines.findIndex((line) => /^#\s+\S/.test(line));

  if (index === -1) {
    return `# ${projectName}\n\n${markdown.trimStart()}`;
  }

  lines[index] = `# ${projectName}`;
  return lines.join("\n");
}
