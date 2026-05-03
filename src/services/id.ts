import { formatDateTimeForId } from "./date";

export type IdPrefix = "task" | "proj";

export function createTaskId(date = new Date(), random = Math.random): string {
  return createId("task", date, random);
}

export function createProjectId(date = new Date(), random = Math.random): string {
  return createId("proj", date, random);
}

export function createId(
  prefix: IdPrefix,
  date = new Date(),
  random = Math.random,
): string {
  return `${prefix}_${formatDateTimeForId(date)}_${randomShort(random)}`;
}

function randomShort(random: () => number): string {
  const value = Math.floor(random() * 0xffff);
  return value.toString(16).padStart(4, "0").slice(0, 4);
}
