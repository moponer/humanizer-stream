/**
 * 零依赖 LLM 反向代理：客户端把 baseURL 指到本地，回复在路过的瞬间被改写。
 *
 * 为什么这条路线最重要：
 *  它不需要任何客户端改代码、改提示词、装 SDK。提示词一个字不动，
 *  所以 token 消耗、前缀缓存命中率、上下文窗口管理全部保持原样。
 *  请求体原样转发（除了去掉 accept-encoding 以拿到明文），响应体只在文本字段上做减法。
 *
 * 支持：
 *  - OpenAI Chat Completions（流式 delta.content / 非流式 message.content）
 *  - OpenAI Completions（text）
 *  - Responses API（response.output_text.delta）
 *  - Anthropic Messages（content_block_delta.delta.text / 非流式 content[].text）
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { createEngine } from "./engine.js";

const HOP_BY_HOP = new Set([
  "host", "connection", "keep-alive", "transfer-encoding", "upgrade",
  "proxy-authenticate", "proxy-authorization", "te", "trailer", "content-length",
]);

/** SSE 重写器：按事件块处理，不做字节级猜测 */
export class SseRewriter {
  constructor(options = {}) {
    this.engine = createEngine({ profile: "chat", ...options });
    this.buf = "";
    this.last = null;
    this.kind = "";
    this.blockIndex = -1;
    this.done = false;
  }

  /**
   * 吃一段响应文本，吐出应当写给客户端的内容。
   * @param {string} chunk
   * @returns {string}
   */
  write(chunk) {
    this.buf += chunk;
    let out = "";
    for (;;) {
      const idx = this.buf.indexOf("\n\n");
      if (idx === -1) break;
      const block = this.buf.slice(0, idx + 2);
      this.buf = this.buf.slice(idx + 2);
      out += this.handleBlock(block);
    }
    return out;
  }

  handleBlock(block) {
    const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) return block;
    const payload = dataLine.slice(5).trim();

    if (payload === "[DONE]") {
      return this.flushEvents() + block;
    }
    let obj;
    try {
      obj = JSON.parse(payload);
    } catch {
      return block;
    }
    this.last = obj;
    const text = extractText(obj, this);
    if (text === undefined) return block;

    const clean = this.engine.push(text);
    const rebuilt = replaceText(obj, clean, this);
    if (rebuilt === null) return block;
    const line = `data: ${JSON.stringify(rebuilt)}\n`;
    // 保留原有 event: 行（Anthropic 需要）与非 data 行
    return block
      .split("\n")
      .map((l) => (l.startsWith("data:") ? line.trimEnd() : l))
      .join("\n");
  }

  /** 结束前把引擎缓冲的尾巴补成一个合法事件 */
  flushEvents() {
    if (this.done) return "";
    this.done = true;
    const tail = this.engine.end();
    if (!tail || !this.last) return "";
    const synthetic = this.synth(tail);
    return synthetic ? `data: ${JSON.stringify(synthetic)}\n\n` : "";
  }

  synth(tail) {
    const base = this.last;
    if (this.kind === "openai") {
      const ch = base?.choices?.[0] ?? {};
      return {
        id: base.id ?? `chatcmpl-deslop`,
        object: base.object ?? "chat.completion.chunk",
        created: base.created ?? Math.floor(Date.now() / 1000),
        model: base.model ?? "",
        choices: [{ index: ch.index ?? 0, delta: { content: tail }, finish_reason: null }],
      };
    }
    if (this.kind === "anthropic") {
      if (this.blockIndex < 0) return null;
      return {
        type: "content_block_delta",
        index: this.blockIndex,
        delta: { type: "text_delta", text: tail },
      };
    }
    if (this.kind === "responses") {
      return { type: "response.output_text.delta", item_id: base?.item_id, output_index: base?.output_index ?? 0, content_index: base?.content_index ?? 0, delta: tail };
    }
    return null;
  }
}

function extractText(obj, state) {
  // OpenAI chat
  if (Array.isArray(obj.choices)) {
    state.kind = "openai";
    const ch = obj.choices[0];
    if (ch?.delta && typeof ch.delta.content === "string") return ch.delta.content;
    if (typeof ch?.text === "string") return ch.text;
    return undefined;
  }
  // Anthropic
  if (obj.type === "content_block_start" || obj.type === "content_block_delta") {
    state.kind = "anthropic";
    if (typeof obj.index === "number") state.blockIndex = obj.index;
    const t = obj.delta?.text ?? obj.content_block?.text;
    return typeof t === "string" ? t : undefined;
  }
  // Responses API
  if (obj.type === "response.output_text.delta" && typeof obj.delta === "string") {
    state.kind = "responses";
    return obj.delta;
  }
  return undefined;
}

