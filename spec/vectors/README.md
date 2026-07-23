# ERDL 决策引擎跨实现验证向量集

> 这是 ERDL 标准的唯一权威向量集来源。
> 所有第三方实现必须通过这些向量来证明 ERDL 兼容性。

---

## 目录

| 文件 | 说明 | 向量数 | 状态 |
|------|------|:---:|:---:|
| `decision-object-vectors-v1.0.json` | v1.0 原始向量集 (2026-07-15 冻结) | 28 (23 决策 + 5 审计) | ✅ Concordia 已验证 |
| `decision-object-vectors-v1.1.json` | v1.1 整合向量集 (2026-07-22) | 39 (32 决策 + 7 审计) | ✅ v1.0 不变 + 9 新增 |
| `generate-v1.1-vectors.cjs` | v1.1 向量生成脚本 | — | 可复现 |
| `generate-audit-vectors.cjs` | 审计哈希生成脚本 | — | 需引擎就绪运行 |
| `regenerate-audit-vectors.cjs` | 审计哈希重生成脚本 | — | 向量变更后运行 |

---

## 认证级别

| 级别 | 要求 | 向量数 | 有效期 |
|:---:|------|:---:|:---:|
| **L1** | 通过 v1.0 静态向量集 | 28 条 | 永久 |
| **L2** | L1 + v1.1 新增静态向量 + AV-006~007 | 39 条 | 6 个月 |
| **L3** | L2 + 动态向量集 (26 条) + 合规场景 (5 条) | 70 条 | 1 年 |

---

## 使用方式

### 验证所有静态向量

```bash
erdl-certify verify --level L1
erdl-certify verify --level L2
```

### 验证动态向量（需连接认证服务器）

```bash
erdl-certify verify --level L3 --server https://certify.openoba.com
```

---

## 当前通过方

| 实现 | 语言 | L1 | L2 | L3 | 最后验证 |
|------|------|:---:|:---:|:---:|------|
| erdl-engine (OpenOBA) | TypeScript | ✅ | ⏳ | — | — |
| Concordia (Erik Newton) | Rust | ✅ | — | — | 2026-07-13 |

---

> *"中立性是被测出来的，不是宣称出来的。" — Erik Newton (Concordia)*
>
> 维护者：OpenOBA · 许可证：CC-BY-NC-SA 4.0（向量集）· MIT（生成脚本）
