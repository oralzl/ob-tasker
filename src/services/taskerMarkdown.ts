import type { Task } from "../types/task";
import { isCompletedStatus, isTaskStatus, type TaskStatus } from "../types/task";
import type { TaskerFileParseResult } from "../types/project";
import { formatDate } from "./date";
import { createTaskId } from "./id";

const TASKER_HEADING = "## Tasker";
const TASKER_HEADING_RE = /^##\s+Tasker\s*$/;
const SECTION_END_RE = /^#{1,2}\s+\S/;
const TASK_LINE_RE = /^-\s+\[([ xX])\]\s+(.*)$/;
const FIELD_LINE_RE = /^\s{2,}([^:\n]+)::\s*(.*)$/;

export interface ParseTaskerMarkdownOptions {
  generateTaskId?: () => string;
}

interface RawTask {
  title: string;
  checkboxDone: boolean;
  fields: Record<string, string>;
}

interface SplitTaskerSectionResult {
  body: string;
  taskerBody: string;
  existed: boolean;
}

export function parseTaskerMarkdown(
  markdown: string,
  options: ParseTaskerMarkdownOptions = {},
): TaskerFileParseResult {
  const generateTaskId = options.generateTaskId ?? createTaskId;
  const split = splitTaskerSection(markdown);
  const repairs: string[] = [];

  if (!split.existed) {
    repairs.push("created-tasker-section");
  }

  const tasks = parseTasks(split.taskerBody, generateTaskId, repairs);
  const normalizedMarkdown = buildTaskerMarkdown(split.body, tasks);

  return {
    body: split.body,
    tasks,
    normalizedMarkdown,
    taskerSectionExisted: split.existed,
    repairs,
  };
}

export function splitTaskerSection(markdown: string): SplitTaskerSectionResult {
  const lines = normalizeLineEndings(markdown).split("\n");
  const headingIndex = lines.findIndex((line) => TASKER_HEADING_RE.test(line));

  if (headingIndex === -1) {
    return {
      body: normalizeBody(markdown),
      taskerBody: "",
      existed: false,
    };
  }

  let endIndex = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (SECTION_END_RE.test(lines[index])) {
      endIndex = index;
      break;
    }
  }

  const before = lines.slice(0, headingIndex).join("\n").trimEnd();
  const after = lines.slice(endIndex).join("\n").trimStart();
  const body = [before, after].filter(Boolean).join("\n\n");
  const taskerBody = lines.slice(headingIndex + 1, endIndex).join("\n");

  return {
    body,
    taskerBody,
    existed: true,
  };
}

export function buildTaskerMarkdown(body: string, tasks: Task[]): string {
  const normalizedBody = normalizeBody(body);
  const taskLines = tasks.flatMap(formatTask);
  const taskerLines = taskLines.length > 0
    ? [TASKER_HEADING, "", ...taskLines]
    : [TASKER_HEADING];
  const taskerSection = taskerLines.join("\n").trimEnd();

  if (!normalizedBody) {
    return `${taskerSection}\n`;
  }

  return `${normalizedBody}\n\n${taskerSection}\n`;
}

export function setTaskStatus(task: Task, status: TaskStatus, today = formatDate()): Task {
  if (status === "完成") {
    return {
      ...task,
      status,
      completedAt: task.completedAt ?? today,
    };
  }

  const { completedAt: _completedAt, ...rest } = task;
  return {
    ...rest,
    status,
  };
}

export function updateTaskStatus(
  tasks: Task[],
  taskId: string,
  status: TaskStatus,
  today = formatDate(),
): Task[] {
  return tasks.map((task) => {
    if (task.id === taskId) {
      return setTaskStatus(task, status, today);
    }

    if (status === "进行中" && task.status === "进行中") {
      return setTaskStatus(task, "待处理", today);
    }

    return task;
  });
}

