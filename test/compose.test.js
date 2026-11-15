import { test } from "node:test";
import assert from "node:assert/strict";
import { composeRules, composeCost, listRules } from "../src/compose.js";

test("注入文本：表头 + 逐条约束，同参逐字节相同", () => {
  const a = composeRules({ profile: "chat", locale: "zh" });
  const b = composeRules({ profile: "chat", locale: "zh" });
  assert.equal(a, b, "两次必须完全一样（宿主会缓存这段）");
  assert.match(a, /硬约束/);
  for (const line of a.split("\n").slice(1)) assert.match(line, /^- /);
  assert.ok(a.length <= 1000, `chat 场景太长了：${a.length} 字`);
});

test("英文场景输出英文，且不混中文表头", () => {
  const en = composeRules({ profile: "prose", locale: "en" });
  assert.match(en, /hard constraints/i);
  assert.ok(!/硬约束/.test(en));
});

test("maxChars 生效：收紧后条目变少但每行仍完整", () => {
  const wide = composeRules({ profile: "prose", locale: "zh" });
  const tight = composeRules({ profile: "prose", locale: "zh", maxChars: 400 });
  assert.ok(tight.length < wide.length);
  for (const line of tight.split("\n").slice(1)) {
    assert.ok(!line.endsWith("（不要："), `不許截半句：${line}`);
  }
});

test("code 场景只讲注释与提交信息", () => {
  const code = composeRules({ profile: "code", locale: "zh" });
  assert.match(code, /注释/);
  assert.ok(!/未来可期|综上所述/.test(code), "代码场景不该带散文规则");
});

test("预算与清单：cost 与 listRules 跟实际选中一致", () => {
  const rows = listRules({ profile: "chat", locale: "zh" });
  const cost = composeCost({ profile: "chat", locale: "zh" });
  assert.ok(cost > 0 && cost <= 900);
  assert.equal(rows.length > 0, true);
  assert.ok(rows.every((r) => r.id && r.cat && r.rule));
  // 清单只用于展示，不该包含提示词里的表头
  assert.ok(rows.every((r) => !r.rule.includes("硬约束")));
});
