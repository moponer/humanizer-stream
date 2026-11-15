#!/usr/bin/env node
/**
 * deslop —— humanizer-stream 的命令行入口
 *
 * 常用：
 *   deslop article.md                 # 过滤后打到 stdout
 *   deslop -i docs/*.md               # 原地改写
 *   deslop --dir docs --write         # 递归改写整个目录
 *   deslop --check README.md          # 体检：AI 味超阈值就退出码 1（给 CI 用）
 *   deslop proxy --upstream https://api.deepseek.com --port 8787
 *   deslop mcp                        # 作为 MCP server 跑（stdio）
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { extname, join, resolve, relative } from "node:path";
import { createEngine, inspect } from "../src/engine.js";
import { listRules } from "../src/rules/index.js";
import { loadConfig, resolveOptions, profileForFile, defaultConfigFile } from "../src/config.js";
import { grade } from "../src/score.js";

const HELP = `deslop v0.1.0 —— 输出侧去 AI 味

用法
  deslop [文件…] [选项]              过滤后输出到 stdout（无文件时读 stdin）
  deslop -i <文件…>                  原地改写（写回同一文件）
  deslop --dir <目录> [--write]      递归处理目录（--write 才落盘）
  deslop --check <文件…>             只体检，不输出正文
  deslop rules                       列出全部规则
  deslop init                        在当前目录写 .deslop.json
  deslop proxy --upstream <url>      起一个 LLM 反向代理，流式改写回复
  deslop mcp                         以 MCP server 方式运行（stdio）

选项
  --profile <prose|chat|mild|code|all>   档位（默认 prose；.js/.py 等源码自动 code）
  --lang <zh|en|auto>                    只跑对应语种的规则
  --emoji <strip|keep>                   装饰性 emoji 处理（默认 strip）
  --no-comments                          不处理代码块里的注释
  --tables                               连表格单元格一起过滤
  --unsafe                               允许删承载语义的从句（句尾升华）
  --disable <ruleId,ruleId>              临时关掉若干规则
  --report                               把体检报告打到 stderr
  --json                                 报告以 JSON 打到 stderr
  --threshold <n>                        --check 的分数阈值（默认 15）
  --ext <md,txt>                         --dir 时限定扩展名
  --dry-run                              和 --write 搭配：只报告不落盘
  -h, --help / -v, --version
`;

function parseArgs(argv) {
  const opts = { files: [], _: [] };
  const take = (i, name) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${name} 需要一个值`);
    return v;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--") {
      opts.files.push(...argv.slice(i + 1));
      break;
    }
    if (!a.startsWith("-")) {
      opts.files.push(a);
      continue;
    }
    switch (a) {
      case "-h": case "--help": opts.help = true; break;
      case "-v": case "--version": opts.version = true; break;
      case "-i": case "--in-place": case "--write": opts.write = true; break;
      case "--dir": opts.dir = take(i, a); i += 1; break;
      case "--check": opts.check = true; break;
      case "--report": opts.report = true; break;
      case "--json": opts.json = true; break;
      case "--dry-run": opts.dryRun = true; break;
      case "--tables": opts.tables = true; break;
      case "--no-comments": opts.comments = false; break;
      case "--unsafe": opts.unsafe = true; break;
      case "--profile": opts.profile = take(i, a); i += 1; break;
      case "--lang": opts.lang = take(i, a); i += 1; break;
      case "--emoji": opts.emoji = take(i, a); i += 1; break;
      case "--disable": opts.disabled = take(i, a).split(",").map((s) => s.trim()).filter(Boolean); i += 1; break;
      case "--threshold": opts.threshold = Number(take(i, a)); i += 1; break;
      case "--ext": opts.ext = take(i, a).split(",").map((s) => s.trim()); i += 1; break;
      case "--port": opts.port = Number(take(i, a)); i += 1; break;
      case "--upstream": opts.upstream = take(i, a); i += 1; break;
      case "--log": opts.log = take(i, a); i += 1; break;
      default: throw new Error(`未知选项 ${a}`);
    }
  }
  return opts;
}

function readStdin() {
  return new Promise((res, rej) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => { data += c; });
    process.stdin.on("end", () => res(data));
    process.stdin.on("error", rej);
  });
}

function collectDir(dir, exts) {
  const out = [];
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      if (ent.name === "node_modules" || ent.name.startsWith(".git")) continue;
      const p = join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (!exts || exts.includes(extname(ent.name).replace(".", ""))) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function emitReport(report, { json, file }) {
  if (json) {
    process.stderr.write(`${JSON.stringify({ file, ...report })}\n`);
    return;
  }
  const head = `${file ? `${file} ` : ""}AI味 ${report.score}（${grade(report.score)}）· 命中 ${report.totalHits} 处 · ${report.chars} 字`;
  process.stderr.write(`${head}\n`);
  for (const r of report.byRule.slice(0, 12)) {
    process.stderr.write(`  ${String(r.count).padStart(3)}  ${r.id}  ${r.label}\n`);
  }
  if (report.rhythmRun) process.stderr.write(`  ·  连续 ${report.rhythmRun} 句超过 40 字，节奏太匀\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const opts = parseArgs(argv);

  if (opts.help) { process.stdout.write(HELP); return 0; }
  if (opts.version) { process.stdout.write("0.1.0\n"); return 0; }

  if (cmd === "rules") {
    const rows = listRules();
    process.stdout.write(`${rows.length} 条规则\n\n`);
    for (const r of rows) {
      process.stdout.write(`${r.id.padEnd(22)} ${r.kind.padEnd(8)} ${r.cat.padEnd(11)} ${r.label}\n`);
    }
    return 0;
  }

  if (cmd === "init") {
    const p = resolve(".deslop.json");
    if (existsSync(p)) { process.stderr.write(".deslop.json 已存在，不覆盖\n"); return 1; }
    writeFileSync(p, `${JSON.stringify(defaultConfigFile(), null, 2)}\n`, "utf8");
    process.stdout.write(`已写入 ${p}\n`);
    return 0;
  }

  if (cmd === "install-lynn") {
    const { cpSync, mkdirSync } = await import("node:fs");
    const { homedir } = await import("node:os");
    const { fileURLToPath } = await import("node:url");
    const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
    const dest = resolve(process.env.LYNN_PLUGIN_DIR ?? join(homedir(), ".lynn", "plugins", "humanizer-stream"));
    mkdirSync(dest, { recursive: true });
    cpSync(join(root, "src"), join(dest, "src"), { recursive: true });
    cpSync(join(root, "adapters", "lynn", "lynn.plugin.json"), join(dest, "lynn.plugin.json"));
    // 装进插件目录后，入口要多跳一层：../../src → ./src
    const entry = readFileSync(join(root, "adapters", "lynn", "index.js"), "utf8")
      .replace('"../../src/index.js"', '"./src/index.js"');
    writeFileSync(join(dest, "index.js"), entry, "utf8");
    process.stdout.write(`已安装到 ${dest}\n在 lynn 的设置 → 权限与安全 里打开「去 AI 味」即生效。\n`);
    return 0;
  }

  if (cmd === "proxy") {
    const { startProxy } = await import("../src/proxy.js");
    return startProxy({
      port: opts.port ?? 8787,
      upstream: opts.upstream,
      log: opts.log,
      profile: opts.profile ?? "chat",
      lang: opts.lang,
      comments: opts.comments,
    });
  }

  if (cmd === "mcp") {
    const { startMcp } = await import("../src/mcp.js");
    return startMcp({ profile: opts.profile ?? "prose", lang: opts.lang });
  }

  // 文件 / stdin
  const cfg = loadConfig();
  const threshold = Number.isFinite(opts.threshold) ? opts.threshold : (cfg.threshold ?? 15);

  let targets = [...opts.files];
  if (opts.dir) targets.push(...collectDir(resolve(opts.dir), opts.ext));

  if (targets.length === 0) {
    const text = await readStdin();
    const base = resolveOptions(cfg, cliToOptions(opts));
    const engine = createEngine(base);
    const out = engine.push(text) + engine.end();
    process.stdout.write(out.trim() || !text.trim() ? out : text);
    if (opts.report || opts.json) emitReport(engine.report(), { json: opts.json });
    return 0;
  }

  let worst = 0;
  let failed = false;
  for (const file of targets) {
    const abs = resolve(file);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      process.stderr.write(`跳过（不是文件）：${file}\n`);
      continue;
    }
    const text = readFileSync(abs, "utf8");
    const guess = profileForFile(abs);
    const base = resolveOptions(
      { ...cfg, ...guess },
      cliToOptions(opts),
    );

    if (opts.check) {
      const report = inspect(text, base);
      worst = Math.max(worst, report.score);
      emitReport(report, { json: opts.json, file: relative(process.cwd(), abs) });
      if (report.score > threshold) failed = true;
      continue;
    }

    const engine = createEngine(base);
    const out = engine.push(text) + engine.end();
    const final = out.trim() || !text.trim() ? out : text;
    const report = engine.report();
    worst = Math.max(worst, report.score);

    if (opts.write) {
      if (opts.dryRun) {
        process.stderr.write(`[dry-run] ${file}\n`);
      } else if (final !== text) {
        writeFileSync(abs, final, "utf8");
        process.stderr.write(`已改写 ${file}（命中 ${report.totalHits} 处）\n`);
      }
    } else {
      process.stdout.write(final);
    }
    if (opts.report || opts.json) emitReport(report, { json: opts.json, file });
  }

  if (opts.check) {
    process.stderr.write(failed ? `\n体检未过：最高 ${worst} > 阈值 ${threshold}\n` : `\n体检通过：最高 ${worst} ≤ 阈值 ${threshold}\n`);
    return failed ? 1 : 0;
  }
  return 0;
}

function cliToOptions(opts) {
  const out = {};
  if (opts.profile) out.profile = opts.profile;
  if (opts.lang) out.lang = opts.lang;
  if (opts.emoji) out.emoji = opts.emoji;
  if (opts.comments === false) out.comments = false;
  if (opts.tables) out.tables = true;
  if (opts.unsafe) out.unsafe = true;
  if (opts.disabled) out.disabled = opts.disabled;
  return out;
}

main().then(
  (code) => process.exit(code ?? 0),
  (err) => {
    process.stderr.write(`deslop: ${err?.message ?? err}\n`);
    process.exit(2);
  },
);
