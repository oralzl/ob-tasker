import type { TaskerStore } from "../app/useTaskerStore";
import { InboxSection } from "./InboxSection";
import { ProjectCardGrid } from "./ProjectCardGrid";
import { QuickAdd } from "./QuickAdd";

export interface HomePageProps {
  store: TaskerStore;
}

export function HomePage({ store }: HomePageProps) {
  return (
    <div className="tasker-home">
      <header className="tasker-page-header">
        <div>
          <h1>
            <label className="tasker-area-switcher">
              <select
                className="tasker-area-select"
                aria-label="切换 area"
                value={store.activeArea}
                onChange={(event) => void store.setActiveArea(event.currentTarget.value)}
              >
                {store.areas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
              <span aria-hidden="true">{store.activeArea}</span>
              <svg aria-hidden="true" viewBox="0 0 16 16" focusable="false">
                <path d="M4.5 6.5 8 10l3.5-3.5" />
              </svg>
            </label>
          </h1>
        </div>
        <div className="tasker-page-actions">
          <button className="tasker-secondary-button" type="button" onClick={() => store.setPage("archive")}>
            归档项目
          </button>
          <button className="tasker-secondary-button" type="button" onClick={() => void store.reload()}>
            重新扫描
          </button>
        </div>
      </header>

      <QuickAdd
        busy={store.busy}
        projects={store.projects}
        onCreate={store.createQuickTask}
      />

      <section className="tasker-project-wall">
        <div className="tasker-section-heading">
          <div>
            <h2>项目/焦点</h2>
          </div>
          <span className="tasker-section-count">{store.projects.length}</span>
        </div>
        <ProjectCardGrid
          busy={store.busy}
          projects={store.projects}
          onAddTask={store.addTaskToProject}
          onCompleteTask={(projectId, taskId) => store.updateTaskStatus(projectId, taskId, "完成")}
          onOpenProject={store.openProject}
          onPromoteTask={(projectId, taskId) => {
            const project = store.projects.find((item) => item.id === projectId);
            if (!project) {
              return Promise.resolve();
            }

            const nextTaskIds = [
              taskId,
              ...project.tasks.filter((task) => task.id !== taskId).map((task) => task.id),
            ];
            return store.reorderProjectTasks(projectId, nextTaskIds);
          }}
          onReorder={store.reorderProjects}
        />
      </section>

      <InboxSection
        busy={store.busy}
        inbox={store.inbox}
        projects={store.projects}
        onAssign={store.assignInboxTask}
      />
    </div>
  );
}
