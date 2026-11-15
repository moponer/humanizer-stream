import { test } from "node:test";
import assert from "node:assert/strict";
import { allRules, selectRules, ruleById, CATEGORIES, PROFILES } from "../src/rules/index.js";
import { zhRules } from "../src/rules/zh.js";
import { enRules } from "../src/rules/en.js";

test("规则表结构：id 唯一、分类合法、每条都能直接进提示词", () => {
  const ids = new Set();
  for (const r of allRules()) {
    assert.ok(r.id && !ids.has(r.id), `规则 id 重复：${r.id}`);
    ids.add(r.id);
    assert.ok(CATEGORIES.includes(r.cat), `${r.id} 的分类不在表里：${r.cat}`);
    assert.ok([1, 2, 3].includes(r.sev ?? 2), `${r.id} 的严重度只能是 1–3`);
    assert.ok(r.rule && r.rule.length <= 42, `${r.id} 的约束要写成一句短祈使句：${r.rule}`);
    assert.ok(r.why && r.why.length >= 6, `${r.id} 要写清为什么这是 AI 味（否则下一个人会删掉它）`);
    if (r.bad) assert.ok(r.bad.length <= 56, `${r.id} 的反例太长，会挤占提示词预算：${r.bad}`);
    if (r.re) assert.ok(r.re instanceof RegExp, `${r.id} 的 re 必须是正则`);
    if (r.detect) assert.ok(["bold-ratio", "dash", "emoji", "list-ratio"].includes(r.detect), `${r.id} 的检测器不存在：${r.detect}`);
  }
  assert.ok(zhRules.length >= 25, "中文规则太少，覆盖不住常见 AI 腔");
  assert.ok(enRules.length >= 10);
});

test("选规则是同参同输出：宿主把它拼进系统提示词，抖动就等于打穿前缀缓存", () => {
  const a = selectRules({ profile: "chat", locale: "zh" });
  const b = selectRules({ profile: "chat", locale: "zh" });
  assert.deepEqual(a.map((r) => r.id), b.map((r) => r.id));
  assert.deepEqual(
    allRules().map((r) => r.id),
    allRules().map((r) => r.id),
  );
});

test("每个场景都拿到规则，且 chat 比 prose 省", () => {
  for (const profile of Object.keys(PROFILES)) {
    const rows = selectRules({ profile, locale: "zh" });
    assert.ok(rows.length > 0, `${profile} 场景没有规则`);
  }
  const chat = selectRules({ profile: "chat", locale: "zh" });
  const prose = selectRules({ profile: "prose", locale: "zh" });
  assert.ok(prose.length > chat.length, "文档场景应该比对话场景覆盖更多类别");
  assert.ok(!chat.some((r) => r.cat === "rhythm" && r.sev === 1), "对话场景不该塞轻量排版规则");
});

test("预算收紧时整条丢弃，不截半句", () => {
  const tight = selectRules({ profile: "prose", locale: "zh", maxChars: 300 });
  const loose = selectRules({ profile: "prose", locale: "zh", maxChars: 5000 });
  assert.ok(tight.length < loose.length);
  for (const r of tight) assert.ok(ruleById(r.id), "丢弃后留下的仍必须是完整规则");
});

test("code 场景只给注释与提交信息规则", () => {
  const rows = selectRules({ profile: "code", locale: "zh" });
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.id.startsWith("zh.code.")));
  assert.equal(selectRules({ profile: "code", locale: "en" }).length, 3);
});
