/**
 * lynn 宿主适配器（写作规则插件）。
 *
 * 宿主契约（api = 2）：
 *   export const api = 2
 *   export function writingRules({ profile, locale, maxChars }) -> string
 *   export function check(text, opts) -> 体检结果（可选，仅界面诊断用）
 *
 * 宿主拿 writingRules() 的结果拼进**系统提示词一次**。注意三件事：
 *  1. 同一入参必须返回同一字符串——拼进系统提示词的东西一旦抖动，前缀缓存全废；
 *  2. 这是「约束模型怎么写」，不是「事后改模型的话」；宿主的落盘与上下文都别再改写；
 *  3. 插件缺失或抛错时宿主当作没装，静默回落到无规则。
 *
 * 安装：把本目录的 index.js 与仓库的 src/ 一起复制到 ~/.lynn/plugins/humanizer-stream/
 * （`deslop install-lynn` 就是干这个的）。
 */

import { writingRules, writingRulesCost, profileForFile, check, api, name } from "./src/index.js";

export { api, name, writingRules, writingRulesCost, profileForFile, check };

export const version = "0.2.0";

export default { api, name, version, writingRules, writingRulesCost, profileForFile, check };
