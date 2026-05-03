const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

export function sanitizeProjectFileName(projectName: string): string {
  const cleaned = projectName
    .trim()
    .replace(UNSAFE_FILENAME_CHARS, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^\.+$/, "")
    .replace(/^\.+/, "")
    .slice(0, 120)
    .trim();

  return cleaned || "Untitled Project";
}

export function ensureMarkdownExtension(fileName: string): string {
  return fileName.toLowerCase().endsWith(".md") ? fileName : `${fileName}.md`;
}

export function joinVaultPath(...parts: string[]): string {
  return parts
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

export function projectFilePath(projectDir: string, projectName: string): string {
  return joinVaultPath(projectDir, ensureMarkdownExtension(sanitizeProjectFileName(projectName)));
}

export function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

export function basenameWithoutExtension(path: string): string {
  return basename(path).replace(/\.md$/i, "");
}

export function isDirectChildMarkdown(path: string, dir: string): boolean {
  const normalizedDir = dir.replace(/^\/+|\/+$/g, "");
  const prefix = normalizedDir ? `${normalizedDir}/` : "";
  if (!path.startsWith(prefix) || !path.toLowerCase().endsWith(".md")) {
    return false;
  }

  return !path.slice(prefix.length).includes("/");
}
