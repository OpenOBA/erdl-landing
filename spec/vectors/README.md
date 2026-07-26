# ERDL Decision Object — Cross-Implementation Test Vectors

> 维护者：OpenOBA | 许可证：MIT
> 最后更新：2026-07-26
>
> **⚠️ 版本识别**：向量文件内的 `version` 字段为语义版本标签，不保证唯一性（同一版本号下可能存在不同修订版）。实现者应使用 **Git commit hash** 锁定具体版本（例如 `git show <commit>:spec/vectors/decision-object-vectors-v1.1.json`）。仅凭 version string 无法区分两个不同字节状态的向量文件——这一缺陷在 v1.1 冻结期审计中由 Christopher Hopley (chopmob-cloud) 独立发现并记录。

## 文件说明

| 文件 | 描述 | 向量数 |
|------|------|:---:|
| `decision-object-vectors-v1.0.json` | Decision Object v1.0 基准向量集 | 28 (23 决策 + 5 审计) |
| `decision-object-vectors-v1.1.json` | Decision Object v1.1 整合向量集 | 45 (37 决策 + 8 审计) |

## 审计哈希向量（AV-001 ~ AV-008）

v1.1 包含 8 条审计哈希向量，用于验证跨实现的 JCS (RFC 8785) 规范化 + SHA-256 哈希一致性。

### 向量结构

每条审计向量包含以下关键字段：

| 字段 | 用途 |
|------|------|
| `canonical_bytes` | hex 编码的 JCS 规范化字节序列。**诊断工具** — 当两个独立实现产生不同哈希时，可逐字节比对定位差异，无需对方 canonicalizer 代码。 |
| `decision_object.audit.hash` | Decision Object 中存储的自引用声称哈希。runner **MUST** 从 `canonical_bytes` 重新计算 SHA-256 并与此值比对。 |

### `expected_sha256` 已移除

v1.1 向量集已移除 `expected_sha256` 字段。该字段是一个答案密钥 — 简写 runner 可通过直接比较 `expected_sha256` 与 `decision_object.audit.hash` 跳过 JCS+SHA-256 重算步骤。移除后所有 runner 必须从 `canonical_bytes` 重新推导哈希。

此项设计变更基于 Erik Newton (Concordia) 和 Christopher Hopley (chopmob-cloud) 在 2026-07-24 冻结期审计中的独立建议。

### AV-008 陈旧回归向量

AV-008 是一个**故意陈旧**的向量：`canonical_bytes` 已更新（em-dash 空格修复），但 `decision_object.audit.hash` 保留了修复前的旧值。结果：SHA-256(canonical_bytes) ≠ audit.hash。

- **正确的 runner**（从第一原理重算 JCS+SHA-256）→ 检测到不匹配 → **这是正确行为** ✅
- **简写 runner**（使用缓存/预计算答案表）→ 不计算 → 可能错误地认为通过 → **被暴露** ❌

AV-008 的存在价值：任何声称兼容的实现必须证明它真正从 `canonical_bytes` 重新推导了哈希。

## 验证方法（六步完整流程）

兼容实现 **MUST** 执行以下步骤（详见 SPEC v1.1 §12.7.3）：

1. 从向量集加载 Decision Object
2. 提取 `decision_object.audit.hash` 作为**声称哈希**
3. 从 `decision_object` 中**删除** `audit.hash` key（MUST delete，不得设为 null 或 ""）
4. 对剩余对象执行 JCS (RFC 8785) 规范化 → canonical bytes
5. 计算 SHA-256 (FIPS 180-4) → **重算哈希**
6. 比较重算哈希（步骤 5）与声称哈希（步骤 2）— MUST 逐字节一致

### 关键约束：删除 key，不得置空

```json
// ✅ 正确: delete audit.hash → JCS 不含 "hash" key
//   {"audit":{"commitment":"x","previous_hash":null},"decision_id":"d1"}
//   sha256:023c4b7d...

// ❌ 错误: audit.hash 设为 "" → JCS 含 "hash":""
//   {"audit":{"commitment":"x","hash":"","previous_hash":null},"decision_id":"d1"}
//   sha256:bd0925a9... (完全不同！)
```

两种方式在 JCS 下产生不同的 canonical byte sequence，因此产生不同的 digest。错误实现将导致**所有向量系统性漂移**。

## 实证故障记录

2026-07-24 冻结期间，commit `c3f22df` 的向量文件在更新 AV-003/AV-004/AV-005 的 `canonical_bytes` 后遗漏了同步更新 `audit.hash`。五步简写（strip → JCS → SHA-256 → 比 expected_sha256）报告 7/7 PASS，但完整六步验证暴露了 3 条向量的 audit.hash 与 canonical_bytes 不匹配。commit `5cff368` 修复了此问题。

详见 SPEC v1.1 §12.7.3 设计理由。

## 独立验证记录

| 实现 | 验证人 | 日期 | 向量数 | 结果 |
|------|--------|------|:---:|------|
| Rulsynor (TypeScript) | OpenOBA | 2026-07-26 | 8 审计 | ✅ 全部逐字节匹配 |
| Concordia (Rust) | Erik Newton | 2026-07-14 | 5 审计 (AV-001~005) | ✅ 全部逐字节匹配 |
| chopmob-cloud (Python) | Christopher Hopley | 2026-07-25 | 8 审计 (步骤 5-6) | ✅ hex+SHA-256 复现 |

## 参考

- SPEC: [erdl-spec-v1.1.md](../erdl-spec-v1.1.md) · §12 Decision Object
- JCS: [RFC 8785](https://datatracker.ietf.org/doc/rfc8785/)
- SHA-256: [FIPS 180-4](https://csrc.nist.gov/publications/fips/fips180-4)
- 独立向量仓库: [github.com/erdl-vectors](https://github.com/erdl-vectors)
