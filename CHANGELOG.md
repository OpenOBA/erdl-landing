# ERDL Specification — Changelog

> 维护方：OpenOBA · https://github.com/OpenOBA/erdl-landing

---

## [1.1.0] — 2026-07-10

### Added
- **Decision Object v1.0 规范草案**（中英文双版）— 面向企业 Agent 治理的标准化、可审计、跨实现验证的开放规范
- **23 条跨实现验证向量集**（`decision-object-vectors-v1.0.json`）— 覆盖 7 种决策类型、13 个类别、11 种运算符
- **审计链机制**（`audit.hash` + `audit.previous_hash` + `audit.commitment`）— JCS (RFC 8785) 归一化 + SHA-256 防篡改
- **数据保留参考表**（§2.5）— 6 个法规保留期对照（EU AI Act、COSO/SOX、HIPAA、PCI DSS、GB/Z 185、CC-CSIRT）
- **社区鸣谢新增 Erik Newton** — 跨实现中立性验证方法论、"中立性是测出来的而非宣称的"
- **合规对齐扩展**：
  - §7.6: ISO/IEC 42001:2023 AI 管理系统（A.5.2 / A.7.5 / A.9.1 / A.9.2 / A.9.3 / A.10.1）
  - §7.7: IEEE P3395 — Agentic AI 实践（可追溯性、责任归属、协作边界、风险分级）
  - §7.1 OWASP 对齐更新到 2026 版本（LLM01-LLM10 新编号体系）
- **SPEC 时间戳更新**：2026-07-07 → 2026-07-10

### Changed
- **ERDL 定位调整**：从 "Agent 协议栈第三层" 改为 "兼容 MCP 和 A2A 生态的声明式规则描述语言"
- **三层架构图重构**：去 MCP/A2A/ERDL 并列叙事，改为 MCP Server + A2A Agent Card 扩展融入生态
- **执行环映射细化**：Ring 0-3 与决策类型的对应关系更清晰（Free/Pro/Enterprise 分层）
- **决策类型表扩展**：从 6 种 → 10 种，加入 NOTIFY、ROLLBACK、QUARANTINE、ESCALATE

### Removed
- "MCP 管工具。A2A 管通信。ERDL 管规则。" 的平行并列表述
- "Agent 协议栈第三层"、"第三层协议栈" 等所有竞争性定位描述

---

## [1.0.0] — 2026-07-07

### Added
- ERDL Protocol Specification v1.0 首次发布（中英文双版）
- 11 个章节：范围、核心概念、Entity 定义、规则语义、扩展层、安全模型、合规对齐、协议互操作、版本兼容性、参考实现、附录
- 16 种 Then 语义 + 11 种 Operator + Execution Rings 四级分级

---

> 确定性架构，而非 Prompt 工程。
> OpenOBA · 2026
