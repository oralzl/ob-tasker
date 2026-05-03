# Ob Tasker

Markdown-backed project and task focus manager for Obsidian.

## Install From Release

1. Open the latest GitHub release.
2. Download `ob-tasker.zip`.
3. Unzip it into your vault:

```text
<your-vault>/.obsidian/plugins/ob-tasker/
```

The folder must contain:

```text
main.js
manifest.json
styles.css
```

4. In Obsidian, open Settings -> Community plugins.
5. Disable Safe mode if needed, then enable `Ob Tasker`.

## Build From Source

```bash
npm ci
npm run build
```

The build writes the deployable plugin files to:

```text
.obsidian/plugins/ob-tasker/
```

Copy that folder into another vault's `.obsidian/plugins/` directory to install manually.

## Development

```bash
npm run typecheck
npm test
npm run build
```

The plugin stores task data in `ob-tasker/inbox.md` and `ob-tasker/projects/` inside the vault.
The repository excludes local vault data such as `ob-tasker/`, legacy `Tasker Inbox.md` and `projects/`, and `.obsidian/`.