function replaceText(obj, clean, state) {
  if (Array.isArray(obj.choices)) {
    const ch = obj.choices[0];
    if (ch?.delta && typeof ch.delta.content === "string") {
      const next = { ...obj, choices: [{ ...ch, delta: { ...ch.delta, content: clean } }] };
      return next;
    }
    if (typeof ch?.text === "string") {
      return { ...obj, choices: [{ ...ch, text: clean }] };
    }
    return null;
  }
  if (obj.type === "content_block_delta" && typeof obj.delta?.text === "string") {
    return { ...obj, delta: { ...obj.delta, text: clean } };
  }
  if (obj.type === "content_block_start" && typeof obj.content_block?.text === "string") {
    return { ...obj, content_block: { ...obj.content_block, text: clean } };
  }
  if (obj.type === "response.output_text.delta" && typeof obj.delta === "string") {
    return { ...obj, delta: clean };
  }
  return null;
}

/** 非流式 JSON 的整体改写 */
function rewriteJsonBody(text, options) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return text;
  }
  const engine = createEngine({ profile: "chat", ...options });
  const one = (s) => {
    const out = engine.push(s) + engine.end();
    return out.trim() || !s.trim() ? out : s;
  };
  let touched = false;
  if (Array.isArray(obj.choices)) {
    for (const ch of obj.choices) {
      if (typeof ch?.message?.content === "string") {
        ch.message.content = one(ch.message.content);
        touched = true;
      }
      if (typeof ch?.text === "string") {
        ch.text = one(ch.text);
        touched = true;
      }
    }
  }
  if (Array.isArray(obj.content)) {
    for (const c of obj.content) {
      if (c?.type === "text" && typeof c.text === "string") {
        c.text = one(c.text);
        touched = true;
      }
    }
  }
  return touched ? JSON.stringify(obj) : text;
}

/**
 * @param {{port?:number, upstream?:string, log?:string, profile?:string, lang?:string, comments?:boolean}} cfg
 */
export function startProxy(cfg = {}) {
  const upstream = cfg.upstream || process.env.HUMANIZER_UPSTREAM;
  if (!upstream) {
    process.stderr.write("proxy: 需要 --upstream https://api.deepseek.com（或环境变量 HUMANIZER_UPSTREAM）\n");
    return 2;
  }
  const base = new URL(upstream);
  const lib = base.protocol === "https:" ? https : http;
  const filterOpts = { profile: cfg.profile ?? "chat", lang: cfg.lang, comments: cfg.comments };

  const server = http.createServer((req, res) => {
    const target = new URL(base.toString());
    target.pathname = joinPath(base.pathname, req.url ?? "/");

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (HOP_BY_HOP.has(k.toLowerCase())) continue;
      if (k.toLowerCase() === "accept-encoding") continue; // 要明文才能改
      headers[k] = v;
    }
    headers["accept-encoding"] = "identity";

    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const upReq = lib.request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || (target.protocol === "https:" ? 443 : 80),
          path: target.pathname + target.search,
          method: req.method,
          headers: { ...headers, "content-length": String(body.length) },
        },
        (upRes) => {
          const type = String(upRes.headers["content-type"] ?? "");
          const isSse = type.includes("text/event-stream");

          if (!isSse) {
            const bufs = [];
            upRes.on("data", (c) => bufs.push(c));
            upRes.on("end", () => {
              const raw = Buffer.concat(bufs).toString("utf8");
              const out = type.includes("json") ? rewriteJsonBody(raw, filterOpts) : raw;
              const h = { ...upRes.headers };
              delete h["content-length"];
              delete h["content-encoding"];
              res.writeHead(upRes.statusCode ?? 200, { ...h, "content-length": String(Buffer.byteLength(out)) });
              res.end(out);
            });
            return;
          }

          const rewriter = new SseRewriter(filterOpts);
          res.writeHead(upRes.statusCode ?? 200, {
            ...upRes.headers,
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache",
            connection: "keep-alive",
            "x-deslop": "on",
          });

          const decoder = new TextDecoder();
          upRes.on("data", (c) => {
            const out = rewriter.write(decoder.decode(c, { stream: true }));
            if (out) res.write(out);
          });
          upRes.on("end", () => {
            const tail = rewriter.flushEvents();
            if (tail) res.write(tail);
            res.end();
            if (cfg.log) logLine(cfg.log, { path: target.pathname, ok: true });
          });
        },
      );
      upReq.on("error", (err) => {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: `deslop proxy: ${err.message}` } }));
      });
      if (body.length) upReq.write(body);
      upReq.end();
    });
  });

  const port = cfg.port ?? 8787;
  server.listen(port, "127.0.0.1", () => {
    process.stderr.write(
      `deslop proxy 已启动：http://127.0.0.1:${port} → ${base.toString()}\n` +
      `把客户端的 baseURL 指到 http://127.0.0.1:${port} 即可（提示词不用改）。\n`,
    );
  });
  return new Promise(() => {}); // 常驻
}

function joinPath(a, b) {
  const x = (a || "").replace(/\/+$/, "");
  const y = (b || "").replace(/^\/+/, "");
  return y ? `${x}/${y}` : x || "/";
}

function logLine(file, obj) {
  try {
    // 懒加载，避免不用 --log 时也碰 fs
    import("node:fs").then(({ appendFileSync }) => {
      appendFileSync(file, `${new Date().toISOString()} ${JSON.stringify(obj)}\n`);
    });
  } catch {
    /* 日志失败不影响转发 */
  }
}
