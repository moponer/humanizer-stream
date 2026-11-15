# 插件接口规范 v1

> 状态：稳定（v1）。任何破坏性改动都会发 v2 并保留 v1 适配层。

本规范定义两件事：

1. **插件契约**：一个「文本过滤器插件」长什么样（本仓库产出的东西）。
2. **宿主契约**：宿主（harness / 客户端 / 应用）必须怎么调用它，才能拿到「去掉 AI 味」的效果且**不破坏自己的 token 与缓存语义**。

二者都不涉及网络协议，最小实现可以只有两个函数。

---

## 1. 分层

```
┌─────────────────────────────────────────────┐
│ 宿主（lynn / Claude Code / 自研客户端 / …）  │
│  · 拥有提示词、上下文、token 记账            │
│  · 决定「在哪里」调用过滤器                  │
└───────────────┬─────────────────────────────┘
                │  文本过滤器契约（本文件 §3）
┌───────────────▼─────────────────────────────┐
│ 适配器（adapters/*）                         │
│  · 把宿主的概念翻译成 profile / mode / lang  │
└───────────────┬─────────────────────────────┘
                │  createTextFilter(options)
┌───────────────▼─────────────────────────────┐
│ 引擎（src/）                                 │
│  · 纯函数式文本处理，无 IO、无网络、无模型调用│
└─────────────────────────────────────────────┘
```

**关键**：引擎不向上调用任何东西。它不知道模型是谁、请求花了多少钱、上下文多长。这是「不影响 token / 缓存」的结构性保证，而不是纪律要求。

---

## 2. 插件包形态

```
<plugin-dir>/
├── lynn.plugin.json     # 清单（宿主自定义，可省略）
├── index.js             # 入口，导出 §3 契约
└── src/                 # 引擎（自包含，别依赖宿主 node_modules）
```

### 清单字段（建议）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一标识，建议 `humanizer-stream` |
| `name` | string | 展示名 |
| `version` | string | semver |
| `kind` | string | 固定 `text-filter`，宿主据此识别能力类型 |
| `api` | number | 契约版本，当前 `1` |
| `entry` | string | 入口文件相对路径 |
| `capabilities` | string[] | `filterText` / `filterStream` / `filterFile` 的子集 |
| `defaults` | object | 默认 options，宿主可在调用时覆盖 |

---

## 3. 插件契约（本仓库实现的部分）

入口必须导出：

```js
export const api = 1;                 // 契约版本
export function createFilter(options) // -> Filter
```

`Filter` 对象：

```ts
interface Filter {
  /** 一次性过滤。输入空串原样返回空串。 */
  text(input: string, extra?: Options): string;

  /** 开一条流式管线。每个流必须 end() 一次。 */
  stream(extra?: Options): Stream;

  /** 可选：处理一整个文件的文本，按扩展名自动选档 */
  file?(path: string, content: string): { text: string; changed: boolean };
}

interface Stream {
  /** 喂增量，返回「现在可以安全输出」的文本（可能为空串） */
  push(chunk: string): string;
  /** 冲刷尾巴，一次性返回剩余文本 */
  end(): string;
  /** 可选：命中报告（引擎已处理字符数、命中规则、评分） */
  report?(): Report;
}
```

`Options`：

| 字段 | 取值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `profile` | `prose` / `chat` / `mild` / `code` / `all` | `prose` | 语气档位；`chat` 不删承载语义的从句 |
| `lang` | `zh` / `en` / `auto` | `auto` | 限定语种规则 |
| `mode` | `text` / `code` | `text` | `code` 表示整段是源码，只处理注释 |
| `emoji` | `strip` / `keep` | `strip` | 是否删除装饰性 emoji |
| `comments` | boolean | `false` | `text` 档下是否处理围栏内的注释 |
| `tables` | boolean | `false` | 是否过滤表格单元格 |
| `disabled` | string[] | `[]` | 临时关闭的规则 id |
| `unsafe` | boolean | 随档位 | 是否允许删承载语义的从句 |
| `minEmit` | number | `80` | 流式最小缓冲（字） |
| `maxHold` | number | `600` | 流式最大缓冲，超了硬切 |

