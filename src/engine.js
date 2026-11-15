/**
 * 流式去 AI 味引擎。
 *
 * 设计前提（决定了所有取舍）：
 *  1. 只吃「模型已经产出的文本」，绝不回问模型 → 不多花 1 个 token，不改提示词 → 前缀缓存完全不受影响。
 *  2. 必须能处理流式增量：hold 住尾巴，只在句子/行边界输出，保证规则不被 chunk 切开。
 *  3. 保护区优先：代码块、行内码、URL、路径、公式、frontmatter、表格一律不碰。
 *  4. 只做减法：删套话、化简公文腔。要做「重写」的那部分（黑话、排比）只标记，不代笔，因为那需要编造。
 */

import { selectRules } from "./rules/index.js";
import {
  splitProtected,
  splitLinePrefix,
  isTableRow,
  fenceMarker,
  isFrontmatterFence,
  scanCodeLine,
} from "./scan.js";
import { collapseHedges, limitDashes, tidy, stripEmoji, rhythmHits, charCount } from "./passes.js";
import { buildReport } from "./score.js";

export const DEFAULTS = {
  /** prose=文档/文案/说明；chat=对话输出；mild=只清最扎眼的；code=源码；all=全部 */
  profile: "prose",
  /** zh / en / auto */
  lang: "auto",
  /** text=Markdown 文本；code=源码 */
  mode: "text",
  /** strip=删装饰 emoji；keep=保留 */
  emoji: "strip",
  /**
   * text 模式里是否处理围栏代码块内的注释。
   * 默认 **false**：回答里贴的代码片段用户通常要原样复制，动它就是帮倒忙。
   * （整份源码走 mode:"code" 时，注释规则始终生效。）
   */
  comments: false,
  /** 是否过滤表格单元格（默认不动表格） */
  tables: false,
  /** 临时关闭的规则 id */
  disabled: [],
  /** 是否允许删承载语义的从句（默认按 profile 决定） */
  unsafe: undefined,
  /** 至少攒够多少字符才找边界（越小越实时，越大规则命中越完整） */
  minEmit: 80,
  /** 缓冲区超过这个长度就硬切，避免长段落一直不输出 */
  maxHold: 600,
  /** 删改之后是否收拾重复标点 */
  tidy: true,
  /** 是否把连续空行压到一个（删掉整句套话后常留两个空行） */
  collapseBlank: true,
};

const CUT_CHARS = new Set(["\n", "。", "！", "？", "；", "!", "?", ";", "…"]);

/**
 * 建一个流式过滤器。
 * @param {Partial<typeof DEFAULTS>} options
 */
