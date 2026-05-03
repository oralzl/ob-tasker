import type { TaskerStore } from "../app/useTaskerStore";
import type { Project } from "../types/project";

export interface ArchivePageProps {
  store: TaskerStore;
}

export function ArchivePage({ store }: ArchivePageProps) {
  return (
    <div className="tasker-archive-page">
      <header className="tasker-page-header">
        <div>
          <h1>归档项目</h1>
          <p>归档项目不会出现在首页，可以随时恢复。</p>
          <div className="tasker-page-actions">
            <button className="tasker-secondary-button" type="button" onClick={() => store.setPage("home")}>
              返回首页
            </button>
            <button className="tasker-secondary-button" type="button" onClick={() => void store.reload()}>
              重新扫描
            </button>
          </div>
        </div>
      </header>

      {store.archivedProjects.length === 0 ? (
        <section className="tasker-panel tasker-panel-empty">
          <h2>还没有归档项目</h2>
          <p>在项目详情页归档后，项目文件会移动到 archive 文件夹，并出现在这里。</p>
        </section>
      ) : (
        <div className="tasker-archive-list">
          {store.archivedProjects.map((project) => (
            <ArchiveProjectRow
              key={project.id}
              busy={store.busy}
              project={project}
              onRestore={store.restoreProject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ArchiveProjectRowProps {
  project: Project;
  busy: boolean;
  onRestore: (archivedPath: string) => Promise<void>;
}

function ArchiveProjectRow({ project, busy, onRestore }: ArchiveProjectRowProps) {
  return (
    <article className="tasker-archive-row">
      <div className="tasker-archive-copy">
        <strong>{project.name}</strong>
        <span>归档时间：{project.archivedAt ?? "未知"}</span>
      </div>
      <button
        className="tasker-secondary-button"
        type="button"
        disabled={busy}
        onClick={() => void onRestore(project.path)}
      >
        恢复
      </button>
    </article>
  );
}
