# ERDL SPEC v1.1 — 中英文术语定译表 (Terminology Mapping)

> 维护者：唐浩然（OpenOBA AI 执行官）
> 日期：2026-07-23
> 用途：英文版翻译基准，所有翻译必须严格遵循本表

---

## 一、核心口号与定位

| 中文 | English |
|------|---------|
| 确定性架构，而非 Prompt 工程 | Deterministic Architecture, Not Prompt Engineering |
| 人、LLM、系统、审计共享的语义约定层 | A Shared Semantic Contract Layer for Humans, LLMs, Systems, and Auditors |
| 先成为，再输出 | Become First, Then Output |
| 企业的 AI 执行官 | The Enterprise AI Executive |

---

## 二、协议与架构术语

| 中文 | English |
|------|---------|
| 实体 | Entity |
| 规则 | Rule |
| 条件 | Condition / When |
| 动作 | Action / Then |
| 执行环 | Execution Ring |
| 豁免机制 | Exemption Mechanism |
| 硬约束 | Hard Constraint |
| 优先级 | Priority |
| 覆盖 | Override |
| 短路求值 | Short-Circuit Evaluation |
| 空值传播 | Null Propagation |
| 类型匹配 | Type Matching |
| 资源配额 | Resource Quota |
| 语义约定 | Semantic Contract |
| 语义层 | Semantic Layer |
| 协议互操作 | Protocol Interoperability |
| 版本兼容性 | Version Compatibility |
| 向后兼容 | Backward Compatibility |
| 非破坏性 | Non-breaking |

---

## 三、Then 决策类型

| 中文 | English |
|------|---------|
| 外部可见决策类型 | Externally Visible Decision Types |
| 内部推理动作 | Internal Reasoning Actions |
| 放行 | ALLOW |
| 纠正 | CORRECT |
| 通知 | NOTIFY |
| 拒绝 | DENY |
| 紧急终止 | EMERGENCY_HALT |
| 回滚 | ROLLBACK |
| 隔离 | QUARANTINE |
| 请求人类审批 | REQUEST_HUMAN |
| 升级 | ESCALATE |
| 委派 | DELEGATE |
| 建议替代策略 | STRATEGIZE |
| 仅记录日志 | AUDIT |
| 安全计算 | CALCULATE |
| 校验 | VALIDATE |
| 工作流编排 | WORKFLOW |
| 工作流等待 | WORKFLOW_WAITING |
| 工作流推进 | WORKFLOW_PROGRESS |
| 通过（无规则匹配） | PASS |

---

## 四、执行环命名

| 中文 | English |
|------|---------|
| 安全环 | Security Ring (Ring 0) |
| 合规环 | Compliance Ring (Ring 1) |
| 运营环 | Operations Ring (Ring 2) |
| 执行环 | Execution Ring (Ring 3) |

---

## 五、安全与合规术语

| 中文 | English |
|------|---------|
| 安全模型 | Security Model |
| 合规对齐 | Compliance Alignment |
| 质量门禁 | Quality Gate |
| 幂等性约束 | Idempotency Constraint |
| 审计记录 | Audit Record |
| 审计子集 | Audit Subset |
| 审计链 | Audit Chain |
| 防篡改 | Tamper-Evident |
| 跨实现验证 | Cross-Implementation Verification |
| 跨实现中立性 | Cross-Implementation Neutrality |
| 逐字节一致 | Byte-for-Byte Identical |
| 确定性求值 | Deterministic Evaluation |

---

## 六、Agent 身份与信任

| 中文 | English |
|------|---------|
| 守护者 | Guardian |
| 操作者 | Operator |
| 被观察者 | Observed |
| 信任评分 | Trust Score |
| 身份标识 | Identity |
| 物料清单 | Bill of Materials (AgBOM) |
| 监管 Agent | Observed Agent |

---

## 七、规范文档约定

| 中文 | English |
|------|---------|
| 本文档约定 | Document Conventions |
| 规范 | Specification |
| 冻结 | Frozen |
| 定稿 | Finalized |
| 继承与微调 | Inherited with Adjustments |
| 新增章节 | New Sections |
| 变更摘要 | Change Summary |
| 规划目标 | Planned Goals |
| 附录 | Appendix |
| 术语表 | Glossary |
| 参考 | References |
| 贡献 | Contributing |
| 社区致谢 | Acknowledgments |

---

## 八、ERDL 专有术语（不翻译，保留原文）

| 术语 | 说明 |
|------|------|
| ERDL | Entity-Rule Definition Language（全称可译，缩写不译） |
| SafeExpr | 自研安全表达式引擎（名称不译） |
| Decision Object | 决策对象标准（名称保留英文） |
| `when` / `then` / `unless` | YAML 字段名（保留原文） |
| `guard` / `override` / `within` | YAML 字段名（保留原文） |
| MCP / A2A | 协议名（不译） |
| JCS (RFC 8785) | JSON Canonicalization Scheme（可加译注） |
| BCP 14 (RFC 2119 & RFC 8174) | 不译 |
| ReDoS | 正则表达式拒绝服务攻击（缩写不译） |

---

## 九、翻译规则

1. **MUST / MUST NOT / SHOULD / SHOULD NOT / MAY** — 英文版中使用大写原词，不翻译
2. **代码块（YAML/JSON/Bash）** — 原样保留，不翻译注释（注释已有中英文混排则保留）
3. **表格列数、行数** — 严格与中文版一致
4. **数字** — 绝对保持一致（13 operators, 17 actions, 44 vectors）
5. **章节编号（§1–§14）** — 严格一致
6. **Markdown 结构（#/##/###/表格/代码块/引用块）** — 不改变
