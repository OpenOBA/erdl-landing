<!--
  Copyright (c) 2026 唐启鑫 (Tang Qixin)
  Licensed under MIT. See LICENSE file.
-->

# ERDL Specification — Changelog

> 维护方：OpenOBA · https://github.com/OpenOBA/erdl-landing

---

## [1.1.1] — 2026-08-01

### Spec Amendments (per Erik Newton third-party audit)
- **§3.6 Guard**: "cannot bypass" → precise mediation language ("all MCP calls routed through the proxy are mediated by the Guard")
- **§8.4 Proxy Mode**: same mediation language correction
- **RFC §7.5**: same correction applied

### Documentation Infrastructure
- **README Quick Start**: honest disclosure that `erdl-engine-js` is not yet public; Concordia listed as the only independently cloneable implementation
- **SPEC §12 verification table**: added "Executable" column (zh+en) — only independently cloneable implementations listed
- **All README layers** (root → spec/vectors, vectors-v1.3): vector count updated from 44 to 101 (v1.3); Christopher moved from verification table to Acknowledgments; ERDL Engine JS removed from verification table (not publicly available)
- **spec/vectors/README.md (zh)**: fully aligned with README.en.md — added Version Identification warning, verification table, Acknowledgments, Verification Method

### Vectors v1.3 Integration
- **vectors-v1.3/**: full v1.3 vector set mirrored from erdl-vectors (75 static: 63 DO + 12 AV + 26 dynamic in rulsynor). No answers file included.
- **Tooling**: verify.js, reference-runner.js, generate-vectors.cjs, test suites (67 generator + 86 verification tests), CI pipeline, verified-runners.json, RUNNERS-GUIDE.md
- **v1.0/v1.1 vectors**: retained as historical archive; v1.3 is the sole authoritative version

### Examples Alignment
- **All rule examples** aligned to SPEC v1.1 §5.1 format rules (F1-F8): added missing `metadata.name`/`decision`/`tags`/`override`; removed non-SPEC fields (`guard`, `triggers`, `owner`, `owasp_alignment`); double-quoted all string values; fixed field ordering
- **examples/README.md**: added SPEC F1-F8 reference

---

## [1.1.0] — 2026-07-23

### Added
- **§3.2.1** when 最小完整度要求 — 防止 `when: 'true'` + 拦截性 `then` 导致系统不可用
- **§3.2.2** unless 豁免机制 — 短·求值与审计行为完整定义
- **§3.2.3** message 强制要求 — DENY/HALT/CORRECT/REQUEST_HUMAN 必须附带原因
- **§3.2.4** 规则命名规范 — `[CAT]-[NNN]-描述` 格式 + CAT 缩写表
- **§3.4.1** metadata.decision 与 rules[].then 的优先级定义
- **§3.4** WORKFLOW/WORKFLOW_WAITING/WORKFLOW_PROGRESS 三种 decision 注册
- **§6.1** 空值传播语义 + 资源配额（深度≤64、节点≤256、正则≤10,000）
- **§11.5** 规则质量门禁（11 项加载时检测）
- **§12** Decision Object 审计子集 — 全量集成 decision-object-v1.0 (2026-07-15 冻结)
- **§1.5** BCP 14 (RFC 2119 & RFC 8174) 关键词声明
- **§9.3** v1.1 新增约束向后兼容声明（Non-breaking）
- 新增章节表增加「兼容性」列
- **附录 E** v1.2 规划目标
- **验证向量集 v1.1** — 37 条决策引擎向量 + 7 条审计哈希向量 = 44 条
- **13 种运算符全覆盖**（新增 `not_in`、`not_contains`）

### Changed
- 运算符：11 → 13（新增 `not_in`、`not_contains`）
- Then 动作：14 → 17（新增 WORKFLOW 系列 3 种）
- when 语法：2 → 3 种形式（新增扁平简写）
- "未修改章节" → "继承与微调章节"，消除体例矛盾
- §12 章节编号格式统一（移除 emoji 前缀）
- owasp 字段统一为数组格式

### Fixed
- 章节编号冲突修复（两个 §5、两个 §10 → 唯一编号）
- 运算符表 BNF 遗漏补全
- 审计向量数量 5 → 7 条，文本同步
- DELEGATE → ESCALATE 映射规则补充
- 名称唯一性大小写说明补充
- 附录 E 幂等性状态修正

### Audited
- 技术自洽性深度审计 (2026-07-22)
- 工程可行性审计 (2026-07-22)
- 第三方发布前最终审计 (2026-07-23)
- 三方交叉审计：SPEC v1.1 ↔ Decision Object v1.0 ↔ 向量集 v1.1

---

## [1.0.0] — 2026-07-10

### Added
- ERDL Protocol Specification v1.0 Community Preview
- Decision Object v1.0 规范草案（中英文双版）
- 10 种外部决策类型 + 4 种内部推理动作
- 11 种运算符 + 4 级 Execution Rings
- 23 条跨实现验证向量 + 5 条审计哈希向量

---

> 确定性架构，而非 Prompt 工程。
> OpenOBA · 2026
