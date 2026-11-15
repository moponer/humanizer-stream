# 接入方式

六条路，从「零改动」到「深度集成」排序。**先读第 0 节**，那里有一条所有方式都适用的铁律。

---

## 0. 唯一的铁律：只改展示，不改上下文

```js
// ✅ 对：人看的干净，模型看的是原文
ui.text    = filter.text(raw);
history.push({ role: "assistant", content: raw });

// ❌ 错：把过滤后的文本写回历史
history.push({ role: "assistant", content: filter.text(raw) });
```

写回历史有两个后果：上下文变短/变味（下一轮模型接着「干净文本」往下写，风格会漂），以及**过滤器版本一变，整段历史的前缀就变了 → 缓存命中率崩塌**。

过滤器是**渲染层**组件，不是数据层组件。记住这一条，后面所有方式都安全。

---

## 1. HTTP 代理（客户端零改动）

适用于任何走 HTTP 的客户端：官方 SDK、CLI、IDE 插件、自研 App。

```bash
deslop proxy --upstream https://api.openai.com --port 8787
# 或
HUMANIZER_UPSTREAM=https://api.deepseek.com deslop proxy --port 8787
```

客户端侧只改一个环境变量：

```bash
export OPENAI_BASE_URL=http://127.0.0.1:8787/v1
# Anthropic
export ANTHROPIC_BASE_URL=http://127.0.0.1:8787
```

原理：请求体**原样转发**（只去掉 `accept-encoding` 以拿到明文），响应侧按事件块解析 SSE，只替换正文文本字段，`usage`、`id`、`finish_reason`、思考链一律不碰。流结束时把引擎缓冲的尾巴拼成一个合法 chunk 补发，所以不会丢字。

支持的报文：

| 协议 | 流式字段 | 非流式字段 |
| --- | --- | --- |
| OpenAI Chat Completions | `choices[0].delta.content` | `choices[0].message.content` |
| OpenAI Completions | `choices[0].text` | 同左 |
| OpenAI Responses API | `response.output_text.delta` | — |
| Anthropic Messages | `content_block_delta.delta.text` | `content[].text` |

注意：代理会看到你的 API key（它只是转发，不落盘）。介意的话就把代理跑在本机，或者用第 2 条路。

---

## 2. 作为库（推荐给自研 harness）

### 2.1 一次性

```js
import { createTextFilter } from "humanizer-stream";
const hz = createTextFilter({ profile: "prose" });
const clean = hz.text(raw);
```

### 2.2 流式

```js
const stream = hz.stream();
for await (const delta of modelStream) {
  const out = stream.push(delta);     // 可能为空串：还在攒缓冲
  if (out) render(out);
}
render(stream.end());                 // 必须 end，否则丢尾巴
```

### 2.3 直接拿引擎（需要细粒度控制）

```js
import { createEngine } from "humanizer-stream";

const engine = createEngine({ profile: "chat", lang: "zh", emoji: "keep" });
engine.push("值得注意的是，");   // => ""      （还没到边界）
engine.push("我们改了三处。");    // => "我们改了三处。"
engine.report();                 // => { score, byRule, ... }
```

### 2.4 Vercel AI SDK / LangChain 这类框架

框架一般都有「transform」钩子，挂在最靠近 UI 的那一侧：

```js
// Vercel AI SDK：把 transform 包在 chunk 上
const result = streamText({ ... , transform: (chunk) => filterChunk(chunk) });
```

原则不变：**在 chunk 变成 UI 状态的那一步**过滤，不要回写消息数组。

---

## 3. CLI / CI / Git hook

```bash
# 交付前把整个 docs 目录过一遍
deslop --dir docs --write --report

# CI：新文档的 AI 味不许超过阈值
node bin/deslop.js --check docs/**/*.md --threshold 15

# pre-commit：只检查改动的文档
git diff --cached --name-only --diff-filter=ACM | grep -E '\.(md|txt)$' | xargs -r node bin/deslop.js --check
```

