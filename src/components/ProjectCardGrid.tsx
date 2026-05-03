import { useEffect, useRef } from "react";
import Sortable from "sortablejs";
import type { Project } from "../types/project";
import { ProjectCard } from "./ProjectCard";

export interface ProjectCardGridProps {
  projects: Project[];
  busy: boolean;
  onAddTask: (projectId: string, title: string) => Promise<void>;
  onCompleteTask: (projectId: string, taskId: string) => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onPromoteTask: (projectId: string, taskId: string) => Promise<void>;
  onReorder: (projectIds: string[]) => Promise<void>;
}

export function ProjectCardGrid({
  projects,
  busy,
  onAddTask,
  onCompleteTask,
  onOpenProject,
  onPromoteTask,
  onReorder,
}: ProjectCardGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!gridRef.current) {
      return undefined;
    }

    const sortable = Sortable.create(gridRef.current, {
      animation: 180,
      draggable: ".tasker-project-card",
      handle: ".tasker-card-drag-handle",
      ghostClass: "is-dragging",
      onEnd: () => {
        const projectIds = Array.from(gridRef.current?.children ?? [])
          .map((child) => child.getAttribute("data-project-id"))
          .filter((projectId): projectId is string => Boolean(projectId));
        void onReorder(projectIds);
      },
    });

    return () => sortable.destroy();
  }, [onReorder, projects.length]);

  if (projects.length === 0) {
    return (
      <section className="tasker-panel tasker-panel-empty">
        <h2>还没有项目</h2>
        <p>在上方输入任务和项目名，Tasker 会创建第一个项目文件。</p>
      </section>
    );
  }

  return (
    <div className="tasker-card-grid" ref={gridRef}>
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          busy={busy}
          project={project}
          onAddTask={onAddTask}
          onCompleteTask={onCompleteTask}
          onOpenProject={onOpenProject}
          onPromoteTask={onPromoteTask}
        />
      ))}
    </div>
  );
}
