import { FormEvent, useState } from "react";
import type { Project } from "../types/project";

export interface QuickAddProps {
  projects: Project[];
  busy: boolean;
  onCreate: (title: string, projectName?: string) => Promise<void>;
}

export function QuickAdd({ projects, busy, onCreate }: QuickAddProps) {
  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || busy) {
      return;
    }

    await onCreate(trimmedTitle, projectName);
    setTitle("");
    setProjectName("");
  }

  return (
    <form className="tasker-quick-add" onSubmit={(event) => void handleSubmit(event)}>
      <input
        aria-label="任务标题"
        className="tasker-input tasker-quick-title"
        placeholder="输入新任务"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />
      <input
        aria-label="项目名称，可选"
        className="tasker-input tasker-quick-project"
        list="tasker-quick-project-options"
        placeholder="项目，可选"
        value={projectName}
        onChange={(event) => setProjectName(event.currentTarget.value)}
      />
      <datalist id="tasker-quick-project-options">
        {projects.map((project) => (
          <option key={project.id} value={project.name} />
        ))}
      </datalist>
      <button className="tasker-primary-button" type="submit" disabled={busy || !title.trim()}>
        创建
      </button>
    </form>
  );
}
