import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../src/check.js";
import { extractStrings } from "../src/strings.js";

const SLOP = [
  "随着人工智能技术的不断发展，各行各业都在加速转型。",
  "值得注意的是，我们对现有流程进行了分析，效率得到显著提升。",
  "综上所述，这不仅是工具升级，更是组织能力的跃迁。",
  "未来可期，让我们拭目以待。希望对你有帮助。",
].join("\n");

const CLEAN = [
  "订单表在 11 月 14 日涨到 3.2 亿行，按天分页的查询从 40ms 掉到 900ms。",
  "把 created_at 上的单列索引换成 (tenant_id, created_at) 之后回到 55ms。",
  "改动的 SQL 在 migrations/0042.sql，回滚脚本是同一目录下的 down.sql。",
].join("\n");

test("AI 腔文本得分高，且能指出具体是哪几条", () => {
  const r = check(SLOP, { locale: "zh" });
  const ids = r.hits.map((h) => h.id);
  for (const id of ["zh.open.era", "zh.fill.noting", "zh.close.future", "zh.close.hope"]) {
    assert.ok(ids.includes(id), `没抓到 ${id}：${ids.join(",")}`);
  }
  assert.ok(r.score > 50, `分数应偏高，实际 ${r.score}`);
  assert.equal(r.pass, false);
});

test("正常技术说明不误报：分数低、没有命中的套话", () => {
  const r = check(CLEAN, { locale: "zh" });
  assert.ok(r.score < 15, `正常文本被判 AI 味：${r.score}，命中 ${r.hits.map((h) => h.id).join(",")}`);
  assert.ok(r.pass);
  assert.ok(!r.hits.some((h) => h.id.startsWith("zh.close") || h.id === "zh.fact.number"));
});

test("代码块与链接不是散文：不参与判定", () => {
  const text = ["```bash", "# 随着业务的不断发展", "echo 值得注意的是", "```", "见 https://example.com/未来可期"].join("\n");
  const r = check(text, { locale: "zh" });
  assert.equal(r.hits.length, 0, `代码块被当成散文了：${r.hits.map((h) => h.id).join(",")}`);
});

test("同一类里出现两三次才算特征的规则：单处不报", () => {
  const one = check("这个方案,我觉得可以。其余的都对了，没有问题。", { locale: "zh" });
  assert.ok(!one.hits.some((h) => h.id === "zh.format.halfpunct"), "单处半角标点不该定罪");

  const three = check("第一处,第二处.第三处!都用了半角标点。这是一段比较长的话，用来抬高字数避免密度失真。", { locale: "zh" });
  assert.ok(three.hits.some((h) => h.id === "zh.format.halfpunct"), "三处半角标点应该被抓到");
});

test("结构类检测：emoji、满屏加粗、什么都拆成列表", () => {
  const emoji = check("已完成 ✅ 下一步 🚀 继续推进。", { locale: "zh" });
  assert.ok(emoji.hits.some((h) => h.id === "zh.format.emoji"));

  const bold = check(
    ["**效率**：更快", "**稳定**：更稳", "**安全**：更安全", "**成本**：更低", "**生态**：更开放", "**体验**：更顺"].join("\n"),
    { locale: "zh" },
  );
  assert.ok(bold.hits.some((h) => h.id === "zh.struct.bold"), bold.hits.map((h) => h.id).join(","));

  const listy = check(
    Array.from({ length: 9 }, (_, i) => `- 第 ${i + 1} 点：某件事`).join("\n"),
    { locale: "zh" },
  );
  assert.ok(listy.hits.some((h) => h.id === "zh.struct.listify"));
});

test("英文规则并行：as an AI / hope this helps / in today's world", () => {
  const r = check("In today's fast-paced world, tools matter. As an AI language model I cannot verify this. Hope this helps!", {
    locale: "en",
  });
  const ids = r.hits.map((h) => h.id);
  assert.ok(ids.includes("en.open.era"));
  assert.ok(ids.includes("en.voice.self"));
  assert.ok(ids.includes("en.close.hope"));
});

test("源码文案提取：只留给人看的字，跳过 import、标识符与样式", () => {
  const src = [
    'import { useT } from "../i18n";',
    'export const x = { "safety.title": "安全检查", "safety.hint": "开启后每次调用都要你确认。" };',
    'const cls = "flex items-center";',
    "function A() { return <button title=\"开始运行\">开始运行</button>; }",
  ].join("\n");
  const rows = extractStrings(src, { file: "a.tsx" });
  const texts = rows.map((r) => r.text);
  assert.ok(texts.includes("安全检查"));
  assert.ok(texts.includes("开启后每次调用都要你确认。"));
  assert.ok(texts.includes("开始运行"));
  assert.ok(!texts.includes("flex items-center"), "样式类名不是文案");
  assert.ok(!texts.some((t) => t.includes("useT")), "import 不是文案");
  for (const r of rows) assert.ok(r.line >= 1 && r.file === "a.tsx");
});
