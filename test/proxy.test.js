import test from "node:test";
import assert from "node:assert/strict";
import { SseRewriter } from "../src/proxy.js";

/** 把一段完整 SSE 流喂进去，收集所有 data: 负载里的正文 */
function runStream(raw, opts = {}) {
  const rw = new SseRewriter({ profile: "all", ...opts });
  const out = rw.write(raw) + rw.flushEvents();
  let text = "";
  for (const block of out.split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data:"));
    if (!line) continue;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") continue;
    const obj = JSON.parse(payload);
    text += obj.choices?.[0]?.delta?.content ?? obj.delta?.text ?? obj.delta ?? "";
  }
  return { text, raw: out };
}

const openaiChunk = (content, extra = {}) =>
  `data: ${JSON.stringify({
    id: "chatcmpl-1",
    object: "chat.completion.chunk",
    created: 1,
    model: "m",
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
    ...extra,
  })}\n\n`;

test("OpenAI 流式：正文被改写，usage 等字段原样", () => {
  const pieces = ["值得注意", "的是，随着技术", "的不断发展，我们改了", "三处。未来", "可期。", "希望对你有帮助。"];
  const raw = pieces.map((p) => openaiChunk(p)).join("") + "data: [DONE]\n\n";
  const { text, raw: emitted } = runStream(raw);
  assert.ok(!text.includes("值得注意的是"), text);
  assert.ok(!text.includes("随着技术"), text);
  assert.ok(!text.includes("未来可期"), text);
  assert.ok(text.includes("我们改了三处"), text);
  assert.ok(emitted.includes("data: [DONE]"), "结束标记必须保留");
});

test("OpenAI 流式：非正文事件（role 帧）不被破坏", () => {
  const roleChunk = `data: ${JSON.stringify({ id: "x", choices: [{ index: 0, delta: { role: "assistant" } }] })}\n\n`;
  const { raw } = runStream(roleChunk + openaiChunk("值得注意的是，A 好了。") + "data: [DONE]\n\n");
  assert.ok(raw.includes('"role":"assistant"'), raw);
});

test("Anthropic 流式：content_block_delta 被改写且 index 保持", () => {
  const raw =
    `event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n` +
    `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "首先，值得注意的是，" } })}\n\n` +
    `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "我们对日志进行了分析。" } })}\n\n` +
    `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`;
  const { text, raw: emitted } = runStream(raw);
  assert.ok(!text.includes("值得注意的是"), text);
  assert.ok(text.includes("分析了日志"), text);
  assert.ok(emitted.includes("event: content_block_delta"), "event: 行必须保留");
});

test("尾部缓冲在 [DONE] 之前补发，不丢字", () => {
  const raw = openaiChunk("我们改了三处，都很小。") + "data: [DONE]\n\n";
  const { text } = runStream(raw);
  assert.equal(text.trim(), "我们改了三处，都很小。");
});

test("坏 JSON / 非 data 行原样透传", () => {
  const raw = ": keep-alive\n\ndata: {broken\n\n" + openaiChunk("正常一句话。") + "\n";
  const rw = new SseRewriter({ profile: "all" });
  const out = rw.write(raw);
  assert.ok(out.includes(": keep-alive"));
  assert.ok(out.includes("data: {broken"));
});

test("上游分片（一次只给半行）也能正确拼接", () => {
  const full = openaiChunk("值得注意的是，我们改了三处。") + "data: [DONE]\n\n";
  const rw = new SseRewriter({ profile: "all" });
  let out = "";
  for (let i = 0; i < full.length; i += 7) out += rw.write(full.slice(i, i + 7));
  out += rw.flushEvents();
  assert.ok(out.includes("[DONE]"));
  assert.ok(!out.includes("值得注意的是"), out);
});
