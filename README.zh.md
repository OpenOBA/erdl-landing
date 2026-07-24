<!--
  Copyright (c) 2026 唐启鑫 (Tang Qixin)
  Licensed under MIT. See LICENSE file.
-->

<p align="center">
  <img src="https://raw.githubusercontent.com/openoba/erdl-spec/main/assets/erdl-logo.svg" alt="ERDL Logo" width="120" />
</p>

<h1 align="center">ERDL（Entity-Rule Definition Language）</h1>

<p align="center">
  <strong>ERDL——用声明式规则代码约束 LLM 输出的执行协议。</strong>
</p>

<p align="center">
  <a href="https://github.com/OpenOBA/erdl-landing/releases"><img src="https://img.shields.io/badge/Version-1.1%20Final-blue?style=flat-square" alt="Version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/Status-v1.1%20Stable%20%7C%20Audited-success?style=flat-square" alt="Status"></a>
  <a href="#"><img src="https://img.shields.io/badge/Verification-44%20Vectors-blue?style=flat-square" alt="Vectors"></a>
</p>

<p align="center">
  <a href="#-你的怒火可曾因此而被点燃">痛点</a> •
  <a href="#-何为-erdl">何为 ERDL</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-位置">位置</a> •
  <a href="#-信任需要证明">证明</a> •
  <a href="#-设计哲学">哲学</a> •
  <a href="#-agent-市场留下的蛋糕">市场</a> •
  <a href="#-参与贡献">贡献</a>
</p>

---

## 你的怒火可曾因此而被点燃：

| 你说了 800 遍… | 它干了什么 | 根因 |
|----------------|-----------|------|
| **别用 `any`** | 十轮之后 `as any` 进生产了 | Prompt 是建议，不是约束 |
| **别跑偏** | 前 20 轮完美，第 40 轮在重构你没让碰的代码 | LLM 优化下一步，不锚定目标 |
| **等我批准** | 点头说"好的"，回头直接 push 了 | Agent 没有协议层门禁 |
| **记住这 30 条规则** | 遵守了 4 条，其余全脑补 | Token ≠ 理解，窗口 ≠ 记忆 |

**每次都说"好的，明白了"，每次都忘。** SKILL、Prompt、Markdown——你试遍了。不是你的规则写得不够好，是规则住错了地方。规则住在 LLM 的上下文窗口里，跟它正在思考的所有东西挤在一起。它当然会忘。当然会跑偏。当然会脑补。

**但 LLM 太强了，离不开。怎么办？**

把规则搬出去。不在 Prompt 里。在协议层——Agent 和外部世界的边界上。**ERDL 是代码级的规则执行协议。** 用 YAML 写 `when/then` 规则，引擎在每次工具调用前强制执行。LLM 忘不了——因为根本不在它脑子里。绕不过——因为门在它外面。

---

## 何为 ERDL

ERDL（Entity-Rule Definition Language，实体规则定义语言）：用 `when/then` 声明式结构描述规则逻辑的 YAML 句式，**取代 Prompt 和 Markdown 对 LLM 输出的约束**，实现 LLM 无法遗忘、无法绕过的确定性执行。

> 像写小学作业一样：`when(A)` + `then(B)` 就是你颁布的一条法规。规则越明确，结果质量越高、效率越有保障。

| 特性 | 含义 |
|------|------|
| 🚫 **与 LLM、框架无关** | MIT 开源协议。任何人、组织均可接入，创建专属规则集。 |
| 📋 **全链路可审计** | 每次工具调用前评估，完整哈希记录。谁、什么时候、哪条规则、什么结果——全在。不可篡改。 |
| 🎯 **执行前判，不执行后追** | 事前决定该做什么、不该做什么，给 LLM 明确的导航目标。不是事后翻日志。 |
| 📖 **一份文件，多方共识** | 用户、Agent、LLM、审计师——都能读懂同一份 YAML。人审得懂，机器执行得了。 |

