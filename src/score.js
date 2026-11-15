/**
 * 报告与体检分。
 *
 * 说明：这个分数**不是**「AI 检测器通过率」，任何拿它当反检测指标的宣传都是假的。
 * 它只是内部质量信号：同样字数的文本里，命中了多少条明确的 AI 写作特征、有多重。
 * 用来做 CI 门禁（比如「新写的 README 不许比上一个版本更 AI」）是它唯一正确的用法。
 */

export function buildReport({ hits, rules, chars, samples }) {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const detail = [];
  let totalHits = 0;
  let weighted = 0;

  for (const [id, count] of Object.entries(hits)) {
    const rule = byId.get(id);
    totalHits += count;
    weighted += count * (rule?.weight ?? 1);
    detail.push({
      id,
      cat: rule?.cat ?? "unknown",
      kind: rule?.kind ?? "replace",
      label: rule?.label ?? id,
      count,
    });
  }
  detail.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

  const kchars = Math.max(1, chars / 1000);
  const score = clamp(Math.round((weighted / kchars) * 8), 0, 100);

  return {
    chars,
    totalHits,
    weighted,
    score,
    byRule: detail,
    samples: samples ?? [],
  };
}

export function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}

/** 人话版评级，给 CLI 与界面用 */
export function grade(score) {
  if (score <= 5) return "很干净";
  if (score <= 15) return "轻微";
  if (score <= 35) return "明显";
  if (score <= 60) return "很重";
  return "重到不自然";
}
