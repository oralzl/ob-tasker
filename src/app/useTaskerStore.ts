import { useCallback, useEffect, useMemo, useState } from "react";
import { TFile } from "obsidian";
import type { TaskerRuntime } from "./taskerRuntime";
import { createDefaultTask, type InboxSnapshot } from "../services/inboxService";
import { updateTaskStatus as updateTaskStatusList } from "../services/taskerMarkdown";
import type { Project } from "../types/project";
import {
  getActiveProjectOrder,
  normalizeAreaName,
  type TaskerViewId,
  withActiveProjectOrder,
} from "../types/settings";
import type { Task, TaskStatus } from "../types/task";

export type MainTaskerPage = Extract<TaskerViewId, "home" | "archive" | "projectDetail">;

export interface TaskerStoreState {
  page: MainTaskerPage;
  activeProjectId?: string;
  projects: Project[];
  archivedProjects: Project[];
  inbox: InboxSnapshot;
  areas: string[];
  activeArea: string;
  loading: boolean;
  busy: boolean;
  error?: string;
  externalChangePath?: string;
}

export interface TaskerStore extends TaskerStoreState {
  reload: () => Promise<void>;
  setPage: (page: MainTaskerPage) => void;
  setActiveArea: (area: string) => Promise<void>;
  openProject: (projectId: string) => void;
  createQuickTask: (title: string, projectName?: string) => Promise<void>;
  addTaskToProject: (projectId: string, title: string) => Promise<void>;
  archiveProject: (projectId: string) => Promise<boolean>;
  assignInboxTask: (taskId: string, projectName: string) => Promise<void>;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
  openMarkdownFile: (projectId: string) => Promise<void>;
  reorderProjects: (projectIds: string[]) => Promise<void>;
  reorderProjectTasks: (projectId: string, taskIds: string[]) => Promise<void>;
  restoreProject: (archivedPath: string) => Promise<void>;
  saveProjectBody: (projectId: string, body: string) => Promise<void>;
  createOpenClawContextJob: (projectId: string) => Promise<void>;
  applyOpenClawContext: (projectId: string) => Promise<void>;
  updateProjectName: (projectId: string, name: string) => Promise<void>;
  updateTask: (projectId: string, taskId: string, patch: Partial<Task>) => Promise<void>;
  updateTaskStatus: (projectId: string, taskId: string, status: TaskStatus) => Promise<void>;
  clearExternalChange: () => void;
}

const EMPTY_INBOX: InboxSnapshot = {
  body: "# Tasker Inbox",
  tasks: [],
};

