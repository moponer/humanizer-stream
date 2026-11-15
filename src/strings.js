/**
 * 从源码里抠出「给用户看的字」。
 *
 * 为什么要这一步：界面文案散在 TS/TSX 的字符串字面量与 JSX 文本里，
 * 直接对整个文件跑检测会被标识符、import 路径、类型注解淹没。
 * 所以先只留含中文（或英文单词成句）的字符串，再送去 check。
 *
 * 不追求完备：漏掉几句比把代码当文案报一堆假阳性好。
 */

const CODE_HINTS = /=>|function\s*\(|import\s|require\(|className=|console\.|process\.env|\/\/|\bpx\b|:\s*[A-Z][A-Za-z]+\[|\$\{|[;{}`]|\?:|\breturn\b|\bconst\b/;

function unescape(s) {
  return s.replace(/\\(n|t|r|"|'|`|\\)/g, (m, c) => ({ n: "\n", t: "\t", r: "\r", '"': '"', "'": "'", "`": "`", "\\": "\\" })[c] ?? m);
}

function lineAt(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i += 1) if (src.charCodeAt(i) === 10) line += 1;
  return line;
}

function looksLikeCopy(text) {
  const s = text.trim();
  if (s.length < 4) return false;
  if (CODE_HINTS.test(s)) return false;
  if (/^[\w./\\-]+$/.test(s)) return false;
  const cjk = (s.match(/[\u4e00-\u9fff]/g) ?? []).length;
  if (cjk >= 2) return true;
  // 纯英文文案：至少两个词、带空格，且不像标识符
  return /^[A-Z][^.]{6,}$/.test(s) && /\s/.test(s) && !/[{}();=<>]/.test(s);
}

/**
 * @param {string} source 文件内容
 * @param {{file?: string, minChars?: number}} opts
 * @returns {{text: string, line: number, file: string}[]} 去重后的文案（同文取首次出现）
 */
export function extractStrings(source, { file = "", minChars = 4 } = {}) {
  const src = String(source ?? "");
  const out = [];
  const seen = new Set();

  const push = (text, index) => {
    const clean = unescape(text).replace(/\s+/g, " ").trim();
    if (clean.length < minChars) return;
    if (!looksLikeCopy(clean)) return;
    if (seen.has(clean)) return;
    seen.add(clean);
    out.push({ text: clean, line: lineAt(src, index), file });
  };

  // 字符串字面量："…" / '…' / `…`
  const lit = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g;
  for (const m of src.matchAll(lit)) push(m[2], m.index ?? 0);

  // JSX 文本节点：>这是一句文案<（只在 tsx/jsx 里成立；
  // 在 .ts 里这个形状大多来自泛型尖括号，会把代码当文案）
  if (/\.[jt]sx$/i.test(file)) {
    const jsx = />([^<>{}]+)</g;
    for (const m of src.matchAll(jsx)) push(m[1], m.index ?? 0);
  }

  return out;
}
