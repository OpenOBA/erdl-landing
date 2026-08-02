# ERDL Decision Object — 跨实现验证向量

> 维护者：OpenOBA | 许可证：MIT
> 最后更新：2026-08-02
>
> **权威数据源**：[erdl-vectors](https://github.com/OpenOBA/erdl-vectors) — 独立仓库。本目录为其镜像。
>
> **版本标识警告**：向量文件中的 `version` 字段仅为语义标签，不保证唯一性（同一版本号可能对应不同修订版）。实现者 **应** 固定到特定的 **Git commit hash**。该缺陷由 Christopher Hopley (chopmob-cloud) 在 v1.1 冻结期审计中独立发现并记录。

## 目录

| 文件 / 目录 | 说明 | 向量数 |
|------|------|:---:|
| `decision-object-vectors-v1.0.json` | v1.0 基准（历史归档） | 28（23 决策 + 5 审计） |
| `decision-object-vectors-v1.1.json` | v1.1 整合（历史归档） | 45（37 决策 + 8 审计） |
| `../vectors-v1.3/` | **v1.3 当前版本 — 101 条向量 + 验证器 + runner 参考实现**。详见 [子目录 README](../vectors-v1.3/README.md) | 63 DO + 12 AV + 26 动态 |

## 快速开始

```bash
cd ../../vectors-v1.3
npm install
node verify.js
# → ALL VERIFICATIONS PASSED (11/11 MATCH + AV-013 CANARY DETECTED)
```

## 独立验证记录

仅列出拥有公开仓库、可独立克隆执行的实现。

| 实现 | 语言 | 验证者 | 日期 | 向量 | 结果 |
|------|------|------|------|:---:|------|
| Concordia | Python | Erik Newton | 2026-08-02 | 13 审计 (AV-001~013) | ✅ 12 逐字节匹配 + 金丝雀正确判别 |

## 致谢

- **Erik Newton (Concordia)** — 首位独立 Runner 实现者。仅凭 spec 文本独立验证全部 13 条审计向量，逐字节匹配。确立了"中立性是被检验的，而非被宣称的"原则。
- **Christopher Hopley (chopmob-cloud)** — 独立技术审查者。其 JCS 边界案例分析、版本标识缺陷发现，以及合规审计反馈直接塑造了 v1.3 的审计哈希结构和答案文件分离架构。

## 验证方法

合规实现 **必须** 执行以下步骤：

1. 从向量集中加载 Decision Object。
2. 提取 `decision_object.audit.hash` 作为**声称的哈希值**。
3. **删除** `decision_object` 中的 `audit.hash` 键。必须删除；不得设为 `null` 或 `""`——两者在 JCS 下产生不同的规范字节序列。
4. 使用 JCS (RFC 8785) 序列化剩余对象。
5. 计算规范字节的 SHA-256 (FIPS 180-4)，前缀 `sha256:`。
6. 与声称的哈希值逐字节比较。不匹配即为合规失败。

## 参考

- SPEC: [erdl-spec-v1.1.md](../erdl-spec-v1.1.md) · §12 Decision Object
- 权威向量仓库: [github.com/OpenOBA/erdl-vectors](https://github.com/OpenOBA/erdl-vectors) (v1.3, 101 vectors, Frozen)
- JCS: [RFC 8785](https://datatracker.ietf.org/doc/rfc8785/)
- SHA-256: [FIPS 180-4](https://csrc.nist.gov/publications/fips/fips180-4)
