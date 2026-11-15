/**
 * MCP server（stdio，零依赖）。让任何支持 MCP 的 harness 直接把「去 AI 味」当工具调。
 *
 * 注意：MCP 工具是**按需调用**，适合「交付前过一遍」；
 * 想做到「所有输出自动过滤」，用库 API 或代理模式，不要指望 agent 每次都主动调工具。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { humanize, inspect } from "./engine.js";

const PROTOCOL = "2024-11-05";

const TOOLS = [
  {
    name: "humanize_text",
    description:
      "把一段文本里的 AI 味抹掉：删套话、化简公文腔、清理装饰 emoji、规整标点。" +
      "只做减法，不加事实、不改数字与人名；代码块、行内代码、URL、路径、公式一律不碰。" +
      "返回改写后的文本与命中报告。",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "要改写的文本" },
        profile: { type: "string", enum: ["prose", "chat", "mild", "code", "all"], description: "档位，默认 prose" },
        lang: { type: "string", enum: ["zh", "en", "auto"], description: "语种，默认 auto" },
        emoji: { type: "string", enum: ["strip", "keep"], description: "装饰性 emoji 是否删除，默认 strip" },
      },
      required: ["text"],
    },
  },
  {
    name: "humanize_file",
    description: "按文件类型自动选档位（源码只改注释），过滤整个文件。write=true 时原地写回。",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径（绝对路径或相对 cwd）" },
        write: { type: "boolean", description: "是否写回文件，默认 false（只返回结果）" },
        profile: { type: "string", enum: ["prose", "chat", "mild", "code", "all"] },
      },
      required: ["path"],
    },
  },
  {
    name: "score_text",
    description: "只体检不改写：返回 AI 味评分、命中的规则与例子。可用来做 CI 门禁或交付前自查。",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, profile: { type: "string" } },
      required: ["text"],
    },
  },
];

function log(msg) {
  process.stderr.write(`[deslop-mcp] ${msg}\n`);
}

function send(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function ok(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function fail(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function textResult(text, meta) {
  return {
    content: [{ type: "text", text }, ...(meta ? [{ type: "text", text: meta }] : [])],
  };
}

function callTool(name, args, defaults) {
  const base = {
    profile: args.profile ?? defaults.profile ?? "prose",
    lang: args.lang ?? defaults.lang,
    ...(args.emoji ? { emoji: args.emoji } : {}),
  };
  if (name === "humanize_text") {
    const { text, report } = humanize(String(args.text ?? ""), base);
    return textResult(text, `命中 ${report.totalHits} 处，AI 味 ${report.score}`);
  }
  if (name === "humanize_file") {
    const p = resolve(String(args.path ?? ""));
    const src = readFileSync(p, "utf8");
    const isCode = /\.(js|mjs|cjs|ts|tsx|jsx|rs|go|java|kt|py|rb|php|c|h|cpp|cs|swift|sh|ps1|sql|css|scss|vue|svelte|lua|toml|ya?ml)$/i.test(p);
    const { text, report } = humanize(src, { ...base, ...(isCode ? { profile: "code", mode: "code" } : {}) });
    if (args.write) writeFileSync(p, text, "utf8");
    return textResult(args.write ? `已写回 ${p}` : text, `命中 ${report.totalHits} 处，AI 味 ${report.score}`);
  }
  if (name === "score_text") {
    const report = inspect(String(args.text ?? ""), base);
    const lines = report.byRule.slice(0, 15).map((r) => `${r.count}\t${r.id}\t${r.label}`);
    return textResult(
      `AI 味 ${report.score}（${report.chars} 字，命中 ${report.totalHits} 处）\n${lines.join("\n")}`,
    );
  }
  throw new Error(`未知工具 ${name}`);
}

export function startMcp(defaults = {}) {
  let initialized = false;
  let buf = "";

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buf += chunk;
    for (;;) {
      const nl = buf.indexOf("\n");
      if (nl === -1) break;
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        fail(null, -32700, "parse error");
        continue;
      }
      handle(msg);
    }
  });

  function handle(msg) {
    const { id, method, params } = msg;
    if (method === "initialize") {
      initialized = true;
      ok(id, {
        protocolVersion: PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "humanizer-stream", version: "0.1.1" },
      });
      return;
    }
    if (method === "notifications/initialized" || method === "initialized") return;
    if (method === "ping") { ok(id, {}); return; }
    if (method === "tools/list") { ok(id, { tools: TOOLS }); return; }
    if (method === "tools/call") {
      const name = params?.name;
      try {
        ok(id, callTool(String(name), params?.arguments ?? {}, defaults));
      } catch (err) {
        ok(id, { content: [{ type: "text", text: String(err?.message ?? err) }], isError: true });
      }
      return;
    }
    if (id !== undefined) fail(id, -32601, `method not found: ${method}`);
  }

  log(`已就绪（${initialized ? "" : "等待 initialize"}），工具 ${TOOLS.length} 个`);
}
