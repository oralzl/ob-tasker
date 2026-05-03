import { FormEvent, useState } from "react";
import type { TaskerStore } from "../app/useTaskerStore";
import { stripFrontmatter } from "../services/frontmatter";
import type { Project } from "../types/project";
import { InlineEditableText } from "./InlineEditableText";
import { ProjectBodyEditor } from "./ProjectBodyEditor";
import { TaskList } from "./TaskList";

export interface ProjectDetailPageProps {
  store: TaskerStore;
}

export function ProjectDetailPage({ store }: ProjectDetailPageProps) {
  const project = store.projects.find((item) => item.id === store.activeProjectId);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  if (!project) {
    return (
      <section className="tasker-empty-state">
        <h1>项目不存在</h1>
        <p>这个项目可能已经被归档、删除，或还没有加载完成。</p>
        <button className="tasker-secondary-button" type="button" onClick={() => store.setPage("home")}>
          返回首页
        </button>
      </section>
    );
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed || !project) {
      return;
    }

    await store.addTaskToProject(project.id, trimmed);
    setNewTaskTitle("");
  }

  async function reorderTasks(taskIds: string[]) {
    if (!project) {
      return;
    }

    await store.reorderProjectTasks(project.id, taskIds);
  }

  return (
    <div className="tasker-detail">
      <header className="tasker-detail-header">
        <div className="tasker-detail-titlebar">
          <button className="tasker-link-button" type="button" onClick={() => store.setPage("home")}>
            返回首页
          </button>
          <InlineEditableText
            className="tasker-project-title-edit"
            disabled={store.busy}
            value={project.name}
            onSave={(name) => name ? store.updateProjectName(project.id, name) : undefined}
          />
        </div>
        <div className="tasker-detail-actions">
          <button
            className="tasker-secondary-button"
            type="button"
            onClick={() => void store.openMarkdownFile(project.id)}
          >
            打开 Markdown
          </button>
          <button
            className="tasker-danger-button"
            type="button"
            disabled={store.busy}
            onClick={() => void archiveProject(store, project)}
          >
            归档项目
          </button>
        </div>
      </header>

      <div className="tasker-detail-grid">
        <section className="tasker-task-panel">
          <form className="tasker-detail-add" onSubmit={(event) => void addTask(event)}>
            <input
              aria-label="新增任务"
              className="tasker-input"
              placeholder="输入任务，按 Enter 添加"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.currentTarget.value)}
            />
            <button className="tasker-primary-button" type="submit" disabled={store.busy || !newTaskTitle.trim()}>
              添加
            </button>
          </form>

          <TaskList
            disabled={store.busy}
            tasks={project.tasks}
            onDelete={(taskId) => store.deleteTask(project.id, taskId)}
            onOpenMarkdown={() => store.openMarkdownFile(project.id)}
            onReorder={reorderTasks}
            onUpdate={(taskId, patch) => store.updateTask(project.id, taskId, patch)}
            onUpdateStatus={(taskId, status) => store.updateTaskStatus(project.id, taskId, status)}
          />
        </section>

        <ProjectBodyEditor
          body={stripFrontmatter(project.body)}
          disabled={store.busy}
          onSave={(body) => store.saveProjectBody(project.id, body)}
        />
      </div>
    </div>
  );
}

async function archiveProject(store: TaskerStore, project: Project): Promise<void> {
  const incompleteCount = project.tasks.filter((task) => task.status !== "完成").length;
  if (incompleteCount > 0) {
    const confirmed = window.confirm(`这个项目还有 ${incompleteCount} 个未完成节点。确认归档？`);
    if (!confirmed) {
      return;
    }
  }

  await store.archiveProject(project.id);
}
