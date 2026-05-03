import { useEffect, useRef, useState } from "react";
import type { Task, TaskStatus } from "../types/task";
import { InlineEditableText } from "./InlineEditableText";
import { TaskStatusMenu } from "./TaskStatusMenu";

export interface TaskRowProps {
  task: Task;
  disabled: boolean;
  onDelete: (taskId: string) => Promise<void>;
  onOpenMarkdown: () => Promise<void>;
  onUpdate: (taskId: string, patch: Partial<Task>) => Promise<void>;
  onUpdateStatus: (taskId: string, status: TaskStatus) => Promise<void>;
}

export function TaskRow({
  task,
  disabled,
  onDelete,
  onOpenMarkdown,
  onUpdate,
  onUpdateStatus,
}: TaskRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function deleteTask() {
    const shouldDelete = window.confirm("删除这个任务？删除后会从项目文件中移除。");
    if (!shouldDelete) {
      return;
    }

    await onDelete(task.id);
    setMenuOpen(false);
  }

  async function copyTitle() {
    await navigator.clipboard?.writeText(task.title);
    setMenuOpen(false);
  }

  return (
    <div className="tasker-task-row" data-task-id={task.id}>
      <button className="tasker-task-drag-handle" type="button" aria-label="拖动任务排序">
        ⋮⋮
      </button>

      <InlineEditableText
        className="tasker-task-title"
        disabled={disabled}
        value={task.title}
        onSave={(title) => title ? onUpdate(task.id, { title }) : undefined}
      />

      <div className="tasker-task-meta">
        <TaskStatusMenu
          disabled={disabled}
          value={task.status}
          onChange={(status) => onUpdateStatus(task.id, status)}
        />

        <InlineEditableText
          className="tasker-task-owner"
          disabled={disabled}
          placeholder="我"
          value={task.owner ?? ""}
          onSave={(owner) => onUpdate(task.id, { owner: owner || undefined })}
        />

        <input
          aria-label="跟进日期"
          className="tasker-date-input"
          disabled={disabled}
          type="date"
          value={task.followUpDate ?? ""}
          onChange={(event) => {
            void onUpdate(task.id, { followUpDate: event.currentTarget.value || undefined });
          }}
        />
      </div>

      <div className="tasker-row-menu" ref={menuRef}>
        <button
          className="tasker-row-menu-trigger"
          type="button"
          aria-label="更多操作"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((isOpen) => !isOpen)}
        >
          •••
        </button>
        {menuOpen && (
          <div className="tasker-row-menu-popover">
          <button type="button" onClick={() => void copyTitle()}>
            复制标题
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void onOpenMarkdown();
            }}
          >
            打开 Markdown
          </button>
          <button className="is-danger" type="button" onClick={() => void deleteTask()}>
            删除任务
          </button>
          </div>
        )}
      </div>
    </div>
  );
}
