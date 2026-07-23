# ERDL 规范标准文档

> **Entity-Rule Definition Language — Agent 行为规则层开放标准**
>
> 维护者：OpenOBA · 许可证：MIT

---

## 核心规范

| 文档 | 版本 | 日期 | 状态 |
|------|------|------|:---:|
| **[ERDL SPEC v1.1 (Final)](./erdl-spec-v1.1.md)** | v1.1 | 2026-07-22 | **Final · 冻结** |
| [ERDL SPEC v1.0 (Legacy)](./index.md) | v1.0 | 2026-07-10 | 归档 |
| [ERDL SPEC v1.2 (Roadmap)](./erdl-spec-v1.2.md) | v1.2 | 2026-07-22 | Planning |

## Decision Object（审计子集）

| 文档 | 版本 | 状态 |
|------|------|:---:|
| [Decision Object v1.0](./decision-object/decision-object-v1.0.md) | v1.0 | 冻结 (2026-07-15) |
| [Decision Object v1.0 英文版](./decision-object/decision-object-v1.0.en.md) | v1.0 | 冻结 |

## 跨实现验证向量集 ★

| 文档 | 向量数 | 状态 |
|------|:---:|:---:|
| [向量集说明](./vectors/README.md) | — | — |
| [v1.0 向量集 (28 条)](./vectors/decision-object-vectors-v1.0.json) | 28 | ✅ Concordia 已验证 |
| [v1.1 向量集 (39 条)](./vectors/decision-object-vectors-v1.1.json) | 39 | ✅ 静态汇编完成 |

## 第三方审计

| 文档 | 日期 |
|------|------|
| [技术自洽性与工程可行性审计（最终报告）](./audit/ERDL%20v1.1%20规范多维度评估最终研究报告.agent.md) | 2026-07-22 |
| [开源战略多维度深度评估](./audit/ERDL%20开源战略多维度深度评估报告.agent.md) | 2026-07-22 |
| [规范与开源战略最终研究成果](./audit/ERDL%20v1.1%20规范与开源战略最终研究成果报告.agent.md) | 2026-07-22 |

## 开源战略

| 文档 | 版本 |
|------|------|
| **[开源战略 V3.0 正式版](./strategy/erdl-opensource-strategy-v3.md)** | 2026-07-22 |
| [动态向量集与认证体系](./strategy/erdl-dynamic-vectors-and-certification.md) | 2026-07-22 |
| [动态向量集实施计划](./strategy/erdl-dynamic-vectors-plan.md) | 2026-07-22 |

## 工程文档

| 文档 | 说明 |
|------|------|
| [核心引擎工程方案](./engineering/erdl-core-engine-plan.md) | rulsynor → erdl-engine 抽取方案 |
| [参考实现缺口盘点](./engineering/erdl-gap-analysis.md) | 42 项缺口分析 |
| [参考实现工程评估](./engineering/erdl-implementation-assessment.md) | rulsynor 逐项评估 |

---

> *"确定性架构，而非 Prompt 工程。"*
>
> -- OpenOBA · 2026.07.22
