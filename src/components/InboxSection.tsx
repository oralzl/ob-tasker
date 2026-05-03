import { FormEvent, useState } from "react";
import type { InboxSnapshot } from "../services/inboxService";
import type { Project } from "../types/project";
import type { Task } from "../types/task";

export interface InboxSectionProps {
  inbox: InboxSnapshot;
  projects: Project[];
  busy: boolean;
  onAssign: (taskId: string, projectName: string) => Promise<void>;
}

export function InboxSection({ inbox, projects, busy, onAssign }: InboxSectionProps) {
  return (
    <section className="tasker-inbox-section">
      <div className="tasker-section-heading">
        <div>
          <h2>无项目任务</h2>
        </div>
        <span className="tasker-section-count">{inbox.tasks.length}</span>
      </div>

      {inbox.tasks.length === 0 ? (
        <div className="tasker-panel tasker-panel-empty">
          <h3>无项目任务为空</h3>
        </div>
      ) : (
        <div className="tasker-inbox-list">
          {inbox.tasks.map((task) => (
            <InboxRow
              key={task.id}
              busy={busy}
              task={task}
              onAssign={onAssign}
            />
          ))}
          <datalist id="tasker-inbox-project-options">
            {projects.map((project) => (
              <option key={project.id} value={project.name} />
            ))}
          </datalist>
        </div>
      )}
    </section>
  );
}

interface InboxRowProps {
  task: Task;
  busy: boolean;
  onAssign: (taskId: string, projectName: string) => Promise<void>;
}

function InboxRow({ task, busy, onAssign }: InboxRowProps) {
  const [projectName, setProjectName] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed || busy) {
      return;
    }

    await onAssign(task.id, trimmed);
    setProjectName("");
  }

  return (
    <form className="tasker-inbox-row" onSubmit={(event) => void handleSubmit(event)}>
      <div className="tasker-inbox-topline">
        <span className="tasker-inbox-leading-space" aria-hidden="true" />
        <div className="tasker-inbox-assign">
          <input
            aria-label={`将 ${task.title} 归入项目`}
            className="tasker-input"
            list="tasker-inbox-project-options"
            placeholder="归入项目"
            value={projectName}
            onChange={(event) => setProjectName(event.currentTarget.value)}
          />
          <button className="tasker-secondary-button" type="submit" disabled={busy || !projectName.trim()}>
            归入
          </button>
        </div>
      </div>
      <div className="tasker-inbox-copy">
        <strong>{task.title}</strong>
      </div>
    </form>
  );
}
