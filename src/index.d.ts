/** humanizer-stream 的类型声明（实现是零编译的纯 ESM，声明手写维护） */

export type Profile = "prose" | "chat" | "mild" | "code" | "all";
export type Lang = "zh" | "en" | "auto";
export type Mode = "text" | "code";

export interface Options {
  profile?: Profile | string[];
  lang?: Lang;
  mode?: Mode;
  emoji?: "strip" | "keep";
  comments?: boolean;
  tables?: boolean;
  disabled?: string[];
  unsafe?: boolean;
  minEmit?: number;
  maxHold?: number;
  tidy?: boolean;
}

export interface RuleHit {
  id: string;
  cat: string;
  kind: "delete" | "replace" | "flag";
  label: string;
  count: number;
}

export interface Report {
  chars: number;
  totalHits: number;
  weighted: number;
  score: number;
  byRule: RuleHit[];
  samples: { kind: string; from: string; to: string }[];
  rhythmRun?: number;
}

export interface Engine {
  /** 喂增量，返回当前可安全输出的文本（可能为空串） */
  push(chunk: string): string;
  /** 结束，冲刷尾部缓冲 */
  end(): string;
  /** 一次性处理（内部新建引擎） */
  humanize(text: string): string;
  report(): Report;
  hits(): Record<string, number>;
  options(): Required<Options>;
}

export function createEngine(options?: Options): Engine;
export function humanize(text: string, options?: Options): { text: string; report: Report };
export function inspect(text: string, options?: Options): Report;

export interface TextFilter {
  options: Required<Options>;
  /** 一次性过滤；空文本原样返回 */
  text(input: string, extra?: Options): string;
  /** 开一条流式管线（每个流必须 end()） */
  stream(extra?: Options): Engine;
}

export function createTextFilter(options?: Options): TextFilter;
export function createTextFilterFromConfig(cwd?: string): TextFilter;

export const DEFAULTS: Required<Options>;
export const PROFILES: Record<string, string[] | null>;
export const allRules: RuleDef[];
export function selectRules(options?: Options): RuleDef[];
export function listRules(): Omit<RuleDef, "re" | "to">[];

export interface RuleDef {
  id: string;
  cat: string;
  kind: "delete" | "replace" | "flag";
  label: string;
  re: RegExp;
  to: string | ((...args: string[]) => string);
  weight: number;
  scope?: "prose" | "comment";
  safe?: boolean;
}

export function buildReport(args: {
  hits: Record<string, number>;
  rules: RuleDef[];
  chars: number;
  samples?: Report["samples"];
}): Report;

export function grade(score: number): string;
export function loadConfig(cwd?: string): Options & { __file?: string };
export function resolveOptions(...layers: (Options | undefined)[]): Required<Options>;
export function profileForFile(file: string): { profile: Profile; mode: Mode };
export function splitProtected(text: string): { p: boolean; t: string }[];
export function splitCodeComments(text: string): { type: "code" | "comment"; text: string }[];

export default {
  createTextFilter,
  createTextFilterFromConfig,
};
