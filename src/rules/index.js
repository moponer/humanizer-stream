import { zhRules } from "./zh.js";
import { enRules } from "./en.js";

/** 分类的固定顺序：进提示词时按这个顺序，保证每次生成的文本逐字节一致（宿主可放心缓存）。 */
export const CATEGORIES = ["opening", "filler", "structure", "rhythm", "jargon", "voice", "format", "closing", "fact"];

export const CATEGORY_LABELS = {
  opening: "开头",
  filler: "填充",
  structure: "结构",
  rhythm: "节奏",
  jargon: "用词",
  voice: "口吻",
  format: "排版",
  closing: "结尾",
  fact: "事实",
};

/**
 * 四个写入场景。`cats` 决定拿哪些类别的规则，`maxChars` 是这份提示词的字数上限
 * （不是模型输出上限）：宿主把它塞进系统提示词，太长会挤占上下文。
 */
export const PROFILES = {
  chat: {
    label: "对话与汇报",
    cats: ["opening", "filler", "structure", "rhythm", "jargon", "voice", "closing", "fact"],
    maxChars: 900,
  },
  prose: {
    label: "文档与文章",
    cats: CATEGORIES,
    maxChars: 2200,
  },
  code: {
    label: "注释与提交信息",
    cats: [],
    maxChars: 600,
  },
  ui: {
    label: "界面文案",
    cats: ["jargon", "voice", "format", "structure"],
    maxChars: 700,
  },
};

/**
 * 场景专属规则（不在通用表里，因为只对某一种文本成立）。
 * 字段与通用规则一致，只是没有检测正则。
 */
export const PROFILE_RULES = {
  code: {
    zh: [
      {
        id: "zh.code.why",
        cat: "voice",
        sev: 2,
        rule: "注释写「为什么」，不复述代码在做什么",
        bad: "// 把 i 加一",
        why: "代码已经说明了做什么，注释的价值在于记录原因与坑。",
      },
      {
        id: "zh.code.nochat",
        cat: "voice",
        sev: 3,
        rule: "注释里不写对话残留（好的、这里我们、如下图所示）",
        bad: "// 好的，接下来我们对参数进行处理",
        why: "注释是给未来的维护者看的，不是聊天记录。",
      },
      {
        id: "zh.code.commit",
        cat: "structure",
        sev: 2,
        rule: "提交信息写「改了什么、为什么」，不写「优化代码」",
        bad: "chore: 优化代码结构",
        why: "「优化」无法回溯，半年后没人知道改了什么。",
      },
    ],
    en: [
      {
        id: "en.code.why",
        cat: "voice",
        sev: 2,
        rule: "Comments explain why, not what the line already says",
        bad: "// increment i",
        why: "The code says what; the comment should say why.",
      },
      {
        id: "en.code.nochat",
        cat: "voice",
        sev: 3,
        rule: "No chat residue in comments",
        bad: "// Alright, now let's handle the params",
        why: "Comments are for the next maintainer, not a chat log.",
      },
      {
        id: "en.code.commit",
        cat: "structure",
        sev: 2,
        rule: "Commit messages state what changed and why",
        bad: "chore: improve code",
        why: "'Improve' cannot be audited six months later.",
      },
    ],
  },
  ui: {
    zh: [
      {
        id: "zh.ui.length",
        cat: "structure",
        sev: 2,
        rule: "按钮两到四个字，说明一句话；不写第二句补充",
        bad: "点击此处立即开始使用我们的服务",
        why: "界面上每多一个字都要用户多读一眼。",
      },
      {
        id: "zh.ui.please",
        cat: "voice",
        sev: 3,
        rule: "不用「请」「欢迎」「感谢」这类礼仪词",
        bad: "请稍候，我们正在为您加载",
        why: "界面是工具，不是营业员。",
      },
      {
        id: "zh.ui.nopromise",
        cat: "voice",
        sev: 2,
        rule: "说清用户能做什么，不承诺价值",
        bad: "让工作更高效、更智能",
        why: "「更高效」不是能力描述，用户点下去才知道有没有。",
      },
    ],
    en: [
      {
        id: "en.ui.length",
        cat: "structure",
        sev: 2,
        rule: "Buttons are 1–2 words; helper text is one sentence",
        bad: "Click here to get started with our service",
        why: "Every extra word is another thing to read.",
      },
      {
        id: "en.ui.please",
        cat: "voice",
        sev: 3,
        rule: "No 'please', 'welcome' or 'thank you' in UI copy",
        bad: "Please wait while we load your data",
        why: "The UI is a tool, not a greeter.",
      },
      {
        id: "en.ui.nopromise",
        cat: "voice",
        sev: 2,
        rule: "Describe the action, don't promise the outcome",
        bad: "Work smarter and faster",
        why: "That is marketing, not a capability.",
      },
    ],
  },
};

const ALL = [...zhRules, ...enRules];

export function allRules() {
  return ALL;
}

export function rulesForLocale(locale = "zh") {
  if (locale === "en") return enRules;
  if (locale === "zh") return zhRules;
  return ALL;
}

export function ruleById(id) {
  return ALL.find((r) => r.id === id) ?? null;
}

/** 一条规则进提示词要占多少字（只算真正会写出来的部分） */
export function entryCost(r) {
  return (r.rule?.length ?? 0) + (r.bad ? r.bad.length + 6 : 0) + 4;
}

/**
 * 选规则：按场景取类别，按严重度降序，再按分类顺序稳定排序，
 * 最后按 maxChars 截断（宁可少几条，也不让提示词顶掉上下文）。
 * 同输入必须同输出——宿主把它拼进系统提示词，抖动会让前缀缓存作废。
 */
export function selectRules({ profile = "chat", locale = "zh", maxChars } = {}) {
  const p = PROFILES[profile] ?? PROFILES.chat;
  const limit = Math.max(200, maxChars ?? p.maxChars);
  const base = rulesForLocale(locale).filter((r) => p.cats.includes(r.cat));
  const extra = (PROFILE_RULES[profile]?.[locale === "en" ? "en" : "zh"] ?? []).filter((r) => p.cats.length === 0 || p.cats.includes(r.cat));

  const ordered = [...extra, ...base].sort((a, b) => {
    if ((b.sev ?? 2) !== (a.sev ?? 2)) return (b.sev ?? 2) - (a.sev ?? 2);
    const ca = CATEGORIES.indexOf(a.cat);
    const cb = CATEGORIES.indexOf(b.cat);
    if (ca !== cb) return ca - cb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const picked = [];
  let used = 0;
  for (const r of ordered) {
    const cost = entryCost(r);
    if (used + cost > limit) continue;
    picked.push(r);
    used += cost;
  }
  return picked;
}
