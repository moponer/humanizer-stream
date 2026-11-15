# 规则全表

> 本文件由 `node scripts/gen-rules-doc.mjs` 生成，不要手改。改规则请改 `src/rules/zh.js` 与 `src/rules/en.js`。

## 分类

| 分类 | 代号 | 条数 |
| --- | --- | --- |
| 开头 | `opening` | 7 |
| 填充 | `filler` | 6 |
| 结构 | `structure` | 5 |
| 节奏 | `rhythm` | 6 |
| 用词 | `jargon` | 3 |
| 口吻 | `voice` | 5 |
| 排版 | `format` | 5 |
| 结尾 | `closing` | 7 |
| 事实 | `fact` | 3 |

## 中文规则（33 条）

| 规则号 | 分类 | 严重度 | 约束 | 能否检测 |
| --- | --- | --- | --- | --- |
| `zh.open.era` | 开头 | 3 | 开头直接说结论或事实，不铺时代背景 | 是 |
| `zh.open.scene` | 开头 | 3 | 不写「在当今这个…时代」的舞台说明 | 是 |
| `zh.open.meta` | 开头 | 2 | 不报幕、不导览，直接给内容 | 是 |
| `zh.open.echo` | 开头 | 2 | 先回答，再解释；不复述问题 | 是 |
| `zh.open.flatter` | 开头 | 3 | 不夸提问、不表态热情 | 是 |
| `zh.close.sum` | 结尾 | 2 | 结尾不写「综上所述」这类没有新信息的总结 | 是 |
| `zh.close.hope` | 结尾 | 3 | 不写「希望对你有帮助」 | 是 |
| `zh.close.future` | 结尾 | 3 | 不展望未来、不升华 | 是 |
| `zh.close.offer` | 结尾 | 2 | 不主动提供后续服务 | 是 |
| `zh.close.ask` | 结尾 | 2 | 不反问「还需要我做什么吗」 | 是 |
| `zh.fill.noting` | 填充 | 2 | 删掉「值得注意的是 / 由此可见 / 众所周知」这类路标词 | 是 |
| `zh.fill.hollow` | 填充 | 3 | 不用「显著提升 / 极大改善 / 有效促进」代替数字 | 是 |
| `zh.fill.hedge` | 填充 | 2 | 不确定就说不确定，不叠「可能 / 或许 / 在一定程度上」 | 是 |
| `zh.fill.repeat` | 填充 | 2 | 一句话只表达一次，不换词重说 | 是 |
| `zh.struct.listify` | 结构 | 2 | 能用一两句说清的就不拆列表；列表项写事实，不写形容词 | 是 |
| `zh.struct.first` | 结构 | 2 | 不用「首先 / 其次 / 最后」机械分段 | 是 |
| `zh.struct.bold` | 结构 | 1 | 加粗只给真正的结论，一篇里不超过三处 | 是 |
| `zh.struct.heading` | 结构 | 1 | 小标题不写成「名词：副标题」的包装句式 | 是 |
| `zh.struct.binary` | 节奏 | 2 | 不用「不是 A，而是 B」制造对立 | 是 |
| `zh.struct.parallel` | 节奏 | 2 | 不凑三项排比 | 是 |
| `zh.struct.dash` | 节奏 | 1 | 少用破折号插话，一句话说完再补下一句 | 是 |
| `zh.struct.quote` | 排版 | 1 | 不给普通词加引号强调 | 是 |
| `zh.jargon.web` | 用词 | 3 | 不用互联网黑话，说人话 | 是 |
| `zh.jargon.big` | 用词 | 2 | 不用大词代替具体动作 | 是 |
| `zh.voice.nominal` | 口吻 | 2 | 用动词，不用「对 X 进行分析」这类名词化 | 是 |
| `zh.voice.passive` | 口吻 | 2 | 少用欧化被动；主语能省略就省略 | 是 |
| `zh.voice.service` | 口吻 | 3 | 不用客服腔（亲爱的用户、请您放心） | 是 |
| `zh.voice.self` | 口吻 | 3 | 不自称 AI、不做能力声明 | 是 |
| `zh.format.emoji` | 排版 | 2 | 不加装饰性 emoji | 是 |
| `zh.format.excl` | 排版 | 2 | 不用感叹号表热情 | 是 |
| `zh.format.halfpunct` | 排版 | 1 | 中文句子用全角标点 | 是 |
| `zh.fact.number` | 事实 | 3 | 数字要有出处；没有就写「没测过」 | 是 |
| `zh.fact.cite` | 事实 | 3 | 不编造引用与研究结论 | 是 |

## English rules (14)