```yaml
# 没有 DBA 权限？DROP TABLE 想都别想。
- name: "SEC-001-protect-prod-db"
  unless:
    conditions:
      - field: "caller.role"
        operator: eq
        value: "DBA_ADMIN"
  when:
    conditions:
      - field: "tool.name"
        operator: eq
        value: "execute_sql"
      - field: "tool.args.query"
        operator: match
        value: "(?i)DROP\\s+TABLE"
  then: DENY
  message: "DROP TABLE 已拦截。请使用 data_archive_tool 或联系 DBA。"
```

---

## 快速开始

```bash
npm install -g @openoba/erdl-engine-js
```

3 分钟写出第一条规则：

```yaml
# rules/pricing.erdl.yaml
- name: "FIN-001-max-discount"
  when:
    field: "context.discount"
    operator: gt
    value: 0.3
  then: DENY
  message: "折扣超出 30% 上限，需经理审批。"
```

验证并运行：

```bash
npx erdl-engine check ./rules/
# ✔ FIN-001-max-discount: Passed
```

**13 种运算符。17 种 Then 动作。4 级执行环。** 从 `DENY` 到 `EMERGENCY_HALT` 到 `QUARANTINE`——Agent 需要的每一种反应，声明式定义。

📄 完整规范：[English](spec/erdl-spec-v1.1.en.md) | [中文版](spec/erdl-spec-v1.1.md)

---

## 位置

```
┌──────────────────────────────────────────────────┐
│  A2A — Agent ↔ Agent 通信标准 (L8)                │  Google · Linux Foundation
├──────────────────────────────────────────────────┤
│  ERDL — Agent 行为规则描述语言 (L9)               │  Tang Qixin · MIT License
│  (MCP Server + A2A Card Extension)                │  <--- 规则层（培训/合规）
├──────────────────────────────────────────────────┤
│  MCP — Agent ↔ Tool 连接标准 (L8)                 │  Anthropic · Linux Foundation
└──────────────────────────────────────────────────┘
```

MCP 让 Agent 连接工具。A2A 让 Agent 连接 Agent。**ERDL 约束 LLM 的执行输出，让这些连接都可审计、可纠正、可追朔。** 用规则约束 LLM 的每一个执行动作，完整记录全过程——完美解决 AI 落地日常工作与企业业务中的合规环节。

---

## 信任需要证明

"我们很安全"不是信任。证明才是。ERDL 附带 **44 条验证向量**——37 条决策引擎 + 7 条审计哈希——任何实现必须逐字节通过。

### 独立验证（再次向他们致谢）

| 验证者 | 验证内容 | 通过向量 | 日期 | 结果 |
|-------------|---------|:-------:|------|--------|
| **Erik Newton** (Concordia) | 审计哈希链 | 5/5 (AV-001~AV-005) | 2026-07-14 | ✅ 逐字节一致 |
| **Christopher** (chopmob-cloud) | 合规回执 + JCS 边缘案例 | 18/18 | 2026-07 | ✅ 已验证 |

两个独立 Runner。两套不同技术栈。输出逐字节一致。这不是营销，是数学。

