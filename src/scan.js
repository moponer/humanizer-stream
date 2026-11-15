/**
 * 保护区扫描：把「绝对不能改」的片段从文本里切出来。
 *
 * 这是整个项目的第一优先级。改错一个 URL、一个行内代码、一个路径，
 * 用户就会关掉插件再也不开。所以这里的策略是**宁可漏改，不可改错**：
 * 拿不准的片段一律进保护区。
 */

/** 一次扫完的保护区正则（顺序即优先级） */
export const PROTECT_RE = new RegExp(
  [
    // 围栏代码块（跨行，兜底用；正常路径由行级状态机处理）
    "```[\\s\\S]*?```",
    "~~~[\\s\\S]*?~~~",
    // 行内代码
    "`[^`\\n]*`",
    // URL / 邮箱
    "https?:\\/\\/[^\\s<>()\"'`）】]+",
    "\\bwww\\.[^\\s<>()\"'`）】]+",
    "\\bmailto:[^\\s<>()\"'`]+",
    // Windows 绝对路径 / Unix 绝对路径
    "\\b[A-Za-z]:\\\\[^\\s\"'`）】]+",
    "(?<![\\w.>])\\/(?:[\\w.-]+\\/)+[\\w.-]*",
    // HTML / JSX 标签
    "<[A-Za-z\\/!][^>\\n]{0,200}>",
    // 行内公式
    "\\$[^$\\n]{1,120}\\$",
    // Markdown 图片 / 链接（含目标整体）
    "!\\[[^\\]\\n]*\\]\\([^)\\n]*\\)",
    "\\[[^\\]\\n]*\\]\\([^)\\n]*\\)",
    // 引用式链接 / 脚注
    "\\[[^\\]\\n]+\\]\\[[^\\]\\n]*\\]",
    "\\[\\^[^\\]\\n]+\\]",
    // 十六进制哈希 / 版本号 / 语义化版本
    "\\b[0-9a-f]{7,40}\\b",
    "\\bv?\\d+(?:\\.\\d+){2,}(?:[-+][\\w.]+)?\\b",
    // 模板占位
    "\\{\\{[^}\\n]{1,60}\\}\\}",
    "\\$\\{[^}\\n]{1,60}\\}",
    "%[sdif]\\b",
  ].join("|"),
  "g",
);

/**
 * 把一行切成 [{p:true|false, t:"..."}]，p=true 表示保护区。
 * 相邻同类片段会合并，减少对象数量。
 */
export function splitProtected(text) {
  /** @type {{p:boolean,t:string}[]} */
  const out = [];
  let last = 0;
  PROTECT_RE.lastIndex = 0;
  let m;
  while ((m = PROTECT_RE.exec(text)) !== null) {
    if (m.index > last) push(false, text.slice(last, m.index));
    push(true, m[0]);
    last = m.index + m[0].length;
    if (m[0].length === 0) PROTECT_RE.lastIndex += 1;
  }
  if (last < text.length) push(false, text.slice(last));
  return out;

  function push(p, t) {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev && prev.p === p) prev.t += t;
    else out.push({ p, t });
  }
}