| 规则号 | 分类 | 严重度 | 约束 | 能否检测 |
| --- | --- | --- | --- | --- |
| `en.open.era` | 开头 | 3 | Start with the finding, not the era | 是 |
| `en.open.delve` | 开头 | 3 | No 'let's dive in' / 'let's delve into' | 是 |
| `en.fill.noting` | 填充 | 2 | Never write 'it is important to note' | 是 |
| `en.fill.tapestry` | 用词 | 3 | No 'tapestry' or 'testament to' filler | 是 |
| `en.fill.hedge` | 填充 | 2 | State the uncertainty once | 是 |
| `en.struct.three` | 节奏 | 2 | Don't force the rule of three | 是 |
| `en.struct.negation` | 节奏 | 2 | Avoid 'not just X, but Y' | 是 |
| `en.struct.bold` | 结构 | 1 | Bold only the conclusion, max three | 是 |
| `en.struct.dash` | 节奏 | 1 | Use one em dash, not a row of them | 是 |
| `en.close.sum` | 结尾 | 2 | Skip 'in conclusion' restatements | 是 |
| `en.close.hope` | 结尾 | 3 | No 'hope this helps' or 'reach out' | 是 |
| `en.voice.self` | 口吻 | 3 | Never say you are an AI | 是 |
| `en.format.emoji` | 排版 | 2 | No decorative emoji | 是 |
| `en.fact.cite` | 事实 | 3 | Never invent studies or statistics | 是 |

---

## 逐条说明

