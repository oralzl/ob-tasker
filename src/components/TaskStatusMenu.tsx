import { TASK_STATUSES, type TaskStatus } from "../types/task";

export interface TaskStatusMenuProps {
  value: TaskStatus;
  disabled?: boolean;
  onChange: (status: TaskStatus) => Promise<void> | void;
}

export function TaskStatusMenu({ value, disabled = false, onChange }: TaskStatusMenuProps) {
  return (
    <select
      className="tasker-status-select"
      disabled={disabled}
      value={value}
      onChange={(event) => void onChange(event.currentTarget.value as TaskStatus)}
    >
      {TASK_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}