`--check` 的退出码：`0` 达标，`1` 超阈值，`2` 用法错误。JSON 报告用 `--json`。

---

## 4. MCP server

```jsonc
// Claude Desktop / 任何 MCP 客户端
{
  "mcpServers": {
    "humanizer": {
      "command": "node",
      "args": ["/abs/path/humanizer-stream/bin/deslop.js", "mcp"]
    }
  }
}
```

工具：

| 工具 | 用途 |
| --- | --- |
| `humanize_text` | 改写一段文本，返回结果 + 命中数 |
| `humanize_file` | 按扩展名选档处理文件，`write: true` 才落盘 |
| `score_text` | 只体检，返回评分与命中规则 |

MCP 的问题：**要靠 agent 自觉调用**。想要「所有输出自动过滤」，请用代理或库。

---

## 5. lynn 插件（本仓库自带适配器）

```bash
node bin/deslop.js install-lynn
# 装到 ~/.lynn/plugins/humanizer-stream/（自包含，含 src/）
```

然后：

1. lynn 的设置 → 权限与安全 → 「去 AI 味」开关打开。
2. lynn 在加载时 `import(pluginDir + "/index.js")`，检查 `api === 1`，拿 `createFilter({ profile: "chat" })`。
3. 三处接线：
   - 流式 delta → `stream.push(delta)` 后再推给渲染层；
   - 回合收尾 → `filter.text(raw)` 作为卡片文本，**history 存 raw**；
   - 成员写的文档 → `file(path, content)`（`.md/.txt` 走 prose，`.ts/.py` 走 code 只改注释）。

宿主侧代码量在 100 行以内，不需要改 lynn 的提示词、上下文管理或 token 记账。

---

## 6. 浏览器 / Electron 渲染层

如果宿主前端直接持有模型文本（比如 WebSocket 推 delta 到前端），可以只在前端加一层：

```js
import { createTextFilter } from "humanizer-stream/browser";
const hz = createTextFilter({ profile: "chat" });
```

条件是打包工具能处理 ESM（Vite / esbuild / webpack 都行）。引擎没有 Node 依赖，纯字符串处理，前端可用。

---

## 7. 各客户端「钩在哪」速查

| 客户端 | 钩子位置 | 推荐方式 |
| --- | --- | --- |
| 任意 OpenAI SDK | `baseURL` | 代理 |
| Claude Code / Codex CLI | 环境变量 `*_BASE_URL` | 代理 |
| 自研 Electron 应用 | 主进程 delta 事件 + 卡片收尾 | 库 |
| 自研 Web 应用 | 前端 SSE 解析处 | 库（浏览器） |
| 内容团队工作流 | 交付前批处理 | CLI |
| Agent 平台 | 工具调用 | MCP |
| IDE 插件 | 渲染 Markdown 前 | 库 |

---

## 8. 参数怎么选

| 场景 | profile | 说明 |
| --- | --- | --- |
| 聊天/助手回复 | `chat` | 只删套话与残留，不动承载语义的从句 |
| 文档/文案/README | `prose` | 连同句尾升华、排版一起收拾 |
| 只想去掉最扎眼的 | `mild` | 只清填充词与残留 |
| 写源码 | `code` | 只处理注释，代码零改动 |
| 体检/审计 | `all` | 全部规则，包含只标记的 |

按扩展名自动选：`.md/.txt/.html` → prose；`.ts/.py/.go/.rs/...` → code。

---

## 9. 排障

| 现象 | 原因 |
| --- | --- |
| 流式输出比平时慢半拍 | 正常：缓冲区在等句/行边界（默认 80 字起）。调小 `minEmit` |
| 短回复整段在结束才出现 | 回复不足 80 字，全部在 `end()` 才吐出。调小 `minEmit` 或用 `text()` |
| 代码块被改了 | 说明 `mode` 没设成 `code`，或围栏没闭合（识别不到围栏） |
| 表格没被过滤 | 默认不动表格（`tables: false`） |
| 某些句子删得太多 | 用 `disabled` 关掉具体规则 id（`deslop rules` 查） |
