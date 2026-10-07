# ERDL —— 你的 Agent 打不破的护栏

> 中文 | [English](./README.md)
>
> **最后更新**：2026-10-07 — 定位多 Agent 时代

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/@openoba/erdl)](https://www.npmjs.com/package/@openoba/erdl)
[![Vectors](https://img.shields.io/badge/vectors-342-green.svg)](#已验证的一致性)
[![A2A](https://img.shields.io/badge/A2A-RFC_%232031-8A2BE2)](#生态)
[![Spec](https://img.shields.io/badge/spec-v2.3-orange.svg)](./erdl-language-spec-v2.3.md)
[![Deterministic](https://img.shields.io/badge/deterministic-by_construction-2ea44f)](#给怀疑者)
[![Kernel](https://img.shields.io/badge/kernel-34_nodes-blueviolet)](#给怀疑者)
[![Multi-agent](https://img.shields.io/badge/governance-delegated_authority-8A2BE2)](#多-agent-治理委托权威)

> 🚀 **欢迎 POC** —— 欢迎你在自己的环境中试用本项目概念验证。需要技术支持？随时联系 [support@openoba.com](mailto:support@openoba.com)。

**Entity-Rule Definition Language · 实体规则定义语言**

> **ERDL** 是 AI Agent 的治理层 —— 确定性 `when → then` 规则、
> 可密码学验证的审计轨迹、多 Agent 系统的委托权威。
> **一份规范、一棵规范树、一个哈希 —— 跨实现逐字节验证一致。**
>
> **永不放行。永不漏拦。可证明。**

ERDL 在每一次工具调用、每一个决策、每一次委派发生之前，用你以纯 YAML 写下的规则
做检查 —— 求值发生在**模型之外**，提示词攻不破的安全边界。违规动作被拦截，并被
哈希锚定进审计链。同一条规则、同一份输入，在任何符合规范的实现上都产出
**逐字节一致的结果与哈希**。

## 最后一块空白层

Agent 基础设施正在被一层层补齐 —— 记忆、运行时安全、Agent 管理、团队编排。
每一层「给 Agent 加能力」的基础设施，都已经有了爆火的开源项目。

**治理层是仅剩的空白。** ERDL 补上它：让自主性可部署、可审计的规则层。

## ERDL 给你什么

| 层 | 治理什么 | ERDL 原语 |
|-------|-----------------|----------------|
| **单 Agent** | 确定性 `when → then` 行为规则 | 34 节点表达树、Simple 30 运算符、13 决策 |
| **跨实现** | 每个决策的字节级可验证审计 | 决策对象（DO）+ 哈希链 + 342 一致性向量 |
| **多 Agent** | 委派链上的委托权威 | §6a 状态块（FSM）+ §6b 委托权威不变量（INV-01~05）|

## 为什么需要 ERDL？

| 问题 | ERDL 的解法 |
|---------|-------------------|
| LLM 输出是概率性的 —— 提示词可被越狱 | 规则在**模型之外**求值；安全边界从不押在提示词上 |
| 被委派的子 Agent 可能越权 | **委托权威不变量（INV-01~05）** —— 权威不放大、溯源连续、窄化继承、传递撤销 —— 由事件驱动状态机（§6a）执行，由对抗向量（AV-01~14）证明 |
| 规则语义在各实现间漂移 | 342 条 JCS + SHA-256 向量强制逐字节一致 —— 三个独立实现交叉验证 |
| 合规要求审计轨迹 | 每一次求值都产出可密码学验证的哈希 |
| 业务人员看不懂代码 | 三个投影面（Simple / Expression / 决策表）编译到同一棵语义树 |

## 30 秒护栏

```bash
npm install @openoba/erdl
```

```yaml
# refund.erdl.yaml
protocol: "erdl/v2"
version: "2.2.0"
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
const result = new Evaluator().evaluate(
  rules,
  { tool: { name: 'issue_refund', args: { amount: 8000 } } },
  { fallbackDecision: metadata.decision },
)
console.log(result.decision) // 'REQUEST_HUMAN'
```

### 它在哪里接入

在你的 Agent 工具调用边界 —— 工具执行之前 —— 加一次 `evaluate()`：

```ts
import { Evaluator } from '@openoba/erdl'

const result = new Evaluator().evaluate(rules, incomingToolCall, {
  fallbackDecision: 'DENY',
})

if (result.decision !== 'ALLOW') {
  haltForReview(result) // 你的处理函数：拦截调用、留存审计轨迹
}
```

只要你的 Agent 跑在 Node 上，ERDL 就能守护它。典型接入点：**Claude Code hooks、
Codex / Cursor harness、MCP 服务器、A2A Agent、自研执行器。**

本包提供文档加载器（`loadErdlFile` / `parseErdlDocument`）、求值引擎、
34 节点表达树内核、规则校验、YAML 序列化与模板引擎。
格式详见[规范](./erdl-language-spec-v2.3.md)，完整 API 参考见 [API.md](./API.md)。

## 我们攻击自己

多 Agent 安全模型在攻击下被证明成立 —— **十四条对抗向量**（AV-01 ~ AV-14，SPEC §6b）：

| 攻击 | 向量类别 |
|--------|--------------|
| 子 Agent 给自己授予比委派者更大的权威 | 直接 / 传递 / 聚合放大 |
| 权威经委派链洗白 | 特权洗权 |
| 在已被撤销的授权上行动 | 撤销祖先、陈旧撤销 |
| 重放早先的授权 | 序列重放 |

14 条全部拦下。每条不变量全部守住。

## 已验证的一致性

ERDL 的语义由一套跨实现向量集钉死（见
[`erdl-vectors`](https://github.com/OpenOBA/erdl-vectors)）。独立的、
仅凭规范实现的 runner 用自建 JCS 重算每一条向量 —— 不依赖参考代码，
不读答案文件。

| 层 | 向量数 | 状态 |
|-------|---------|--------|
| 决策哈希（DO v1.5） | 78 | ✅ Node.js（参考实现）· ✅ Go（norviq-go）· ✅ Python（concordia-python） |
| 表达投影（V-ENGINE） | 240 | ✅ Node.js（参考实现）· ✅ Python（concordia-python-expression） |
| 决议层（V-RESOLVE） | 13 | ✅ Node.js（参考实现）· ✅ Ravindra Annam（spec-only runner） |
| 签名层（V-SIGN） | 5 | 生成（参考实现自证） |
| 时间锚定（TSA） | 3 | 生成（参考实现自证） |
| decision_divergence | 3 | 重推导 |

## 形式化验证

向量证明的是你采样到的情形。[**erdl-formal**](https://github.com/OpenOBA/erdl-formal)
证明其余全部 —— 它把 ERDL 表达内核编译为 SMT（Z3），在*所有*输入上验证
规则永不报错、永不失败放行、永不漏拦。完整覆盖 34 节点 / E1–E12，
反例可以直接回放到本参考引擎。

## 有状态规则（§6a 状态块与转移）

除了无状态的 `when → then` 规则，ERDL 还支持**单实例有限状态机**（§6a）：两个可选顶层字段——`state`（状态空间）与 `transitions`（确定性、事件驱动的转移函数）。状态由引擎在表达式树内核之外维护，规则经 `state.<name>` 命名空间只读访问；转移守卫只读 `state.*` 与 `event.*`。每次成功提交的转移被串行锚定进审计链（genesis → transition / transition_error），求值结果则按需记录 `state_snapshot`（`{ values, state_version, transitions_head }`）。这正是组织层构建多 Agent **委托权威**治理（SPEC §6b，INV-01~05）的原语。

```yaml
state:
  - name: authorization
    values: [authorized, revoked]
    initial: revoked
transitions:
  - on: authorize
    audit_as: DELEGATE
    set: { authorization: authorized }
  - on: revoke
    audit_as: DELEGATE
    set: { authorization: revoked }
```

```ts
import { StateMachine, Evaluator } from '@openoba/erdl'

const sm = new StateMachine(stateDecls, transitions, docTreeHash)
sm.injectEvent({ event_id: 'e1', on: 'authorize', actor: 'root-P' })

const result = new Evaluator().evaluate(rules, fact, { stateMachine: sm })
result.stateSnapshot // { values: { authorization: 'authorized' }, state_version: 1, transitions_head }
```

## 多 Agent 治理（委托权威）

单 Agent 护栏止于「这个 Agent、这个决策」。多 Agent 系统提出了更难的问题：**当 Agent A 委派给 Agent B 时，B 的动作究竟源于哪条授权链？它在哪一步违背了策略？** ERDL 用**委托权威安全模型**（SPEC §6b）回答它：

- **五条不变量**（`INV-01` ~ `INV-05`）约束委派链上的有效权威——权威不放大、溯源连续、窄化继承、传递撤销、能力边界不放大。
- **十四条对抗向量**（`AV-01` ~ `AV-14`）证明不变量在攻击下仍成立——直接/传递/聚合放大、特权洗权、撤销祖先、序列重放、陈旧撤销。
- **§6a 状态块**提供语言原语：单实例 FSM，其 `state`/`transitions` 表达授权状态及事件驱动、审计锚定的转移。

委托授权安全不变量（INV-01–INV-05）及相关对抗一致性向量（AV-01–AV-14）由 **Ravindra Annam** 提出，随后在与 OpenOBA 的技术评审与协作中进一步细化与完善。它们存于 [`rulsynor-multi-agent`](https://github.com/OpenOBA/rulsynor-multi-agent) 仓库——消费 ERDL 原语的组织层。ERDL 提供确定性表达决策 + 状态机原语；组织层跨 hop 推导有效权威；表达层始终是唯一决策权威（SPEC §6b、DESIGN §8a）。

```yaml
# 每个委派关系一个授权 FSM 实例（SPEC §6a.1 分层）
state:
  - name: authorization
    values: [authorized, revoked]
    initial: revoked
transitions:
  - on: authorize
    audit_as: DELEGATE
    reason: authorize
    set: { authorization: authorized }
  - on: revoke
    audit_as: DELEGATE
    reason: revoke
    set: { authorization: revoked }
```

## 生态

| 组成 | 是什么 |
|-------|-----------|
| `@openoba/erdl`（本仓库） | 参考引擎 —— 加载器、求值器、34 节点内核、§6a 状态机 |
| [`erdl-vectors`](https://github.com/OpenOBA/erdl-vectors) | 342 条一致性向量，由独立 spec-only runner 重算 |
| [`erdl-formal`](https://github.com/OpenOBA/erdl-formal) | 表达内核的 SMT（Z3）形式化验证 —— 覆盖所有输入，而非采样 |
| [`rulsynor-multi-agent`](https://github.com/OpenOBA/rulsynor-multi-agent) | 消费 ERDL 原语、实现委托权威的组织层 |
| A2A Discussion #2031 | ERDL 被提议为 Agent Cards 扩展 —— Agent 发现的行为规则 |

## 给怀疑者

「确定性」是一个宣称，构造如下：

- **34 节点表达内核**（E1–E12）：定点有理数算术、NFC 规范化、资源限制（E4）、防 ReDoS 正则。
- **字节级可复现**：RFC 8785 JCS 规范化 + SHA-256；342 条向量由独立、仅凭规范的 runner 重算 —— 不依赖参考代码，不读答案文件。
- **三个独立实现**：Node.js（参考实现）· Go（norviq-go）· Python（concordia-python / concordia-python-expression）。
- **形式化证明**：erdl-formal 在*所有*输入上验证 —— 永不报错、永不失败放行、永不漏拦；反例可直接回放到本引擎。
- **独立审计史**：见[鸣谢](#鸣谢)—— 四位外部审阅者在 ERDL 的历史上找出过真实缺口；每一个都已修复并被向量覆盖。中立性不是宣称的，是测出来的。

## 规范

- [erdl-language-spec-v2.3.md](./erdl-language-spec-v2.3.md) — 中文规范（权威）
- [erdl-language-spec-v2.3.en.md](./erdl-language-spec-v2.3.en.md) — English specification

## 社区

- [CONTRIBUTING.md](./CONTRIBUTING.md) — 参与贡献（环境搭建、编码标准、PR 流程）。
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — 社区行为准则。
- [SECURITY.md](./SECURITY.md) — 漏洞报告。
- [DEVELOPMENT.md](./DEVELOPMENT.md) — 开发工具链与路线图。

## 仓库结构

```
.
├── README.md                 # English README
├── README.zh-CN.md           # 中文 README（本文件）
├── erdl-language-spec-v2.3.md              # 中文规范（权威）
├── erdl-language-spec-v2.3.en.md           # English specification
├── API.md                    # API 参考
├── CHANGELOG.md              # 发布历史（Keep a Changelog）
├── CHANGELOG.zh-CN.md        # release history (Keep a Changelog)
├── CONTRIBUTING.md           # 贡献指南
├── CODE_OF_CONDUCT.md        # 行为准则
├── SECURITY.md               # 安全策略
├── DEVELOPMENT.md            # 开发工具链 + 路线图
├── LICENSE                   # MIT
├── NOTICE.md                 # 商标声明
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
    ├── state-definition.ts   # §6a state/transitions 类型 + 加载时校验
    ├── state-machine.ts      # §6a 运行时 FSM（事件注入 / 审计链 / state_snapshot）
    ├── evaluation-object.ts  # 语言层求值结果 DO 序列化 + 哈希
    ├── safe-regex.ts         # 防 ReDoS 正则
    ├── clock.ts / date-utils.ts  # 时间 + 日期工具
    └── expr-tree/            # 34 节点表达树内核
        ├── node-types.ts     # ExprNode + 34 种节点类型
        ├── evaluator.ts      # 树求值器（E1–E12）
        ├── gloss.ts          # 自然语言投影（gloss）
        ├── s-expression.ts   # S-表达式序列化
        ├── simple-compiler.ts  # Simple 30 运算符编译
        ├── rule-to-expr.ts   # when → 树编译
        ├── canonical.ts       # 规范形
        ├── fixed-point.ts     # 定点有理数算术
        ├── limits.ts          # 资源限制（E4）
        ├── normalize.ts       # NFC 规范化
        ├── grade.ts           # 规则分级（A/B/C）
        ├── decision-table.ts # 决策表编译
        ├── eval-trace.ts / eval-warning.ts  # 求值轨迹 + 警告
        └── *.spec.ts         # 测试套件
```

## 鸣谢

- **Christopher Hopley（chopmob-cloud / AlgoVoi）**——独立技术审阅者。在 v1.2 / v1.3 审计中发现自引用哈希排除规则缺位、字符串小数跨引擎不一致等关键问题，推动扁平哈希架构确立；其洁净室 RFC 8785 JCS + SHA-256 检查器报告了四个技术发现（C1–C4）与三个安全问题（S1–S3），其中双哈希算法降级（CWE-757）与 schema_ref SSRF 攻击面直接推动了安全加固。
- **Erik Newton（Concordia）**——首个独立 Runner 实现者，「中立性不是宣称的，是测出来的」原则的提出者。在 A2A Discussion #2031 确立「三个独立实现、一个开放规范、没有单一所有者」的标准化路径；以 Python 纯规范实现（自建 JCS）逐字节验证 v1.3 全部 13 条 AV 向量；2026-09 他以 concordia-python 逐字节验证 v1.5 的 78 条 V-DO-v15 哈希向量（107/107 canonical bytes）；贡献了链完整性金丝雀设计、答案文件分离架构与 generated-artifact + clean-room + registry 的 CI 验证架构。2026-09 他还构建了首个独立表达层 runner（`concordia-python-expression`），仅凭 spec + 契约的 Python 实现逐字节验证 V-ENGINE 表达层全部 240 条向量；其 RESULTS.md 记录了 16 处 spec 歧义（A1–A16），其中四处暴露了现已修复的真实缺口。
- **Santosh Kumar Puppala（norviq-dev）**——以 norviq-go（Go）逐字节验证 v1.5 的 78 条 V-DO-v15 哈希向量（107/107 canonical bytes，2026-09-01）；提出 record-emission fidelity 缺口（附录 A P-05）及 PEP/缓存命中路径的真实事故案例；提出 P6 可解析集语义歧义；将 decision_divergence 界定为「bound 非 closure」。
- **Ravindra Annam**——独立技术审阅者，直指「确定性内核」宣称中最难坚守的边界——有状态算子（`within`/`rate`）。他对求值器的 review 揭示了状态突变的 `temporal_state` 证据缺口与 `total_evaluated` 计数漂移——现均已修复并由一致性向量覆盖。委托授权安全不变量（INV-01–INV-05）与相关对抗一致性向量（AV-01–AV-14）由他提出，随后在与 OpenOBA 的技术评审与协作中进一步细化与完善，并成为 OpenOBA 多 Agent 治理方向的基础。他还为委托授权 conformance 贡献了独立 Python runner（ravindra-annam-python-independent，Python 3 stdlib spec-only 独立表达式树求值器），逐字节验证 AV-01~AV-14 对抗向量（14/14）。他还贡献了首个独立 §7.1 resolution runner（PR #5）：13 条 neutral V-RESOLVE 向量（R01–R13）+ spec-only runner，其推导暴露并解决了收紧方向边界（R08/R13），现已在 §7.1 第 5 条明示。
- **Rulsynor 团队**——参考规则引擎实现，为 Decision Object 字段设计提供真实工程约束输入，是测试向量生成的基准。

## 许可证

MIT © 2026 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.)

**商标**：ERDL™ 是深圳市秒镜科技有限公司的商标。MIT 许可仅覆盖版权，
不授予任何商标权利。详见 [NOTICE.md](./NOTICE.md)。
