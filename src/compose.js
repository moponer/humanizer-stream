import { PROFILES, selectRules, entryCost } from "./rules/index.js";

const HEADER = {
  zh: "以下写作规则是硬约束。写之前按它约束措辞，写完之后按它自查一遍；违反任何一条就算没写好：",
  en: "These writing rules are hard constraints. Follow them while drafting, and check the result against them before you finish:",
};

const BULLET = "- ";

/**
 * 把规则编译成一段可以直接塞进系统提示词的文本。
 *
 * 三条设计约束：
 *  1. **确定性**：同样的入参永远得到逐字节相同的字符串（宿主拼在系统提示词里，
 *     抖动一次就等于把前缀缓存全废掉）。
 *  2. **可预算**：`maxChars` 是硬上限，超出的规则整条丢弃，不截半句。
 *  3. **只写约束**：不写「你是资深文案」这类角色设定，也不列规则编号——
 *     模型要的是命令，不是文献目录。
 */
export function composeRules({ profile = "chat", locale = "zh", maxChars } = {}) {
  const lang = locale === "en" ? "en" : "zh";
  const p = PROFILES[profile] ?? PROFILES.chat;
  const rules = selectRules({ profile, locale: lang, maxChars });
  if (!rules.length) return "";
  const lines = rules.map((r) => {
    const head = BULLET + r.rule;
    const bad = r.bad ? (lang === "en" ? ` (avoid: ${r.bad})` : `（不要：${r.bad}）`) : "";
    return head + bad;
  });
  return [HEADER[lang], ...lines].join("\n");
}

/** 组合后的字数（宿主用来判断值不值得注入） */
export function composeCost(opts = {}) {
  const rules = selectRules(opts);
  return rules.reduce((n, r) => n + entryCost(r), 0);
}

/** 规则清单（给 `deslop rules` 与人读文档用），按场景过滤后逐条列出 */
export function listRules({ profile = "prose", locale = "zh" } = {}) {
  return selectRules({ profile, locale, maxChars: 100_000 }).map((r) => ({
    id: r.id,
    cat: r.cat,
    sev: r.sev ?? 2,
    rule: r.rule,
    bad: r.bad ?? "",
    why: r.why ?? "",
    detectable: Boolean(r.re || r.detect),
  }));
}
