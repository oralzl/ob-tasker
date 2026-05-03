import { describe, expect, it } from "vitest";
import {
  buildTaskerMarkdown,
  parseTaskerMarkdown,
  setTaskStatus,
  splitTaskerSection,
  updateTaskStatus,
} from "../services/taskerMarkdown";
import type { Task } from "../types/task";

function idGenerator(ids: string[]): () => string {
  let index = 0;
  return () => ids[index++] ?? `generated_${index}`;
}

describe("taskerMarkdown", () => {
  it("creates a Tasker section when missing", () => {
    const result = parseTaskerMarkdown("# Project\n\nNotes.", {
      generateTaskId: idGenerator([]),
    });

    expect(result.taskerSectionExisted).toBe(false);
    expect(result.repairs).toContain("created-tasker-section");
    expect(result.normalizedMarkdown).toBe("# Project\n\nNotes.\n\n## Tasker\n");
  });

  it("keeps project body outside the Tasker section", () => {
    const markdown = [
      "# Project",
      "",
      "Background.",
      "",
      "## Tasker",
      "",
      "- [ ] First node",
      "  id:: task_1",
      "  状态:: 待处理",
      "",
      "## Notes",
      "",
      "Later note.",
    ].join("\n");

    const split = splitTaskerSection(markdown);

    expect(split.body).toBe("# Project\n\nBackground.\n\n## Notes\n\nLater note.");
    expect(split.taskerBody).toContain("- [ ] First node");
  });

  it("parses task title, fields, and optional metadata", () => {
    const result = parseTaskerMarkdown(
      [
        "## Tasker",
        "",
        "- [ ] 等 Alex 确认首页结构",
        "  id:: task_1",
        "  状态:: 等别人",
        "  责任人:: Alex",
        "  跟进日期:: 2026-05-06",
      ].join("\n"),
    );

    expect(result.tasks).toEqual([
      {
        id: "task_1",
        title: "等 Alex 确认首页结构",
        status: "等别人",
        owner: "Alex",
        followUpDate: "2026-05-06",
        completedAt: undefined,
      },
    ]);
  });

  it("uses status as source of truth when checkbox conflicts", () => {
    const result = parseTaskerMarkdown(
      [
        "## Tasker",
        "",
        "- [x] Still open",
        "  id:: task_1",
        "  状态:: 待处理",
      ].join("\n"),
    );

    expect(result.repairs).toContain("checkbox-status-conflict:task_1");
    expect(result.normalizedMarkdown).toContain("- [ ] Still open");
  });

  it("fills missing ids and statuses", () => {
    const result = parseTaskerMarkdown(
      [
        "## Tasker",
        "",
        "- [ ] Missing metadata",
      ].join("\n"),
      {
        generateTaskId: idGenerator(["task_generated"]),
      },
    );

    expect(result.tasks[0]).toMatchObject({
      id: "task_generated",
      status: "待处理",
      title: "Missing metadata",
    });
    expect(result.repairs).toContain("missing-id:0");
    expect(result.repairs).toContain("missing-status:0");
  });

  it("repairs duplicate ids", () => {
    const result = parseTaskerMarkdown(
      [
        "## Tasker",
        "",
        "- [ ] A",
        "  id:: task_dup",
        "  状态:: 待处理",
        "",
        "- [ ] B",
        "  id:: task_dup",
        "  状态:: 待处理",
      ].join("\n"),
      {
        generateTaskId: idGenerator(["task_new"]),
      },
    );

    expect(result.tasks.map((task) => task.id)).toEqual(["task_dup", "task_new"]);
    expect(result.repairs).toContain("duplicate-id:task_dup");
  });

  it("writes completed tasks with checkbox and completed date", () => {
    const task: Task = {
      id: "task_1",
      title: "Done",
      status: "完成",
      completedAt: "2026-04-30",
    };

    expect(buildTaskerMarkdown("", [task])).toBe(
      [
        "## Tasker",
        "",
        "- [x] Done",
        "  id:: task_1",
        "  状态:: 完成",
        "  完成时间:: 2026-04-30",
        "",
      ].join("\n"),
    );
  });

  it("sets and removes completedAt when status changes", () => {
    const task: Task = {
      id: "task_1",
      title: "Ship parser",
      status: "待处理",
    };

    const completed = setTaskStatus(task, "完成", "2026-04-30");
    expect(completed.completedAt).toBe("2026-04-30");

    const reopened = setTaskStatus(completed, "待处理", "2026-05-01");
    expect(reopened.completedAt).toBeUndefined();
  });

  it("moves the previous in-progress task back to todo", () => {
    const tasks: Task[] = [
      { id: "task_1", title: "A", status: "进行中" },
      { id: "task_2", title: "B", status: "待处理" },
    ];

    expect(updateTaskStatus(tasks, "task_2", "进行中")).toMatchObject([
      { id: "task_1", status: "待处理" },
      { id: "task_2", status: "进行中" },
    ]);
  });

  it("keeps Inbox task output free of project fields", () => {
    const output = buildTaskerMarkdown("# Tasker Inbox", [
      {
        id: "task_1",
        title: "Unsorted",
        status: "待处理",
      },
    ]);

    expect(output).not.toContain("项目::");
    expect(output).toContain("# Tasker Inbox\n\n## Tasker");
  });

  it("parses and writes task area metadata", () => {
    const result = parseTaskerMarkdown(
      [
        "## Tasker",
        "",
        "- [ ] Buy milk",
        "  id:: task_1",
        "  状态:: 待处理",
        "  area:: 家庭",
      ].join("\n"),
    );

    expect(result.tasks[0]).toMatchObject({
      id: "task_1",
      area: "家庭",
    });
    expect(buildTaskerMarkdown("# Inbox", result.tasks)).toContain("  area:: 家庭");
  });
});
