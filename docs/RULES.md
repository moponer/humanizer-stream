# 规则清单

> 本文件的表格由 `node scripts/gen-rules-doc.mjs` 从 `src/rules/` 生成。**改规则请改代码，不要改这里。**

动作只有三种：

- **删**：整段删掉，不补任何东西。只用于「不承载信息」的填充。
- **改**：替换成等价表达。等价性是可验证的（公文腔化简、全半角、加粗列表）。
- **标记**：只计数、不落笔。这类需要语义判断，自动改就是代笔。

来源：Wikipedia:Signs of AI writing（WikiProject AI Cleanup 的公开特征清单）、
jiji262/humanizer-chinese（MIT）对中文的 36 条拆解与误伤清单、余光中《怎样改进英式中文》。
词表与实现为本项目自写，未逐字搬运上述项目的受版权文本。

---

## 规则表

共 **66** 条。

### 开场（8）

| id | 动作 | 说明 | 语种 |
| --- | --- | --- | --- |
| `zh.opener.era` | 改 | 宏大时代开场（随着…的不断发展） | zh |
| `zh.opener.era2` | 改 | 宏大时代开场（在当今…时代） | zh |
| `zh.opener.teacher` | 改 | 讲义腔热身（话不多说 / 下面我们来看） | zh |
| `zh.opener.leadin` | 改 | 对话残留引子（以下是我为你整理的…：） | zh |
| `zh.filler.honest` | 改 | 假坦诚钩子（说实话，/ 不瞒你说，） | zh |
| `en.opener.wrap` | 改 | In today's fast-paced world | en |
| `en.opener.dive` | 改 | Let's dive in / take a look | en |
| `en.opener.leadin` | 改 | Here's what you need to know | en |

### 结尾（7）

| id | 动作 | 说明 | 语种 |
| --- | --- | --- | --- |
| `zh.closer.future` | 改 | 万能升华结尾（未来可期 / 拭目以待） | zh |
| `zh.closer.hope` | 改 | 对话残留祝福（希望对你有帮助） | zh |
| `zh.closer.subscribe` | 改 | 假互动引流（你怎么看？欢迎点赞关注） | zh |
| `zh.closer.subscribe2` | 改 | 假互动引流（点赞关注尾部） | zh |
| `zh.closer.thanks` | 改 | 感谢阅读 | zh |
| `en.closer.help` | 改 | I hope this helps | en |
| `en.closer.invite` | 改 | Let me know if you have any questions | en |

### 填充与路标（8）

| id | 动作 | 说明 | 语种 |
| --- | --- | --- | --- |
| `zh.filler.noting` | 改 | AI 高频路标（值得注意的是 / 由此可见） | zh |
| `zh.filler.overall` | 改 | 总结套话（综上所述 / 总而言之） | zh |
| `zh.repeat.very` | 改 | 程度副词叠用（非常非常） | zh |
| `en.filler.worth` | 改 | It's worth noting that | en |
| `en.filler.overall` | 改 | In conclusion / Overall | en |
| `en.filler.moreover` | 改 | Moreover / Furthermore 句首 | en |
| `cm.filler.open` | 改 | 注释里的空转前缀（注意：/ 备注：/ Note:） | 注 |
| `cm.filler.polite` | 改 | 注释里的客套（我们需要 / 我们可以） | 注 |

### 句尾升华（1）

| id | 动作 | 说明 | 语种 |
| --- | --- | --- | --- |
| `zh.suffix.uplift` | 改 | 句尾升华小句（，体现了…。） | zh |

### 结构（9）

| id | 动作 | 说明 | 语种 |
| --- | --- | --- | --- |
| `zh.list.marker` | 改 | 讲义式序号（首先，/ 其次，/ 最后，） | zh |
| `zh.flag.binary` | 标记 | 二分否定强调（不是 X，而是 Y） | zh |
| `zh.flag.heading` | 标记 | 小标题过度包装（标题里加冒号副标题） | zh |
| `zh.flag.fakeEnum` | 标记 | 伪跨度（从 X 到 Y） | zh |
| `en.flag.notjust` | 标记 | It's not just X, it's Y | en |
| `en.flag.titlecase` | 标记 | Title Case 小标题 | en |
| `cm.marker` | 改 | 注释里的讲义式序号（首先，/ 然后，） | 注 |
| `cm.flag.changelog` | 标记 | 以变更为锚的注释（原本…现在改为…） | 注 |
| `cm.flag.restate` | 标记 | 复述代码的注释（i++ // 自增） | 注 |

### 标点（10）

| id | 动作 | 说明 | 语种 |
| --- | --- | --- | --- |
| `zh.emphasis.excl` | 改 | 感叹号堆叠 | zh |
| `zh.dash.single` | 改 | 单字宽破折号（— → ——） | zh |
| `zh.punct.comma` | 改 | 中文里的半角逗号 | zh |
| `zh.punct.semicolon` | 改 | 中文里的半角分号 | zh |
| `zh.punct.colon` | 改 | 中文里的半角冒号 | zh |
| `zh.punct.question` | 改 | 中文里的半角问号/叹号 | zh |
| `zh.flag.quote` | 标记 | 给普通词加引号强调 | zh |
| `en.emphasis.excl` | 改 | 感叹号堆叠 | en |
| `en.flag.emDash` | 标记 | 破折号插入语（X — that is, Y — Z） | en |
| `cm.dash.single` | 改 | 注释里的单字宽破折号 | 注 |