### `zh.open.era`　开头 · 严重度 3
- **约束**：开头直接说结论或事实，不铺时代背景
- **反例**：随着数据规模的不断发展，数据治理变得愈发重要。
- **为什么**：模型没有具体的时间地点人物，只能用「随着…的发展」这种空转句子起手。
- **检测**：正则命中
### `zh.open.scene`　开头 · 严重度 3
- **约束**：不写「在当今这个…时代」的舞台说明
- **反例**：在当今数字化转型的时代，企业对效率的要求越来越高。
- **为什么**：信息量为零，任何主题都能套上去。
- **检测**：正则命中
### `zh.open.meta`　开头 · 严重度 2
- **约束**：不报幕、不导览，直接给内容
- **反例**：以下是为你整理的三个要点： / 话不多说，我们开始。
- **为什么**：读者要的是内容，不是目录。
- **检测**：正则命中
### `zh.open.echo`　开头 · 严重度 2
- **约束**：先回答，再解释；不复述问题
- **反例**：你问的是 Q3 订单怎么核对，这个问题可以从三个层面来看。
- **为什么**：复述是模型给自己争取缓冲，读者已经知道自己问了什么。
- **检测**：正则命中
### `zh.open.flatter`　开头 · 严重度 3
- **约束**：不夸提问、不表态热情
- **反例**：这是一个非常好的问题！
- **为什么**：客服式开场，和内容无关。
- **检测**：正则命中
### `zh.close.sum`　结尾 · 严重度 2
- **约束**：结尾不写「综上所述」这类没有新信息的总结
- **反例**：综上所述，数据治理是一项长期工作。
- **为什么**：如果前面说清了，总结是重复；没说清，总结也补不上。
- **检测**：正则命中
### `zh.close.hope`　结尾 · 严重度 3
- **约束**：不写「希望对你有帮助」
- **反例**：希望对你有帮助。
- **为什么**：对话残留，交付物里出现说明说话人没底气。
- **检测**：正则命中
### `zh.close.future`　结尾 · 严重度 3
- **约束**：不展望未来、不升华
- **反例**：未来可期，让我们拭目以待。
- **为什么**：把没做完的事包装成宏大叙事，是典型的收尾套路。
- **检测**：正则命中
### `zh.close.offer`　结尾 · 严重度 2
- **约束**：不主动提供后续服务
- **反例**：如有疑问，随时联系我。
- **为什么**：用户没说需要，这句话只是占位。
- **检测**：正则命中
### `zh.close.ask`　结尾 · 严重度 2
- **约束**：不反问「还需要我做什么吗」
- **反例**：需要我继续深入分析吗？
- **为什么**：把决策推回用户，等于没交付。
- **检测**：正则命中
### `zh.fill.noting`　填充 · 严重度 2
- **约束**：删掉「值得注意的是 / 由此可见 / 众所周知」这类路标词
- **反例**：值得注意的是，这个接口没有鉴权。
- **为什么**：路标词是给空洞内容壮胆的，直接说事更有力。
- **检测**：正则命中
### `zh.fill.hollow`　填充 · 严重度 3
- **约束**：不用「显著提升 / 极大改善 / 有效促进」代替数字
- **反例**：性能得到显著提升，用户体验大幅改善。
- **为什么**：没有度量就没有信息；有数字就写数字。
- **检测**：正则命中
### `zh.fill.hedge`　填充 · 严重度 2
- **约束**：不确定就说不确定，不叠「可能 / 或许 / 在一定程度上」
- **反例**：这或许可能在一定程度上会影响结果。
- **为什么**：多层软化等于什么都没说。
- **检测**：正则命中
### `zh.fill.repeat`　填充 · 严重度 2
- **约束**：一句话只表达一次，不换词重说
- **反例**：基本上大致可以说是可行的。
- **为什么**：同义反复是凑字数。
- **检测**：正则命中
### `zh.struct.listify`　结构 · 严重度 2
- **约束**：能用一两句说清的就不拆列表；列表项写事实，不写形容词
- **反例**：1. 高效：流程更顺畅 2. 稳定：系统更可靠
- **为什么**：把散文拆成编号清单会让内容看起来有结构，实际上每条都空。
- **检测**：结构检测（list-ratio）
### `zh.struct.first`　结构 · 严重度 2
- **约束**：不用「首先 / 其次 / 最后」机械分段
- **反例**：首先，梳理需求；其次，设计方案；最后，落地实施。
- **为什么**：顺序词替代了逻辑关系，读者看不出哪一步是重点。
- **检测**：正则命中
### `zh.struct.bold`　结构 · 严重度 1
- **约束**：加粗只给真正的结论，一篇里不超过三处
- **反例**：**高效**：**稳定**：**安全**：
- **为什么**：满屏加粗等于没有重点，那是排版噪音。
- **检测**：结构检测（bold-ratio）
### `zh.struct.heading`　结构 · 严重度 1
- **约束**：小标题不写成「名词：副标题」的包装句式
- **反例**：## 数据治理：从混乱到有序的必经之路
- **为什么**：冒号副标题是标题党结构，正文往往撑不起来。
- **检测**：正则命中
### `zh.struct.binary`　节奏 · 严重度 2
- **约束**：不用「不是 A，而是 B」制造对立
- **反例**：这不是一次升级，而是一次重构。
- **为什么**：为对仗牺牲准确：多数时候两者都对，或者根本不是对立关系。
- **检测**：正则命中
### `zh.struct.parallel`　节奏 · 严重度 2
- **约束**：不凑三项排比
- **反例**：更快、更稳、更省。
- **为什么**：三项并列是修辞拐杖，真实结论往往只有一条。
- **检测**：正则命中
### `zh.struct.dash`　节奏 · 严重度 1
- **约束**：少用破折号插话，一句话说完再补下一句
- **反例**：这个方案——说实话——并没有解决问题。
- **为什么**：破折号插入语是英文习惯，中文里连用会让句子断气。
- **检测**：结构检测（dash）
### `zh.struct.quote`　排版 · 严重度 1
- **约束**：不给普通词加引号强调
- **反例**：这才是真正的「效率」。
- **为什么**：引号该留给引用、术语与反讽，滥用只是强调手势。
- **检测**：正则命中
### `zh.jargon.web`　用词 · 严重度 3
- **约束**：不用互联网黑话，说人话
- **反例**：打通底层逻辑，形成闭环，赋能业务。
- **为什么**：这些词在原文里往往对应一件很具体的小事，写清楚那件事就行。
- **检测**：正则命中
### `zh.jargon.big`　用词 · 严重度 2
- **约束**：不用大词代替具体动作
- **反例**：构建全方位的协同生态。
- **为什么**：「全方位」「多维度」「深度融合」都不指向任何可执行的动作为。
- **检测**：正则命中
### `zh.voice.nominal`　口吻 · 严重度 2
- **约束**：用动词，不用「对 X 进行分析」这类名词化
- **反例**：对日志进行了分析，对配置进行了调整。
- **为什么**：「进行 + 名词」是英文 nominalization 直译，中文本来就有动词。
- **检测**：正则命中
### `zh.voice.passive`　口吻 · 严重度 2
- **约束**：少用欧化被动；主语能省略就省略
- **反例**：配置将被自动保存。
- **为什么**：「被…」在中文里多带不愉快色彩，日常陈述用「会」或直接说动作。
- **检测**：正则命中
### `zh.voice.service`　口吻 · 严重度 3
- **约束**：不用客服腔（亲爱的用户、请您放心）
- **反例**：亲爱的用户，请您放心，我们会竭诚为您服务。
- **为什么**：身份不对：助手不是客服，用户也不是工单。
- **检测**：正则命中
### `zh.voice.self`　口吻 · 严重度 3
- **约束**：不自称 AI、不做能力声明
- **反例**：作为一个 AI 语言模型，我无法…
- **为什么**：用户知道自己在跟谁说话；这句只用来免责。
- **检测**：正则命中
### `zh.format.emoji`　排版 · 严重度 2
- **约束**：不加装饰性 emoji
- **反例**：✅ 已完成 🚀 效率提升
- **为什么**：emoji 代替不了信息；界面与文档里还会破坏排版。
- **检测**：结构检测（emoji）
### `zh.format.excl`　排版 · 严重度 2
- **约束**：不用感叹号表热情
- **反例**：太棒了！！这个方案真的很好！
- **为什么**：情绪靠内容传达，标点只是补丁。
- **检测**：正则命中
### `zh.format.halfpunct`　排版 · 严重度 1
- **约束**：中文句子用全角标点
- **反例**：这个方案,我觉得可以.
- **为什么**：半角逗号句号出现在中文里，通常是英文模板没换干净。
- **检测**：正则命中
### `zh.fact.number`　事实 · 严重度 3
- **约束**：数字要有出处；没有就写「没测过」
- **反例**：约 80% 左右的用户对此表示满意。
- **为什么**：「约 / 左右 / 高达」配整数，是模型编造统计的典型形状。
- **检测**：正则命中
### `zh.fact.cite`　事实 · 严重度 3
- **约束**：不编造引用与研究结论
- **反例**：研究表明，90% 的团队都在这上面踩过坑。
- **为什么**：「研究表明 / 数据显示 / 业内普遍认为」后面没有可核对的来源，就是捏造。
- **检测**：正则命中

