import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, extname, resolve } from "node:path";
import { DEFAULTS } from "./engine.js";

export const CONFIG_FILES = [".deslop.json", ".desloprc.json", ".humanizerrc.json"];

/** 读配置：项目目录优先，其次用户目录 */
export function loadConfig(cwd = process.cwd()) {
  const candidates = [
    ...CONFIG_FILES.map((f) => resolve(cwd, f)),
    join(homedir(), ".deslop", "config.json"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      const raw = JSON.parse(readFileSync(file, "utf8"));
      return { ...raw, __file: file };
    } catch {
      // 配置写坏了不影响主流程，安静跳过
    }
  }
  return {};
}

export function resolveOptions(...layers) {
  const out = { ...DEFAULTS };
  for (const layer of layers) {
    if (!layer) continue;
    for (const [k, v] of Object.entries(layer)) {
      if (v === undefined) continue;
      if (k.startsWith("__")) continue;
      if (k === "disabled" && Array.isArray(v)) out.disabled = [...new Set(v)];
      else out[k] = v;
    }
  }
  return out;
}

const CODE_EXT = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".jsonc", ".rs", ".go",
  ".java", ".kt", ".c", ".h", ".cc", ".cpp", ".hpp", ".cs", ".py", ".rb", ".php",
  ".swift", ".m", ".scala", ".sh", ".bash", ".zsh", ".ps1", ".sql", ".css", ".scss",
  ".less", ".vue", ".svelte", ".lua", ".toml", ".ini", ".conf", ".yml", ".yaml",
]);

const PROSE_EXT = new Set([
  ".md", ".markdown", ".mdx", ".txt", ".rst", ".adoc", ".org", ".tex", ".html", ".htm",
  ".svg", ".xml", ".csv", ".tsv", ".srt", ".vtt",
]);

/** 按扩展名猜档位：源码走 code（只碰注释），其余走 prose */
export function profileForFile(file) {
  const ext = extname(String(file || "")).toLowerCase();
  if (CODE_EXT.has(ext)) return { profile: "code", mode: "code" };
  if (PROSE_EXT.has(ext)) return { profile: "prose", mode: "text" };
  return { profile: "prose", mode: "text" };
}

/** 默认落盘配置，给 `deslop init` 用 */
export function defaultConfigFile() {
  return {
    profile: "prose",
    lang: "auto",
    emoji: "strip",
    comments: true,
    tables: false,
    disabled: [],
    unsafe: false,
  };
}