function parseTasks(
  taskerBody: string,
  generateTaskId: () => string,
  repairs: string[],
): Task[] {
  const rawTasks: RawTask[] = [];
  let current: RawTask | null = null;

  for (const line of normalizeLineEndings(taskerBody).split("\n")) {
    const taskMatch = TASK_LINE_RE.exec(line);

    if (taskMatch) {
      if (current) {
        rawTasks.push(current);
      }

      current = {
        title: taskMatch[2].trim(),
        checkboxDone: taskMatch[1].toLowerCase() === "x",
        fields: {},
      };
      continue;
    }

    const fieldMatch = FIELD_LINE_RE.exec(line);
    if (current && fieldMatch) {
      current.fields[fieldMatch[1].trim()] = fieldMatch[2].trim();
    }
  }

  if (current) {
    rawTasks.push(current);
  }

  const seenIds = new Set<string>();

  return rawTasks.map((rawTask, index) => {
    const task = rawToTask(rawTask, index, generateTaskId, repairs);
    const uniqueId = ensureUniqueId(task.id, seenIds, generateTaskId);

    if (uniqueId !== task.id) {
      repairs.push(`duplicate-id:${task.id}`);
      task.id = uniqueId;
    }

    seenIds.add(task.id);
    return task;
  });
}

function rawToTask(
  rawTask: RawTask,
  index: number,
  generateTaskId: () => string,
  repairs: string[],
): Task {
  const statusField = rawTask.fields["状态"];
  const status = parseStatus(statusField, rawTask.checkboxDone, index, repairs);
  const id = parseId(rawTask.fields.id, index, generateTaskId, repairs);
  const area = optionalField(rawTask.fields.area);

  if (rawTask.checkboxDone !== isCompletedStatus(status)) {
    repairs.push(`checkbox-status-conflict:${id}`);
  }

  return {
    id,
    title: rawTask.title,
    status,
    owner: optionalField(rawTask.fields["责任人"]),
    followUpDate: optionalField(rawTask.fields["跟进日期"]),
    completedAt: status === "完成" ? optionalField(rawTask.fields["完成时间"]) : undefined,
    ...(area ? { area } : {}),
  };
}

function parseStatus(
  value: string | undefined,
  checkboxDone: boolean,
  index: number,
  repairs: string[],
): TaskStatus {
  if (value && isTaskStatus(value)) {
    return value;
  }

  if (value) {
    repairs.push(`invalid-status:${index}`);
  } else {
    repairs.push(`missing-status:${index}`);
  }

  return checkboxDone ? "完成" : "待处理";
}

function parseId(
  value: string | undefined,
  index: number,
  generateTaskId: () => string,
  repairs: string[],
): string {
  if (value) {
    return value;
  }

  const id = generateTaskId();
  repairs.push(`missing-id:${index}`);
  return id;
}

function ensureUniqueId(id: string, seenIds: Set<string>, generateTaskId: () => string): string {
  if (!seenIds.has(id)) {
    return id;
  }

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const candidate = generateTaskId();
    if (!seenIds.has(candidate)) {
      return candidate;
    }
  }

  let suffix = 1;
  let fallback = `${id}_${suffix}`;
  while (seenIds.has(fallback)) {
    suffix += 1;
    fallback = `${id}_${suffix}`;
  }
  return fallback;
}

function formatTask(task: Task): string[] {
  const checkbox = isCompletedStatus(task.status) ? "x" : " ";
  const lines = [
    `- [${checkbox}] ${task.title.trim()}`,
    `  id:: ${task.id}`,
    `  状态:: ${task.status}`,
  ];

  if (task.owner && task.owner.trim() && task.owner.trim() !== "我") {
    lines.push(`  责任人:: ${task.owner.trim()}`);
  }

  if (task.followUpDate?.trim()) {
    lines.push(`  跟进日期:: ${task.followUpDate.trim()}`);
  }

  if (task.area?.trim()) {
    lines.push(`  area:: ${task.area.trim()}`);
  }

  if (task.status === "完成" && task.completedAt?.trim()) {
    lines.push(`  完成时间:: ${task.completedAt.trim()}`);
  }

  return [...lines, ""];
}

function optionalField(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeBody(markdown: string): string {
  return normalizeLineEndings(markdown).trim();
}

function normalizeLineEndings(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n");
}
