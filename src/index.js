/**
 * humanizer-stream · 模型写作输出规则
 *
 * 用法只有一条：把 `writingRules()` 的结果拼进系统提示词一次。
 * 模型按规则写，规则就不用在生成之后再来改稿。
 *
 * 这里不再提供「输出过滤器」——0.1 那版在展示层改写模型原文，
 * 判不准的地方只能猜，改出来的句子既不像人写的也不像模型写的。
 * 详见 docs/DESIGN.md。
 */
import { composeRules, composeCost, listRules } from "./compose.js";

export const api = 2;
export const name = "humanizer-stream";

export { composeRules, composeCost, listRules } from "./compose.js";
export { check, summarise } from "./check.js";
export { extractStrings } from "./strings.js";
export { allRules, selectRules, ruleById, rulesForLocale, PROFILES, CATEGORIES, CATEGORY_LABELS } from "./rules/index.js";

/**
 * 宿主入口：返回该注入的系统提示词片段。
 *
 * 同参同输出（逐字节），宿主可以放心缓存这段文本，不会因为规则抖动打穿前缀缓存。
 * 插件缺失时宿主拿到空串，就当没开这个功能。
 */
export function writingRules(opts = {}) {
  return composeRules(opts);
}

/** 这段提示词会占多少字（宿主用来提示用户成本，不做自动决定） */
export function writingRulesCost(opts = {}) {
  return composeCost(opts);
}

/**
 * 按文件类型挑场景：写文档用 prose，写代码用 code，写界面文案用 ui。
 * 给「成员写盘前注入」这类场景用；认不出就返回 chat。
 */
export function profileForFile(file) {
  const ext = String(file ?? "").toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  if ([".md", ".markdown", ".txt", ".rst"].includes(ext)) return "prose";
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".rs", ".go", ".py", ".java", ".css", ".scss"].includes(ext)) return "code";
  if ([".json", ".yaml", ".yml"].includes(ext)) return "ui";
  return "chat";
}
