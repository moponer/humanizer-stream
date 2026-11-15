/**
 * lynn 宿主适配器（文本过滤器插件）。
 *
 * 宿主契约（PLUGIN-CONTRACT.md §3）：
 *   export const api = 1
 *   export function createFilter(options) -> { text(s), stream() }
 *
 * lynn 侧只做一件事：把模型给的文本在**展示前**过一遍本过滤器。
 * 它不参与提示词、不参与上下文、不参与 token 记账——所以开关这个插件
 * 不会改变上下文长度，也不会打穿前缀缓存。
 *
 * 安装：`deslop install-lynn` 会把 src/ 一起复制到 ~/.lynn/plugins/humanizer-stream/
 * 这样插件目录是自包含的，不依赖你 clone 在哪。
 */

import { createTextFilter } from "../../src/index.js";

export const api = 1;
export const name = "humanizer-stream";
export const version = "0.1.1";

/** 宿主默认档位：对话输出用 chat（只删套话，不动承载语义的从句） */
export const DEFAULT_OPTIONS = { profile: "chat", lang: "auto", emoji: "strip" };

/**
 * @param {object} [options] 宿主可以传 { profile, disabled, emoji }
 */
export function createFilter(options = {}) {
  return createTextFilter({ ...DEFAULT_OPTIONS, ...options });
}

export default { api, name, version, createFilter };
