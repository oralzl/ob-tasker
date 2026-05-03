import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const outDir = resolve(root, ".obsidian/plugins/ob-tasker");

mkdirSync(outDir, { recursive: true });
copyFileSync(resolve(root, "manifest.json"), resolve(outDir, "manifest.json"));
copyFileSync(resolve(root, "styles.css"), resolve(outDir, "styles.css"));
