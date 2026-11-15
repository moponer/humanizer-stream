import test from "node:test";
import assert from "node:assert/strict";
import { createEngine, humanize } from "../src/engine.js";

/** 把整段文本按随机/固定大小切片喂进去，结果必须与一次性处理完全一致 */
function chunked(text, size, opts = {}) {
  const e = createEngine(opts);
  let out = "";
  for (let i = 0; i < text.length; i += size) out += e.push(text.slice(i, i + size));
  out += e.end();
  return out;
}

const SRC = [
  "随着人工智能的不断发展，写文档这件事变快了。",
  "",
  "- **高效**：十分钟能出一版",
  "- **稳定**：不会漏掉章节",
  "",
  "我们对数据进行了分析, 发现重复率偏高。",
  "",
  "```ts",
  "// 注意：以下代码不改",
  "const x = 1; // 首先，初始化",
  "```",
  "",
  "详见 https://example.com/a/首先 与 `npm run build`。",
  "",
  "综上所述，未来可期。希望对你有帮助。",
].join("\n");

// 结尾的空行不算内容：切片边界恰好落在文末空行上时会差一个换行
const norm = (s) => s.replace(/\n+$/, "");

test("逐字切片与一次性处理结果一致", () => {
  const whole = norm(humanize(SRC, { profile: "all", unsafe: true }).text);
  for (const size of [1, 2, 3, 7, 13, 64]) {
    const got = norm(chunked(SRC, size, { profile: "all", unsafe: true }));
    assert.equal(got, whole, `切片大小 ${size} 结果不一致`);
  }
});

test("流式输出是单调增长的（不会回退已发出的内容）", () => {
  const e = createEngine({ profile: "all" });
  let emitted = "";
  for (let i = 0; i < SRC.length; i += 9) {
    const piece = e.push(SRC.slice(i, i + 9));
    assert.ok(piece.length >= 0);
    const before = emitted;
    emitted += piece;
    assert.ok(emitted.startsWith(before));
  }
  emitted += e.end();
  assert.equal(emitted, humanize(SRC, { profile: "all", unsafe: true }).text);
});

test("短输入不早泄（缓冲里没边界就不输出）", () => {
  const e = createEngine({ profile: "all" });
  assert.equal(e.push("值得注意的"), "");
  const out = e.push("是，A 改了三处。") + e.end();
  assert.equal(out, "A 改了三处。");
});

test("围栏跨 chunk 打开时，内部内容仍然原样", () => {
  const e = createEngine({ profile: "all" });
  let out = "";
  out += e.push("前文。\n``");
  out += e.push("`js\n// 首先，进行优化\n");
  out += e.push("const a = 1;\n``");
  out += e.push("`\n后文。\n");
  out += e.end();
  assert.ok(out.includes("// 首先，进行优化"), out);
  assert.ok(out.includes("const a = 1;"), out);
});

test("代码模式：只改注释，代码一个字符不动", () => {
  const code = [
    "// 注意：首先，进行优化",
    "const url = 'https://a.com//b'; // 首先，初始化",
    "/* 需要说明的是，这里对数据进行了处理 */",
    "function f(a, b) { return a + b; } // 进行验证",
  ].join("\n");
  const out = humanize(code, { profile: "code", mode: "code" }).text;
  assert.ok(!out.includes("注意："), out);
  assert.ok(!out.includes("首先，"), out);
  assert.ok(!out.includes("对数据进行了处理"), out);
  assert.ok(out.includes("处理了数据"), out);
  assert.ok(out.includes("const url = 'https://a.com//b';"), "字符串里的 // 不能当注释");
  assert.ok(out.includes("function f(a, b) { return a + b; }"), "代码本体不能动");
  // 行数不变（注释规则绝不删行）
  assert.equal(out.split("\n").length, code.split("\n").length);
});

test("Python 的 # 注释与 shebang", () => {
  const py = ["#!/usr/bin/env python3", "# 首先，进行校验", "x = 1  # 注意：不要动代码"].join("\n");
  const out = humanize(py, { profile: "code", mode: "code" }).text;
  assert.ok(out.startsWith("#!/usr/bin/env python3"), out);
  assert.ok(out.includes("校验"), out);
  assert.ok(!out.includes("首先，"), out);
  assert.ok(out.includes("x = 1"), out);
});

test("越界输入不崩：空串、纯空白、二进制噪声", () => {
  assert.equal(humanize("").text, "");
  assert.equal(humanize("   \n\n  ").text, "   \n\n  ");
  const noise = "\u0000\u0001abc\u0002值得注意的".repeat(30);
  assert.doesNotThrow(() => humanize(noise, { profile: "all" }));
});
