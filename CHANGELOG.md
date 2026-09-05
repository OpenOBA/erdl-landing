# Changelog

本项目的所有重要变更记录于此。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

本仓库包含**两条正交的版本线**（详见 `erdl-spec.md` 头部「版本语义」）：
- **规范文档版本**（本文件追踪）：`v2.0` → `v2.1` …
- **规则格式版本**（`*.erdl.yaml` 顶层 `version:` 字段）：`2.0.0` → `2.1.0` …
- **协议标识** `protocol: "erdl/v2"` 为冻结值，不随规范升级而变。

## [2.1.0-alpha.4] - 2026-09-05

### Fixed
- **空条件规则（catch-all/兜底）不得改写显式条件规则的决议（§7.1 第 6 条新增）**：`evaluator.ts` 的 ALLOW 分支此前缺 catch-all 守护——`when` 为空（无条件命中）的 ALLOW 携带 `override: critical/high` 时，会跨 ring 覆盖显式条件 DENY 的拦截，令兜底放行吞噬显式拦截（“覆盖到更不安全状态”，违反 §7.1 第 5 条）。现与 DENY 分支对称：catch-all ALLOW 在已有显式决议时被 pop，仅在无显式命中时作兜底生效。同频补 §7.1 第 6 条（中英双语）与修订历史。

## [2.1.0-alpha.3] - 2026-09-05

### Fixed
- **`not_*` Simple 运算符在 Expression 投影的处理（§5.2 exists 守卫 / E7）**：`fromSExpr` 此前把 `not_in`/`not_contains`/`not_starts_with`/`not_ends_with`/`not_exists`/`not_between` 宽松解析为裸 `not(...)`，丢失 simple-compiler 添加的 exists 守卫——字段缺失时翻转空值传播为 true（fail-open 安全洞），且同一运算符产出两棵不同的规范树。现**删除 `not_in`/`not_contains`/`not_starts_with`/`not_ends_with`/`not_between` 的宽松分支**（`{not_in:[...]}` 报 `unknown node key`，强制 Expression 投影写 `{not:{in:[...]}}` + 显式 exists）；**保留 `not_exists` 为 §5.2 例外别名**（裸 `not(exists)`，字段缺失→true，与规范树一致）；与 erdl-formal（从不接 `not_*`）及 V-ENGINE `not_in` 向量（exists 守卫）对齐。
- **时间节点严格 ISO 8601 解析（§7.3(f) 无时区后缀按 UTC）**：`epochMs`/`daysBetween`/`toDate` 此前用 `new Date(String(...))`，把无时区后缀的 datetime 按**本地时区**解析，非 UTC 主机上跨实现逐字节不一致。新增 `parseIsoDateStrict`（date-only → UTC 零点；datetime 无时区 → 补 `Z` 按 UTC；带 `Z`/`±HH:MM` → 透传；非 ISO 与非法日历日期（`2026-02-30`、`hour>23` 等）→ 拒绝 invalid_date），三处统一走它，与 erdl-formal 严格 UTC 编码对齐。
- **时间节点拒绝小数秒（§7.3(f) 整秒精度）**：`parseIsoDateStrict` 移除 `(\.\d{1,9})?` 小数秒分组，`YYYY-MM-DDTHH:MM:SS.SSS` 等小数秒输入返回 `invalid_date`，与 erdl-formal 整秒 SMT 编码对齐，消除 JS `Date` 小数秒截断/舍入的跨实现歧义。

### Changed
- `node-types.ts` 头注释冻结语义由「may only be pruned, never extended」改为「additive-only（可增、语义不改，不删不重定义）」，对齐 `[FREEZE-2]` 与 `erdl-schema.ts`/`REGISTRY.md`；`s-expression.ts` 头注释 key 列表补齐 `date_add`/`date_part`/`month_last_day`。

## [2.1.0-alpha.2] - 2026-09-04

### Fixed
- **`match` 安全正则子集补全（§7.3(d)③）**：`analyzePattern` 此前只拒「嵌套量词 + 相邻量化原子」，未拒**反向引用（`\1`–`\9`、`\k<name>`）与环视（`(?=)`/`(?!)` 前瞻、`(?<=)`/`(?<!)` 后顾）**——这类非正则构造依赖回溯顺序、无法逐字节确定、SMT 验证器（erdl-formal）无法表达。现新增字符级扫描（跳过转义与字符类，不误读 `\\1`、`[\]]`），显式拒绝反向引用与环视；原子组/占有量词/条件组/内联 `(?i)` 本就被 JS RegExp 解析器拒绝（SyntaxError），由 safeRegExp 的 try-catch 覆盖。
- 修正 `evaluator.ts` match 注释中误导性的「(?i)」表述（JS RegExp 不支持内联 (?i)，匹配始终大小写敏感）。

### Changed
- §7.3(d)（中英双语）明确安全语法子集 = 正则语言：禁止反向引用与环视；内联大小写标志不提供。

## [2.1.0] - 2026-09-03

### Added
- **`correction` 规则字段**（§4.1）：CORRECT 决策的纠偏文本，是求值输出 `primary_correction`（§7.0.3）的输入来源。补齐了规范此前「输出契约要求 primary_correction、输入字段表却无 correction」的自相矛盾。
- **`category` 规则字段**（§4.1，规则级）：缺省继承 `metadata.category`，允许同一文档内混合分类。
- **`enabled` 规则字段**（§4.1）：规则启用标志，默认 `true`；`false` 时求值跳过该规则。
- 参考实现 `erdl-loader` 映射 `correction` → `action.correction`；`rule-yaml-serializer` 补 emit `correction`/`category`/`enabled`（修复 round-trip 丢失）。
- 规范文档末尾新增「修订历史」章节。

### Fixed
- §4.1 字段表与固定字段顺序补齐上述三个字段（此前 `correction` 在实现/预设中已被使用，但规范从未定义——实现先于规范，现回写对齐）。
- `rule-yaml-serializer` 的 F3 字段顺序注释过时（只写到 `unless`，实际还 emit `explanation`/`alternative`/`legal_basis`/`source_text`），已对齐规范全序。

### Changed
- 规则格式版本 `2.0.0` → `2.1.0`（新增可选字段，Non-breaking；存量 2.0.0 规则仍有效）。
- 规范文档版本 `v2.0` → `v2.1`。
- README 双语拆分：`README.md` 重写为开发者优先叙事（英文）后按本仓命名约定双语化——中文版升为 `README.md`（主），英文版移至 `README.en.md`，互设语言切换链接；与 `erdl-spec.md`/`.en.md` 及姊妹仓（erdl-formal、erdl-vectors）的 `.md`/`.en.md` 约定一致。

## [2.0.0] - 2026-08-30

### Added
- ERDL 语言规范 v2.0 定稿（`erdl-spec.md` 中文 + `erdl-spec.en.md` 英文）。
- 表达式树语义内核（34 节点 / 10 组）、Simple 30 运算符、13 种决策类型。
- 参考实现：`erdl-loader`（文档加载）、`evaluator`（求值引擎）、`rule-yaml-serializer`（序列化）。
