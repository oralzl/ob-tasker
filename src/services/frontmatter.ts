export type FrontmatterValue = string | undefined;

interface FrontmatterParts {
  fields: Record<string, string>;
  body: string;
  hasFrontmatter: boolean;
}

export function readFrontmatterField(markdown: string, key: string): FrontmatterValue {
  return splitFrontmatter(markdown).fields[key];
}

export function readFrontmatterFields(markdown: string): Record<string, string> {
  return splitFrontmatter(markdown).fields;
}

export function stripFrontmatter(markdown: string): string {
  return splitFrontmatter(markdown).body;
}

export function upsertFrontmatterFields(
  markdown: string,
  fields: Record<string, string | undefined>,
): string {
  const parts = splitFrontmatter(markdown);
  const nextFields = { ...parts.fields };

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value.trim() === "") {
      delete nextFields[key];
    } else {
      nextFields[key] = value;
    }
  }

  return joinFrontmatter(nextFields, parts.body);
}

export function removeFrontmatterFields(markdown: string, keys: string[]): string {
  const fields = Object.fromEntries(keys.map((key) => [key, undefined]));
  return upsertFrontmatterFields(markdown, fields);
}

function splitFrontmatter(markdown: string): FrontmatterParts {
  const normalized = markdown.replace(/\r\n?/g, "\n");

  if (!normalized.startsWith("---\n")) {
    return {
      fields: {},
      body: normalized.trimStart(),
      hasFrontmatter: false,
    };
  }

  const endIndex = normalized.indexOf("\n---", 4);
  if (endIndex === -1) {
    return {
      fields: {},
      body: normalized.trimStart(),
      hasFrontmatter: false,
    };
  }

  const frontmatter = normalized.slice(4, endIndex);
  const bodyStart = normalized.slice(endIndex + 4).replace(/^\n/, "");

  return {
    fields: parseFrontmatter(frontmatter),
    body: bodyStart.trimStart(),
    hasFrontmatter: true,
  };
}

function parseFrontmatter(frontmatter: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const line of frontmatter.split("\n")) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }

    fields[match[1]] = unquoteYamlValue(match[2].trim());
  }

  return fields;
}

function joinFrontmatter(fields: Record<string, string>, body: string): string {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${quoteYamlValue(value)}`);
  const normalizedBody = body.trimStart();

  if (lines.length === 0) {
    return normalizedBody;
  }

  return `---\n${lines.join("\n")}\n---\n\n${normalizedBody}`.trimEnd() + "\n";
}

function quoteYamlValue(value: string): string {
  return JSON.stringify(value);
}

function unquoteYamlValue(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }

  return value;
}
