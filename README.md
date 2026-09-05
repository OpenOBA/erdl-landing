# ERDL —— 面向 AI Agent 的确定性规则

> 中文 | [English](./README.en.md)
>
> **最后更新**：2026-09-03 — 双语拆分：`README.md` 为中文版，英文版移至 `README.en.md`

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/@openoba/erdl)](https://www.npmjs.com/package/@openoba/erdl)
[![Vectors](https://img.shields.io/badge/verified_vectors-301-green.svg)](#已验证的一致性)
[![Spec](https://img.shields.io/badge/spec-v2.1-orange.svg)](./erdl-spec.md)

**Entity-Rule Definition Language · 实体规则定义语言**

> **ERDL** 是一种确定性、声明式的规则格式，用于 AI Agent 行为治理。
> **一份规范、一棵规范树、一个哈希 —— 跨实现逐字节验证一致。**

ERDL 以 `when → then` 决策的形式，用 YAML/JSON 表达实体结构与行为规则。
它是一门**语言** —— 实现中立、跨平台、可证明一致：同一条规则、同一份输入，
在任何符合规范的实现上都产出逐字节一致的结果与哈希。

## 为什么需要 ERDL？

| 问题 | ERDL 的解法 |
|---------|-------------------|
| LLM 输出是概率性的 | 确定性 `when → then` 护栏，在模型之外求值 —— 安全边界从不押在提示词上 |
| 规则语义在各实现间漂移 | 301 条 JCS + SHA-256 向量，强制逐字节一致 |
| 合规要求审计轨迹 | 每一次求值都产出可密码学验证的哈希 |
| 业务人员看不懂代码 | 三个投影面（Simple / Expression / 决策表）编译到同一棵语义树 |

## 已验证的一致性

ERDL 的语义由一套跨实现向量集钉死（见
[`erdl-vectors`](https://github.com/OpenOBA/erdl-vectors)）。独立的、
仅凭规范实现的 runner 用自建 JCS 重算每一条向量 —— 不依赖参考代码，
不读答案文件。

| 层 | 向量数 | 状态 |
|-------|---------|--------|
| 决策哈希（DO v1.5） | 78 | ✅ Node.js（参考实现）· ✅ Go（norviq-go）· ✅ Python（concordia-python） |
| 表达投影（V-ENGINE） | 223 | ✅ Node.js（参考实现）· 🚧 欢迎独立 runner |

## 形式化验证

向量证明的是你采样到的情形。[**erdl-formal**](https://github.com/OpenOBA/erdl-formal)
证明其余全部 —— 它把 ERDL 表达内核编译为 SMT（Z3），在*所有*输入上验证
规则永不报错、永不失败放行、永不漏拦。完整覆盖 34 节点 / E1–E12，
反例可以直接回放到本参考引擎。

## 快速开始（30 秒）

```bash
npm install @openoba/erdl
```

```yaml
# refund.erdl.yaml
protocol: "erdl/v2"
version: "2.1.0"
metadata:
  name: "refund-guard"
  decision: ALLOW
  category: coding
rules:
  - name: "SEC-001-refund-limit"
    description: "Refunds over 5000 require human approval"
    priority: 10
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "issue_refund"
        - field: "tool.args.amount"
          operator: gt
          value: 5000
    then: REQUEST_HUMAN
    message: "Refund amount over 5000, human approval required"
```

```ts
import { loadErdlFile, Evaluator } from '@openoba/erdl'

// 1. 从 YAML 文件加载规则
const { rules, metadata } = loadErdlFile('refund.erdl.yaml')

// 2. 对事实对象求值（兜底决策从 metadata 注入）
const result = new Evaluator().evaluate(rules, {
  tool: { name: 'issue_refund', args: { amount: 8000 } },
  'metadata.decision': metadata.decision,
})
console.log(result.decision) // 'REQUEST_HUMAN'
```

本包提供文档加载器（`loadErdlFile` / `parseErdlDocument`）、求值引擎、
34 节点表达树内核、规则校验、YAML 序列化与模板引擎。
格式详见[规范](./erdl-spec.md)，完整 API 参考见 [API.md](./API.md)。

## 规范

- [erdl-spec.md](./erdl-spec.md) — 中文规范（权威）
- [erdl-spec.en.md](./erdl-spec.en.md) — English specification

## 社区

- [CONTRIBUTING.md](./CONTRIBUTING.md) — 参与贡献（环境搭建、编码标准、PR 流程）。
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — 社区行为准则。
- [SECURITY.md](./SECURITY.md) — 漏洞报告。
- [DEVELOPMENT.md](./DEVELOPMENT.md) — 开发工具链与路线图。

## 仓库结构

```
.
├── README.md                 # 中文 README（本文件）
├── README.en.md              # English README
├── erdl-spec.md              # 中文规范（权威）
├── erdl-spec.en.md           # English specification
├── API.md                    # API 参考
├── CHANGELOG.md              # 发布历史（Keep a Changelog）
├── CONTRIBUTING.md           # 贡献指南
├── CODE_OF_CONDUCT.md        # 行为准则
├── SECURITY.md               # 安全策略
├── DEVELOPMENT.md            # 开发工具链 + 路线图
├── LICENSE                   # MIT + 商标声明
├── package.json / tsconfig.json / vitest.config.ts
└── src/
    ├── index.ts              # 公开 API 入口
    ├── erdl-loader.ts        # YAML 文档加载器（parseErdlDocument / loadErdlFile）
    ├── evaluator.ts          # 求值引擎
    ├── erdl-schema.ts        # 单一事实源（决策 / 运算符 / 分类）
    ├── rule-definition.ts    # 核心类型定义
    ├── rule-validator.ts     # 规则校验
    ├── rule-yaml-serializer.ts  # RuleDefinition → §2.1 YAML
    ├── rule-quality-gate.ts  # 加载期质量门禁
    ├── template-engine.ts    # 模板引擎
    ├── field-contracts.ts    # 字段契约 + display_name
    ├── fn-registry.ts        # 函数委派注册表
    ├── guard-state-manager.ts  # 有状态运算符（within/rate）状态
    ├── op-sem-registry.ts/.yaml  # 操作语义注册表
    ├── safe-regex.ts         # 防 ReDoS 正则
    ├── clock.ts / date-utils.ts  # 时间 + 日期工具
    └── expr-tree/            # 34 节点表达树内核
        ├── node-types.ts     # ExprNode + 34 种节点类型
        ├── evaluator.ts      # 树求值器（E1–E12）
        ├── gloss.ts          # 自然语言投影（gloss）
        ├── s-expression.ts   # S-表达式序列化
        ├── simple-compiler.ts  # Simple 30 运算符编译
        ├── rule-to-expr.ts   # when → 树编译
        ├── canonical.ts      # 规范形
        ├── fixed-point.ts    # 定点有理数算术
        ├── limits.ts         # 资源限制（E4）
        ├── normalize.ts      # NFC 规范化
        ├── grade.ts          # 规则分级（A/B/C）
        ├── decision-table.ts # 决策表编译
        ├── eval-trace.ts / eval-warning.ts  # 求值轨迹 + 警告
        └── *.spec.ts         # 测试套件
```

## 鸣谢

决议语义（§7.1 的 ring / override / catch-all）在成形过程中受益于外部 review。其中 **ANP2 Network**（[dev.to/anp2network](https://dev.to/anp2network)）对裁决层做了两轮精确、可复现的 review，指出了「空条件（catch-all）规则不得改写显式决议」这一语义边界（现 §7.1 第 6 条）及其在引擎与 SMT 验证层的对应缺口。每一处都推进到「补 spec + 修引擎 + 补证明」。

## 许可证

MIT © 2026 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.)

**商标**：ERDL™ 是深圳市秒镜科技有限公司的商标。MIT 许可仅覆盖版权，
不授予任何商标权利。
