import { allRules, rulesForLocale } from "./rules/index.js";
import { PROFILES } from "./rules/index.js";

/**
 * 检测器：只报告，不改写。
 *
 * 这个文件的存在理由：**改写别人的句子是代笔**。判断「这句是不是空洞」需要语义，
 * 正则做不到；做得到的那部分（删套话）已经在生成侧被规则挡住了。
 * 所以这里只回答一个问题：这段文字里有多少处明确的 AI 写作特征，分布在哪里。
 *
 * 用途是门禁与自检：CI 卡一道、交付前过一遍、界面文案抽查。
 * 它不是「绕过 AI 检测」的工具，分数低也不代表文本就好。
 */

const MAX_HITS_PER_RULE = 3;

/** 保护区的粗暴剥离：代码与链接不是散文，检查它们只会制造假阳性 */
function prose(text) {
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^---\n[\s\S]*?\n---\n/, " ");
}

function excerpt(text, index, len) {
  const from = Math.max(0, index - 12);
  const to = Math.min(text.length, index + len + 12);
  const s = text.slice(from, to).replace(/\s+/g, " ").trim();
  return (from > 0 ? "…" : "") + s + (to < text.length ? "…" : "");
}

const STRUCTURAL = {
  "bold-ratio": (text) => {
    const marks = text.match(/\*\*[^*\n]{1,40}\*\*/g) ?? [];
    if (marks.length < 5) return null;
    const bolded = marks.reduce((n, m) => n + m.replace(/\*\*/g, "").length, 0);
    if (bolded / Math.max(1, text.length) < 0.06 && marks.length < 8) return null;
    return { len: 1, excerpt: `${marks.length} 处加粗：${marks.slice(0, 3).join(" ")}` };
  },
  dash: (text) => {
    const hits = text.match(/——|—|--/g) ?? [];
    if (hits.length < 3) return null;
    const i = text.indexOf(hits[0]);
    return { len: 1, excerpt: excerpt(text, i, hits[0].length) , count: hits.length };
  },
  emoji: (text) => {
    const m = text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu);
    if (!m) return null;
    const i = text.indexOf(m[0]);
    return { len: m[0].length, excerpt: excerpt(text, i, m[0].length), count: m.length };
  },
  "list-ratio": (text) => {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 8) return null;
    const items = lines.filter((l) => /^(?:[-*+]|\d+[.)])\s+/.test(l)).length;
    if (items / lines.length < 0.6) return null;
    return { len: 1, excerpt: `${items}/${lines.length} 行是列表项`, count: items };
  },
};

/**
 * 检查一段文本。
 *
 * @returns {{
 *   score: number, chars: number, pass: boolean,
 *   hits: {id,cat,sev,rule,excerpt}[],
 *   byCat: Record<string, number>
 * }}
 */
export function check(text, { locale = "zh", profile = "prose", threshold = 15 } = {}) {
  const raw = String(text ?? "");
  const body = prose(raw);
  const chars = body.replace(/\s/g, "").length;
  const rules = locale === "auto" ? allRules() : rulesForLocale(locale);
  const cats = (PROFILES[profile] ?? PROFILES.prose).cats;

  const hits = [];
  for (const rule of rules) {
    if (rule.cat && !cats.includes(rule.cat)) continue;
    if (rule.re) {
      let found = 0;
      const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
      for (const m of body.matchAll(re)) {
        if (typeof m.index !== "number") continue;
        found += 1;
        if (found > MAX_HITS_PER_RULE) break;
        hits.push({
          id: rule.id,
          cat: rule.cat,
          sev: rule.sev ?? 2,
          rule: rule.rule,
          excerpt: excerpt(body, m.index, m[0].length),
        });
      }
      // 「同一类里出现两三次才算特征」的规则（路标词、感叹号、半角标点…）
      if (found > 0 && found < (rule.minHits ?? 1)) {
        hits.splice(hits.length - found, found);
      }
    } else if (rule.detect) {
      const fn = STRUCTURAL[rule.detect];
      const hit = fn ? fn(body) : null;
      if (!hit) continue;
      hits.push({
        id: rule.id,
        cat: rule.cat,
        sev: rule.sev ?? 1,
        rule: rule.rule,
        excerpt: hit.excerpt,
      });
    }
  }

  // 分数 = 每 100 字的加权命中数（严重度越高权重越大），封顶 100
  const weighted = hits.reduce((n, h) => n + h.sev, 0);
  const density = weighted / Math.max(chars, 50) * 100;
  const score = Math.min(100, Math.round(density * 6));

  const byCat = {};
  for (const h of hits) byCat[h.cat] = (byCat[h.cat] ?? 0) + 1;

  return { score, chars, pass: score < threshold, hits, byCat, threshold };
}

/** 把结果整理成一行给人看的摘要 */
export function summarise(result) {
  const top = [...new Set(result.hits.map((h) => h.id))].slice(0, 4);
  return `${result.chars} 字 · AI 味 ${result.score}/100 · 命中 ${result.hits.length} 处${top.length ? `（${top.join(" ") }）` : ""}`;
}
