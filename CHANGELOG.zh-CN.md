# Changelog

本项目的所有重要变更记录于此。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

本仓库包含**三条版本线**（详见 `erdl-language-spec-v2.3.md` 头部「版本语义」）：
- **规范文档版本**：`v2.0` → `v2.3` …（文档自身修订号，独立）
- **规则格式版本**（`*.erdl.yaml` 顶层 `version:` 字段）：`2.0.0` → `2.2.0` …
- **npm 包版本**（本文件追踪，即 CHANGELOG 小节标题）：跟随规则格式版本——`2.0.0` → `2.1.0` → `2.2.0-beta.1`。
- **协议标识** `protocol: "erdl/v2"` 为冻结值，不随规范升级而变。

## [Unreleased]

### Added
- **§7.1a 决策合并（fold）**——新增小节定义决策强度偏序（EMERGENCY_HALT/WORKFLOW=0 → DENY/ROLLBACK/QUARANTINE=1 → REQUEST_HUMAN=2 → ESCALATE=3 → DELEGATE=4 → DEFER=5 → CORRECT=6 → GUIDE=7 → ALLOW=8）与 fold 算法；NOTIFY 是附带动作，不参与主决策。（评审 A1）
- **§8.2a.1a 规则集哈希**——`rule_set_hash` = sha256(JCS({ fallback_decision, rules: [规则规范对象] }))，每条规则规范对象为 { name, when_tree, unless_tree, then, priority, override, ring, enabled }；加入 DO 字段序（canonical_trees 之后）与求值结果；弥补 canonical_trees 只覆盖命中规则 when 树的缺口，使第三方可验证「没有别的规则本该命中」。（评审 A2）
- **§8.2a.1b 求值选项（eval_profile）**——`eval_profile` = { strict, context, contract_hash, spec_version, engine_id } 加入 DO 字段序；严格模式、Guard/analysis 上下文、字段契约哈希、规范版本与引擎标识进原像，使第三方可复算。（评审 A3）
- **§8.2.1 规范化树编码**——钉死每个节点的 S-expression JSON 形态（字面量/field/var/and/or/not/比较/in/字符串/exists/length/between/量词/算术/时间/聚合/fn）；交换律节点（and/or/add/mul）保持定义顺序（不排序）；优先条款：正文优先于向量。（评审 A4）
- **§7.3(c) 数值口径加固 + §8.2 十进制字符串编码**——加载期拒绝超范围字面量（小数位数 ≤ 14、有效位数 ≤ 34）；溢出/除零为 EvaluationError（E12 fail-closed）；比较作用于精确有理数；round(x[, digits]) 统一 half-even；canonical 数字字面量序列化为**十进制字符串**（非 JCS IEEE754）以避免 2^53 之外的失真/碰撞。（评审 A5）
- **§7.3(a) Kleene 三值逻辑**——true/false/unknown；`not(unknown)=unknown`（堵住「缺失→false→not true→fail-open」漏洞）；`and` 任一 false→false、`or` 任一 true→true、否则 unknown；规则仅在 `when === true` 时命中；顶层 unknown 不命中（Guard 可配置 `metadata.on_indeterminate`）。（评审 A6）
- **§7.0.2/E1 求值副作用与短路澄清**——逻辑节点（`and`/`or`/`量词`）全量求值（不短路）；`WORKFLOW` MUST NOT 屏蔽其后的拦截（仅在无 DENY/ROLLBACK/QUARANTINE/EMERGENCY_HALT 命中时启动）；`within`/`rate` 计数为两阶段（求值只读预状态，Guard 在决策提交后原子提交 `record`，与 §6a.8 一致）。（评审 A7）
- **§5.2.5 计数主体作用域**——`within`/`rate` 增加显式 `scope`（按哪个字段分组，如 `user.id`/`tool.name`），使不同主体不再共享单个全局计数器；计数隔离键包含 `scope`。（评审 A8）
- **§6a.5.5 实例标识 + create/restore 两入口**——genesis 携带 `instance_id`（同一文档的不同实例得到不同 genesis 哈希，防链跨实例移植）；两种加载入口：create（写 genesis）与 restore（校验最新权威头，fail-closed——绝不把状态重置为 `initial`）。（评审 B1）
- **§8.2a.1 fact 的 Merkle 承诺（可选 profile）**——`fact` 可能含个人信息/密钥；可选地对其做 Merkle 承诺（带盐哈希叶子，DO 只存根 `fact_hash`，按需披露字段加证明）；脱敏必须先于求值（求值所用的值与记录的值一致）。（评审 A9）
- **§6a.2.1 事件处理回执**——`injectEvent` 返回显式回执 `committed | noop | rejected`（非布尔）；撤销类 `noop` MUST 写链外告警（或链上摘要），避免运维误以为已撤销。（评审 B2）
- **§6a.7 到期/额度承载**——到期/额度等标量约束 MUST 由授权根签发的凭据字段承载（写入链），而非调用方 payload 的 `event.expires`（调用方可省略/延长）；「每次 `evaluate` 前注入 `exercise` 事件」是明确的边界义务。（评审 B3）
- **§6a.5.5 rule_set_hash 绑定**——`doc_tree_hash` 不含 rules，故 `rule_set_hash`（§8.2a.1a）与 `doc_tree_hash` 共同锚定「状态机 + 规则」（验证要求二者一致）；`metadata.name` 不是安全边界。（评审 B4）
- **§6a.2.2 错误归因 vs 顺序无关澄清**——set 结果与顺序无关，但错误归因按定义顺序，故定义顺序属哈希语义（消除 §6a.2.1 与 §6a.2.2 的内部矛盾）。（评审 B5）
- **§6a.5.4 事件认证证据**——已认证事件 MUST 携带可验证证据（签名或证明摘要，如 JWS `kid` + 摘要）写入转移记录，使「由谁批准」可独立验证（堵住可伪造字符串 `actor` 的缺口）。（评审 B6）
- **§5.4 决策表是 `rules[]` 语法糖**——决策表逐行展开为规则（每行一条规则，字段按行归属）；示例 priority 方向与 §4.1 统一（数字越小越优先），默认行 MUST 排最后且 priority 最大。（评审 C1）
- **§5.5 gloss 矛盾修正**——删除 `exists` 对 `is_*`/`has_*` 的「is true」特例（统一渲染「is present」，因 false 也算存在）；G3 现在无字段契约时回退原始字段路径（使 `gloss == render(tree)` lint 校验可复现）。（评审 C2）
- **§1.1/§3 Entity 命名空间措辞 + 字段路径文法**——Entity 改为预置命名空间约定（非顶层声明，消除 §1.1 矛盾）；补字段路径文法（点分隔 snake_case 段、`# Changelog

本项目的所有重要变更记录于此。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

本仓库包含**三条版本线**（详见 `erdl-language-spec-v2.3.md` 头部「版本语义」）：
- **规范文档版本**：`v2.0` → `v2.3` …（文档自身修订号，独立）
- **规则格式版本**（`*.erdl.yaml` 顶层 `version:` 字段）：`2.0.0` → `2.2.0` …
- **npm 包版本**（本文件追踪，即 CHANGELOG 小节标题）：跟随规则格式版本——`2.0.0` → `2.1.0` → `2.2.0-beta.1`。
- **协议标识** `protocol: "erdl/v2"` 为冻结值，不随规范升级而变。

## [Unreleased]

### Added
- **§7.1a 决策合并（fold）**——新增小节定义决策强度偏序（EMERGENCY_HALT/WORKFLOW=0 → DENY/ROLLBACK/QUARANTINE=1 → REQUEST_HUMAN=2 → ESCALATE=3 → DELEGATE=4 → DEFER=5 → CORRECT=6 → GUIDE=7 → ALLOW=8）与 fold 算法；NOTIFY 是附带动作，不参与主决策。（评审 A1）
- **§8.2a.1a 规则集哈希**——`rule_set_hash` = sha256(JCS({ fallback_decision, rules: [规则规范对象] }))，每条规则规范对象为 { name, when_tree, unless_tree, then, priority, override, ring, enabled }；加入 DO 字段序（canonical_trees 之后）与求值结果；弥补 canonical_trees 只覆盖命中规则 when 树的缺口，使第三方可验证「没有别的规则本该命中」。（评审 A2）
- **§8.2a.1b 求值选项（eval_profile）**——`eval_profile` = { strict, context, contract_hash, spec_version, engine_id } 加入 DO 字段序；严格模式、Guard/analysis 上下文、字段契约哈希、规范版本与引擎标识进原像，使第三方可复算。（评审 A3）
- **§8.2.1 规范化树编码**——钉死每个节点的 S-expression JSON 形态（字面量/field/var/and/or/not/比较/in/字符串/exists/length/between/量词/算术/时间/聚合/fn）；交换律节点（and/or/add/mul）保持定义顺序（不排序）；优先条款：正文优先于向量。（评审 A4）
- **§7.3(c) 数值口径加固 + §8.2 十进制字符串编码**——加载期拒绝超范围字面量（小数位数 ≤ 14、有效位数 ≤ 34）；溢出/除零为 EvaluationError（E12 fail-closed）；比较作用于精确有理数；round(x[, digits]) 统一 half-even；canonical 数字字面量序列化为**十进制字符串**（非 JCS IEEE754）以避免 2^53 之外的失真/碰撞。（评审 A5）
- **§7.3(a) Kleene 三值逻辑**——true/false/unknown；`not(unknown)=unknown`（堵住「缺失→false→not true→fail-open」漏洞）；`and` 任一 false→false、`or` 任一 true→true、否则 unknown；规则仅在 `when === true` 时命中；顶层 unknown 不命中（Guard 可配置 `metadata.on_indeterminate`）。（评审 A6）
- **§7.0.2/E1 求值副作用与短路澄清**——逻辑节点（`and`/`or`/`量词`）全量求值（不短路）；`WORKFLOW` MUST NOT 屏蔽其后的拦截（仅在无 DENY/ROLLBACK/QUARANTINE/EMERGENCY_HALT 命中时启动）；`within`/`rate` 计数为两阶段（求值只读预状态，Guard 在决策提交后原子提交 `record`，与 §6a.8 一致）。（评审 A7）
- **§5.2.5 计数主体作用域**——`within`/`rate` 增加显式 `scope`（按哪个字段分组，如 `user.id`/`tool.name`），使不同主体不再共享单个全局计数器；计数隔离键包含 `scope`。（评审 A8）
- **§6a.5.5 实例标识 + create/restore 两入口**——genesis 携带 `instance_id`（同一文档的不同实例得到不同 genesis 哈希，防链跨实例移植）；两种加载入口：create（写 genesis）与 restore（校验最新权威头，fail-closed——绝不把状态重置为 `initial`）。（评审 B1）
- **§8.2a.1 fact 的 Merkle 承诺（可选 profile）**——`fact` 可能含个人信息/密钥；可选地对其做 Merkle 承诺（带盐哈希叶子，DO 只存根 `fact_hash`，按需披露字段加证明）；脱敏必须先于求值（求值所用的值与记录的值一致）。（评审 A9）
- **§6a.2.1 事件处理回执**——`injectEvent` 返回显式回执 `committed | noop | rejected`（非布尔）；撤销类 `noop` MUST 写链外告警（或链上摘要），避免运维误以为已撤销。（评审 B2）
- **§6a.7 到期/额度承载**——到期/额度等标量约束 MUST 由授权根签发的凭据字段承载（写入链），而非调用方 payload 的 `event.expires`（调用方可省略/延长）；「每次 `evaluate` 前注入 `exercise` 事件」是明确的边界义务。（评审 B3）
- **§6a.5.5 rule_set_hash 绑定**——`doc_tree_hash` 不含 rules，故 `rule_set_hash`（§8.2a.1a）与 `doc_tree_hash` 共同锚定「状态机 + 规则」（验证要求二者一致）；`metadata.name` 不是安全边界。（评审 B4）
- **§6a.2.2 错误归因 vs 顺序无关澄清**——set 结果与顺序无关，但错误归因按定义顺序，故定义顺序属哈希语义（消除 §6a.2.1 与 §6a.2.2 的内部矛盾）。（评审 B5）
- **§6a.5.4 事件认证证据**——已认证事件 MUST 携带可验证证据（签名或证明摘要，如 JWS `kid` + 摘要）写入转移记录，使「由谁批准」可独立验证（堵住可伪造字符串 `actor` 的缺口）。（评审 B6）
- **§5.4 决策表是 `rules[]` 语法糖**——决策表逐行展开为规则（每行一条规则，字段按行归属）；示例 priority 方向与 §4.1 统一（数字越小越优先），默认行 MUST 排最后且 priority 最大。（评审 C1）
- **§5.5 gloss 矛盾修正**——删除 `exists` 对 `is_*`/`has_*` 的「is true」特例（统一渲染「is present」，因 false 也算存在）；G3 现在无字段契约时回退原始字段路径（使 `gloss == render(tree)` lint 校验可复现）。 根、`$.path`、受控 `state.*`/`event.*`）。（评审 C3）

### Changed
- **求值器决策合并重构为 fold**——`DECISION_STRENGTH` + `foldDecision()` 取代 ad-hoc 的首命中/累积分支；收紧自由、放松需 override、同向取更强；NOTIFY 记入 `matched_rules` 但不改变决策。（评审 A1）
- **求值结果新增 `ruleSetHash`**——`computeRuleSetHash()` 哈希规则语义全集（fallback 决策 + 每条规则的规范对象）。（评审 A2）
- **求值结果新增 `evalProfile`**——`computeContractHash()` 哈希字段契约；新增 `SPEC_VERSION`（`v2.3`）+ `ENGINE_ID`（`erdl-engine`）常量。（评审 A3）

## [2.2.0-beta.1] - 2026-10-04

### Added
- **状态块与状态转移（§6a，新章）**——`state`/`transitions` 两个可选顶层字段：受控状态源；资源上限（≤4 变量 / 2–4 枚举 / ≤256 组合 / ≤32 转移规则 / ≤16 事件名 / ≤8 键 payload）；状态转移审计闭环（转移链 + 快照 + 合法性 + 出处锚定，`state_snapshot` 扩展为 `{values, state_version, transitions_head}`）；同变量冲突可判定互斥检查；事件注入认证；genesis 记录；并发串行化；加载时校验全集。
- **§6a 引擎实现（加载 + 运行时）**——`state-definition.ts`（加载时校验：state/transitions 结构、同变量冲突、state/event 引用检查、转移守卫白名单）+ `state-machine.ts`（事件驱动 FSM：eager FIFO、event_id 去重、守卫原子求值、genesis/transition/transition_error 审计链、按需 `state_snapshot`）；`Evaluator` 新增 `stateMachine` 选项 + `state.*` 受控读取 + `EvaluationResult.stateSnapshot`。
- **§6a.8 执行边界 check/act 原子性**——边界在提交安全敏感副作用前重校验 `{state_version, transitions_head}` 或封闭同步边界。
- **§6a.9 最新权威头新鲜度（反回滚）**——重放验证证明完整性/来源，而非新鲜度；边界 MUST 确立最新权威头（未被取代）或 fail closed。
- **§6 决策类型设计说明**——13 种决策类型旨在 AI 时代发挥 LLM 价值，而非简单放行/拒绝。
- **§6a.10 授权建立/重建的根源绑定**——授权「可行使化」转移 MUST 有授权根源（actor 归因于有权建立该授权的 principal）；撤销后 re-authorization MUST 有新的有效授权基础；后代 MUST NOT 自恢复被撤销授权。
- **§6b 委托权威安全模型（组织行为层）**——总纲「委派不得制造权威」；五条不变量 INV-01~05；撤销新鲜度机制中立；对抗向量族 AV-01~14 + AV-15/16。
- **§6b.4 按授权基础收敛的撤销（多根组合）**——有效权威 = 当前有效各授权基础可导出权威的并集；`revoke(basis-X)` 移除恰恰好 basis-X 可导出的权威（不多/不少）；MUST NOT 把主体权威归约为单一主体级全局 revoked/authorized 位；存活授权基础 MUST NOT 保留只属于已撤销谱系的权威；术语表新增 `authorization basis`。
- **§7.0.1a + §7.3(a) 字段契约 + 严格模式（引擎）**——EntityFieldContract `default_value`/`optional: false`（fail-closed E12）+ 比较节点类型不匹配在严格模式下记 `type_mismatch` warning；修复「fail-open」与「静默 false」。
- **§8.2a.1 fact 进 DO**——求值结果 DO 字段序新增 `fact`（输入事实对象，RFC-002 中称 `context`）；修复「DO 哈希原像缺输入事实」的规范缺口（breaking：字段序变更）。

### Changed
- **`decision` 改名 `audit_as`**——仅审计承载，收窄为 {ALLOW, NOTIFY, DELEGATE, ESCALATE, REQUEST_HUMAN}。
- **`transitions` 新增 `enabled`（默认 true）与 `reason`；`state` 新增 `display_name`（双语）。**
- **§7.3 子节重编号为字母标签 (a)–(g)**；长章拆分为编号子节（§5.2/§5.3/§5.4/§5.5/§6a.2/§6a.5/§6a.7/§8.2a/§10.2/§10.3）。
- **SPEC 文档版本 bump 到 v2.3**（fact + 严格模式 + 字段契约）；规则格式 `version:` 保持 2.2.0（无规则格式变更）；规范文件名 `erdl-language-spec-v2.1.md/.en.md` → `erdl-language-spec-v2.3.md/.en.md`。**npm 包版本 2.1.0-alpha.9 → 2.2.0-beta.1**（首个 beta；跟随规则格式版本，而非 SPEC 文档版本）。

### Fixed
- **§7.1 第 5 条**：`override` 挂 DENY 上无效——收紧（DENY/ROLLBACK/QUARANTINE 覆盖 ALLOW）是默认行为，不再被 same-ring override 阻断；求值器 `restrictive` 分支改为无条件收紧。
- **§7.1 第 2/6 条 + override 缺席排序**：澄清第 2 条（「同 priority 按 `override` 级别排序」）与第 6 条（「`when` 为字面量 `true`」）；`override` 缺席排序对齐「默认 normal」（erdl-formal 缺席 rank 4 → 2），清除 erdl-vectors#4 待确认-A/B/C。
- **§7.0.1a + §7.3(a)**：新增字段契约（EntityFieldContract）+ 严格模式——比较节点类型不匹配在严格模式下记 `type_mismatch` warning，修复审计隐患「fail-open」与「静默 false」。
- **§8.2a.1**：求值结果 DO 字段序新增 `fact`（输入事实对象，RFC-002 中称 `context`）——修复「DO 哈希原像缺输入事实」的规范缺口（breaking：字段序变更）。
- **`decision` 更名 `audit_as`**——仅审计承载，收窄为 {ALLOW, NOTIFY, DELEGATE, ESCALATE, REQUEST_HUMAN}。
- **`transitions` 增 `enabled`（默认 true）与 `reason`；`state` 增 `display_name`（双语）。**
- **§7.3 子节改为字母编号 (a)–(g)**；长章节拆为编号子节（§5.2/§5.3/§5.4/§5.5/§6a.2/§6a.5/§6a.7/§8.2a/§10.2/§10.3）。

## [2.1.0-alpha.9] - 2026-09-12

### Added
- **`EvaluationResult.canonicalTrees` 携带 canonical 树快照**（`tree` 字段 = 规范化树 JSON）与 `sha256:` 哈希并列——命中规则的证据可独立重算（E6）。
- **`RuleDefinition.tier`（0–5）接入加载与求值**——E12 按 tier 折叠求值错误：tier 0–2（或未指定）fail-close（`DENY`），tier 3–5 折叠为 `false`。
- **`evaluate(rules, context, options)` 接受 `options.asOf` 与 `options.fallbackDecision`**——显式 fallback 替代 `context['metadata.decision']` 字符串键 hack（S9）；`asOf` 记入结果（E9）。
- **`EntityFieldContract.displayName` 为双语 `{ zh, en }`**——`buildFieldNameMap(contracts, lang)` 按语种取（G3；canonical 英文 gloss 取 `en`）。
- **fn 委派：非确定性函数在 Guard 路径被拒**——已注册但非 deterministic 的 fn 返回 errored（`not_ruleable`）；`invoke`/`invokeSync` 均记录 `argsHash` + `resultHash`（sha256，附录 D）。

### Changed
- **SPEC §4.1** 增 `tier` 字段；**§7.0.3** 列明 `canonical_trees` / `eval_warnings` / `errored` / `as_of`；**§8.2** 区分 E2 求值口径（定点字符串）与编码口径（JCS number）；**E4** 标注 50ms 单规则上限为防 DoS 实现建议，非求值语义。
- **override 不再跳过同 ring 其余规则**——删除 `skipRing` 短路，对齐 §7.0.2「命中不短路」。

### Fixed
- **`unlessExemptions` 现在在 metadata-decision fallback 分支也返回**——否则 unless 豁免的规则在无其他命中时丢失豁免记录。
- **加载时校验**：`when` 字符串仅接受 `"true"`；`expr`+`conditions` 互斥；`metadata.name` 必填；未知顶层字段拒收；重复规则 id 拒收（B4/S6/N5）。
- **决策表编译为每行一条规则**——操作符元组行、空行 catch-all（字面量 `true`）、行序即优先级（B3）。
- **gloss**：对齐 §5.5 模板（`the last day of…`、`at least one element in…`、`not (X exists)`、仅 `not(eq)` 规范化 `ne`）；每条规则携带 gloss + `lintGloss`（B5）。
- **删除死代码**：`field_absent` warning 类型、`MAX_EVAL_MS`、`js-yaml` 依赖（N2/N3）。

## [2.1.0-alpha.8] - 2026-09-11

### Changed
- **SPEC §7.3(a)**：明确 warning 不对称中的 `errored` 口径——`in`/字符串/`length`/`aggregate` 记 `type_mismatch` warning 但 `errored: false`（仅 warning，非 E3 的 EvaluationError）。消除独立 runner 发现的歧义（A17）。
- **SPEC §7.3(a)/(b)**：扩展 warning 不对称——逻辑节点（`and`/`or` 非布尔操作数）静默折叠；量词（`all`/`any`/`none` 非数组操作数）记 `type_mismatch`（两者均 `errored: false`）。补齐独立 runner 在 A17 之外发现的空白。
- **SPEC §7.3(d)**：明确 ReDoS 折叠——违反限制的正则折叠为 `false` + `regex_re_dos` warning + `errored: false`（非 E3 的 EvaluationError）。
- **SPEC §7.3(g)**（新增）：E4 结构性资源限制违规抛出（`value: null` + `threw: true`，非求值错误）；E5 加载时互斥记录 `value: true`（= 检测到违规）。约束验证结果非求值结果。
- **SPEC §5.5**：补 gloss 渲染细节——`not(eq(x,y))` 规范化为 `ne`、字符串/list 字面量带引号、算术节点带括号。
- **SPEC §7.3(c)**：明确一致性比较的是 scale-14 定点值**数值**（尾零不敏感：`"35"` ≡ `"35.0"`），而非字符串拼写——十进制字符串是*编码*，不是比较单位。

- **语言规范文档改名为 `erdl-language-spec-v2.3.md`** —— `erdl-spec.md` / `erdl-spec.en.md` 改名为 `erdl-language-spec-v2.3.md` / `erdl-language-spec-v2.3.en.md`（language-spec vs product-spec 命名）；仓库内所有引用已更新。
- **表达式层向量数对齐为 240** —— V-ENGINE 表达式层现为 240 条（原 239）；240 条表达式层向量已由 `concordia-python-expression` runner（Erik Newton，Concordia）独立验证。

## [2.1.0-alpha.7] - 2026-09-09

### Fixed
- **求值错误标记 `errored: true`（E3）**：除零、非法日期、元数错误、算术类型不匹配的操作数现返回 `err()`（`errored: true`）而非 `ok(null)`（`errored: false`）；类型不匹配的**比较**与 null/缺失字段传播仍是正常 `false` 结果（`errored: false`）。对齐新补的 `errored` 标志（spec §7.2 E3 / §7.3(a)）。
- **`length` 对标量折叠为 `false`**：存在但非 string/array 的值折叠为 `false` 并记 `type_mismatch` warning（类似 aggregate 非数组 §7.3(e)）；`length(missing)` 仍返回 `0`（spec §5.2 exists 守卫依据）。
- **`in` 成员比较 NFC 归一（E10）**：分解态与预组合态字符串比较相等，对齐 `eq`/`ne`。
- **比较/字符串类型不匹配静默折叠**：比较节点（`gt`/`gte`/`lt`/`lte`）与 `contains` 左值非 string 类型不匹配静默返回 false（不记 warning）；quantifier over 缺失字段静默 false（E11 空值传播）。

### Changed
- **SPEC §7.2 E3 / §7.3(a) / 附录 E**：补 `errored` 求值错误标志——EvaluationError → `errored=true`（即便 E12 折叠为 false）；类型不匹配比较与空值传播 → `errored=false`。
- **SPEC §7.3(a)**：补 warning 不对称标注（比较/`between` 静默 false；`in`/字符串/`length`/`aggregate` 记 `type_mismatch`）。
- **SPEC §5.5**：gloss 渲染语言定为英文 canonical（G3 display_name 取英文值；中文模板为展示层可选投影）；渲染模板措辞对齐实际渲染（`in`/`between`/`length`/`match`/`epoch_ms`/`date_part`/`date_add`/`aggregate`/`quantifier`/`var`）。

## [2.1.0-alpha.6] - 2026-09-07

### Fixed
- **`total_evaluated` 计数漂移**：求值器对 `total_evaluated` 的推导不一致——EMERGENCY_HALT 短路路径用 `allMatched.length`（漏算其前面求值过但不命中的规则），其它路径用 `enabled.length`（多算被 `skipRing` 或 catch-all 惰性跳过的规则）。现新增显式 `evaluatedCount`，在规则实际进入 unless/when 求值时递增，所有返回路径统一使用。一致性向量：non-match + EMERGENCY_HALT = 2 条被求值；显式命中 + 惰性 catch-all = 1 条。

### Changed
- **SPEC §7.0.3 `total_evaluated` 措辞**（中英）：澄清为「实际进入 `unless`/`when` 求值的规则总数（被 `skipRing` 或 catch-all 惰性跳过的规则不计入）」。

## [2.1.0-alpha.5] - 2026-09-06

### Fixed
- **`BLOCKING_DECISIONS`（质量门禁 wild-when 禁令）4 → 6**：`when: true` + `ROLLBACK`/`QUARANTINE` 现在与 `when: true` + `DENY` 同样不安全（§7.4）。求值器决议极性集合改名 `BLOCKING_DECISIONS` → `RESTRICTIVE_DECISIONS`（`isBlocking` → `isRestrictive`）以消除两概念歧义。
- **修复 §7.0.2 first-match-wins 矛盾**（step 3c 说「short-circuits the ring」，同节又说「DENY does not short-circuit」）。
- **修复 §7.1 override 跨 ring 措辞**。
- **`date_add` 的 amount MUST 为整数（§7.3(f)）**。
- **类型不匹配的 `eq`/`ne` 折叠为 `false`（§7.3(a)）** —— 不再经 JS 隐式转换 fail-open。
- **`!= null` 在字段存在时折叠为 `true`**（G4 回归修复）。

### Changed
- README/CHANGELOG 默认英文（中文移 `.zh-CN.md`）；补徽章、POC 欢迎提示与 support 邮箱。

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
- README 双语拆分：`README.md` 重写为开发者优先叙事（英文）后按本仓命名约定双语化——中文版升为 `README.md`（主），英文版移至 `README.zh-CN.md`，互设语言切换链接；与 `erdl-spec.md`/`.en.md` 及姊妹仓（erdl-formal、erdl-vectors）的 `.md`/`.en.md` 约定一致。

## [2.0.0] - 2026-08-30

### Added
- ERDL 语言规范 v2.0 定稿（`erdl-spec.md` 中文 + `erdl-spec.en.md` 英文）。
- 表达式树语义内核（34 节点 / 10 组）、Simple 30 运算符、13 种决策类型。
- 参考实现：`erdl-loader`（文档加载）、`evaluator`（求值引擎）、`rule-yaml-serializer`（序列化）。
