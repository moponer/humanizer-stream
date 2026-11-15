/**
 * 从规则表生成 docs/RULES.md 的规则清单部分。
 * 规则是唯一事实来源（src/rules/*），文档不许手抄——手抄必然过期。
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { listRules } from "../src/rules/index.js";

const rows = listRules();
const cats = {
  opening: "开场",
  closing: "结尾",
  filler: "填充与路标",
  suffix: "句尾升华",
  structural: "结构",
  punct: "标点",
  format: "排版",
  voice: "语体（公文腔/欧化）",
  residue: "模型残留",
  jargon: "黑话",
  rhythm: "节奏",
};
const kinds = { delete: "删", replace: "改", flag: "标记" };

const byCat = new Map();
for (const r of rows) {
  if (!byCat.has(r.cat)) byCat.set(r.cat, []);
  byCat.get(r.cat).push(r);
}

let out = "";
for (const cat of Object.keys(cats)) {
  const list = byCat.get(cat);
  if (!list || list.length === 0) continue;
  out += `### ${cats[cat]}（${list.length}）\n\n`;
  out += "| id | 动作 | 说明 | 语种 |\n| --- | --- | --- | --- |\n";
  for (const r of list) {
    const scope = r.scope === "comment" ? "注" : r.id.startsWith("en.") ? "en" : "zh";
    out += `| \`${r.id}\` | ${kinds[r.kind]} | ${r.label} | ${scope} |\n`;
  }
  out += "\n";
}

const head = `# 规则清单

> 本文件的表格由 \`node scripts/gen-rules-doc.mjs\` 从 \`src/rules/\` 生成。**改规则请改代码，不要改这里。**

动作只有三种：

- **删**：整段删掉，不补任何东西。只用于「不承载信息」的填充。
- **改**：替换成等价表达。等价性是可验证的（公文腔化简、全半角、加粗列表）。
- **标记**：只计数、不落笔。这类需要语义判断，自动改就是代笔。

来源：Wikipedia:Signs of AI writing（WikiProject AI Cleanup 的公开特征清单）、
jiji262/humanizer-chinese（MIT）对中文的 36 条拆解与误伤清单、余光中《怎样改进英式中文》。
词表与实现为本项目自写，未逐字搬运上述项目的受版权文本。

---

## 规则表

共 **${rows.length}** 条。

`;

const tail = `---

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
| \`prose\` | 全部可改（含句尾升华） | 文档、文案、README |
| \`chat\` | opening / closing / filler / residue / punct / format / voice | 对话回复 |
| \`mild\` | filler / residue / format | 只清最扎眼的 |
| \`code\` | 仅注释作用域 | 源码 |
| \`all\` | 全部 | 体检、审计 |

\`profile: "chat"\` 与 \`prose\` 的差别就一条：**不删承载语义的从句**。
「上线时间定在周五，这体现了团队的效率」在 chat 档保留后半句，
因为删掉它等于替用户下了「效率不重要」的判断。
`;

const path = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "docs/RULES.md");
const prev = existsSync(path) ? readFileSync(path, "utf8") : "";
const body = `${head}${out}${tail}`;
writeFileSync(path, body, "utf8");
console.log(`已生成 ${path}（${rows.length} 条规则${prev ? "，覆盖旧文件" : ""}）`);
