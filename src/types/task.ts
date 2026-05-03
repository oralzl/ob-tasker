export const TASK_STATUSES = [
  "待处理",
  "进行中",
  "等别人",
  "暂停",
  "完成",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  owner?: string;
  followUpDate?: string;
  completedAt?: string;
  area?: string;
}

export function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

export function isCompletedStatus(status: TaskStatus): boolean {
  return status === "完成";
}
