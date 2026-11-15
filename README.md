# humanizer-stream

**把 AI 味从输出里洗掉，一个 token 都不多花。**

模型写出来的东西有一股味儿：套话开场、句尾升华、满屏加粗、破折号插入语、`综上所述 + 未来可期` 收尾。*humanizer-stream* 在**出口**把这类痕迹削掉——不改你的提示词，不额外调用一次模型，不动上下文，因此**不增加 token 消耗、不打穿前缀缓存命中率**。

它不是一个 skill，也不是一段 prompt。它是一层可以插在任何 harness 输出链路上的过滤器。

```
模型（原样）──► [ humanizer-stream ] ──► 用户看到的文本
                       │
                       └─ 规则命中、改写、丢弃套话；代码/URL/路径/公式原样通过
```

---

## 为什么不是又一个 prompt

社区里做得最好的几个去 AI 味项目（`blader/humanizer`、`jiji262/humanizer-chinese` 等）都是 **SKILL.md**：把规则写进上下文，让模型自己改写。效果确实好，但它们有三个绕不过去的代价：

| 代价 | 后果 |
| --- | --- |
| 规则要进提示词 | 提示词变了 → **前缀缓存全废**，每轮多付一份完整输入的钱 |
| 让模型再写一遍 | **输出 token 翻倍**，长文尤其贵；还会引入新的事实漂移风险 |
| 常驻上下文 | 吃掉窗口，挤掉真正需要的材料 |

`humanizer-stream` 换了个位置：**不参与生成，只参与呈现**。

- 输入侧一个字节都不改 → 缓存命中率与不开插件时**完全一致**。
- 不发起任何模型请求 → token 消耗增量**为 0**。
- 不写进会话历史 → 上下文长度**不变**。

换句话说：这层过滤器对「模型看到什么」无感，只对「人看到什么」负责。

---

## 装 / 用

零依赖，Node 18+。仓库里没有构建步骤，`src/` 就是可运行代码。

```bash
git clone <this-repo> humanizer-stream
cd humanizer-stream
node bin/deslop.js samples/before-zh.md      # 直接看效果
```

### 1) 命令行（改已有文件、交付前过一遍）

```bash
deslop article.md                 # 过滤后打到 stdout
deslop -i docs/*.md               # 原地改写
deslop --dir docs --write         # 递归改写
deslop --check README.md          # 只体检：AI 味超阈值退出码 1（CI 门禁）
deslop --check --json doc.md      # 机器可读报告
deslop rules                      # 全部规则清单
```

### 2) 作为库（harness 里挂一个输出钩子）

```js
import { createTextFilter } from "humanizer-stream";

const hz = createTextFilter({ profile: "chat" });

// 一次性
const clean = hz.text(modelOutput);

// 流式：push 返回「现在可以安全输出」的片段，end 冲刷尾巴
const stream = hz.stream();
onDelta((d) => render(stream.push(d)));
onEnd(() => render(stream.end()));
```

### 3) 作为 HTTP 代理（客户端零改动，最推荐）

```bash
deslop proxy --upstream https://api.deepseek.com --port 8787
```

把任意客户端的 `baseURL` 指到 `http://127.0.0.1:8787` 就行。请求体原样转发，只在响应正文的文本字段上做减法。支持 OpenAI Chat Completions / Completions / Responses API 与 Anthropic Messages（流式与非流式）。

### 4) 作为 MCP server

```bash
deslop mcp
```

提供 `humanize_text`、`humanize_file`、`score_text` 三个工具。适合「交付前过一遍」，不适合指望 agent 每次主动调。

### 5) 作为 lynn（或任意宿主）插件

```bash
deslop install-lynn     # 装到 ~/.lynn/plugins/humanizer-stream/
```

宿主只需实现 §3 的文本过滤器契约（见 `docs/PLUGIN-CONTRACT.md`），把模型文本在**展示前**过一遍即可。

---

## 它到底改什么

三类动作，从保守到激进：

- **删**：无信息量的填充。「随着…的不断发展」「值得注意的是」「综上所述」「希望对你有帮助」「未来可期，让我们拭目以待」。
- **改**：有安全等价物的表达。「对数据进行了分析」→「分析了数据」；「将被自动保存」→「会自动保存」；半角标点 → 全角；`- **高效**：…` → `- 高效：…`。
- **标记**：需要语义判断的，**只报告不动手**。互联网黑话（赋能/抓手/闭环）、三项排比、`不是 X，而是 Y`、破折号插入语。自动改这些就是代笔，会编造原文没有的判断。

规则共 70+ 条，中文为主、英文并行，逐条带来源与示例：见 [docs/RULES.md](docs/RULES.md)。

---

## 它绝对不碰什么

保护区分三档，认不准一律不动：

| 类别 | 例子 |
| --- | --- |
| 代码 | 围栏代码块、行内代码、shell 片段 |
| 定位符 | URL、邮箱、Windows/Unix 路径、版本号、git hash、`{{模板}}` |
| 结构 | YAML frontmatter、Markdown 表格、HTML/JSX 标签、`$公式$` |
| 数据 | 数字、单位、引号内的原话 |

外加两条硬约束：

1. **只做减法**：不新增事实、人名、数字、日期。删掉的只能是「说话方式」，不能是「说了什么」。
2. **删空回退**：如果一段文本被削成空串（说明规则在这个语境下误判），原样返回。

源码文件（`.ts` / `.py` / `.go` …）走 **code 档**：只处理注释，代码本体一个字符不动，且**注释规则绝不删行、不动注释符**——保证 diff 干净、语法安全。

---

## 流式安全

流式场景最容易翻车：规则被 chunk 边界切断（`值得注意的` + `是，`），或者把 ```` ``` ```` 这种跨块状态搞错。

做法：

- 缓冲区只在**行 / 句边界**切（`\n。！？；` 等），切不出边界就继续攒（默认 80 字起、600 字兜底硬切）。
- 围栏状态、frontmatter 状态、块注释状态、字符串状态在 push 之间保持。
- 硬切（词中间）时，段首不算真正句首，`^` 锚定规则一律不跑。

有一条测试专门锁这个不变量：**把同一段文本按 1/2/3/7/13/64 字切碎喂进去，结果必须与一次性处理逐字节相同**。

---

## 体检分不是检测器

`deslop --check` 会给一个 0–100 的分。请**不要**拿它当「绕过 AI 检测」的指标——那是另一种假。它只是内部质量信号：同样的字数里，命中了多少条明确的 AI 写作特征、有多重。正确的用法是当 CI 门禁：

```yaml
- run: node bin/deslop.js --check docs/*.md --threshold 15
```

---

## 文档

| 文件 | 内容 |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 引擎内部：状态机、缓冲区、保护区扫描 |
| [docs/RULES.md](docs/RULES.md) | 全部规则、来源、误伤清单、按档位分布 |
| [docs/INTEGRATION.md](docs/INTEGRATION.md) | 六种接入方式的完整配方 |
| [docs/PLUGIN-CONTRACT.md](docs/PLUGIN-CONTRACT.md) | 插件接口规范 v1（宿主 ↔ 插件） |
| [docs/SAFETY.md](docs/SAFETY.md) | 不变量、回退策略、如何验证 |

## 许可

MIT。规则中的「AI 写作特征」描述来自公开材料（Wikipedia:Signs of AI writing、CCL 2023 等），实现与词表为本项目自写。
