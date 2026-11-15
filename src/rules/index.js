import { zhRules } from "./zh.js";
import { enRules } from "./en.js";
import { commentRules } from "./comment.js";

/** 全部规则，顺序即执行顺序（先删开场，再改句内，最后标记） */
export const allRules = [...zhRules, ...enRules, ...commentRules];

/**
 * 档位：按类别挑规则集。
 *  - prose（默认，文档/文案/说明）：能删能改，含句尾升华小句
 *  - chat（对话输出）：只删套话残留，不动承载语义的从句
 *  - mild（保守，只清最扎眼的）：填充词 + 残留 + 格式
 *  - code（代码）：只有注释规则
 *  - all：全部
 */
export const PROFILES = {
  prose: ["opening", "closing", "filler", "suffix", "structural", "punct", "format", "voice", "residue", "jargon", "rhythm"],
  // chat 与 prose 的差别只有一条：不删承载语义的从句（suffix / safe:false 的 voice 规则）
  // 公文腔化简这类安全替换，对话里同样要改
  chat: ["opening", "closing", "filler", "residue", "punct", "format", "voice"],
  mild: ["filler", "residue", "format"],
  code: ["structural", "filler", "voice", "punct", "format", "residue"],
  all: null,
};

/** 这些类别只标记不自动改（flag 规则本来也不改文本，这里只用来自检） */
export const FLAG_CATS = new Set(["jargon", "rhythm", "structural"]);

export const ruleIndex = new Map(allRules.map((r) => [r.id, r]));

/**
 * 挑出本次要用的规则。
 * @param {object} opts
 * @param {"prose"|"chat"|"mild"|"code"|"all"|string[]} [opts.profile]
 * @param {string[]} [opts.disabled]  要临时关闭的规则 id
 * @param {boolean} [opts.unsafe]     是否允许 safe:false 的规则（chat 档默认不允许）
 * @param {"zh"|"en"|"auto"} [opts.lang]
 */
export function selectRules(opts = {}) {
  const profile = opts.profile ?? "prose";
  const cats = Array.isArray(profile) ? profile : PROFILES[profile];
  const disabled = new Set(opts.disabled ?? []);
  const allowUnsafe = opts.unsafe ?? (profile === "prose" || profile === "all");
  const lang = opts.lang ?? "auto";

  return allRules.filter((r) => {
    if (disabled.has(r.id)) return false;
    if (!allowUnsafe && r.safe === false) return false;
    if (lang === "zh" && r.id.startsWith("en.")) return false;
    if (lang === "en" && r.id.startsWith("zh.")) return false;
    const scope = r.scope ?? "prose";
    if (scope === "comment") return profile === "code" || profile === "all";
    if (!cats) return true;
    return cats.includes(r.cat);
  });
}

/** 规则的元信息（给 `deslop rules` 与文档用） */
export function listRules() {
  return allRules.map((r) => ({
    id: r.id,
    cat: r.cat,
    kind: r.kind,
    scope: r.scope ?? "prose",
    label: r.label,
    weight: r.weight,
    safe: r.safe !== false,
  }));
}