export function useTaskerStore(runtime: TaskerRuntime): TaskerStore {
  const initialPage = toMainPage(runtime.settings.lastView);
  const [state, setState] = useState<TaskerStoreState>({
    page: initialPage,
    projects: [],
    archivedProjects: [],
    inbox: EMPTY_INBOX,
    areas: runtime.settings.areas,
    activeArea: runtime.settings.activeArea,
    loading: true,
    busy: false,
  });

  const reload = useCallback(async () => {
    setState((current) => ({
      ...current,
      loading: true,
      error: undefined,
    }));

    try {
      const [projects, archivedProjects, inbox] = await Promise.all([
        runtime.projectService.listProjects(),
        runtime.archiveService.listArchivedProjects(),
        runtime.inboxService.readInbox(),
      ]);

      setState((current) => ({
        ...current,
        projects,
        archivedProjects,
        inbox,
        areas: runtime.settings.areas,
        activeArea: runtime.settings.activeArea,
        loading: false,
        error: undefined,
        externalChangePath: undefined,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [runtime]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const eventRef = runtime.plugin.app.vault.on("modify", (file) => {
      if (!(file instanceof TFile)) {
        return;
      }

      void handleExternalModify(file, runtime, (path) => {
        setState((current) => ({
          ...current,
          externalChangePath: path,
        }));
      });
    });

    return () => runtime.plugin.app.vault.offref(eventRef);
  }, [runtime]);

  const setPage = useCallback((page: MainTaskerPage) => {
    setState((current) => ({
      ...current,
      page,
      activeProjectId: page === "projectDetail" ? current.activeProjectId : undefined,
    }));
    runtime.settings.lastView = page;
    void runtime.settingsService.update((settings) => ({
      ...settings,
      lastView: page,
    }));
  }, [runtime]);

  const setActiveArea = useCallback(async (area: string) => {
    const nextArea = normalizeAreaName(area);
    const nextAreas = Array.from(new Set([...runtime.settings.areas, nextArea]));
    runtime.settings.activeArea = nextArea;
    runtime.settings.areas = nextAreas;
    await runtime.settingsService.update((settings) => ({
      ...settings,
      activeArea: nextArea,
      areas: nextAreas,
      lastView: "home",
    }));
    setState((current) => ({
      ...current,
      page: "home",
      activeProjectId: undefined,
    }));
    await reload();
  }, [reload, runtime]);

  const runAction = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    setState((current) => ({
      ...current,
      busy: true,
      error: undefined,
    }));

    try {
      await action();
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        busy: false,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      }));
      return false;
    }

    setState((current) => ({
      ...current,
      busy: false,
    }));
    return true;
  }, [reload]);

  const createQuickTask = useCallback(async (title: string, projectName?: string) => {
    await runAction(async () => {
      const trimmedProjectName = projectName?.trim();
      if (!trimmedProjectName) {
        await runtime.inboxService.createTask(title);
        return;
      }

      const existing = await runtime.projectService.findProjectByName(trimmedProjectName);
      if (existing) {
        await runtime.projectService.appendTask(existing.path, createDefaultTask(title));
        return;
      }

      const project = await runtime.projectService.createProject(trimmedProjectName, title);
      await appendProjectToOrder(runtime, project.id);
    });
  }, [runAction, runtime]);

  const addTaskToProject = useCallback(async (projectId: string, title: string) => {
    await runAction(async () => {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      await runtime.projectService.appendTask(project.path, createDefaultTask(title));
    });
  }, [runAction, runtime, state.projects]);

  const assignInboxTask = useCallback(async (taskId: string, projectName: string) => {
    await runAction(async () => {
      const result = await runtime.inboxService.assignTaskToProject(taskId, projectName);
      await appendProjectToOrder(runtime, result.project.id);
    });
  }, [runAction, runtime]);

  const archiveProject = useCallback(async (projectId: string): Promise<boolean> => {
    const archived = await runAction(async () => {
      const project = findProject(state.projects, projectId);
      await runtime.archiveService.archiveProject(project.path);
    });

    if (archived) {
      setState((current) => ({
        ...current,
        page: "home",
        activeProjectId: undefined,
      }));
      runtime.settings.lastView = "home";
      void runtime.settingsService.update((settings) => ({
        ...settings,
        lastView: "home",
      }));
    }

    return archived;
  }, [runAction, runtime, state.projects]);

  const reorderProjects = useCallback(async (projectIds: string[]) => {
    setState((current) => {
      const order = new Map(projectIds.map((projectId, index) => [projectId, index]));
      return {
        ...current,
        projects: [...current.projects].sort((a, b) => {
          return (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(b.id) ?? Number.MAX_SAFE_INTEGER);
        }),
      };
    });
    Object.assign(runtime.settings, withActiveProjectOrder(runtime.settings, projectIds));
    await runtime.settingsService.update((settings) => withActiveProjectOrder(settings, projectIds));
  }, [runtime]);

  const updateProjectName = useCallback(async (projectId: string, name: string) => {
    await runAction(async () => {
      const project = findProject(state.projects, projectId);
      await runtime.projectService.updateProjectName(project.path, name.trim());
    });
  }, [runAction, runtime, state.projects]);

  const updateTask = useCallback(async (
    projectId: string,
    taskId: string,
    patch: Partial<Task>,
  ) => {
    await runAction(async () => {
      const project = findProject(state.projects, projectId);
      const tasks = project.tasks.map((task) => (
        task.id === taskId ? { ...task, ...patch } : task
      ));
      await runtime.projectService.replaceTasks(project.path, tasks);
    });
  }, [runAction, runtime, state.projects]);

  const updateTaskStatus = useCallback(async (
    projectId: string,
    taskId: string,
    status: TaskStatus,
  ) => {
    await runAction(async () => {
      const project = findProject(state.projects, projectId);
      await runtime.projectService.replaceTasks(
        project.path,
        updateTaskStatusList(project.tasks, taskId, status),
      );
    });
  }, [runAction, runtime, state.projects]);

  const deleteTask = useCallback(async (projectId: string, taskId: string) => {
    await runAction(async () => {
      const project = findProject(state.projects, projectId);
      await runtime.projectService.replaceTasks(
        project.path,
        project.tasks.filter((task) => task.id !== taskId),
      );
    });
  }, [runAction, runtime, state.projects]);

  const reorderProjectTasks = useCallback(async (projectId: string, taskIds: string[]) => {
    await runAction(async () => {
      const project = findProject(state.projects, projectId);
      const order = new Map(taskIds.map((taskId, index) => [taskId, index]));
      const tasks = [...project.tasks].sort((a, b) => {
        return (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.id) ?? Number.MAX_SAFE_INTEGER);
      });
      await runtime.projectService.replaceTasks(project.path, tasks);
    });
  }, [runAction, runtime, state.projects]);

  const restoreProject = useCallback(async (archivedPath: string) => {
    await runAction(async () => {
      await runtime.archiveService.restoreProject(archivedPath);
    });
  }, [runAction, runtime]);

  const saveProjectBody = useCallback(async (projectId: string, body: string) => {
    const project = findProject(state.projects, projectId);
    const updated = await runtime.projectService.updateProjectBody(project.path, body);
    setState((current) => ({
      ...current,
      projects: current.projects.map((item) => item.id === projectId ? updated : item),
      error: undefined,
    }));
  }, [runtime, state.projects]);

  const createOpenClawContextJob = useCallback(async (projectId: string) => {
    await runAction(async () => {
      const project = findProject(state.projects, projectId);
      await runtime.openClawJobService.createEnrichProjectContextJob(project);
    });
  }, [runAction, runtime, state.projects]);

  const applyOpenClawContext = useCallback(async (projectId: string) => {
    await runAction(async () => {
      const project = findProject(state.projects, projectId);
      await runtime.openClawJobService.applyLatestEnrichProjectContext(project);
    });
  }, [runAction, runtime, state.projects]);

  const openMarkdownFile = useCallback(async (projectId: string) => {
    const project = findProject(state.projects, projectId);
    const file = runtime.files.getMarkdownFile(project.path);
    if (!file) {
      throw new Error(`Markdown file not found: ${project.path}`);
    }

    await runtime.plugin.app.workspace.getLeaf("tab").openFile(file);
  }, [runtime, state.projects]);

  const openProject = useCallback((projectId: string) => {
    setState((current) => ({
      ...current,
      page: "projectDetail",
      activeProjectId: projectId,
    }));
    runtime.settings.lastView = "projectDetail";
    void runtime.settingsService.update((settings) => ({
      ...settings,
      lastView: "projectDetail",
    }));
  }, [runtime]);

  const clearExternalChange = useCallback(() => {
    setState((current) => ({
      ...current,
      externalChangePath: undefined,
    }));
  }, []);

  return useMemo(() => ({
    ...state,
    addTaskToProject,
    archiveProject,
    assignInboxTask,
    createQuickTask,
    deleteTask,
    openMarkdownFile,
    openProject,
    reload,
    reorderProjectTasks,
    reorderProjects,
    restoreProject,
    saveProjectBody,
    createOpenClawContextJob,
    applyOpenClawContext,
    setActiveArea,
    setPage,
    updateProjectName,
    updateTask,
    updateTaskStatus,
    clearExternalChange,
  }), [
    addTaskToProject,
    archiveProject,
    assignInboxTask,
    createQuickTask,
    deleteTask,
    openMarkdownFile,
    openProject,
    reload,
    reorderProjectTasks,
    reorderProjects,
    restoreProject,
    saveProjectBody,
    createOpenClawContextJob,
    applyOpenClawContext,
    setActiveArea,
    setPage,
    updateProjectName,
    updateTask,
    updateTaskStatus,
    clearExternalChange,
    state,
  ]);
}

