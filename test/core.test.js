import test from "node:test";
import assert from "node:assert/strict";
import { humanize, inspect, createEngine } from "../src/engine.js";

const run = (t, o = {}) => humanize(t, { profile: "all", unsafe: true, ...o }).text;

test("开场套话被删掉，正文保留", () => {
  const out = run("随着人工智能技术的不断发展，越来越多的团队开始用模型写文档。");
  assert.equal(out, "越来越多的团队开始用模型写文档。");
});

test("结尾祝福与升华被删掉", () => {
  const out = run("这份报告就写到这里。未来可期，让我们拭目以待！希望对你有帮助。");
  assert.ok(!out.includes("未来可期"), out);
  assert.ok(!out.includes("拭目以待"), out);
  assert.ok(!out.includes("希望对你有帮助"), out);
  assert.ok(out.includes("这份报告就写到这里"), out);
});

test("路标词与讲义序号被清掉", () => {
  const out = run("值得注意的是，我们改了三处。首先，合并了重复代码。");
  assert.ok(!out.includes("值得注意的是"), out);
  assert.ok(!out.includes("首先，"), out);
  assert.ok(out.includes("改了三处"), out);
});

test("公文腔化简成动词", () => {
  assert.equal(run("我们对日志进行了分析。"), "我们分析了日志。");
  assert.equal(run("这次进行优化之后快了一倍。"), "这次优化之后快了一倍。");
  assert.equal(run("改动将被自动保存。"), "改动会自动保存。");
});

test("代码块、行内代码、URL、路径一个字节都不能动", () => {
  const src = [
    "注意：这段别改。",
    "```js",
    "// 这是一个示例，首先我们需要进行优化。",
    "const p = \"D:\\\\code\\\\app\";",
    "```",
    "行内 `const a = 1 // 首先` 和链接 https://example.com/首先 都要原样。",
    "路径 F:\\spiker\\lynn\\src\\main\\kernel.ts 也不能动。",
  ].join("\n");
  const out = run(src);
  assert.ok(out.includes("```js"), "围栏保留");
  assert.ok(out.includes("// 这是一个示例，首先我们需要进行优化。"), "围栏内默认不碰");
  assert.ok(out.includes("`const a = 1 // 首先`"), "行内码保留");
  assert.ok(out.includes("https://example.com/首先"), "URL 保留");
  assert.ok(out.includes("F:\\spiker\\lynn\\src\\main\\kernel.ts"), "路径保留");
});

test("frontmatter 与表格不碰", () => {
  const src = ["---", "title: 测试", "tags: [a, b]", "---", "", "| 项 | 说明 |", "| --- | --- |", "| 注意： | 保持不变 |"].join("\n");
  assert.equal(run(src), src);
});

test("加粗列表项去掉强调（AI 的典型排版）", () => {
  const out = run("- **高效**：处理速度提升\n- **稳定**：不会崩溃");
  assert.ok(out.includes("- 高效：处理速度提升"), out);
  assert.ok(!out.includes("**高效**"), out);
});

test("对冲词只留一个", () => {
  const out = run("这个方案或许可能在一定程度上有效。");
  assert.equal((out.match(/或许|可能|在一定程度上/g) || []).length, 1, out);
});

test("中文里的半角标点被规整", () => {
  assert.equal(run("每组50人, 差异显著."), "每组50人，差异显著.");
});

test("装饰 emoji 被清掉，层次靠文字", () => {
  const out = run("🚀 发布阶段\n✅ 下一步：验收");
  assert.equal(out.trim(), "发布阶段\n下一步：验收");
});

test("整段只剩套话时回退原文，绝不输出空", () => {
  const src = "希望对你有所帮助。";
  assert.equal(run(src), src);
});

test("已经干净的文本不被改动（幂等）", () => {
  const src = "我改了三个文件，把重复的取数逻辑合到一个函数里。测试跑了一遍，全过。";
  const once = run(src);
  const twice = run(once);
  assert.equal(once, src);
  assert.equal(twice, once);
});

test("chat 档不删承载语义的从句", () => {
  const src = "上线时间定在周五，这体现了团队的效率。";
  const chat = humanize(src, { profile: "chat" }).text;
  assert.ok(chat.includes("体现了团队的效率"), chat);
  const prose = humanize(src, { profile: "prose" }).text;
  assert.ok(!prose.includes("体现了团队的效率"), prose);
});