`Report`：

```ts
interface Report {
  chars: number;              // 处理过的字符数
  totalHits: number;          // 命中次数
  weighted: number;           // 按权重加权
  score: number;              // 0–100 体检分（不是检测器通过率）
  byRule: { id; cat; kind; label; count }[];
  samples: { kind; from; to }[];
  rhythmRun?: number;         // 连续长句数（节奏自检）
}
```

---

## 4. 宿主契约（接入方必须遵守）

### 4.1 必须（MUST）

1. **只在展示边界调用**。过滤器输出给「人看」，不要用它替换要回传给模型的历史消息。
   ```js
   // 对
   card.text = filter(hz.text(raw));
   history.push({ role: "assistant", content: raw });
   // 错：缓存与上下文会随过滤器版本变化而失效
   history.push({ role: "assistant", content: hz.text(raw) });
   ```
2. **同一段文本只能过滤一次**。对已过滤文本再过滤虽然幂等（规则都是只减不增），但会白花 CPU。
3. **流式必须 end()**。缓冲区里可能还压着几十个字，不 end 就是丢字。
4. **失败必须降级为原文**。过滤器抛错、加载失败、版本不兼容时，一律透传原文，绝不能让用户看不到模型的话。

### 4.2 禁止（MUST NOT）

1. 不要用过滤器输出覆盖**落盘的历史/会话记录**（同 4.1.1 的理由）。
2. 不要在**请求侧**做任何改写（那是缓存杀手，也超出本插件的职责）。
3. 不要因为过滤器改了字数就去修正 token 计量——token 由模型侧计量，与本插件无关。

### 4.3 建议（SHOULD）

- 对话输出用 `profile: "chat"`，文档/文案用 `prose`，源码写盘用 `code`。
- 把「是否启用」做成显式开关，并让用户看得见当前档位。
- 给用户留一个「这一条别过滤」的逃生口（比如原文切换）。

---

## 5. 生命周期与顺序

```
请求 → 模型 → [流式 delta] → stream.push(delta) → 渲染
                              ↓ (回合结束)
                          stream.end() → 渲染尾部
                              ↓
                      可选：final = filter.text(全文)
```

- 流式期间用 `push`，回合结束时用 `end`；如果宿主同时拿到了完整文本，用 `text(全文)` 覆盖一次可以获得最佳一致性（`push` 的切点受 chunk 影响，`text` 不受）。
- **不要**在 `push` 与 `text` 之间做差量拼接——直接覆盖，结果以 `text(全文)` 为准。

---

## 6. 版本协商

- 宿主读 `api` 字段。`api > 宿主支持的最大版本` → 宿主应拒绝加载并提示，而不是降级硬跑。
- `options` 中未知字段必须被忽略（前向兼容），插件不得因未知字段抛错。
- v1 内新增能力只能以**可选**成员出现（如 `file`、`report`），宿主必须做存在性判断。

---

## 7. 最小实现示例（宿主侧）

```js
// 1) 加载（失败就当没有）
let filter = null;
try {
  const mod = await import(pluginEntry);
  if (mod.api === 1) filter = mod.createFilter({ profile: "chat" });
} catch { /* 静默降级 */ }

// 2) 流式
let stream = filter?.stream() ?? null;
const shown = (delta) => (stream ? stream.push(delta) : delta);

// 3) 收轮
const settle = (raw) => {
  const tail = stream ? stream.end() : "";
  stream = null;
  return filter ? filter.text(raw) : raw;
};
```

---

## 8. 变更策略

| 变更 | 是否破坏兼容 |
| --- | --- |
| 新增规则 | 否（输出会变，接口不变） |
| 新增 `Options` 字段 | 否 |
| 新增可选方法 | 否 |
| 修改 `text/stream` 签名 | 是 → v2 |
| 修改 `Report` 必填字段 | 是 → v2 |

规则集版本记在 `package.json` 的 `version`；宿主可以把它展示在设置页，方便用户判断「我用的规则是哪一版」。
