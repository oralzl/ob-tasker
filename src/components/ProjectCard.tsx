import { FormEvent, useMemo, useState } from "react";
import type { Project } from "../types/project";
import type { Task } from "../types/task";
import { isDueOnOrBefore } from "../services/date";

export interface ProjectCardProps {
  project: Project;
  busy: boolean;
  onAddTask: (projectId: string, title: string) => Promise<void>;
  onCompleteTask: (projectId: string, taskId: string) => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onPromoteTask: (projectId: string, taskId: string) => Promise<void>;
}

export function ProjectCard({
  project,
  busy,
  onAddTask,
  onCompleteTask,
  onOpenProject,
  onPromoteTask,
}: ProjectCardProps) {
  const [taskTitle, setTaskTitle] = useState("");
  const summary = useMemo(() => summarizeProject(project), [project]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = taskTitle.trim();
    if (!trimmed || busy) {
      return;
    }

    await onAddTask(project.id, trimmed);
    setTaskTitle("");
  }

  return (
    <article
      className={`tasker-project-card${summary.current ? "" : " is-muted"}`}
      data-project-id={project.id}
    >
      <div className="tasker-card-topline">
        <button className="tasker-card-drag-handle" type="button" aria-label="拖动排序">
          ⋮⋮
        </button>
        <button
          className="tasker-project-open"
          type="button"
          aria-label={`打开 ${project.name}`}
          onClick={() => onOpenProject(project.id)}
        >
          <span>{project.name}</span>
          <svg aria-hidden="true" viewBox="0 0 16 16" focusable="false">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </button>
      </div>

      <div className={`tasker-current-node${summary.primaryTask ? "" : " is-empty"}`}>
        {summary.primaryTask && (
          <button
            className="tasker-current-complete"
            type="button"
            aria-label={`完成 ${summary.primaryTask.title}`}
            disabled={busy}
            onClick={() => void onCompleteTask(project.id, summary.primaryTask!.id)}
          />
        )}
        <strong>{summary.nodeTitle}</strong>
      </div>

      {summary.otherTasks.length > 0 && (
        <ul className="tasker-other-node-list" aria-label={`${project.name} 的其他任务`}>
          {summary.otherTasks.map((task) => (
            <li key={task.id} className="tasker-other-node">
              <button
                className="tasker-other-complete"
                type="button"
                aria-label={`完成 ${task.title}`}
                disabled={busy}
                onClick={() => void onCompleteTask(project.id, task.id)}
              />
              <span className="tasker-other-node-title">{task.title}</span>
              <button
                className="tasker-other-promote"
                type="button"
                disabled={busy}
                onClick={() => void onPromoteTask(project.id, task.id)}
              >
                移到顶层
              </button>
            </li>
          ))}
        </ul>
      )}

      {summary.dueCount > 0 && (
        <button
          className="tasker-followup-chip is-due"
          type="button"
          onClick={() => onOpenProject(project.id)}
        >
          {`跟进到期 ${summary.dueCount} · 最早 ${summary.earliestDue}`}
        </button>
      )}

      <form className="tasker-card-add" onSubmit={(event) => void handleSubmit(event)}>
        <input
          aria-label={`给 ${project.name} 新增节点`}
          className="tasker-input"
          placeholder="新增任务"
          value={taskTitle}
          onChange={(event) => setTaskTitle(event.currentTarget.value)}
        />
        <button className="tasker-secondary-button" type="submit" disabled={busy || !taskTitle.trim()}>
          添加
        </button>
      </form>
    </article>
  );
}

interface ProjectSummary {
  current?: Task;
  primaryTask?: Task;
  nodeTitle: string;
  otherTasks: Task[];
  dueCount: number;
  earliestDue?: string;
}

function summarizeProject(project: Project): ProjectSummary {
  const current = project.tasks.find((task) => task.status === "进行中");
  const candidate = project.tasks.find((task) => task.status === "待处理");
  const primaryTask = current ?? candidate;
  const otherTasks = project.tasks
    .filter((task) => task.status !== "完成" && task.id !== primaryTask?.id)
    .slice(0, 3);
  const dueTasks = project.tasks
    .filter((task) => task.status !== "完成" && isDueOnOrBefore(task.followUpDate))
    .sort((a, b) => (a.followUpDate ?? "").localeCompare(b.followUpDate ?? ""));

  return {
    current,
    primaryTask,
    nodeTitle: primaryTask?.title ?? "添加一个节点开始整理",
    otherTasks,
    dueCount: dueTasks.length,
    earliestDue: dueTasks[0]?.followUpDate,
  };
}