test("英文规则生效", () => {
  const out = run("It's worth noting that the build passes. I hope this helps!");
  assert.ok(!/worth noting/i.test(out), out);
  assert.ok(!/hope this helps/i.test(out), out);
  assert.ok(/build passes/.test(out), out);
});

test("体检报告能统计命中与分数", () => {
  const report = inspect("值得注意的是，随着技术的不断发展，我们要注意。综上所述，未来可期。", { profile: "all" });
  assert.ok(report.totalHits >= 3, JSON.stringify(report.byRule));
  assert.ok(report.score > 0);
  assert.ok(report.byRule.length >= 2);
});

test("长文本性能：100KB 中文在 1 秒内跑完", () => {
  const para = "值得注意的是，随着业务的不断发展，我们对数据进行了分析。未来可期。\n";
  const big = para.repeat(Math.ceil(100_000 / para.length));
  const t0 = Date.now();
  const { text } = humanize(big, { profile: "prose" });
  const cost = Date.now() - t0;
  assert.ok(cost < 1000, `耗时 ${cost}ms`);
  assert.ok(text.length < big.length);
});

test("引擎可以反复复用，互不串味", () => {
  const a = createEngine({ profile: "all" });
  a.push("值得注意的是，A");
  a.end();
  const b = createEngine({ profile: "all" });
  const out = b.push("值得注意的是，B") + b.end();
  assert.equal(out, "B");
});

test("保护区两侧的空格必须留着（中英混排读感）", () => {
  const src = "我们对 `settleAssistant()` 里的入参做了校验，参考 https://example.com/a 的做法。";
  const out = run(src);
  assert.equal(out, src);
});

test("删掉整句后不会留一堆空行", () => {
  const out = run("第一段。\n\n未来可期，让我们拭目以待。\n\n第二段。");
  assert.ok(!/\n{3,}/.test(out), JSON.stringify(out));
  assert.ok(out.includes("第一段。") && out.includes("第二段。"));
});

test("同一句话里的中文引号/全角标点不被误改", () => {
  const src = "他说：「这个我认了——不改了。」";
  assert.equal(run(src), src);
});

test("删掉结尾套话后句子终止符要补回来", () => {
  const out = run("综上所述，我们对日志进行了分析，未来可期。", { profile: "chat" });
  assert.equal(out, "我们分析了日志。");
});

test("CRLF 与 BOM 不影响行首规则（Windows 上的真实输入）", () => {
  const src = "\uFEFF好的，我帮你梳理一下。\r\n值得注意的是，A 改了三处。\r\n";
  const out = run(src, { profile: "chat" });
  assert.ok(out.startsWith("我帮你梳理一下"), `BOM 挡住了行首规则：${JSON.stringify(out)}`);
  assert.ok(!out.includes("好的，"), out);
  assert.ok(!out.includes("值得注意"), out);
  assert.ok(out.includes("\r\n"), "CRLF 要原样保留，不能悄悄换成 LF");
});

test("规则不咬词中间的字：'随时联系我' 不能把 '随时联系我们' 啃成 '请们'", () => {
  const src = "如需了解更多信息，请随时联系我们。";
  assert.equal(run(src, { profile: "prose" }), src);
});

test("过滤后不留孤字/双标点/行首标点", () => {
  const samples = [
    "如需了解更多信息，请随时联系我们。",
    "有问题欢迎随时联系我。",
    "如果你还有其他问题，随时告诉我。",
    "好的，我帮你梳理一下。值得注意的是，索引重建了。",
    "综上所述，方案可行。未来可期，让我们拭目以待！",
    "首先，我们做了压测；其次，我们分析了日志；最后，我们复核了结论。",
  ];
  for (const s of samples) {
    const out = run(s, { profile: "all" });
    assert.ok(!/请们|[，,。！？；;]们|[，,]{2,}|[。！？]{2,}/.test(out), `异常输出：${s} -> ${out}`);
    assert.ok(!/^[，,。！？；;、]/.test(out.trim()), `行首残留标点：${s} -> ${out}`);
    assert.ok(out.trim().length > 0, `整句被删空：${s}`);
  }
});