export function createEngine(options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const rules = selectRules(opts);

  const st = {
    buf: "",
    /** 是否已收到第一块（用于剥 BOM） */
    started: false,
    midLine: false,
    atStart: true,
    inFence: false,
    fenceMark: "",
    frontmatter: false,
    comment: { inBlock: null, inString: null },
  };

  /** @type {Record<string, number>} */
  const hits = {};
  let inputChars = 0;
  /** @type {{kind:string, from:string, to:string}[]} */
  const samples = [];

  function hit(rule, n) {
    if (!n) return;
    hits[rule.id] = (hits[rule.id] ?? 0) + n;
  }

  /**
   * `^` 锚定规则在句中也要能用：「……。首先，……」里的「首先」同样是句首。
   * 换成后行断言 (?<=^|[。！？!?\n])，同时保留真正的行首匹配。
   */
  const sentenceReCache = new Map();
  function sentenceRe(rule) {
    let re = sentenceReCache.get(rule.id);
    if (!re) {
      const src = rule.re.source.slice(1);
      re = new RegExp(`(?<=^|[。！？!?\\n])${src}`, rule.re.flags);
      sentenceReCache.set(rule.id, re);
    }
    return re;
  }

  // ── 单行处理 ────────────────────────────────────────────────────────────
  function applyRulesOnce(t, anchored) {
    let moved = false;
    for (const rule of rules) {
      if (rule.scope === "comment") continue;
      // 硬切（切点落在词中间）时，段首不是真正的句首，`^` 规则一律不跑
      if (!anchored && rule.re.source.startsWith("^")) continue;
      const re = rule.re.source.startsWith("^") ? sentenceRe(rule) : rule.re;
      const m = t.match(re);
      if (!m || m.length === 0) continue;
      if (rule.kind === "flag") {
        hit(rule, m.length);
        if (samples.length < 40) samples.push({ kind: "flag", from: m[0].slice(0, 40), to: rule.label });
        continue;
      }
      const before = t;
      t = t.replace(re, rule.to);
      if (t !== before) {
        hit(rule, m.length);
        if (samples.length < 40) samples.push({ kind: rule.kind, from: m[0].slice(0, 40), to: rule.id });
        moved = true;
      }
    }
    return { t, moved };
  }

  function transformSpan(text, anchored) {
    let t = text;
    if (opts.emoji === "strip") t = stripEmoji(t);
    t = collapseHedges(t);
    t = limitDashes(t);

    // 跑两轮：删掉前一句套话之后，后一句才落到句首（「值得注意的是，随着…」）
    for (let pass = 0; pass < 2; pass += 1) {
      const r = applyRulesOnce(t, anchored);
      t = r.t;
      if (!r.moved) break;
    }
    if (opts.tidy) t = tidy(t);
    /**
     * 结尾套话被连标点一起删掉时，句子会失去终止符（「…分析了日志」）。
     * 原文本来以句末标点结尾 → 这里把终止符补回来。补的是标点，不是内容。
     */
    if (t && /[\u4e00-\u9fa5]$/u.test(t) && /[。！？!?]$/u.test(text)) t += "。";
    return t;
  }

  function transformProseLine(line) {
    const { prefix, body } = splitLinePrefix(line);
    if (!body) return line;
    const segs = splitProtected(body);
    let out = prefix;
    let first = true;
    for (const seg of segs) {
      if (seg.p) {
        out += seg.t;
        first = false;
        continue;
      }
      const anchored = !st.midLine && prefix === "" && first;
      out += transformSpan(seg.t, anchored);
      first = false;
    }
    return out;
  }

  /** 注释体（去掉注释符之后）才吃规则 */
  function rewriteComment(text) {
    const patterns = [
      /^(\s*)(\/\*+)([ \t]?)([\s\S]*?)([ \t]*\*\/)?$/,
      /^(\s*)(<!--)([ \t]?)([\s\S]*?)([ \t]*-->)?$/,
      /^(\s*)(\/\/\/?|#)([ \t]?)([\s\S]*)$/,
      /^(\s*\*)([ \t]?)([\s\S]*?)([ \t]*\*\/)?$/,
    ];
    for (const re of patterns) {
      const m = re.exec(text);
      if (!m) continue;
      const [all, lead, mark, gap, core, tail] = m;
      if (!all || !core) return text;
      let body = core;
      if (opts.emoji === "strip") body = stripEmoji(body);
      // 跑两轮：删掉「注意：」之后，后面那条「首先，」才落到行首
      for (let pass = 0; pass < 2; pass += 1) {
        let moved = false;
        for (const rule of rules) {
          if (rule.scope !== "comment") continue;
          const mm = body.match(rule.re);
          if (!mm || mm.length === 0) continue;
          if (rule.kind === "flag") {
            if (pass === 0) hit(rule, mm.length);
            continue;
          }
          const before = body;
          body = body.replace(rule.re, rule.to);
          if (body !== before) {
            hit(rule, mm.length);
            moved = true;
          }
        }
        if (!moved) break;
      }
      if (opts.tidy) body = tidy(body);
      if (!body.trim()) return text;
      return `${lead}${mark}${gap}${body}${tail ?? ""}`;
    }
    return text;
  }

  function filterCodeLine(line) {
    const parts = scanCodeLine(line, st.comment);
    let out = "";
    for (const p of parts) out += p.type === "comment" ? rewriteComment(p.text) : p.text;
    return out;
  }

  function consumeLine(line) {
    // 代码模式：整行当代码处理
    if (opts.mode === "code") return filterCodeLine(line);

    // 空白行 / 被删空的段落：最多留一个空行（Markdown 段落只认一个）
    const blank = () => {
      st.blankRun = (st.blankRun ?? 0) + 1;
      return opts.collapseBlank !== false && st.blankRun > 1 ? null : "";
    };
    // 有内容的行（含围栏、表格）都结束「连续空行」计数
    const keep = (s) => {
      st.blankRun = 0;
      return s;
    };

    // 围栏代码块
    const marker = fenceMarker(line);
    if (st.inFence) {
      if (marker && marker === st.fenceMark) {
        st.inFence = false;
        st.fenceMark = "";
        return keep(line);
      }
      return keep(opts.comments ? filterCodeLine(line) : line);
    }
    if (marker) {
      st.inFence = true;
      st.fenceMark = marker;
      return keep(line);
    }

    // YAML frontmatter
    if (st.frontmatter) {
      if (isFrontmatterFence(line)) st.frontmatter = false;
      return keep(line);
    }
    if (st.atStart && isFrontmatterFence(line)) {
      st.frontmatter = true;
      return keep(line);
    }
    if (line.trim()) st.atStart = false;

    // 表格：默认不动（对齐、列宽都靠空白，改了必坏）
    if (!opts.tables && isTableRow(line)) return keep(line);

    if (!line.trim()) return blank();
    const body = transformProseLine(line);
    // 整行被删空 → 视作空行，不额外多留一个空行
    if (!body.trim()) return blank();
    return keep(body);
  }

  function consume(piece) {
    const lines = piece.split(/(?<=\n)/);
    let out = "";
    let first = true;
    for (const raw of lines) {
      if (!raw) continue;
      const hasNl = raw.endsWith("\n");
      const withCr = hasNl ? raw.slice(0, -1) : raw;
      // CRLF：`\r` 属于行终止符，不能留在正文里（否则 $ 锚定规则与 tidy 都会错位）
      const cr = withCr.endsWith("\r") ? "\r" : "";
      const line = cr ? withCr.slice(0, -1) : withCr;
      const res = consumeLine(line);
      // null = 这行连同换行一起吞掉（连续空行的第二个起）
      if (res !== null) out += res + cr + (hasNl ? "\n" : "");
      // 只有整段的第一行可能"接在上一段中间"（硬切造成），后续行都是真行首
      if (first) {
        st.midLine = !hasNl;
        first = false;
      }
    }
    return out;
  }

  /**
   * 找一个可以安全输出的切点。
   * 只在行/句边界切——切在句中会把规则切断（"值得注意的" + "是，"）。
   * hard=true 表示没找到边界、被 maxHold 硬切，此时下一段开头不能跑 `^` 锚定规则。
   */
  function safeCut(buf) {
    const n = buf.length;
    if (n < opts.minEmit) return { cut: 0, hard: false };
    for (let i = n - 1; i >= opts.minEmit - 1; i -= 1) {
      if (CUT_CHARS.has(buf[i])) return { cut: i + 1, hard: false };
    }
    if (n > opts.maxHold) return { cut: n - Math.floor(opts.minEmit / 2), hard: true };
    return { cut: 0, hard: false };
  }

  const api = {
    /** 喂一段增量，返回「现在就可以输出」的文本（可能为空串） */
    push(chunk) {
      if (!chunk) return "";
      // Windows 上从文件/管道读来的文本常带 BOM：不剥掉的话第一行永远匹配不到行首规则
      if (!st.started) {
        st.started = true;
        chunk = chunk.replace(/^\uFEFF/, "");
        if (!chunk) return "";
      }
      inputChars += chunk.length;
      st.buf += chunk;
      let out = "";
      for (;;) {
        const { cut, hard } = safeCut(st.buf);
        if (cut <= 0) break;
        const piece = st.buf.slice(0, cut);
        st.buf = st.buf.slice(cut);
        st.midLine = hard;
        out += consume(piece);
      }
      return out;
    },
    /** 结束：冲刷剩余缓冲 */
    end() {
      const rest = st.buf;
      st.buf = "";
      const out = rest ? consume(rest) : "";
      // 收尾把多于一个的尾部空行压掉（删掉整段套话后常留两三个）
      const eol = out.includes("\r\n") ? "\r\n" : "\n";
      return out.replace(/(?:\r?\n){2,}$/, eol);
    },
    /** 一次处理整段文本 */
    humanize(text) {
      const one = createEngine(opts);
      const out = one.push(text) + one.end();
      Object.assign(hits, one.hits());
      return out.trim() ? out : text;
    },
    report() {
      return buildReport({ hits, rules, chars: inputChars, samples });
    },
    hits() {
      return { ...hits };
    },
    options() {
      return { ...opts };
    },
  };

  return api;
}

/** 一次性处理：返回改写后的文本与报告 */
export function humanize(text, options = {}) {
  const engine = createEngine(options);
  const out = engine.push(text) + engine.end();
  // 整段被删空（或只剩空白）说明规则在这个语境下误伤，回退原文
  const final = out.trim() ? out : text;
  return { text: final, report: engine.report() };
}

/** 只体检不改写：跑一遍规则统计命中，供 `deslop --check` 与 CI 用 */
export function inspect(text, options = {}) {
  const engine = createEngine(options);
  // 不改写也能拿命中：先跑一遍（改写结果丢弃）
  engine.push(text);
  engine.end();
  const report = engine.report();
  const rhythm = rhythmHits(text);
  if (rhythm) report.rhythmRun = rhythm;
  return report;
}

export { charCount };
