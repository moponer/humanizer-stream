/**
 * humanizer-stream —— 输出侧去 AI 味过滤器
 *
 * 一句话：模型说什么它不管，模型**怎么说**在出口这里被收拾一遍。
 * 因此它不需要改提示词、不额外调用模型、不影响 token 与前缀缓存命中率。
 */

export { createEngine, humanize, inspect, DEFAULTS } from "./engine.js";
export { allRules, PROFILES, selectRules, listRules } from "./rules/index.js";
export { buildReport, grade } from "./score.js";
export { loadConfig, resolveOptions, profileForFile, CONFIG_FILES } from "./config.js";
export { splitProtected, splitCodeComments, scanCodeLine } from "./scan.js";

import { createEngine } from "./engine.js";
import { loadConfig, resolveOptions } from "./config.js";

/**
 * 宿主接入用的工厂：给一个可复用的 transform 函数。
 *
 * ```js
 * const h = createTextFilter({ profile: "chat" });
 * const clean = h.text(rawModelOutput);          // 一次性
 * const s = h.stream(); s.push(delta); s.end();   // 流式
 * ```
 */
export function createTextFilter(options = {}) {
  const opts = resolveOptions(options);
  return {
    options: opts,
    /** 一次性过滤 */
    text(input, extra = {}) {
      const engine = createEngine({ ...opts, ...extra });
      const out = engine.push(input) + engine.end();
      return out.trim() || !input.trim() ? out : input;
    },
    /** 开一条流式管线；每个流必须 end() */
    stream(extra = {}) {
      return createEngine({ ...opts, ...extra });
    },
  };
}

/** 给 harness 的默认导出：读本地配置后建过滤器 */
export function createTextFilterFromConfig(cwd) {
  return createTextFilter(loadConfig(cwd));
}

export default { createTextFilter, createTextFilterFromConfig };
