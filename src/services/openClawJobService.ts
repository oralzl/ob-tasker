import { App, Notice } from "obsidian";
import type { Project } from "../types/project";
import type { TaskerSettings } from "../types/settings";
import { parentPath, hashContent, normalizeVaultPath, TaskerFiles } from "./taskerFiles";
import { ProjectService } from "./projectService";

const JOB_ROOT = "ob-tasker/openclaw-jobs";
const JOB_DIRECTORIES = ["pending", "running", "done", "failed", "records"];
const MANAGED_CONTEXT_RE = /<!-- ob-tasker:context:start[\s\S]*?<!-- ob-tasker:context:end -->\n?/;

export interface EnrichProjectContextJob {
  id: string;
  type: "enrich_project_context";
  executor: "openclaw";
  status: "pending";
  createdAt: string;
  createdBy: "ob-tasker";
  projectPath: string;
  projectId: string;
  projectName: string;
  taskId: string | null;
  baseBodyHash: string;
  baseHashAlgorithm: "tasker-djb2";
  promptPath: string;
  payload: {
    request: string;
  };
}

export interface EnrichProjectContextResult {
  contextMarkdown: string;
  sources: Array<{ path: string; reason: string }>;
  openQuestions: string[];
  nextActions: string[];
}

export interface EnrichProjectContextDoneJob extends Omit<EnrichProjectContextJob, "status"> {
  status: "done" | "recorded";
  completedAt?: string;
  result?: EnrichProjectContextResult;
}

export class OpenClawJobService {
  constructor(
    private readonly app: App,
    private readonly files: TaskerFiles,
    private readonly projectService: ProjectService,
    private readonly settings: TaskerSettings,
  ) {}

  async ensureJobDirs(): Promise<void> {
    await Promise.all(JOB_DIRECTORIES.map((dir) => this.files.ensureFolder(this.jobPath(dir))));
  }

  async createEnrichProjectContextJob(
    project: Project,
    taskId: string | null = null,
    request = "检索本地 workspace 中与这个项目和任务相关的内容，补充项目背景、目标、约束、风险和下一步行动。",
  ): Promise<EnrichProjectContextJob> {
    await this.ensureJobDirs();

    const id = `${safeTimestamp(new Date())}_enrich_${project.id}`;
    const promptPath = this.jobPath("records", `${id}.prompt.md`);
    const projectMarkdown = await this.files.read(project.path);
    const prompt = buildEnrichProjectContextPrompt({ project, projectMarkdown, request, taskId });

    const job: EnrichProjectContextJob = {
      id,
      type: "enrich_project_context",
      executor: "openclaw",
      status: "pending",
      createdAt: new Date().toISOString(),
      createdBy: "ob-tasker",
      projectPath: project.path,
      projectId: project.id,
      projectName: project.name,
      taskId,
      baseBodyHash: hashContent(project.body),
      baseHashAlgorithm: "tasker-djb2",
      promptPath,
      payload: { request },
    };

    await this.writeText(promptPath, prompt);
    await this.writeJson(this.jobPath("pending", `${id}.json`), job);
    return job;
  }

