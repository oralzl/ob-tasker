import type { Task } from "./task";

export interface Project {
  id: string;
  name: string;
  path: string;
  body: string;
  tasks: Task[];
  archivedAt?: string;
  area: string;
}

export interface TaskerFileParseResult {
  body: string;
  tasks: Task[];
  normalizedMarkdown: string;
  taskerSectionExisted: boolean;
  repairs: string[];
}