### 排版（4）

| id | 动作 | 说明 | 语种 |
| --- | --- | --- | --- |
| `zh.bold.list` | 改 | 加粗列表项（- **高效**：… → - 高效：…） | zh |
| `zh.bold.label` | 改 | 行内加粗标签（**结论**：… → 结论：…） | zh |
| `en.bold.list` | 改 | 加粗列表项（- **Fast**: …） | en |
| `cm.space.excess` | 改 | 注释行尾空白 | 注 |

### 语体（公文腔/欧化）（6）

| id | 动作 | 说明 | 语种 |
| --- | --- | --- | --- |
| `zh.as.a` | 改 | 翻译腔（作为一个…，） | zh |
| `zh.nominalize` | 改 | 万能动词公文腔（对 X 进行分析 → 分析了 X） | zh |
| `zh.official.verb` | 改 | 空转动词（进行优化 → 优化） | zh |
| `zh.passive.future` | 改 | 欧化被动（将被自动保存 → 会自动保存） | zh |
| `cm.nominalize` | 改 | 注释里的公文腔（对 X 进行处理 → 处理 X） | 注 |
| `cm.official.verb` | 改 | 注释里的空转动词（进行优化 → 优化） | 注 |

### 模型残留（9）

| id | 动作 | 说明 | 语种 |
| --- | --- | --- | --- |
| `zh.opener.ok` | 改 | 应答残留（好的，/ 当然，） | zh |
| `zh.sycophancy` | 改 | 谄媚开场（这是一个非常好的问题） | zh |
| `zh.residue.ai` | 改 | 模型自述（作为一个 AI …） | zh |
| `zh.residue.cutoff` | 改 | 知识截止免责 | zh |
| `zh.residue.offer` | 改 | 随时联系我 | zh |
| `zh.flag.knowledgeGap` | 标记 | 知识缺口臆测填空（信息有限，很可能…） | zh |
| `en.sycophancy` | 改 | Great question! | en |
| `en.residue.ai` | 改 | As an AI language model | en |
| `cm.flag.todo` | 标记 | 含糊 TODO（TODO: 待补充） | 注 |

### 黑话（2）

| id | 动作 | 说明 | 语种 |
| --- | --- | --- | --- |
| `zh.flag.jargon` | 标记 | 互联网黑话/大词（赋能、抓手、闭环…） | zh |
| `en.flag.buzz` | 标记 | LLM 高频大词（delve / tapestry / testament…） | en |

### 节奏（2）

| id | 动作 | 说明 | 语种 |
| --- | --- | --- | --- |
| `zh.flag.parallel` | 标记 | 三项以上排比/对偶 | zh |
| `en.flag.triple` | 标记 | 三项并列堆砌 | en |

---

## 误伤清单：这些不算 AI 味

「单特征不定罪」是本项目最重要的判据。下面这些是真人写作的常见特征，规则里**故意不拦**：

| 现象 | 为什么不拦 |
| --- | --- |
| 一个段落里一个破折号 | 中文破折号是规范标点，不是英文的坏习惯。只拦 3 个以上的滥用 |
| 「总的来说」「换句话说」 | 真人也这么说话。只拦「综上所述」「总而言之」这类书面总结套话 |
| 四字成语、公文规范用语 | 文体要求如此，不是 AI 特征 |
| 港台引号「」、单引号 | 是标点体系，不是味道 |
| 通篇无主语 | 中文常态，不是欧化被动 |
| 文学性排比 | 只标记三项以上连续排比，不判死刑 |
| 加粗标题 | 只处理「列表项里的加粗标签」，不动正文强调 |
| 表格 | 默认整行不碰（对齐靠空白，改了必坏） |
| 数字、单位、专有名词 | 一个都不许改 |

另一侧的自查：**不许把文本改成假人味**。故意错别字、堆口语词、强行「说白了」——比 AI 味更尴尬。本项目不做任何这类「注入」。

---

## 档位分布

| 档位 | 类别 | 用途 |
| --- | --- | --- |
| `prose` | 全部可改（含句尾升华） | 文档、文案、README |
| `chat` | opening / closing / filler / residue / punct / format / voice | 对话回复 |
| `mild` | filler / residue / format | 只清最扎眼的 |
| `code` | 仅注释作用域 | 源码 |
| `all` | 全部 | 体检、审计 |

`profile: "chat"` 与 `prose` 的差别就一条：**不删承载语义的从句**。
「上线时间定在周五，这体现了团队的效率」在 chat 档保留后半句，
因为删掉它等于替用户下了「效率不重要」的判断。