function toMainPage(view: TaskerViewId): MainTaskerPage {
  return view === "archive" ? view : "home";
}

async function appendProjectToOrder(runtime: TaskerRuntime, projectId: string): Promise<void> {
  const currentOrder = getActiveProjectOrder(runtime.settings);
  if (currentOrder.includes(projectId)) {
    return;
  }

  const nextOrder = [...currentOrder, projectId];
  Object.assign(runtime.settings, withActiveProjectOrder(runtime.settings, nextOrder));
  await runtime.settingsService.update((settings) => withActiveProjectOrder(settings, nextOrder));
}

function findProject(projects: Project[], projectId: string): Project {
  const project = projects.find((item) => item.id === projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return project;
}

async function handleExternalModify(
  file: TFile,
  runtime: TaskerRuntime,
  onExternalChange: (path: string) => void,
): Promise<void> {
  if (file.extension !== "md" || !isManagedTaskerPath(file.path, runtime)) {
    return;
  }

  const content = await runtime.plugin.app.vault.read(file);
  if (runtime.files.isSelfWrite(file.path, content)) {
    return;
  }

  onExternalChange(file.path);
}

function isManagedTaskerPath(path: string, runtime: TaskerRuntime): boolean {
  const { inboxPath, projectDir, archiveDir } = runtime.settings;
  return path === inboxPath ||
    path.startsWith(`${projectDir}/`) ||
    path.startsWith(`${archiveDir}/`);
}
