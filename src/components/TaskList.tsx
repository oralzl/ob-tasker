import { useEffect, useRef } from "react";
import Sortable from "sortablejs";
import type { Task, TaskStatus } from "../types/task";
import { TaskRow } from "./TaskRow";

export interface TaskListProps {
  tasks: Task[];
  disabled: boolean;
  onDelete: (taskId: string) => Promise<void>;
  onOpenMarkdown: () => Promise<void>;
  onReorder: (taskIds: string[]) => Promise<void>;
  onUpdate: (taskId: string, patch: Partial<Task>) => Promise<void>;
  onUpdateStatus: (taskId: string, status: TaskStatus) => Promise<void>;
}

export function TaskList({
  tasks,
  disabled,
  onDelete,
  onOpenMarkdown,
  onReorder,
  onUpdate,
  onUpdateStatus,
}: TaskListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current || tasks.length < 2) {
      return undefined;
    }

    const sortable = Sortable.create(listRef.current, {
      animation: 180,
      draggable: ".tasker-task-row",
      handle: ".tasker-task-drag-handle",
      ghostClass: "is-dragging",
      onEnd: () => {
        const taskIds = Array.from(listRef.current?.children ?? [])
          .map((child) => child.getAttribute("data-task-id"))
          .filter((taskId): taskId is string => Boolean(taskId));
        void onReorder(taskIds);
      },
    });

    return () => sortable.destroy();
  }, [onReorder, tasks.length]);

  if (tasks.length === 0) {
    return <p className="tasker-task-list-empty">暂无任务</p>;
  }

  return (
    <div className="tasker-task-list" ref={listRef}>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          disabled={disabled}
          task={task}
          onDelete={onDelete}
          onOpenMarkdown={onOpenMarkdown}
          onUpdate={onUpdate}
          onUpdateStatus={onUpdateStatus}
        />
      ))}
    </div>
  );
}
