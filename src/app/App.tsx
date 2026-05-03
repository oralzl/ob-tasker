import type { TaskerRuntime } from "./taskerRuntime";
import { useTaskerStore, type TaskerStore } from "./useTaskerStore";
import { HomePage } from "../components/HomePage";
import { ProjectDetailPage } from "../components/ProjectDetailPage";
import { ArchivePage } from "../components/ArchivePage";

export interface AppProps {
  runtime: TaskerRuntime;
}

export function App({ runtime }: AppProps) {
  const store = useTaskerStore(runtime);

  return (
    <div className="tasker-shell">
      <main className="tasker-main">
        {store.externalChangePath && (
          <div className="tasker-external-change-banner">
            <span>Markdown 文件已在外部修改：{store.externalChangePath}</span>
            <div>
              <button className="tasker-secondary-button" type="button" onClick={() => void store.reload()}>
                重新加载
              </button>
              <button className="tasker-link-button" type="button" onClick={store.clearExternalChange}>
                忽略
              </button>
            </div>
          </div>
        )}
        {renderPage(store)}
      </main>
    </div>
  );
}

function renderPage(store: TaskerStore) {
  if (store.loading) {
    return (
      <section className="tasker-empty-state">
        <h1>正在加载</h1>
        <p>Tasker 正在初始化无项目任务、项目目录和归档项目。</p>
      </section>
    );
  }

  if (store.error) {
    return (
      <section className="tasker-empty-state">
        <h1>加载失败</h1>
        <p>{store.error}</p>
        <button className="tasker-primary-button" type="button" onClick={() => void store.reload()}>
          重新加载
        </button>
      </section>
    );
  }

  if (store.page === "archive") {
    return <ArchivePage store={store} />;
  }

  if (store.page === "projectDetail") {
    return <ProjectDetailPage store={store} />;
  }

  return <HomePage store={store} />;
}