### `en.open.era`　开头 · 严重度 3
- **约束**：Start with the finding, not the era
- **反例**：In today's fast-paced world, teams need to move quickly.
- **为什么**：No specific time, place or actor — the sentence fits any topic.
- **检测**：正则命中
### `en.open.delve`　开头 · 严重度 3
- **约束**：No 'let's dive in' / 'let's delve into'
- **反例**：Let's dive into how the cache works.
- **为什么**：Announces the text instead of starting it.
- **检测**：正则命中
### `en.fill.noting`　填充 · 严重度 2
- **约束**：Never write 'it is important to note'
- **反例**：It is important to note that the endpoint is public.
- **为什么**：If it matters, say it; the announcement adds nothing.
- **检测**：正则命中
### `en.fill.tapestry`　用词 · 严重度 3
- **约束**：No 'tapestry' or 'testament to' filler
- **反例**：The tool is a testament to the power of automation.
- **为什么**：Decorative metaphor standing in for a claim.
- **检测**：正则命中
### `en.fill.hedge`　填充 · 严重度 2
- **约束**：State the uncertainty once
- **反例**：It may potentially be somewhat slower.
- **为什么**：Stacked hedges cancel each other out.
- **检测**：正则命中
### `en.struct.three`　节奏 · 严重度 2
- **约束**：Don't force the rule of three
- **反例**：Faster, cleaner, and more reliable.
- **为什么**：Three beats is a rhythm trick; usually one item is the real point.
- **检测**：正则命中
### `en.struct.negation`　节奏 · 严重度 2
- **约束**：Avoid 'not just X, but Y'
- **反例**：It's not just a tool, it's a workflow.
- **为什么**：Manufactures contrast that the facts don't support.
- **检测**：正则命中
### `en.struct.bold`　结构 · 严重度 1
- **约束**：Bold only the conclusion, max three
- **反例**：**Speed**: **Safety**: **Scale**:
- **为什么**：Uniform emphasis means no emphasis.
- **检测**：结构检测（bold-ratio）
### `en.struct.dash`　节奏 · 严重度 1
- **约束**：Use one em dash, not a row of them
- **反例**：The fix — as usual — was small — but real.
- **为什么**：Chained dashes read as a tic, not as punctuation.
- **检测**：结构检测（dash）
### `en.close.sum`　结尾 · 严重度 2
- **约束**：Skip 'in conclusion' restatements
- **反例**：In conclusion, automation saves time.
- **为什么**：Repeats what the reader already read.
- **检测**：正则命中
### `en.close.hope`　结尾 · 严重度 3
- **约束**：No 'hope this helps' or 'reach out'
- **反例**：Hope this helps! Feel free to reach out.
- **为什么**：Chat residue in a deliverable reads as low confidence.
- **检测**：正则命中
### `en.voice.self`　口吻 · 严重度 3
- **约束**：Never say you are an AI
- **反例**：As an AI language model, I cannot verify this.
- **为什么**：A disclaimer standing where a fact should be.
- **检测**：正则命中
### `en.format.emoji`　排版 · 严重度 2
- **约束**：No decorative emoji
- **反例**：Done ✅ Next: ship 🚀
- **为什么**：Emoji substitute for information and break layout.
- **检测**：结构检测（emoji）
### `en.fact.cite`　事实 · 严重度 3
- **约束**：Never invent studies or statistics
- **反例**：Studies show that 90% of teams struggle here.
- **为什么**：No verifiable source — that is fabrication, not summary.
- **检测**：正则命中