/** 行首的 Markdown 结构标记，必须原样保留：标题井号、列表符、引用符、任务框 */
const PREFIX_RE = /^(\s*(?:(?:#{1,6}\s+)|(?:[-*+]\s+)|(?:\d+[.)]\s+)|(?:>\s?)|(?:\[[ xX]\]\s+))*)/;

export function splitLinePrefix(line) {
  const m = PREFIX_RE.exec(line);
  const prefix = m ? m[1] : "";
  return { prefix, body: line.slice(prefix.length) };
}

/** 是不是表格行（| a | b |） */
export function isTableRow(line) {
  const t = line.trim();
  if (!t.startsWith("|")) return false;
  return (t.match(/\|/g) || []).length >= 2;
}

/** 是不是围栏开始/结束行，返回标记（``` 或 ~~~） */
export function fenceMarker(line) {
  const t = line.trimStart();
  if (t.startsWith("```")) return "```";
  if (t.startsWith("~~~")) return "~~~";
  return null;
}

/** YAML frontmatter 分隔线 */
export function isFrontmatterFence(line) {
  return line.trim() === "---" || line.trim() === "+++";
}

/**
 * 代码注释扫描（逐行、带字符串状态）。
 * 只认四种注释：// …、/* … *\/、# …、<!-- … -->。
 * 认不出的语言（比如 Lisp 的 ;）就整行进代码，不动。
 */
const COMMENT_MARKERS = [
  { open: "//", line: true },
  { open: "#", line: true },
  { open: "<!--", close: "-->" },
  { open: "/*", close: "*/" },
];

/**
 * @param {string} line
 * @param {{inBlock: null|{close:string}, inString: null|string, lang?:string}} state
 * @returns {{type:"code"|"comment", text:string}[]}
 */
export function scanCodeLine(line, state) {
  /** @type {{type:"code"|"comment", text:string}[]} */
  const out = [];
  let i = 0;
  let buf = "";
  const flushCode = () => {
    if (buf) out.push({ type: "code", text: buf });
    buf = "";
  };

  while (i < line.length) {
    // 1) 在块注释里
    if (state.inBlock) {
      const end = line.indexOf(state.inBlock.close, i);
      if (end === -1) {
        out.push({ type: "comment", text: line.slice(i) });
        return out;
      }
      const stop = end + state.inBlock.close.length;
      out.push({ type: "comment", text: line.slice(i, stop) });
      state.inBlock = null;
      i = stop;
      continue;
    }
    // 2) 在字符串里
    if (state.inString) {
      const q = state.inString;
      const end = line.indexOf(q, i);
      if (end === -1) {
        buf += line.slice(i);
        i = line.length;
        break;
      }
      buf += line.slice(i, end + 1);
      state.inString = null;
      i = end + 1;
      continue;
    }
    // 3) 普通代码
    const ch = line[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      state.inString = ch;
      buf += ch;
      i += 1;
      continue;
    }
    // `://` 里的 // 不是注释
    const prev = i > 0 ? line[i - 1] : "";
    if (ch === "/" && line[i + 1] === "/" && prev !== ":") {
      flushCode();
      const text = line.slice(i);
      const stop = findLineCommentEnd(text);
      out.push({ type: "comment", text: text.slice(0, stop) });
      if (stop < text.length) out.push({ type: "code", text: text.slice(stop) });
      return out;
    }
    if (ch === "/" && line[i + 1] === "*") {
      flushCode();
      const end = line.indexOf("*/", i + 2);
      if (end === -1) {
        out.push({ type: "comment", text: line.slice(i) });
        state.inBlock = { close: "*/" };
        return out;
      }
      out.push({ type: "comment", text: line.slice(i, end + 2) });
      i = end + 2;
      continue;
    }
    if (ch === "<" && line.startsWith("<!--", i)) {
      flushCode();
      const end = line.indexOf("-->", i + 4);
      if (end === -1) {
        out.push({ type: "comment", text: line.slice(i) });
        state.inBlock = { close: "-->" };
        return out;
      }
      out.push({ type: "comment", text: line.slice(i, end + 3) });
      i = end + 3;
      continue;
    }
    // 行首 # 才当注释（C 预处理器 `#include`、shebang、CSS 色值 #fff 都落到这里，靠位置与后文判断）
    if (ch === "#" && line.slice(0, i).trim() === "" && !/^#\s*[\[!]/.test(line) && !/^#(?:include|define|if|endif|pragma|import)\b/.test(line)) {
      flushCode();
      out.push({ type: "comment", text: line.slice(i) });
      return out;
    }
    buf += ch;
    i += 1;
  }
  flushCode();
  return out;
}

/** 行注释在行尾遇到 `\` 续行时不截断（C 宏 / Python 续行） */
function findLineCommentEnd(text) {
  const bs = text.lastIndexOf("\\");
  if (bs >= 0 && text.slice(bs + 1).trim() === "") return text.length;
  return text.length;
}

/** 从整段代码里拆出注释片段（一次性，非流式） */
export function splitCodeComments(text) {
  const state = { inBlock: null, inString: null };
  const lines = text.split(/(?<=\n)/);
  const segs = [];
  for (const line of lines) {
    const parts = scanCodeLine(line, state);
    for (const p of parts) segs.push(p);
    // 字符串状态不跨行（除模板串，简化处理：行尾复位）
    state.inString = null;
  }
  return segs;
}