  async findLatestDoneEnrichProjectContextJob(projectId: string): Promise<EnrichProjectContextDoneJob | null> {
    await this.ensureJobDirs();
    const listed = await this.app.vault.adapter.list(this.jobPath("done"));
    const jobs = await Promise.all(
      listed.files
        .filter((path) => path.endsWith(".json"))
        .map((path) => this.readDoneJob(path)),
    );

    return jobs
      .filter((job): job is EnrichProjectContextDoneJob => Boolean(
        job &&
        job.type === "enrich_project_context" &&
        job.projectId === projectId &&
        job.result?.contextMarkdown,
      ))
      .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt))[0] ?? null;
  }

  async applyLatestEnrichProjectContext(project: Project): Promise<Project> {
    const job = await this.findLatestDoneEnrichProjectContextJob(project.id);
    if (!job?.result?.contextMarkdown) {
      throw new Error("没有可应用的 OpenClaw 上下文结果。");
    }

    const latestProject = await this.projectService.readProject(project.path);
    if (job.baseBodyHash && job.baseBodyHash !== hashContent(latestProject.body)) {
      throw new Error("项目描述已变化。请重新生成上下文任务，避免覆盖新的编辑。");
    }

    const nextBody = replaceOrInsertManagedContext(
      latestProject.body,
      buildManagedContextBlock(job.result.contextMarkdown, job.id),
    );

    return this.projectService.updateProjectBody(project.path, nextBody);
  }

  private async readDoneJob(path: string): Promise<EnrichProjectContextDoneJob | null> {
    try {
      return JSON.parse(await this.app.vault.adapter.read(path)) as EnrichProjectContextDoneJob;
    } catch (error) {
      new Notice(`读取 OpenClaw job 失败：${path}`);
      console.warn("Failed to read OpenClaw job", path, error);
      return null;
    }
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    await this.writeText(path, `${JSON.stringify(value, null, 2)}\n`);
  }

  private async writeText(path: string, value: string): Promise<void> {
    const normalized = normalizeVaultPath(path);
    const folderPath = parentPath(normalized);
    if (folderPath) {
      await this.files.ensureFolder(folderPath);
    }
    await this.app.vault.adapter.write(normalized, value);
  }

  private jobPath(...parts: string[]): string {
    return normalizeVaultPath([this.resolveJobRoot(), ...parts].join("/"));
  }

  private resolveJobRoot(): string {
    const projectDirParent = parentPath(this.settings.projectDir);
    return projectDirParent ? `${projectDirParent}/openclaw-jobs` : JOB_ROOT;
  }
}

function buildEnrichProjectContextPrompt({
  project,
  projectMarkdown,
  request,
  taskId,
}: {
  project: Project;
  projectMarkdown: string;
  request: string;
  taskId: string | null;
}): string {
  const target = taskId ? `项目中的指定任务 taskId=${taskId}` : "整个项目";

  return `你是运行在用户 home Mac 上的 OpenClaw。请基于本地 workspace 的可读内容，为 Ob Tasker 项目补充上下文。

目标：
- 处理对象：${target}
- 项目文件：${project.path}
- 项目名称：${project.name}
- 用户请求：${request}

工作方式：
1. 优先检索当前仓库 / vault 中和项目名称、任务标题、关键词相关的 Markdown、脚本、配置和长期记忆文件。
2. 可以使用本地检索工具，例如 rg、find、sed、cat，但不要修改任何文件。
3. 不要编造来源；如果没有找到相关材料，明确说明“未找到本地依据”。
4. 输出必须是 JSON，不要包裹 Markdown 代码块，不要添加 JSON 之外的说明文字。
5. 你不负责写入项目文件。Ob Tasker 插件会读取 JSON 的 contextMarkdown，并插入到项目文件的 "# 项目标题" 与 "## Tasker" 之间。
6. contextMarkdown 必须是 Markdown 片段，不要包含 "# 项目标题" 或 "## Tasker" 标题。建议从 "## Context" 开始。

JSON 输出结构：
{
  "contextMarkdown": "可直接插入项目描述区的 Markdown 片段，包含背景、目标、约束、已知事实、风险和下一步行动",
  "sources": [
    { "path": "相对 workspace 的路径", "reason": "为什么相关" }
  ],
  "openQuestions": ["仍需用户补充的问题"],
  "nextActions": ["建议的下一步行动"]
}

当前项目文件内容：
---
${projectMarkdown}
---
`;
}

function buildManagedContextBlock(contextMarkdown: string, jobId: string): string {
  return `<!-- ob-tasker:context:start id=${jobId} -->
${contextMarkdown.trim()}
<!-- ob-tasker:context:end -->
`;
}

function replaceOrInsertManagedContext(body: string, block: string): string {
  if (MANAGED_CONTEXT_RE.test(body)) {
    return body.replace(MANAGED_CONTEXT_RE, `${block}\n`);
  }

  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const headingIndex = lines.findIndex((line) => /^#\s+\S/.test(line));
  if (headingIndex === -1) {
    return `${block}\n${body.trimStart()}`;
  }

  const before = lines.slice(0, headingIndex + 1).join("\n").trimEnd();
  const after = lines.slice(headingIndex + 1).join("\n").trimStart();
  return [before, block.trimEnd(), after].filter(Boolean).join("\n\n");
}

function safeTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}
