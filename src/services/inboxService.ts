import type { Task } from "../types/task";
import type { Project } from "../types/project";
import { areaMatches, normalizeAreaName } from "../types/settings";
import type { TaskerSettings } from "../types/settings";
import { createTaskId } from "./id";
import { buildTaskerMarkdown, parseTaskerMarkdown } from "./taskerMarkdown";
import { TaskerFiles } from "./taskerFiles";
import { ProjectService } from "./projectService";

export interface InboxSnapshot {
  body: string;
  tasks: Task[];
}

export interface InboxAssignResult {
  task: Task;
  project: Project;
  inboxTasks: Task[];
}

export class InboxService {
  constructor(
    private readonly files: TaskerFiles,
    private readonly projectService: ProjectService,
    private readonly settings: TaskerSettings,
  ) {}

  async ensureInbox(): Promise<void> {
    await this.files.ensureMarkdownFile(this.settings.inboxPath, defaultInboxMarkdown());
    const parsed = await this.files.parseTaskerFile(this.settings.inboxPath);

    if (parsed.normalizedMarkdown !== defaultInboxMarkdown()) {
      return;
    }
  }

  async readInbox(): Promise<InboxSnapshot> {
    const parsed = await this.readAllInboxTasks();
    return {
      body: parsed.body,
      tasks: parsed.tasks.filter((task) => areaMatches(task.area, this.settings.activeArea)),
    };
  }

  async createTask(title: string): Promise<Task> {
    const task = createDefaultTask(title, this.settings.activeArea);
    await this.files.update(this.settings.inboxPath, (content) => {
      const parsed = parseTaskerMarkdown(content || defaultInboxMarkdown());
      return buildTaskerMarkdown(parsed.body || "# Tasker Inbox", [...parsed.tasks, task]);
    });

    return task;
  }

  async assignTaskToProject(taskId: string, projectName: string): Promise<InboxAssignResult> {
    const inbox = await this.readAllInboxTasks();
    const task = inbox.tasks.find((item) => (
      item.id === taskId && areaMatches(item.area, this.settings.activeArea)
    ));

    if (!task) {
      throw new Error(`Inbox task not found: ${taskId}`);
    }

    const project = await this.projectService.findProjectByName(projectName)
      ?? await this.projectService.createProject(projectName);
    await this.projectService.appendTask(project.path, stripTaskArea(task));

    const remainingTasks = inbox.tasks.filter((item) => item.id !== taskId);
    await this.files.write(this.settings.inboxPath, buildTaskerMarkdown(inbox.body, remainingTasks));

    return {
      task,
      project,
      inboxTasks: remainingTasks,
    };
  }

  private async readAllInboxTasks(): Promise<InboxSnapshot> {
    await this.ensureInbox();
    const parsed = await this.files.parseTaskerFile(this.settings.inboxPath);
    return {
      body: parsed.body,
      tasks: parsed.tasks,
    };
  }
}

export function createInboxTask(title: string): Task {
  return createDefaultTask(title);
}

export function createDefaultTask(title: string, area?: string): Task {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Task title is required.");
  }

  const task: Task = {
    id: createTaskId(),
    title: trimmed,
    status: "待处理",
  };

  return area ? { ...task, area: normalizeAreaName(area) } : task;
}

export function defaultInboxMarkdown(): string {
  return "# Tasker Inbox\n\n## Tasker\n";
}

function stripTaskArea(task: Task): Task {
  const { area: _area, ...projectTask } = task;
  return projectTask;
}
