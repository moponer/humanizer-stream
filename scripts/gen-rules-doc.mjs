#!/usr/bin/env node
/**
 * 从规则表生成 docs/RULES.md（单一事实源是 src/rules/*.js，文档不手写）。
 * 用法：node scripts/gen-rules-doc.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allRules, CATEGORIES, CATEGORY_LABELS } from "../src/rules/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const zh = allRules().filter((r) => r.id.startsWith("zh."));
const en = allRules().filter((r) => r.id.startsWith("en."));

function table(rows, lang) {
  const head = lang === "en"
    ? ["规则号", "分类", "严重度", "约束", "能否检测"]
    : ["规则号", "分类", "严重度", "约束", "能否检测"];
  const lines = [
    `| ${head.join(" | ")} |`,
    `| --- | --- | --- | --- | --- |`,
    ...rows.map((r) => `| \`${r.id}\` | ${CATEGORY_LABELS[r.cat] ?? r.cat} | ${r.sev ?? 2} | ${r.rule} | ${r.re || r.detect ? "是" : "仅提示词"} |`),
  ];
  return lines.join("\n");
}

function details(rows) {
  return rows
    .map((r) =>
      [
        `### \`${r.id}\`　${CATEGORY_LABELS[r.cat] ?? r.cat} · 严重度 ${r.sev ?? 2}`,
        "",
        `- **约束**：${r.rule}`,
        r.bad ? `- **反例**：${r.bad}` : "",
        r.why ? `- **为什么**：${r.why}` : "",
        `- **检测**：${r.re ? "正则命中" : r.detect ? `结构检测（${r.detect}）` : "只进提示词，不参与评分"}`,
        "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
}

const counts = CATEGORIES.map((c) => {
  const n = allRules().filter((r) => r.cat === c).length;
  return `| ${CATEGORY_LABELS[c]} | \`${c}\` | ${n} |`;
}).join("\n");

const doc = `# 规则全表

> 本文件由 \`node scripts/gen-rules-doc.mjs\` 生成，不要手改。改规则请改 \`src/rules/zh.js\` 与 \`src/rules/en.js\`。

## 分类

| 分类 | 代号 | 条数 |
| --- | --- | --- |
${counts}

## 中文规则（${zh.length} 条）

${table(zh, "zh")}

## English rules (${en.length})

${table(en, "en")}

---

## 逐条说明

${details(zh)}

${details(en)}
`;

fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs", "RULES.md"), doc.replace(/\n{3,}/g, "\n\n"), "utf8");
process.stdout.write(`docs/RULES.md 已生成：${zh.length} 条中文 + ${en.length} 条英文。\n`);
