#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeRules, listRules } from "../src/compose.js";
import { check, summarise } from "../src/check.js";
import { extractStrings } from "../src/strings.js";
import { ruleById, PROFILES } from "../src/rules/index.js";

const HELP = `deslop — 把 AI 腔挡在生成之前

用法：
  deslop inject [--profile chat|prose|code|ui] [--lang zh|en] [--max 900]
      打印可直接塞进系统提示词的写作规则。宿主的用法就这一条。

  deslop check <文件或目录...> [--threshold 15] [--json] [--lang zh|en|auto] [--profile prose]
      体检：数一数这段话里有多少处明确的 AI 写作特征。只报告，不改写。
      超过阈值退出码 1，可以直接当 CI 门禁。

  deslop check --strings <源码...>
      源码模式：先从 TS/TSX/JS 里抠出给用户看的文案（字符串字面量与 JSX 文本），
      再逐条体检。用来抽查界面文案。

  deslop rules [--profile prose] [--lang zh] [--json]
      列出规则（编号 / 分类 / 严重度 / 约束 / 反例 / 为什么）。

  deslop explain <规则号>
      一条规则的完整说明。

  deslop install-lynn
      装成 lynn 的宿主插件（~/.lynn/plugins/humanizer-stream/，或 $LYNN_HOME）。
`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 装成 lynn 插件：src/ 自包含复制过去，根上放适配器入口与清单 */
function installLynn() {
  const home = process.env.LYNN_HOME || path.join(os.homedir(), ".lynn");
  const dest = path.join(home, "plugins", "humanizer-stream");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(path.join(ROOT, "src"), path.join(dest, "src"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "adapters", "lynn", "index.js"), path.join(dest, "index.js"));
  fs.copyFileSync(path.join(ROOT, "adapters", "lynn", "lynn.plugin.json"), path.join(dest, "lynn.plugin.json"));
  fs.copyFileSync(path.join(ROOT, "package.json"), path.join(dest, "package.json"));
  process.stdout.write(`已装到 ${dest}\n重启 lynn 后在「设置 → 权限与安全 → 写作规则」里确认状态。\n`);
}

const FLAGS = new Set(["json", "strings"]);
const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith("-") ? args[0] : "help";

const opt = { profile: undefined, lang: "zh", max: undefined, threshold: 15, json: false, strings: false };
const paths = [];
for (let i = cmd === "help" ? 0 : 1; i < args.length; i += 1) {
  const a = args[i];
  if (a === "--profile") opt.profile = args[++i];
  else if (a === "--lang") opt.lang = args[++i] ?? "zh";
  else if (a === "--max") opt.max = Number(args[++i]) || undefined;
  else if (a === "--threshold") opt.threshold = Number(args[++i]) || 0;
  else if (a.startsWith("--")) {
    const key = a.slice(2);
    if (FLAGS.has(key)) opt[key] = true;
  } else paths.push(a);
}

const TEXT_EXT = new Set([".md", ".txt", ".markdown", ".json"]);
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return [p];
  const out = [];
  for (const name of fs.readdirSync(p)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === "build") continue;
    out.push(...walk(path.join(p, name)));
  }
  return out;
}

function printInject() {
  const text = composeRules({ profile: opt.profile ?? "chat", locale: opt.lang, maxChars: opt.max });
  if (!text) {
    console.error("这个场景没有可用的规则（检查 --profile / --lang）。");
    process.exit(2);
  }
  process.stdout.write(text + "\n");
}

function printRules() {
  const rows = listRules({ profile: opt.profile ?? "prose", locale: opt.lang });
  if (opt.json) {
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    return;
  }
  for (const r of rows) {
    process.stdout.write(`${r.id}\t[${r.cat} sev${r.sev}]\t${r.rule}\n`);
    if (r.bad) process.stdout.write(`\t反例：${r.bad}\n`);
  }
  process.stdout.write(`\n共 ${rows.length} 条。\n`);
}

function printExplain(id) {
  const r = ruleById(id);
  if (!r) {
    console.error(`没有这条规则：${id}`);
    process.exit(2);
  }
  process.stdout.write(`${r.id}\n分类：${r.cat}　严重度：${r.sev ?? 2}\n约束：${r.rule}\n反例：${r.bad ?? "（无）"}\n为什么：${r.why ?? "（未写）"}\n`);
}

function collect() {
  const files = [];
  for (const p of paths) {
    if (!fs.existsSync(p)) {
      console.error(`找不到路径：${p}`);
      process.exit(2);
    }
    files.push(...walk(p));
  }
  return files;
}

function printCheck() {
  if (!paths.length) {
    console.error("要给至少一个文件或目录。见 deslop --help。");
    process.exit(2);
  }
  const files = collect();
  const profile = opt.profile ?? "prose";
  const reports = [];
  let failed = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!opt.strings && !TEXT_EXT.has(ext)) continue;
    if (opt.strings && !CODE_EXT.has(ext)) continue;
    let src = "";
    try {
      src = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (opt.strings) {
      for (const s of extractStrings(src, { file })) {
        // 界面文案也按「散文」那套特征查：ui 场景的规则只进提示词、不带检测正则，
        // 拿它当筛子会漏掉「希望对你有帮助」这类残留
        const r = check(s.text, { locale: opt.lang, profile: profile, threshold: opt.threshold });
        if (r.hits.length) reports.push({ file, line: s.line, text: s.text, ...r });
      }
    } else {
      const r = check(src, { locale: opt.lang, profile, threshold: opt.threshold });
      if (r.hits.length) reports.push({ file, line: 1, text: "", ...r });
    }
  }

  for (const r of reports) {
    if (!r.pass) failed += 1;
  }

  if (opt.json) {
    process.stdout.write(JSON.stringify({ threshold: opt.threshold, files: reports.length, failed, reports }, null, 2) + "\n");
  } else {
    for (const r of reports) {
      const where = r.text ? `${r.file}:${r.line}` : r.file;
      process.stdout.write(`${r.pass ? "·" : "✗"} ${where}  ${summarise(r)}\n`);
      for (const h of r.hits.slice(0, 6)) {
        process.stdout.write(`    ${h.id}  ${h.excerpt}\n`);
      }
      if (r.text) process.stdout.write(`    原文：${r.text.slice(0, 80)}\n`);
    }
    const worst = reports.filter((r) => !r.pass).length;
    process.stdout.write(`\n体检 ${reports.length} 段，超阈值 ${worst} 段（阈值 ${opt.threshold}）。\n`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

switch (cmd) {
  case "inject":
    printInject();
    break;
  case "rules":
    printRules();
    break;
  case "explain":
    printExplain(args[1] ?? "");
    break;
  case "check":
    printCheck();
    break;
  case "install-lynn":
    installLynn();
    break;
  case "help":
  case "--help":
  case "-h":
    process.stdout.write(HELP);
    break;
  case "profiles":
    for (const [k, v] of Object.entries(PROFILES)) process.stdout.write(`${k}\t${v.label}\t${v.cats.join(",") || "（专属规则）"}\n`);
    break;
  default:
    console.error(`未知命令：${cmd}\n`);
    process.stdout.write(HELP);
    process.exit(2);
}
