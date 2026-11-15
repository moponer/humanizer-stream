/**
 * 代码注释专用规则（只在 comment 作用域生效）。
 *
 * 硬约束：注释规则**永远不删行、不动注释符**，只做词句级替换。
 * 理由：注释虽然不影响执行，但删行会让 diff 面目全非，也会踩到
 *       行注释续行符、块注释收尾这类边界。保守是唯一正确解。
 *
 * 只挑「一眼 AI 写的注释」：讲义式序号、大白话公文腔、emoji、变更叙事。
 */

export const commentRules = [
  {
    id: "cm.marker",
    cat: "structural",
    scope: "comment",
    kind: "replace",
    label: "注释里的讲义式序号（首先，/ 然后，）",
    re: /^(?:首先|其次|然后|最后|第一|第二|第三|Step\s?\d+[:：])[，,、:：]\s*/i,
    to: "",
    weight: 2,
  },
  {
    id: "cm.filler.open",
    cat: "filler",
    scope: "comment",
    kind: "replace",
    label: "注释里的空转前缀（注意：/ 备注：/ Note:）",
    re: /^(?:注意|备注|说明|提示|补充|PS|Note|NOTE)[：:]\s*/,
    to: "",
    weight: 2,
  },
  {
    id: "cm.filler.polite",
    cat: "filler",
    scope: "comment",
    kind: "replace",
    label: "注释里的客套（我们需要 / 我们可以）",
    re: /^(?:我们|你)?(?:需要|可以|应该|要)(?:先)?(?:注意|确保|保证)[，,]?\s*/,
    to: "",
    weight: 1,
  },
  {
    id: "cm.nominalize",
    cat: "voice",
    scope: "comment",
    kind: "replace",
    label: "注释里的公文腔（对 X 进行处理 → 处理 X）",
    re: /(?:对|针对)([^，。；：\n]{1,16}?)(?:进行|加以|作出|做出)(了)?(处理|分析|优化|调整|检查|验证|评估|测试|改进|统计|汇总|整理|核对|说明|排查|比对|修复|补全)/g,
    to: (m, obj, le, verb) => `${verb}${le ?? ""}${obj}`,
    weight: 2,
  },
  {
    id: "cm.official.verb",
    cat: "voice",
    scope: "comment",
    kind: "replace",
    label: "注释里的空转动词（进行优化 → 优化）",
    re: /(?:进行|予以|加以|给予)(优化|调整|升级|修复|更新|清理|确认|支持|补全|重写|改造|验证|测试|检查|处理|分析)/g,
    to: "$1",
    weight: 2,
  },
  {
    id: "cm.dash.single",
    cat: "punct",
    scope: "comment",
    kind: "replace",
    label: "注释里的单字宽破折号",
    re: /([\u4e00-\u9fa5])—([\u4e00-\u9fa5])/g,
    to: "$1——$2",
    weight: 1,
  },
  {
    id: "cm.space.excess",
    cat: "format",
    scope: "comment",
    kind: "replace",
    label: "注释行尾空白",
    re: /[ \t]+$/,
    to: "",
    weight: 1,
  },
  {
    id: "cm.flag.changelog",
    cat: "structural",
    scope: "comment",
    kind: "flag",
    label: "以变更为锚的注释（原本…现在改为…）",
    re: /(?:原本|以前|之前|旧版?)[^，。；\n]{0,20}(?:现在|改为|改成|换成|替换为)|(?:新增|添加)(?:了)?[^，。；\n]{0,16}(?:以)?(?:替代|代替|替换)/,
    to: "",
    weight: 2,
  },
  {
    id: "cm.flag.restate",
    cat: "structural",
    scope: "comment",
    kind: "flag",
    label: "复述代码的注释（i++ // 自增）",
    re: /^(?:设置|获取|定义|创建|初始化|返回|调用|判断|遍历)[^，。；\n]{0,12}(?:为|成)?\s*$/,
    to: "",
    weight: 1,
  },
  {
    id: "cm.flag.todo",
    cat: "residue",
    scope: "comment",
    kind: "flag",
    label: "含糊 TODO（TODO: 待补充）",
    re: /^(?:TODO|FIXME)[:：]?\s*(?:待补充|待完善|补充|完善|后续优化|待优化)\s*$/i,
    to: "",
    weight: 2,
  },
];