加入验证讨论：[A2A Discussion #2031](https://github.com/a2aproject/A2A/discussions/2031) · [#2038](https://github.com/a2aproject/A2A/discussions/2038)

> **想让你的名字出现在这里？** → [参与贡献](#-参与贡献)

---

## Agent 市场留下的蛋糕

所有人都在抢着造更聪明的 Agent。更好的模型、更快的推理、更多的工具。

**还有另一条路可走。**

Agent 市场会裂成两层：

```
┌──────────────────────────────────────────┐
│  第二层：能力                             │  拥挤。商品化。
│  "你的 Agent 能做什么？"                  │  每个模型厂商都在这里。
│  → 模型、工具、框架                       │  利润 → 零。
├──────────────────────────────────────────┤
│  第一层：规则层                           │  空的。无人占领。
│  "给 Agent 立规矩"、"出事以后谁负责？"     │  ERDL 在这里。
│  → 规则、审计、合规、保险                  │  利润 → 整块蛋糕。
└──────────────────────────────────────────┘
```

**合规不是成本中心，是护城河。** 当所有 Agent 能做同样的事，赢家不是模型最聪明的那个，而是能向监管方、向审计师、向客户**证明它不会做错事**的那个。

ERDL 就是这份证明的基础设施。而基础设施层永远比应用层捕获更多价值。问 TCP/IP。问 TLS。问 Kubernetes。

---

## 设计哲学

> *不是让 AI 更聪明，而是让规则足够清晰不产生歧义。*

主流方向是造更强的模型、更长的上下文、更复杂的推理。**ERDL 走反方向：把规则写得足够简单，简单到一个普通人也能理解，一个平庸的 LLM 也能正确执行。** 这是整个协议设计的逆向前提——不跟风造更好的 AI，而是承认 AI 有天花板，用协议补齐。

### 1. 多方易懂的语义层

ERDL 不是又一种规则语言。**它是多方共享的语义约定层**——人（领域专家）、LLM（通用模型）、系统（执行引擎）、审计（监管/合规）。同一份 YAML，人读得懂、LLM 理解得了、机器执行得了、审计追溯得了。各方不再各说各话。

### 2. 最小的核心语法设计

13 种运算符，不增加。`when/then` 声明式结构。没有递归、没有高阶函数、没有图灵完备。**小学算术水平的人就能读懂、能编写。** 核心越小，越不容易出错——越不容易出错，多方越容易达成共识。

### 3. 确定性优先

同样的规则 + 同样的输入 → 同样的输出。换模型不变。换语言不变。**三个独立 LLM 在 ERDL 格式下决策完全一致——跨模型方差为零。** 确定性的价值大于准确率：你可以调优准确率，但你不能修复不确定性。

### 4. 规则普通人可读

人类是最终决策者，也是能力最弱的参与者。**协议必须退化到人的水平，而不是让人去学协议。** ERDL 的 `when/then` 句式利用的正是人类日常沟通中已经使用的条件推理——"当 A，则 B"。不需要培训。不需要手册。

### 5. 复杂逻辑委派支持

ERDL 不做求解优化、不跑 ML 推理、不算复式账。这些属于 `fn` 注册的外部专业引擎。**协议的边界很清晰：翻译规则、导航上下文、返回决策——复杂计算委派给外部引擎。** 五个元属性（within、state、combine、override、fn）在不膨胀核心的前提下扩展覆盖。

### 6. 规则集覆盖常规需求

跨多个行业（ERP、新能源汽车 MES、银行信贷、政务审批）和五个生产级规则系统的交叉验证：**核心表达式覆盖可68-79%。** 剩余为高度专业化的外部计算可委派外部引擎。

### 7. 全链路审计追溯

每次工具调用前评估。JCS（RFC 8785）+ SHA-256 Decision Object。**谁、什么时候、哪条规则、什么结果——完整哈希链，不可篡改，可呈堂。** 两个独立 Runner 已验证逐字节一致。

### 8. 中立 MIT 开源

MIT 许可证。不与任何 LLM、框架、平台绑定。**个人、组织、企业——任何人都可以接入，创建自己的规则引擎、规则集。** 

---

## 参与贡献

ERDL 是社区驱动的中立标准——你不需要修改 SPEC 也能贡献。

| 路径 | 做什么 | 时间 | 举例 |
|------|--------|:--:|------|
| 🧩 **规则模式** | 把你领域的真实规则写成 `.erdl.yaml` | ~30 分钟 | 医疗 HIPAA、金融反洗钱、DevOps 策略 |
| 🐛 **边缘案例** | 找出向量没覆盖的场景——提 Issue | ~1 小时 | "如果 `unless` 引用的字段为空会怎样？" |
| 🔧 **独立 Runner** | 用你擅长的语言实现 ERDL 引擎 | 周末项目 | Rust、Go、Python、Java——用向量集自证 |

```bash
git clone https://github.com/OpenOBA/erdl-landing.git
cd erdl-landing
echo '# 我的领域规则' > examples/healthcare-hipaa.erdl.yaml
npx @openoba/erdl-engine-js check examples/
# → 提交 PR
```
---

## 许可证

ERDL 规范、参考实现、开发工具、验证向量：[MIT License](LICENSE) · Copyright (c) 2026 唐启鑫 (Tang Qixin)

各语言实现与工具（erdl-engine-js、erdl-engine-py、erdl-mcp-server 等）的许可证见各自仓库。

> 确定性架构，而非 Prompt 工程。
