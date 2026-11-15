# humanizer-stream

**让模型在写的时候就别带 AI 味。**

一套写作约束（33 条中文 + 14 条英文），编译成一段可以直接塞进系统提示词的文本；
另带一个体检器，用来查已经写好的文本里还剩多少处 AI 特征。零依赖，Node 18+。

```bash
node bin/deslop.js inject --profile chat      # 打印该注入的规则
node bin/deslop.js check 文章.md              # 体检：多少处 AI 特征、在哪
```

## 0.1 为什么被推翻

上一版是**输出侧过滤器**：模型写完，插件在展示前改写——删「值得注意的是」、把「对数据进行了分析」还原成「分析了数据」、清掉装饰 emoji。想法听着省钱（不动提示词、不加 token），做起来有个绕不过去的坎：

**判断一句话是不是空话需要语义，正则做不到。**

- 删掉「综上所述」以后，后面那句重复的总结还在，只是没了引导，读起来更别扭；
- 「不是 A，而是 B」有时真的是对立关系，改了就歪曲原意；
- 句子里有代码、有引用、有数据时，任何改写都可能碰到不该碰的地方；
- 被改的文本和落盘的文本不一致，排查问题时看到的是两个版本。

结论：**改写别人的句子是代笔**。能做的只有在生成之前约束，生成之后只报告不动手。

## 现在的做法

```
规则表（人写）──► compose ──► 系统提示词里的一段 ──► 模型按规则写
                    │
                    └──► check ──► 报告（分数 + 命中位置），不改一个字
```

三层，各自只管一件事：

| 层 | 文件 | 干什么 |
| --- | --- | --- |
| 规则表 | `src/rules/zh.js` `src/rules/en.js` | 一条规则 = 约束 + 反例 + 为什么 + 检测正则 |
| 编译 | `src/compose.js` | 按场景挑规则、按字数预算截断、输出确定的提示词片段 |
| 体检 | `src/check.js` | 数特征、给分、指出位置；不产出改写结果 |

## 接入

### 1) 直接拿提示词（任何模型、任何宿主）

```js
import { writingRules } from "humanizer-stream";

const rules = writingRules({ profile: "chat", locale: "zh" });
// 拼进系统提示词一次，之后就不要再动它
const system = persona + "\n\n" + rules;
```

`writingRules()` 对同样的入参永远返回同一串字符（有测试锁着）。这一点必须成立：这段文本在系统提示词里，抖一次就等于把前缀缓存全废掉。

### 2) 命令行

```bash
deslop inject --profile prose --lang zh --max 2200   # 文档场景，预算 2200 字
deslop rules --profile chat                           # 看这个场景会注入哪些规则
deslop explain zh.close.future                        # 一条规则的来龙去脉
```

### 3) lynn 插件

```bash
deslop install-lynn     # 装到 ~/.lynn/plugins/humanizer-stream/
```

宿主契约（`api = 2`）：

```js
export const api = 2;
export function writingRules({ profile, locale, maxChars }) -> string
```

lynn 把它拼进系统提示词的固定段（每个会话只拼一次）。关掉开关就不注入，输出一个字节都不改。

## 四个场景

| profile | 用在哪 | 覆盖类别 | 预算 |
| --- | --- | --- | --- |
| `chat` | 对话、汇报、群消息 | 开头 / 填充 / 结构 / 节奏 / 用词 / 口吻 / 结尾 / 事实 | 900 字 |
| `prose` | 文档、文章、报告 | 全部 | 2200 字 |
| `code` | 代码注释、提交信息 | 注释与提交信息专属三条 | 600 字 |
| `ui` | 界面文案 | 用词 / 口吻 / 排版 / 结构 + 专属三条 | 700 字 |

预算超了就整条丢弃，不截半句——半条规则会变成一条错的规则。

## 规则长什么样

```js
{
  id: "zh.close.future",
  cat: "closing",
  sev: 3,
  rule: "不展望未来、不升华",
  bad: "未来可期，让我们拭目以待。",
  why: "把没做完的事包装成宏大叙事，是典型的收尾套路。",
  re: /(?:未来可期|未来前景可期|让我们拭目以待)/g,
}
```

`why` 不是装饰：没有理由的禁令，下一个人维护时会当成个人偏好删掉。
全表在 [docs/RULES.md](docs/RULES.md)（由 `node scripts/gen-rules-doc.mjs` 从规则表生成）。

## 体检怎么用

```bash
deslop check docs/            # 目录递归
deslop check --strings src/   # 源码模式：从 TS/TSX 里抠出界面文案再逐条查
deslop check --json x.md      # 机器可读，接 CI
```

输出是「多少字、多少分、命中哪些规则、命中在哪一句」。阈值默认 15，超了退出码 1。

**别把它当 AI 检测器。** 分数低只说明没有那些明确的特征，不说明文章好；分数高也不等于要被平台判罚。它是一把尺子，不是判决书。

## 它不做什么

- 不改写你的输出，一个字都不改；
- 不新增事实、数字、引用；
- 不伪装成「人类写作」，也不承诺绕过任何检测；
- 不联网、不调用模型、零运行时依赖。

## 目录

```
src/rules/zh.js        中文规则表
src/rules/en.js        英文规则表
src/rules/index.js     分类、场景、选规则（确定性排序 + 预算）
src/compose.js         规则 → 提示词文本
src/check.js           体检（只报告）
src/strings.js         从源码里抠界面文案
bin/deslop.js          命令行
adapters/lynn/         lynn 宿主适配器与清单
test/                  规则结构 / 组合 / 检测 三组测试
docs/DESIGN.md         0.1 复盘与设计取舍
docs/RULES.md          全表（生成物）
```

跑测试：

```bash
node --test
```

## 许可

MIT。规则里的「AI 写作特征」描述来自公开材料（Wikipedia:Signs of AI writing、CCL 2023、余光中《怎样改进英式中文》），措辞、反例、检测实现都是本项目自写。
