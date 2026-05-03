import { ItemView, Plugin, WorkspaceLeaf } from "obsidian";
import { createElement } from "react";
import { createRoot, Root } from "react-dom/client";
import { App } from "./src/app/App";
import { createTaskerRuntime } from "./src/app/taskerRuntime";

const VIEW_TYPE_TASKER = "ob-tasker-view";

class TaskerView extends ItemView {
  private root: Root | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ObTaskerPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_TASKER;
  }

  getDisplayText(): string {
    return "Tasker";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    const mount = container.createDiv({ cls: "tasker-root" });
    this.root = createRoot(mount);

    try {
      const runtime = await createTaskerRuntime(this.plugin);
      this.root.render(createElement(App, { runtime }));
    } catch (error) {
      mount.createEl("div", { cls: "tasker-load-error" }, (el) => {
        el.createEl("h1", { text: "Tasker 启动失败" });
        el.createEl("p", {
          text: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}

export default class ObTaskerPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(
      VIEW_TYPE_TASKER,
      (leaf) => new TaskerView(leaf, this),
    );

    this.addCommand({
      id: "open-tasker",
      name: "Open Tasker",
      callback: () => {
        void this.activateView();
      },
    });
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_TASKER);
  }

  private async activateView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TASKER);

    if (leaves.length > 0) {
      this.app.workspace.revealLeaf(leaves[0]);
      return;
    }

    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE_TASKER,
      active: true,
    });
    this.app.workspace.revealLeaf(leaf);
  }
}
