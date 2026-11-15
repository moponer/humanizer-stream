/**
 * 段落级/行级「pass」：正则规则做不了、需要一点点上下文判断的改写。
 * 全部是纯函数、确定性、幂等，且只做减法（只删多余修饰，不加新内容）。
 */

export const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{2500}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu;

const EMOJI_TEST = new RegExp(EMOJI_RE.source, "u");

/** 去掉装饰性 emoji（连同前后多余空格），保留文字层次 */
export function stripEmoji(text) {
  // 没有 emoji 就原样返回——否则下面那些空格整理会啃掉
  // 「我们对 `x` 里的 y」这类中英混排里必要的空格
  if (!EMOJI_TEST.test(text)) return text;
  // 只有 emoji 本来就顶在段首时才吃掉它后面的空格
  const leading = /^[ \t]*\p{Extended_Pictographic}/u.test(text);
  let out = text.replace(EMOJI_RE, "").replace(/[ \t]{2,}/g, " ");
  if (leading) out = out.replace(/^[ \t]+/, "");
  return out;
}

/**
 * 对冲词去重：一句话里最多留一个限定词。
 * AI 的典型病是「或许可能在一定程度上」三连，人不会这么写。
 * 用一条合并正则而不是逐个替换——否则「一定程度上」会被「在一定程度上」的子串匹配再删一遍。
 */
const HEDGE_RE = /(?:在)?(?:一定程度上|某种程度上|相对而言|相对来说|一般来说|大体上|基本上|或许|也许|可能|大概|似乎)/g;

export function collapseHedges(text) {
  return text
    .split(/(?<=[。！？!?\n])/)
    .map((sent) => {
      let seen = false;
      return sent.replace(HEDGE_RE, (m) => {
        if (!seen) {
          seen = true;
          return m;
        }
        return "";
      });
    })
    .join("");
}

/**
 * 破折号密度控制：一行里 3 个以上 `——` 就只留前两个，其余改逗号。
 * 中文破折号是规范标点，不能一刀切禁（这是和英文规则相反的结论）。
 */
export function limitDashes(text) {
  let count = 0;
  return text.replace(/——/g, (m) => {
    count += 1;
    return count <= 2 ? m : "，";
  });
}

/**
 * 规则删改之后收拾战场：重复标点、行首孤立标点、多余空格。
 * 注意：**不许**去掉片段末尾的空格——片段是「保护区之间的一段正文」，
 * 末尾那个空格是给后面的代码/链接留的（"我们对 `foo` 里的" 会变成 "我们对`foo` 里的"）。
 */
export function tidy(text) {
  return text
    .replace(/([，。；：！？、])\1+/g, "$1")
    .replace(/，([。！？；])/g, "$1")
    .replace(/^[，。；、：]+/u, "")
    .replace(/([（(])\s+/g, "$1")
    .replace(/([^\s])[ \t]{3,}(?=[^\s])/g, "$1 ");
}

/**
 * 节奏自检：连续 4 句都超过 40 字 → 判定「匀速长句」。
 * 只报告不改写——改节奏必然要重写句子，那就是编造。
 */
export function rhythmHits(text) {
  const sentences = text.split(/[。！？!?\n]+/).filter((s) => s.trim().length > 0);
  let run = 0;
  let worst = 0;
  for (const s of sentences) {
    if (s.trim().length >= 40) {
      run += 1;
      worst = Math.max(worst, run);
    } else {
      run = 0;
    }
  }
  return worst >= 4 ? worst : 0;
}

/** 中文字数（不含空白），给评分做分母 */
export function charCount(text) {
  return text.replace(/\s/g, "").length;
}
