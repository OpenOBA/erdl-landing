# ERDL 规范 v2.2
（Entity-Rule Definition Language · 实体规则定义语言）

> **状态**：v2.2 · 定稿
> **日期**：2026-09-12
> **版本语义**：本文档（ERDL 语言规范）版本为 **v2.2**；规则文件顶层 `protocol: "erdl/v2"`（协议标识，固定值）与 `version: "2.2.0"`（规则格式版本）为独立版本标识，与本文档版本互不混同。
> **作者**：唐启鑫
> **商标**：ERDL™ 是深圳市秒镜科技有限公司的商标。
> **定位**：ERDL（Entity-Rule Definition Language，实体规则定义语言）是一种以 YAML/JSON 承载的**声明式规则定义格式**，用于精确表达实体结构与行为规则。本规范**独立且中立**——仅定义格式本身，不依赖任何特定实现或上层框架；其确定性求值与规范化形式支持跨实现逐字节验证。在 ERDL 中，**规则决定一切**：规则既是语义的载体，也是执行的边界、审计的证据与治理的事实。
> **规范语言**：本文档中 **MUST / MUST NOT / SHOULD / SHOULD NOT / MAY** 按 [RFC 2119] 解释。

---

## 1. Introduction

### 1.1 ERDL 是什么

ERDL（Entity-Rule Definition Language，实体规则定义语言）是一种以 YAML/JSON 承载的**声明式规则定义格式**，用于精确表达实体结构与行为规则。它包含两类**声明**：**Entity（实体）**定义数据结构；**Rule（规则）**定义 `when → then` 决策。Entity 界定对象的结构，Rule 规定条件的后果；二者共同构成可执行、可审查、可验证的规则表达。

### 1.2 设计哲学

**ERDL 是多方语义层**：它不仅是规则格式，更是人、LLM、系统与审计四方共享的语义约定层。

| 参与方 | ERDL 的角色 |
|--------|------------|
| 人（业务/领域专家） | 自然语言规则的精确翻译结果，可读、可审 |
| LLM（通用大模型） | 结构化输入，消除歧义，支持确定性求值 |
| 系统（规则引擎） | 标准化规则描述，并以 `fn` 委派控制调用边界 |
| 审计（监管/合规） | 比代码与自然语言更清晰的可追溯规则记录 |

在这一语义层中，规则决定一切：人表达意图，LLM 翻译语义，系统执行决策，审计复核证据。ERDL 的确定性语义层为 LLM 提供明确方向：使用者以自然语言描述规则，经 ERDL 精确翻译后，由 LLM 基于结构化语义确定性执行——对话界面即为统一入口。

### 1.3 ERDL 在 AI 治理层面的价值

AI 治理的核心难题，不是模型能否给出答案，而是概率性输出如何满足监管、审计与追责所要求的确定性边界。ERDL 以 YAML/JSON 承载声明式规则，将实体结构、行为约束和处置动作固化为可验证的确定性规则层，使 AI 的「应当如何行动」从训练假设转变为可检查对象。

**从信任到验证**：传统治理依赖对齐评估或事后解释，难以证明某次具体决策遵循了哪些约束。ERDL 将约束表达为 `when → then` 规则，每次求值绑定 canonical_tree 快照与结果哈希，可独立重算、逐字节跨实现复核。治理方不再只是相信模型「被正确训练」，而是可以验证某次行为是否命中规则、命中哪条规则、为何得到该结果。

**可追责的证据链**：ERDL 求值结果可哈希、可重算，可将规则版本、输入快照、决策输出与哈希锚定形成审计记录。审计不是复述日志，而是可重现的证明过程——为何放行、为何拦截、由谁批准，均可回溯查验，避免事后解释成为唯一依据。

**机制化的人机权责边界**：ERDL 可通过 REQUEST_HUMAN、ESCALATE 等决策类型，将高风险操作、敏感实体变更、不可逆动作等强制交由人工裁决。人的最终决策权不再依赖流程口号，而是被编码为可执行、可测试、可审计的规则路径。

**合规即代码与跨组织互认**：法规、平台政策和内部红线可转写为 ERDL 规则，并通过测试向量持续验证。不同组织、不同实现或第三方审计机构可基于同一规则与规范化树独立复算，形成「信任但验证」的治理范式，使合规从声明文档变为可运行、可检查、可互认的治理事实。

### 1.4 设计目标

1. **确定性**：同一规则、同一输入，任何兼容实现 MUST 产生逐字节一致的求值结果与哈希；
2. **可读性**：任何规则可回读为自然语言（gloss），人可秒懂、可审；
3. **可审计性**：规则的求值过程可独立重算、可追溯；
4. **跨实现可验证**：语义收敛到唯一内核，通过测试向量逐字节比对证明实现合规。

### 1.5 核心承诺

> **语义载体是内核，不是语法。**
> **语义 = 树 = 哈希。** 三者在规范化形式下合一。

任何以「运算符语法」为语义载体的方案，都会因新需求而被迫线性扩张运算符，成本永不收敛。因此本规范把语义收敛到唯一的内核（表达式树），而把多种书写形态作为内核的确定性投影——它们不是各自独立的语言，而是同一语义的不同视图。**规则决定一切**：规则的有效性不取决于书写入口或实现形态，而取决于唯一、可重算、可哈希、可逐字节验证的规范化语义。

---

## 2. 文档结构

### 2.1 顶层格式

一个 ERDL 文档（`*.erdl.yaml`）由六个顶层字段构成，其中四个 MUST、两个 MAY，字段顺序 MUST 固定：

```yaml
protocol: "erdl/v2"       # 协议标识，固定值
version: "2.2.0"          # 规则格式版本
metadata: { ... }         # 文档级元数据（见 §2.2）
state: [ ... ]            # 状态空间声明（可选，见 §6a）
transitions: [ ... ]      # 状态转移规则（可选，见 §6a）
rules: [ ... ]            # 规则列表（见 §4）
```

| 顶层字段 | 类型 | 必填 | 说明 |
|---------|------|:---:|------|
| `protocol` | string | MUST | 协议标识，固定值 `"erdl/v2"` |
| `version` | string | MUST | 规则格式版本（语义化版本） |
| `metadata` | object | MUST | 文档级元数据 |
| `state` | array | MAY | 状态空间声明（§6a） |
| `transitions` | array | MAY | 状态转移规则（§6a） |
| `rules` | array | MUST | 规则列表，元素见 §4 |

### 2.2 metadata

```yaml
metadata:
  name: "my-first-rule-set"
  description: "允许读文件操作"
  category: coding
  decision: ALLOW            # 所有规则不匹配时的 fallback 决策
  tags: [example]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 规则集名称 |
| `description` | string | 规则集描述 |
| `category` | string | 规则集分类（coding/security/compliance…） |
| `decision` | string | fallback 决策（所有规则不匹配时的默认裁决，见 §6） |
| `tags` | array | 标签 |

### 2.3 格式约定

- 字符串值 MUST 双引号，枚举关键字 / 数字 / 布尔值裸词书写；
- 缩进 MUST 2 空格；
- 文件 MUST 以 `protocol: "erdl/v2"` 开头；
- 版本兼容：同一 `protocol` 大版本内，新增约束对存量规则 SHOULD Non-breaking（加载时 Warning 而非 Error）；跨大版本（如 erdl/v1 → erdl/v2）为 breaking change，不适用向后兼容承诺。例外：`when:"true"` + 拦截性 `then` 在任何版本均拒绝加载（Error）。

### 2.4 解析与求值概览

一个 ERDL 文档从文件到决策结果，走固定的五步管线。理解这条管线，即可理解 ERDL 如何被「解析」与「求值」：

| 步骤 | 动作 | 输入 → 输出 | 依据 |
|------|------|-----------|------|
| ① 加载 | 读入规则文档 | `*.erdl.yaml` → 结构化对象 | §2.1–§2.3 |
| ② 校验 | 加载时类型检查 | 结构化对象 → 合法文档（拒绝非法） | E5、§6a.2/§6a.4/§6a.7 |
| ③ 编译 | 三种书写形态归一化 | 合法文档 → 表达式树（canonical_tree） | E7、§8.2 |
| ④ 求值 | 树对输入事实逐节点判定 | 表达式树 + fact → 决策 | §7 |
| ⑤ 输出 | 生成求值证据 | 决策 → 可哈希、可重算的求值结果 | E6、§8 |

- **① 加载**：读入 `*.erdl.yaml`，按 §2.3 格式约定解析（YAML 与 JSON 等价，无损互转）。
- **② 校验**：加载时类型检查——字段顺序、必填、枚举值、`when`/`expr` 互斥、状态块校验（§6a.2/§6a.4/§6a.7）等；违规拒绝加载。
- **③ 编译**：Simple / Expression / 决策表 MUST 编译到同一表达式树（E7），生成规范化树（§8.2）。
- **④ 求值**：表达式树对输入事实逐节点判定（§7）。树是纯函数（E1）；`within`/`rate` 的状态由 `temporal_state` 受控注入，§6a 授权状态由 `state.*` 受控注入。
- **⑤ 输出**：产出决策结果，绑定 canonical_tree 快照与结果哈希（E6），可独立重算、逐字节验证。

> 输入事实（fact）与求值结果（output）的完整契约见 §7.0。

---

## 3. Entity 定义

Entity 是规则作用的主体（经 context 传递）。ERDL 预置以下 Entity 类型：

| Entity 类型 | 说明 |
|------|------|
| `agent` | 单个 Agent 实例 |
| `tool` | Agent 调用的工具 |
| `task` | Agent 执行的任务 |
| `workflow` | 多 Agent 编排流程 |
| `human` | 人类审批者 |
| `guardian` | 监管者（supervisor） |

规则中的字段引用（如 `tool.name`、`context.amount`）以 Entity 为语义命名空间。字段路径承重：字段名一旦发布即冻结 `[FREEZE-1]`，别名 MUST 先行归一化为规范名。

---

## 4. Rule 定义

Rule 是 ERDL 的核心单元：`Rule = Metadata + When（条件）+ Then（动作）+ Audit（审计）`。When 编译为表达式树（§5），Then 为决策类型（§6），Audit 记录规则求值的审计信息。

### 4.1 字段定义

`rules[]` 子字段顺序 MUST 固定为：`name` → `description` → `category` → `priority` → `override` → `ring` → `tier` → `enabled` → `when` → `gloss` → `then` → `message` → `instruction` → `correction` → `unless` → `explanation` → `alternative` → `legal_basis` → `source_text`。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `name` | string | MUST | 规则唯一标识，格式 `[CAT]-[NNN]-描述` |
| `description` | string | MUST | 人读描述 |
| `category` | string | MAY | 规则级分类；缺省继承 `metadata.category`（见 §2.2），允许同一文档内混合分类 |
| `priority` | integer | MUST | 数字越小越优先（见 §7.1） |
| `override` | string | SHOULD | 覆盖级别：critical > high > normal > low（默认 normal） |
| `ring` | integer | SHOULD | 执行环：0 内核 / 1 恢复 / 2 审批 / 3 建议 |
| `tier` | integer | MAY | 规则层级 0–5（0–2 安全底线 MUST 用 Simple，≥3 业务全景可用 Expression）；tier 只决定书写形态，不决定求值错误的折叠方向（见 E12） |
| `enabled` | boolean | MAY | 规则启用标志（默认 true）；false 时求值跳过该规则 |
| `when` | object | MUST | 触发条件（见 §5） |
| `gloss` | string | MUST | 引擎从 `when` 树渲染的自然语言可读投影（§5.5）；lint 校验 `gloss == render(树)`，禁手写；不进哈希（G4） |
| `then` | string | MUST | 决策类型（见 §6） |
| `message` | string | SHOULD | 决策消息（拦截性 then MUST 非空） |
| `instruction` | string | MAY | 建议指令（ALLOW + instruction 场景） |
| `correction` | string | MAY | 纠正文本（CORRECT 决策；求值输出的 `primary_correction` 来源，见 §7.0.3） |
| `unless` | object/null | MAY | 豁免条件块（可选） |
| `explanation` | string / object | MAY | 双语解释（规则为何存在、防止何种危害） |
| `alternative` | string / object | MAY | 被拦截时建议的替代动作 |
| `legal_basis` | string | MAY | 法规依据（条款引用） |
| `source_text` | string | MAY | 所依据法规的原文摘录 |

### 4.2 完整示例

```yaml
protocol: "erdl/v2"
version: "2.2.0"
metadata:
  name: "my-first-rule-set"
  description: "允许读文件操作"
  category: coding
  decision: ALLOW
  tags: [example]
rules:
  - name: "COD-001-allow-read"
    description: "放行 read_file 工具的所有调用"
    priority: 10
    override: high
    ring: 3
    when:
      logic: AND
      conditions:
        - field: "tool.name"
          operator: eq
          value: "read_file"
    gloss: "tool.name equals read_file"  # 引擎生成（G2），lint 校验
    then: ALLOW
    message: "read_file 调用已放行"
    unless: null
```

---

## 5. when 条件表达式

`when` 是规则的内嵌条件表达式。ERDL 提供三种**书写形态**（Simple / Expression / 决策表），任一形态编译归一化到同一语义内核（表达式树），再经渲染还原为任一形态；另有一个**可读投影** gloss（§5.5）从树确定性生成自然语言。

### 5.1 书写形态（投影面）

| 投影面 | 承载 | 适用 tier | 说明 |
|--------|------|:---:|------|
| **A · Simple** | 30 运算符 | 0–2（MUST） | 安全底线，最常用的书写形态 |
| **B · Expression** | 完整 34 节点树 | ≥3 | 业务全景：逻辑组合/量词/算术/时间/聚合 |
| **C · 决策表** | 矩阵 | — | 业务/财务人员首选，编译到同一内核 |

**tier 是规则层级（0–5）**，由低到高表示规则的约束强度与适用范围——本规范中 tier 0–2 为安全底线（MUST 用 Simple），tier ≥3 为业务全景（可用 Expression）。`when` 与 `expr` 不得共存（E5）。

### 5.2 投影面 A：Simple（30 运算符）

Simple 是保留的既有语义单元集合，**30 运算符 = 28 条件 + 2 修饰符**，一字不改。它对应系统安全规则（tier 0–2）。

#### 5.2.1 集合定义

| 族 | 数量 | 运算符 |
|----|------|--------|
| 比较 | 6 | eq · ne · gt · gte · lt · lte |
| 列表 | 2 | in · not_in |
| 字符串 | 5 | contains · not_contains · match · starts_with · ends_with |
| 边界否定 | 2 | not_starts_with · not_ends_with |
| 存在性 | 2 | exists · not_exists |
| 长度 | 5 | length_gt · length_gte · length_lt · length_lte · length_eq |
| 范围 | 2 | between · not_between |
| 计数 | 4 | count_gt · count_gte · count_lt · count_lte |
| 修饰符 | 2 | within（时间窗口）· rate（速率限制） |

#### 5.2.2 语义约定

- **严格类型匹配**：无隐式类型转换，`"100" gt 50` 恒为 false；
- **同类型有序比较**：数值用数值序，字符串用字典序（Unicode 码点序，`"2" gt "10"` 为 true）；跨类型返回 false；
- **match 大小写敏感**：默认大小写敏感，不提供内联不敏感选项；
- **between 仅数值**：闭区间 `[min,max]` 仅支持数值，非数值返回 false；
- **空值传播**：字段缺失时，除 exists/not_exists 外统一返回 false（安全失败）；
- **存在性唯一感知**：仅 exists/not_exists 区分「缺失」与「值不符」；
- **列表上限**：in/not_in 操作数 ≤256 项；
- **确定性保证**：由封闭求值内核执行，无代码注入路径；
- **宽容别名**：实现 MAY 接受 `matches` → `match`、`neq` → `ne` 两个历史别名并归一。别名不是新增运算符（仍为 30 运算符全集）；规范化形态 MUST 用规范名，别名不进树、不进哈希。不实现别名仍属合规。

#### 5.2.3 权威编译映射

**权威编译映射**：30 运算符全部有确定编译归宿，无悬空——**13 直接节点**（eq/ne/gt/gte/lt/lte·in·contains/starts_with/ends_with/match·exists·between）、**6 not 派生**（not_in/not_contains/not_starts_with/not_ends_with/not_exists/not_between）、**9 length/count 组合**（length_* 5 + count_* 4）、**2 时间修饰符**（within/rate）。

| # | Simple 运算符 | 编译归宿 | 表达式树表达 |
|:---:|------|:---:|------|
| 1-6 | `eq` `ne` `gt` `gte` `lt` `lte` | 直接节点 | 比较节点 |
| 7 | `in` | 直接节点 | 集合节点 in |
| 8 | `not_in` | not + exists 守卫 | `exists(field) AND not(in(...))` |
| 9-12 | `contains` `starts_with` `ends_with` `match` | 直接节点 | 字符串节点 |
| 13 | `not_contains` | not + exists 守卫 | `exists(field) AND not(contains(...))` |
| 14-15 | `not_starts_with` `not_ends_with` | not + exists 守卫 | `exists(field) AND not(...)` |
| 16 | `exists` | 直接节点 | 存在节点（值非 `null` 且非 `undefined`；空字符串 `""`、`0`、`false` 均视为「存在」——「存在」≠「非空字符串」） |
| 17 | `not_exists` | not 组合 | `not(exists(...))` |
| 18-22 | `length_gt/gte/lt/lte/eq` | 组合 + exists 守卫 | `exists(field) AND length(field) 比较 n` |
| 23 | `between` | 直接节点 | 范围节点（仅数值） |
| 24 | `not_between` | not + exists 守卫 | `exists(field) AND not(between(...))` |
| 25-28 | `count_gt/gte/lt/lte` | 组合 + exists 守卫 | `exists(field) AND aggregate(count(...)) 比较 n` |
| 29 | `within` | 时间修饰 | 时间窗口（as_of 由引擎注入） |
| 30 | `rate` | 时间修饰 + 聚合 | 速率限制（temporal_state） |

#### 5.2.4 exists 守卫（E11 编译层保障）

**exists 守卫（E11 空值传播的编译层保障）**：`not_*`（除 `not_exists`）与 `length_*`/`count_*` 组合派生 MUST 编译为 `exists(field) AND <派生表达式>`，而非裸 `not(正向算子)` 或裸 `length/count(...) 比较`。原因：正向算子对缺失字段返回 false、`length(缺失)` 返回 0，若直接 `not` 翻转或数值比较，空值传播被破坏（fail-open）。`not_exists` 是唯一例外——语义即「感知字段缺失」，保持裸 `not(exists(...))`。

#### 5.2.5 有状态算子（within/rate）

**有状态算子（within/rate）**：`within` 与 `rate` 是仅有的两个有状态算子，其求值依赖跨决策的滑动窗口内计数。这一状态不存储在表达式树节点中，而由独立的 Guard 状态管理器维护，以 `temporal_state` 字段进入审计记录——表达式树本身仍是纯函数（E1 成立），状态源可审计、可重算。

**有状态算子真值语义（MUST）**：计数达阈值 → 条件成立（触发）；未达阈值 → 记录本次事件并返回 false（放行）。

| 算子 | 阈值 | 首次/未超限 | 达阈值后 |
|---|---|---|---|
| `rate: "N/窗口"` | N | 前 N 次：record + false | 第 N+1 次起：true |
| `within: "窗口"` | 1 | 首次：record + false | 窗口内第 2 次起：true（去重） |

配套约束（均 MUST）：① 计数后置（仅当正向条件成立才计数）；② 计数隔离键（`within` 以 `field+operator+value` 为键，`rate` 以 `field+operator+value+rate` 为键）；③ record 时机在「未超限」分支写入。

### 5.3 投影面 B：Expression（34 节点树）

#### 5.3.1 节点集（34 节点，10 组）

Expression 开放完整内核表达力，面向复杂业务规则（tier ≥3）。语义内核是一棵**类型化表达式树**，由 **34 个节点**构成（归为 **10 组**），节点集冻结于 `[FREEZE-2]`：

| 组 | 节点 | 语义能力 |
|----|------|---------|
| 取值 | field · var · 字面量 | 引用字段、上下文变量、常量（`var` 仅 `$`/`$.path`，禁读时钟与随机） |
| 逻辑 | and · or · not | 组合关系 |
| 比较 | eq · ne · gt · gte · lt · lte | 操作数可为字段、变量、字面量或算术子树 |
| 集合 | in | 标量属于集合 |
| 字符串 | contains · match · starts_with · ends_with | 模式匹配；match 走安全正则 |
| 存在/量纲 | exists · length · between | 存在性、长度（Unicode 码点）、闭区间 |
| 量词 | all · any · none | 数组逐元素判定；空数组一律 false |
| 算术 | add · sub · mul · div · round | 定点小数确定性运算 |
| 时间 | days_between · epoch_ms · date_add · date_part · month_last_day | 日期差、时间戳、日期推演、分量提取、月末取日 |
| 聚合 | aggregate（count/sum/avg/min/max） | 数组聚合 |

> 节点总数：取值 3 + 逻辑 3 + 比较 6 + 集合 1 + 字符串 4 + 存在/量纲 3 + 量词 3 + 算术 5 + 时间 5 + 聚合 1 = **34**。「比较」6 运算符、「字符串」4 运算符、「算术」5 运算符、「量词」3 种类、「聚合」5 函数在实现中分别以参数化节点类型承载，故「34 个语义节点」在代码中映射为更少的类型字面量——二者是语义节点与类型投影的关系，非数量矛盾。

#### 5.3.2 表达式书写示例

**表达式书写示例**：

```yaml
when:
  expr:
    lt:
      - div:
          - sub: [{ field: "tool.args.price" }, { field: "context.cost" }]
          - field: "tool.args.price"
      - 0.15
```

### 5.4 投影面 C：决策表（矩阵形态）

#### 5.4.1 结构与示例

决策表面向业务与财务人员，以行列结构表达多条件组合，编译到同一内核：

```yaml
kind: decision_table
columns:
  - field: "context.amount"
    label: "申请金额"
rows:
  - when: [["gte", 10000]]
    then: "REQUEST_HUMAN"
    priority: 100
  - when: [["gte", 5000]]
    then: "ESCALATE"
    priority: 90
  - when: []                       # 默认行（无条件命中，兜底）
    then: "ALLOW"
    priority: 1
```

#### 5.4.2 编译规则（E7）

编译规则（E7）：① 每行 `when` 条件组按字段列序编译为逻辑与（`and`），条件单元编译为比较节点；② 行序即优先级（自上而下首个命中，与 `priority` 一致，二者 MUST 不冲突）；③ 默认行 `when: []` 编译为字面量 `true`；④ `then` 值 MUST 属于 §6 决策类型枚举；⑤ 编译后产生与手写 Simple/Expression 相同的表达式树。

### 5.5 投影面 D：gloss（自然语言可读投影）

gloss 是从树**确定性生成**的自然语言表述：

```yaml
gloss: "当（售价 减 成本）除以 售价 小于 15% 时，需人工审批"   # 引擎生成，lint 强制一致
```

#### 5.5.1 五条不变量（G1–G5）

**五条不变量（全部 MUST）**：

| # | 不变量 |
|---|--------|
| G1 | gloss = render(树)：由冻结渲染模板确定性生成 |
| G2 | 每条规则与每条转移规则 MUST 携带 gloss，lint 校验 `gloss == render(树)`，禁手写 |
| G3 | gloss 禁原始字段路径，MUST 用 Entity 的 display_name（中英双语字段，gloss 取英文值；`event.*` payload 键除外，见 §5.5） |
| G4 | gloss 为渲染产物（不进哈希），展示时实时 `render(树)` 呈现 |
| G5 | Simple 规则同样生成 gloss（编译为树后渲染）——阅读层不分层 |

#### 5.5.2 渲染模板（逐节点）

**gloss 渲染模板**（逐节点，**英文为 canonical**；中文模板为展示层可选投影，不参与跨实现验证；`{A}`/`{B}`/`{C}` 为子表达式递归渲染结果）：

| 节点 | 中文模板 | English template |
|------|---------|------------------|
| `field` | `{field}` | `{field}` |
| `var` | `$ 或路径` | `$ or path` |
| `literal` | `{value}` | `{value}` |
| `and` | `{A} 且 {B}` | `{A} and {B}` |
| `or` | `{A} 或 {B}` | `{A} or {B}` |
| `not` | `非（{A}）` | `not ({A})` |
| `eq` | `{A} 等于 {B}` | `{A} equals {B}` |
| `ne` | `{A} 不等于 {B}` | `{A} does not equal {B}` |
| `gt` | `{A} 大于 {B}` | `{A} is greater than {B}` |
| `gte` | `{A} 大于等于 {B}` | `{A} is greater than or equal to {B}` |
| `lt` | `{A} 小于 {B}` | `{A} is less than {B}` |
| `lte` | `{A} 小于等于 {B}` | `{A} is less than or equal to {B}` |
| `in` | `{A} 在 {B} 中` | `{A} in {B}` |
| `contains` | `{A} 包含 {B}` | `{A} contains {B}` |
| `match` | `{A} 匹配 {B}` | `{A} matches {B}` |
| `starts_with` | `{A} 以 {B} 开头` | `{A} starts with {B}` |
| `ends_with` | `{A} 以 {B} 结尾` | `{A} ends with {B}` |
| `exists` | `{A} 已发生` | `{A} exists` |
| `length` | `{A} 的长度` | `length of {A}` |
| `between` | `{A} 在闭区间 {B} 到 {C}（含两端）` | `{A} is in the inclusive range {B} to {C}` |
| `all` | `{A} 中所有元素满足「{B}」` | `all elements in {A} satisfy "{B}"` |
| `any` | `{A} 中至少一个元素满足「{B}」` | `at least one element in {A} satisfy "{B}"` |
| `none` | `{A} 中没有元素满足「{B}」` | `no elements in {A} satisfy "{B}"` |
| `add` | `{A} 加 {B}` | `{A} plus {B}` |
| `sub` | `{A} 减 {B}` | `{A} minus {B}` |
| `mul` | `{A} 乘 {B}` | `{A} times {B}` |
| `div` | `{A} 除以 {B}` | `{A} divided by {B}` |
| `round` | `{A} 四舍五入` | `{A} rounded` |
| `days_between` | `{A} 与 {B} 之间的天数` | `days between {A} and {B}` |
| `epoch_ms` | `{A} 的时间戳` | `epoch ms of {A}` |
| `date_add` | `{A} 加 {B} {unit}` | `{A} plus {B} {unit}` |
| `date_part` | `{A} 的 {part}` | `{part} of {A}` |
| `month_last_day` | `{A} 所在月的最后一日` | `the last day of the month of {A}` |
| `aggregate(count)` | `{A} 的元素个数` | `count of {A}` |
| `aggregate(sum)` | `{A} 之和` | `sum of {A}` |
| `aggregate(avg)` | `{A} 的平均值` | `average of {A}` |
| `aggregate(min)` | `{A} 的最小值` | `minimum of {A}` |
| `aggregate(max)` | `{A} 的最大值` | `maximum of {A}` |

#### 5.5.3 特殊渲染规则

> **state.* 的 gloss 渲染（G3）**：路径首段为 `state` 的 field 节点，渲染 `state.<name>` 的 `display_name`（`en`，G3，§6a.1），缺省回退状态变量名；`exists` 布尔特例**不适用**于状态字段（状态枚举值非布尔，`exists(state.x)` 恒为「变量已声明且始终有值」语义，不因枚举值而变）。

> **event.* 的 gloss 渲染（G3）**：路径首段为 `event` 的 field 节点（仅出现在 `transitions[].when`，§6a.7），其四个保留字段渲染固定英文可读名：`event.event_id` → event id、`event.on` → event name、`event.actor` → event actor、`event.at` → event time；payload 键 `event.<key>` 无 display_name，渲染时直接用键名（裸路径）。

> **`exists` 布尔字段特例**：当字段名匹配 `is_*`/`has_*`（布尔字段约定）时，`exists` 渲染为 `{A} 为"是"`（中文）/ `{A} is true`（英文），而非 `{A} 已发生`/`{A} exists`——布尔字段存在即真，避免「是否已告知 已发生」这类别扭表达。

> **gloss 渲染细节（跨实现须精确复现）**：
> - `not(eq({A},{B}))` **规范化**为 `ne` 模板（`{A} does not equal {B}`），而非字面嵌套 `not ({A} equals {B})`；
> - 字符串字面量**带引号**渲染（`"rm"`），list 字面量的字符串成员带引号（`["a", "b"]`）；
> - 算术节点（`add`/`sub`/`mul`/`div`）**带括号**渲染（`(a plus b)`），以在自然语言阅读中保留运算符优先级。

---

## 6. then 决策类型

`then` 的值 MUST 属于以下 13 种决策类型：

| # | 决策类型 | 语义 |
|---|---------|------|
| 1 | ALLOW | 放行 |
| 2 | DENY | 拦截 |
| 3 | CORRECT | 纠正偏差 |
| 4 | NOTIFY | 通知 |
| 5 | REQUEST_HUMAN | 请求人工裁决 |
| 6 | ESCALATE | 升级 |
| 7 | DELEGATE | 委派 |
| 8 | DEFER | 延期 |
| 9 | EMERGENCY_HALT | 紧急停止 |
| 10 | ROLLBACK | 回滚 |
| 11 | QUARANTINE | 隔离 |
| 12 | WORKFLOW | 工作流（状态机；子态 WORKFLOW_WAITING / WORKFLOW_PROGRESS；**注意：与 §6a 授权状态机不同**） |
| 13 | GUIDE | 引导 |

**为什么定义 13 种决策类型（设计说明）**：

传统 IT 的规则引擎与访问控制，决策是**二元**的——ALLOW（放行）或 DENY（拒绝）。它假设决策者是「系统」，系统只需回答「放行还是拒绝」。

但 AI 时代的决策对象是一个**有理解力、却不完全可靠**的 LLM。面对 LLM 的产出，简单的「拒绝」是**放弃**——它丢弃了 LLM 已完成的全部工作，也放弃了「纠正一次、继续前进」的可能。本规范的设计思想是：**确定性规则不是为了拒绝 LLM，而是为了把 LLM 的价值发挥到最大，同时守住安全底线。**

13 种决策类型正是这一思想的展开，分为五类：

| 类别 | 决策类型 | 含义 |
|------|---------|------|
| 放行与拦截 | ALLOW / DENY | 二元底线：明确安全就放行，明确越界就拦截 |
| 引导而非放弃 | CORRECT / GUIDE | LLM 产出有偏差时，纠正或引导它回到正确方向，而不是丢弃整个产出 |
| 人机协同 | REQUEST_HUMAN / ESCALATE / DELEGATE / DEFER | 不确定时引入人工裁决、升级、委派或延期，把「机器搞不定」交给「人或流程」 |
| 安全兜底 | EMERGENCY_HALT / ROLLBACK / QUARANTINE | 危险时果断干预：紧急停止、回滚已发生的副作用、隔离可疑对象 |
| 过程性 | NOTIFY / WORKFLOW | 通知（记录而不阻断）、工作流（进入多步骤状态机） |

一句话：**传统 IT 问「放行还是拒绝」，ERDL 问「如何让 LLM 在受控中做得更好」。** DENY 是最后的手段，而非唯一的手段。

---

## 6a. 状态块与状态转移（受控状态源）

委托授权、撤销、审批流等会话级状态需要显式声明。本节定义**状态空间**（`state`）与**状态转移规则**（`transitions`），把 §5.2 的 within/rate「树外计数状态」泛化为**命名授权状态**。状态本体由引擎维护（表达式树内核之外），表达式树内核（34 节点）**不新增节点**——状态经 `state.*` 受控注入只读访问。

**硬边界**：状态层是有限状态机（FSM），不是图灵机。状态空间 MUST 有限（枚举 + 资源上限），拒绝任意长度历史、递归、下推栈。超过 FSM 的表达（事件溯源）一律不进入引擎。

**分层边界（单实例）**：状态变量是**文档实例级单键**——一个状态变量在当前 ERDL 文档实例内持有单一值。per-实体/per-授权关系的多实例状态（如 P→A 与 A→B 的授权各需一个状态），由组织层为每个关系实例化一个文档承载，**超出本节范围**（§0 分层：组织层消费 ERDL 原语，本状态块是单实例 FSM 的原语）。

### 6a.1 状态空间声明（state）

```yaml
state:
  - name: authorization          # 状态变量名，文档内唯一
    values: [authorized, revoked]  # 枚举值（2–4 个字符串，值内唯一）
    initial: authorized          # 初始状态（MUST 属于 values）
    display_name: { zh: 授权状态, en: authorization state }  # 可选，gloss 可读名（G3）
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `name` | string | MUST | 状态变量名：非空字符串，MUST NOT 含 `.`（避免与 field 点路径解析冲突），MUST NOT 为保留字 `state`，文档内 MUST 唯一；`state.<name>` 命名空间 |
| `values` | array | MUST | 枚举值列表：2–4 个非空字符串，MUST NOT 含 `.`，值内 MUST 唯一；字符串 MUST NFC 规范化（E10）后参与比较 |
| `initial` | string | MUST | 初始状态，MUST 是 `values` 之一 |
| `display_name` | object | MAY | 双语可读名 `{ zh, en }`（同 Entity 约定，G3）；gloss 渲染 `state.<name>` 取 `en` 值，缺省回退 `name` |

> 状态变量在文档加载时即以 `initial` 初始化，**始终有值**——不存在「运行时缺失」。需要表达「授权尚未建立」（unavailable）时，MUST 在 `values` 中显式声明一个哨兵值（如 `unestablished`），并以其为 `initial`，而非依赖空值传播。

### 6a.2 状态转移规则（transitions）

转移规则是状态机的 **F（转移函数）**，确定性、仅由事件触发：

`transitions[]` 子字段顺序 MUST 固定为：`on` → `name` → `audit_as` → `reason` → `enabled` → `when` → `gloss` → `set`（`name` 为可选字段，MAY，格式同 §4.1；`gloss` 为渲染产物，MUST，见下方 gloss 条款）。

```yaml
transitions:
  - on: revoke                  # 触发事件名（受控注入的唯一入口）
    name: "TR-001-revoke"       # 可选，规则标识（格式同 §4.1）
    audit_as: DELEGATE          # 审计承载（仅审计，不参与求值/短路）
    reason: revoke              # 转移语义标识（区分委派与撤销）
    enabled: true               # 启用标志（默认 true）
    when: { ... }               # 可选守卫（表达式树，只读 state.* 与 event.*，不读自由 fact）
    set:
      authorization: revoked    # 状态转移：state.authorization ← revoked
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `on` | string | MUST | 触发事件名（受控注入，见 §6a.3）；MUST 匹配 `[a-z][a-z0-9_]{0,31}`（事件名进审计与哈希，自由 Unicode 徒增规范化负担） |
| `name` | string | MAY | 转移规则标识（格式同 §4.1 的 `[CAT]-[NNN]-描述`）；缺省时错误归因用 `(on, reason, 定义序号)` |
| `audit_as` | string | MUST | **审计承载**（仅审计，见 §6a.5）：取值收窄为 `{ALLOW, NOTIFY, DELEGATE, ESCALATE, REQUEST_HUMAN}`，MUST NOT 取拦截性类型（DENY/EMERGENCY_HALT 等）；**不参与** §7.0.2 求值、不触发任何短路 |
| `reason` | string | SHOULD | 转移语义标识（如 `revoke`）；MUST 匹配 `[a-z][a-z0-9_]{0,31}`，同文档内 SHOULD 唯一（lint） |
| `enabled` | boolean | MAY | 启用标志（默认 true）；false 时该转移规则不参与事件处理（灰度/应急关闭，免改文档） |
| `when` | object | MAY | 守卫条件（编译为表达式树，只读 `state.*` 与 `event.*`，MUST NOT 读自由 fact，见 §6a.7） |
| `gloss` | string | MUST | 引擎从 `when` 树渲染的自然语言可读投影（§5.5）；lint 校验 `gloss == render(树)`，禁手写；不进哈希（G4） |
| `set` | object | MUST | 状态转移映射；键是状态变量名，值 MUST 是该变量 `values` 之一 |

> **transitions 的 gloss（G2，MUST）**：`transitions[].when` 同 `rules[].when`，其守卫表达式树同样由引擎渲染 gloss（§5.5），lint 校验 `gloss == render(树)`，禁手写；`state.*`/`event.*` 的渲染见 §5.5。转移规则的 gloss 仅作用于**审计可读性**（不进哈希，同 G4），不改变求值语义。

#### 6a.2.1 转移语义

- **事件处理原子性（MUST）**：一次 `on` 事件为**原子事务**——守卫按 `transitions` 定义顺序逐条求值（同一事件前快照）；**遇到第一个 EvaluationError 即停止**，**不执行任何 `set`**（fail-closed），记 `transition_error` 审计事件，其 `error` 记**该条（第一个出错的）规则**的错误，`errored=true` 口径同 E3；type_mismatch 类 warning 仅按 §7.3(a) 折叠语义处理（`errored=false`、非错误、**不停止**求值），但**不记录**——转移审计记录无 warnings 字段（§6a.5）；全部守卫通过后，**一次性提交**全部 `set`。

#### 6a.2.2 守卫约束

- **守卫禁有状态算子（MUST）**：`transitions[].when` MUST NOT 使用 `within`/`rate`（加载时 Error）——转移求值无副作用计数，与「转移不产生计数」的纯性一致，避免「事件是否计一次数」的歧义。
- **守卫节点白名单与错误折叠（MUST）**：`transitions[].when` 的节点集 MUST 为：Simple 条件运算符（§5.2 的 28 条件运算符）+ 逻辑节点（`and`/`or`/`not`）+ 时间节点（`epoch_ms`/`days_between`/`date_add`/`date_part`/`month_last_day`，供新鲜度时间比较，§6a.7）+ `field`/`literal`；MUST NOT 使用：量词（`all`/`any`/`none`）、算术（`add`/`sub`/`mul`/`div`/`round`）、聚合（`count`/`sum`/`avg`/`min`/`max`）、`fn`（函数委派）、`within`/`rate`（有状态算子）。其中 `fn` 本就不在转移守卫可编译范围内（Grade C 兜底，非内核），此禁为**显式防御**，避免实现者误将 fn 引入守卫。资源上限按 E4 Grade A 配额（算术深度≤2 / 树深≤6 / 节点≤64）；转移守卫求值错误**不适用** E12 分 tier 折叠，一律按 §6a.2 原子 fail-closed（EvaluationError → 不提交任何 set，§6a.5）。
- **守卫读转移前状态**：`when` 中 `state.*` 读的是**事件到达时刻的状态快照**（即本事件所有转移生效前的状态），不是转移后的中间态——保证守卫判定与转移结果解耦、确定性。
- **单事件内执行顺序不影响结果**：多条转移的执行顺序 MUST NOT 影响结果（快照语义保证），实现 MUST NOT 依赖 `transitions` 定义顺序。
- 转移规则只在「事件到达」时执行，不在规则求值（`evaluate`）时执行——两者分离，避免求值产生副作用。
- **事件处理时机与顺序（eager，MUST）**：
  - **eager**：事件在**到达时即处理**（获取文档实例锁，§6a.5），不得延迟到下一次 `evaluate()`；`evaluate()` 与事件处理在实例锁下互斥，故 `evaluate()` 启动时所读 `state.*` 必为「全部已到达事件提交之后」的状态；
  - **顺序**：实例内事件按到达顺序 **FIFO** 处理；同一 `event_id` 重复到达只处理一次，重复项丢弃并记**链外日志**（不进哈希链）；
  - **无匹配转移的事件**：不改变状态、不生成审计记录、不递增 `state_version`（确定性静默丢弃）。

#### 6a.2.3 同变量冲突检查（可判定、sound）

- **同变量冲突检查（可判定、sound，MUST）**：同一 `(on, 状态变量)` 下，对同一状态变量 `set` 到**不同值**的多条 `enabled` 转移规则构成确定性冲突。加载器 MUST 完成以下确定性检查，宁拒勿纵（`set` 到**相同值**的规则幂等，不构成冲突，免检查）：
  - (0) 若存在无条件规则（`when` 省略，或编译产物为字面量 `true` 节点——实现 MUST NOT 做超出字面量的常量折叠，避免跨实现分歧），则其 MUST 是该 `(on, 状态变量)` 下唯一规则；与其他任何规则共存即 Error；
  - (1) 否则全部规则两两互斥证明，**仅顶层合取项可作证明依据**：Simple 形态 = `logic: AND` 的 `conditions` 元素（单条件时即顶层合取项）；expr 形态 = 顶层 `and` 节点的直接子节点；嵌套于 `or`/`not` 下的条件一律不得作为证明依据（视为不可证明）；**精度规则（MUST）**：Simple 形态 `logic: OR` 时，整个条件组视为**单个顶层合取项**（OR 的子条件不构成合取项），因它不是 `eq` 合取项，两两证明一律落入 (3) 视为不可证明——除非 `set` 同值（幂等免检查）；
  - (2) 可证明互斥的情形仅限：(a) 两条规则均有对同一 `state.<v>` 的顶层 `eq` 合取项且常量不同；(b) 两条规则均有同一字段的顶层 `eq`/`in` 合取项且常量集合交集为空（`eq` 视为单元素集合）；
  - (3) 其余组合一律视为不可证明 → Error，要求作者拆分事件名或状态变量；
  - (4) `enabled: false` 的规则不参与检查（运行时亦不生效），但与 `enabled` 规则冲突时 lint SHOULD 警告——否则 enable 瞬间即违规。
  - 配合 `transitions` 数量上限（§6a.4），两两检查为 O(n²) 有界开销。

#### 6a.2.4 一致性校验与加载时校验

- **同事件 `audit_as` 一致性（可判定，MUST）**：同一 `on` 事件名下的全部 `enabled` 转移规则，其 `audit_as` MUST 相同（同一事件类型 = 同一审计姿态）；不一致即加载时 Error。依据：成功转移记录以「事件」为粒度（§6a.5）——一个事件 = 一条记录、一个 `audit_as` 位；若同事件内各规则 `audit_as` 不同，记录无法唯一取值，两个实现会给出不同答案，构成审计链分叉。`enabled: false` 的规则不参与检查，但与 `enabled` 规则 `audit_as` 不同时 lint SHOULD 警告。
- `set` 的值 MUST 属于该变量的 `values`；转移方向（如 `authorized → revoked`）由 `values` 枚举 + `set` 声明共同决定，引擎只执行声明的转移，不推断未声明的转移（fail-closed）。
- **引用未声明的状态变量（加载时校验全集，MUST）**：以下情况均在加载时拒绝（Error）——不是求值时的空值传播：
  - (a) 文档**任意表达式位置**（`rules[].when`、`rules[].unless`、`transitions[].when`、决策表单元、`transitions[].set` 的键）引用 `state.<name>` 且 `<name>` 未在 `state` 声明；
  - (b) field 路径恰为 `"state"`（无路径段）——单独 `state` 无状态变量名，无法解析，拒绝；
  - (c) `transitions[].when` 引用自由 fact（§6a.7）；
  - (d) `rules[].when` / `rules[].unless` / 决策表单元引用 `event.*`——`event` 命名空间仅存在于转移求值上下文（§6a.7），规则求值（§7.0.2）中无当前事件；引用即加载时 Error（否则按 E11 恒 false 静默死规则，正是 E11 要防的 fail-silent）。

### 6a.3 状态受控注入（安全基石）

- 状态变量是**受控注入**：只能由 `transitions` 的 `set` 更新，外部（fact / 调用方）不能直接写。
- 求值时，状态经 `state.<name>` 命名空间只读注入 context——与 fact 字段严格隔离（fact 外部可写，state 引擎持有）。
- **状态作用域（MUST）**：仅当字段路径**首段为 `state`** 时进入受控状态命名空间（如 `state.authorization`）。`context.state.*`、`tool.state.*` 等首段非 `state` 的路径仍按 fact 解析——但 lint SHOULD 警告，避免审阅者误判。
- `state` 是保留命名空间：fact 顶层字段 MUST NOT 使用 `state` 作为键，避免与状态快照冲突；field 路径恰为 `"state"`（无路径段）是加载时错误（§6a.2）。
- 表达式树内核**不新增节点**：`state.<name>` 复用现有 `field` 节点（resolveField 时 `state.` 前缀走受控状态读取）。
- 状态变量始终有值（§6a.1 `initial` 保证），不存在「缺失」语义；引用未声明的状态变量是加载时错误（§6a.2）。
- **求值语义锚定（MUST）**：`state.*` 的求值语义与 fact 字段**完全一致**（§7.3 全部适用）——`gt`/`between`/`length` 等对状态值的判定与对 fact 字段相同：`length(state.x)` 对枚举字符串按码点长度，`between` 对非数值恒 false，字符串比较走 E10 码点序。唯一差异：声明变量**不存在缺失**（E11 永不触发）。
- 这保证 fail-closed：撤销状态无法被外部「删字段」绕过——与 `as_of`/`temporal_state` 同一受控注入机制（E1）。

### 6a.4 资源上限（防膨胀）

状态空间 MUST 有限，超限拒绝加载（Error）：

| 维度 | 上限 | 依据 |
|------|:---:|------|
| 状态变量数（`state` 数组长度） | ≤ 4 | 授权/新鲜度/审批/任务 四类常见状态 |
| 单个状态变量 `values` 枚举值 | 2–4 | 撤销 2 态（valid/revoked）、授权/审批/任务最多 3–4 态 |
| 状态组合空间（∏ values 长度） | ≤ 4⁴ = 256 | 防组合爆炸 |
| 转移规则数（`transitions` 数组长度）/ 文档 | ≤ 32 | 约束两两互斥检查（§6a.2）为 O(n²) 有界开销 |
| distinct `on` 事件名数 | ≤ 16 | 事件名空间有限，防无限膨胀 |
| 事件 `payload` | ≤ 8 键 / 深度 ≤ 2 / 单值 ≤ 256B | 受控负载，防大负载（§6a.7） |

> 委托链深度（per-实体多实例的 hop 数）属组织层约束，不属单实例 FSM 状态空间维度，不在本节资源上限内（§6a 分层边界）。

### 6a.5 状态转移审计闭环

状态在内核外 ≠ 状态不可审计。审计靠三环闭合 + 密码学链接环，缺一不可：

| 环 | 审计什么 | 机制 |
|---|---|---|
| ① 转移链 | 状态从 authorized→revoked 的每一步 | 转移事件 = 转移审计记录（`audit_as` 映射到 §6a.2 收窄取值），走 `previous_hash` 串行锚定 |
| ② 快照 | 求值时读到的状态值 | `state_snapshot` 进 DO，进哈希原像（§7.0.3） |
| ③ 合法性 | 只有转移规则能改状态，方向合法 | 引擎验证转移（fail-closed），未声明的转移不执行 |

#### 6a.5.1 `state_snapshot` 结构

**`state_snapshot` 结构（出处锚定，MUST）**：`state_snapshot` 为：

```
{ values: { <状态变量名>: <值> },      # 本次求值实际读到的状态变量（on-demand，非全量）
  state_version: <uint>,               # 初始为 0（即 genesis）；每个成功提交的事件事务 +1
  transitions_head: <hash> }           # 最近一次成功改变状态的审计记录的哈希；初始为 genesis 哈希
```

三者一并进 DO 哈希原像（§7.0.3）。`state_version` 与 `transitions_head` 把快照**锚定到转移链**：

- **state_version 计数单位（MUST）**：每个**成功提交的事件事务** +1——同一事件内多条 `set` 合并为一次递增；初始为 0（即 genesis）。
- **transitions_head 定义（MUST）**：为「最近一次**成功改变状态**的审计记录」的哈希，初始为 genesis 哈希；**无 null 分支**。
- **transition_error 记录的链位置**：`transition_error` 记录（EvaluationError 时，§6a.2）沿 `previous_hash` **链接入链**（保证链完整），但**不应用 set、不递增 state_version、不移动 transitions_head**。

#### 6a.5.2 重放验证

- **重放验证（MUST）**：**第 0 步（起点校验）**——验证者 MUST 先按 §6a.5 `doc_tree_hash` 定义重算目标文档的文档级哈希，与链上 genesis 记录的 `doc_tree_hash` 比对，不一致即判定该链不属于本文档（拒绝，防跨文档链移植）；**第 1 步（遍历）**——从 genesis 沿 `previous_hash` 遍历全链，对成功记录应用其 `set` 并递增计数；当计数 == `state_version` 时，重放得到的**全状态**中，凡 `state_snapshot.values` 里出现的状态变量，其值 MUST 等于 `values[变量]`，且当前记录哈希 MUST 等于 `transitions_head`；`error` 记录仅遍历、不应用、不计数。

#### 6a.5.3 `state_snapshot` 序列化规范化

- `values` 的键按**状态变量名 UTF-8 码点升序**排列，序列化为 JSON object；
- 字符串值 NFC 规范化（E10）；
- DO 哈希原像的字段序 MUST 固定——并列清单（含 `temporal_state`、`state_snapshot`、`canonical_trees` 的先后次序）见 §8.2a。

两个实现若键序、编码、字段序任一不同，会算出不同 DO 哈希，违背「语义=树=哈希」的核心承诺——故三者 MUST 规范化。

#### 6a.5.4 事件注入认证

**事件注入认证（MUST）**：事件注入 MUST 经引擎认证——`actor` 身份（§6a.7）进转移审计记录；未认证事件 MUST 拒绝（fail-closed）。任意调用方不得注入 `revoke`/`authorize` 事件。

> **audit_as 不构成人工批准证据**：`audit_as` 仅是审计标签，不携带任何批准证明；攻击者可注入 `actor: human-1` 的伪造事件。人工批准的唯一可审计形态 = 认证身份层以 human 身份注入事件（`actor` 进链）——`audit_as: REQUEST_HUMAN` 不意味「本条转移即人工批准」。

#### 6a.5.5 三类审计记录

**成功转移记录（链上一等记录，MUST）**：成功提交 `set` 的转移生成一条成功转移记录，格式为：

```
{ type: "transition", event_id, on, actor, at, audit_as, set, state_version, previous_hash }
```

- `type` 固定为 `"transition"`；
- `audit_as` = 该 `on` 事件统一的审计承载值（§6a.2 收窄取值 + 同事件一致性校验），进哈希原像；
- `set` = 本事务全部规则 `set` 的合并映射 `{ <状态变量名>: <值> }`，键按状态变量名 UTF-8 码点升序（同变量同值幂等合并已在冲突检查中保证无歧义）；
- `state_version` = 本次事务提交后的版本号（= 上一版本 +1）；
- `previous_hash` = 链上前一条记录（genesis 或更早的 transition/transition_error）的哈希；
- 完整字段序与固定键集见 §8.2a。

**transition_error 记录（链上一等记录，MUST）**：`transition_error`（EvaluationError 时，§6a.2）为链上一等记录，格式为：

```
{ type: "transition_error", event_id, on, actor, at, audit_as, error, errored: true, previous_hash }
```

- `audit_as` = 该 `on` 事件统一的审计承载值（§6a.2 收窄取值 + 同事件一致性校验）；
- `error` = 第一个（按 `transitions` 定义顺序）EvaluationError 的规则的错误描述（§6a.2 事件处理原子性：遇到第一个即停止）；
- 入链：沿 `previous_hash` 链接入链（保链完整）；
- 不应用 `set`、不移动 `transitions_head`、不递增 `state_version`（口径同 P0-4 重放验证）；
- 无 `set`/`state_version` 字段，`errored` 恒为 `true`；完整字段序与固定键集见 §8.2a。

> **守卫 warning 不记录（MUST）**：转移守卫的 type_mismatch warning 仅影响求值折叠（§7.3(a)，`errored=false`），**不记录**——成功/错误转移记录均无 warnings 字段；守卫的审计重点是转移结果（`set` 是否提交），非求值过程警告。

**被拒事件落点（MUST，链内链外分离）**：未认证、重复 `event_id`、超资源上限的事件 MUST NOT 进入哈希链；在**链外审计存储**中记录（`actor` 若已知、事件名、`event_id`、拒绝原因，内容消毒后落盘）——**链内只留可信记录，链外留入侵痕迹**。这保证：审计员在链内看到的是可信状态转移全史，在链外看到注入尝试 / 重放 / 超限攻击痕迹，两者互不污染。

**genesis 记录（MUST）**：文档加载时 MUST 为 `initial` 生成 genesis 审计记录（initial 快照 + 文档规范树哈希）。这是转移链 ① 的起点——一份 `initial=authorized` 的文档，链上可回答「它凭什么一开始是 authorized」。

**genesis 原像字节级定义（MUST）**：

- `doc_tree_hash` = `sha256(JCS({ metadata.name, state 声明, transitions 声明, rules 的 canonical_tree 数组 }))`——文档级 canonical 形式（区别于 §8.2 的表达式树级 canonical）；
- genesis 原像 = `{ type: "genesis", protocol, doc_tree_hash, initial: {变量名码点升序}, at, previous_hash: null }`。

其中 `initial` 的键按状态变量名 UTF-8 码点升序；`previous_hash: null` 键不省略（固定键集合）。三类记录的完整字段序与固定键集见 §8.2a。

> `initial`（genesis 记录）与 `state_snapshot.values`（§7.0.3）虽同为「状态变量 → 值」映射，但分属 genesis 记录与 DO 求值结果**两个不同原像**，字段名各自固定——`initial` 表达初始态、`values` 表达求值读到的当前态；实现者 MUST 按各自字段名序列化，不得混用。

#### 6a.5.6 被拒事件落点与并发语义

**规范性指引（SHOULD）**：承载授权语义的文档，`initial` SHOULD 取最保守哨兵值（`unestablished`/`revoked`）；显式 bootstrap 授权必须走一次**有 `actor` 的转移事件**，留下链上出处，而非凭空 `initial=authorized`。

**并发语义（per 文档实例 MUST 串行化）**：同一文档实例上的事件处理与 `evaluate()` MUST 互斥；`evaluate()` 看到的 `state_snapshot` 为求值开始时刻的一致快照，禁止中间态。

> 第 ③ 环是快照式（状态外部物化）做不到、也是显式状态机的核心：引擎验证「状态是怎么合法变到这一步的」，而不是照单全收外部状态。

### 6a.6 与 within/rate 的关系

`within`/`rate` 是本节 FSM 的**极窄特例**（状态=计数、转移=+1、输出=超限）。状态块是它们的泛化，不改变其既有语义。两者并存：`within`/`rate` 仍由 `temporal_state` 受控注入，状态块经 `state.*` 受控注入。**状态块与 within/rate 计数器互不共享命名空间**：状态块用 `state.<name>`（由 §6a.1 `state` 声明驱动），within/rate 用 `field+operator+value`（§5.2 计数隔离键）——两者键隔离规则各自独立，互不冲突。

### 6a.7 事件与转移求值上下文（受控注入）

转移规则的守卫求值同样收敛进「受控注入」模型（E1），**不读自由 fact**。事件对象、守卫上下文、编译口径 MUST 如下：

#### 6a.7.1 事件对象（Event）结构

**事件对象（Event）**，结构 MUST 为：

```yaml
event:
  event_id: "evt-2026-09-12-0001"   # 文档内唯一，重放去重依据
  on: revoke            # 事件名（匹配 transitions.on）
  at: "2026-09-12T10:00:00Z"  # 引擎注入的 UTC 时刻（转移求值的 as_of）
  actor: "agent-A"      # 已认证的事件源标识
  payload: { ... }      # 受限负载（见下）
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `event_id` | string | 文档内唯一；重放去重依据（同一 `event_id` 只处理一次） |
| `on` | string | 事件名，匹配 `transitions.on` |
| `at` | string | 引擎注入的 UTC 时刻（转移求值的 as_of）；MUST NOT 由外部提供（E9 禁墙钟同样适用） |
| `actor` | string | 已认证的事件源标识（身份层提供，非 payload 自证）；字符串 MUST NFC 规范化（E10，进转移审计记录哈希原像） |
| `payload` | object | 受限负载：≤8 键、深度 ≤2、叶子值标量、单值 ≤256B；键 MUST NOT 含 `.` 且 MUST NOT 为四个保留字段名（`event_id`/`on`/`actor`/`at`） |

#### 6a.7.2 event.* 解析机制

**event.* 解析机制（MUST）**：

- `event.*` 与 `state.*` 同样复用 field 节点首段拦截（resolveField 时首段为 `event` 走受控事件读取）；
- **可读字段** = `event.event_id` / `event.on` / `event.actor` / `event.at` + payload 键（绑定为 `event.<key>`）；payload 键值可为对象（深度 ≤2），守卫可读 `event.<key>.<sub>` 嵌套路径（深度 ≤2），解析规则同 fact 字段路径（§3）；
- **不存在的键**按 E11 空值传播返回 false（`exists`/`not_exists` 可感知缺失）；
- **payload 字符串 MUST NFC 规范化后参与求值（E10）**。

#### 6a.7.3 转移求值上下文（when 的输入）

**转移求值上下文（when 的输入）**：`when` 守卫的求值上下文 MUST 仅为以下两类，MUST NOT 读取自由 fact：

1. **事件前状态快照** `state.*`（本事件所有转移生效前的状态，§6a.2）；
2. **事件对象** `event.*`（`event.event_id`/`event.on`/`event.actor`/`event.at` + payload 键 `event.<key>`；`event.at` 为引擎注入的 UTC 时刻，即转移求值的 as_of）。

守卫读取 `state.*` 与 `event.*` 之外的任意字段（自由 fact）MUST 在加载时拒绝（Error，见 §6a.2 加载时校验全集）。

#### 6a.7.4 编译与求值口径

**编译与求值口径**：转移求值 MUST 走与规则求值相同的唯一编译管线（E7）；其 warning / errored 口径与 §7.3 完全一致。

#### 6a.7.5 时间与新鲜度（无时间触发器）

**时间与新鲜度（无时间触发器，MUST）**：状态机**不含时间触发器**——转移仅由事件驱动，状态不会自行过期。需要「新鲜度」状态（如 `fresh`/`stale`）时，两种模式二选一：

1. **外部 sweeper 注入**：组织层周期性注入 `on: expire` 事件，触发 `fresh → stale` 转移（引擎不维护定时器）；
2. **守卫时间比对**：`when` 用 `event.at` / `epoch_ms` 比对过期时刻，在事件到达时判定过期（不依赖后台定时器）。

示例（授权过期，模式 2）：

```yaml
state:
  - name: authorization
    values: [authorized, revoked]
    initial: revoked
transitions:
  - on: exercise
    audit_as: ESCALATE
    reason: auth_expired
    when:
      gt:
        - epoch_ms: { field: "event.at" }
        - epoch_ms: { field: "event.expires" }
    set: { authorization: revoked }
```

> 引擎不负责「随时间自动过期」——时间只作为事件的受控属性（`event.at`）或守卫的时间比较输入存在，与 E9（禁墙钟、as_of 受控注入）一致。

---

### 6a.8 执行边界 check/act 原子性（集成要求）

§6a 的授权状态由**执行边界**（Action Guard / 工具调用守卫，§9.1）消费，用于门控安全敏感副作用。`evaluate()` 是纯函数（E1）：它返回决策与 `state_snapshot = { values, state_version, transitions_head }`（§7.0.3），但**不亲自**提交被门控的副作用——提交发生在执行边界这一独立组件中，于 `evaluate()` 返回并释放实例锁之后。

由此留下 check/act 窗口：`evaluate()` 可能基于 `state_version = N` 返回 `ALLOW`，随后一条 `revoke` 事件在效果落地前提交 `state_version = N+1`，导致效果在已失效的授权谱系下执行。

**执行边界重校验（MUST）**：对授权依赖 §6a 状态的安全敏感副作用，执行边界 MUST 保证：在「用于授权决策的状态版本」与「受保护效果的提交」之间，任何影响授权谱系的状态变更事件不得提交。合规边界通过以下任一方式满足：

1. **原子重校验**：在提交效果前，于实例锁（§6a.5）下重读文档当前 `{ state_version, transitions_head }`，与决策的 `state_snapshot` 比对；任一不匹配即 fail-closed（不执行——按不可用/过期授权处理，AV-05/AV-10/AV-14 语义）；或
2. **等效同步边界封闭**：将相关锁（或等效串行化保证）持有至效果提交完成，使任何转移事件都无法在 check 与 act 之间插入。

**分层（引擎 vs 边界）**：引擎 MUST 暴露重校验原语——当前 `state_version`/`transitions_head` 可在实例锁下读取——但**不**执行副作用，也**不**替边界在效果提交期间持有锁（E1：求值纯、提交在引擎之外）。故 check/act 原子性是执行边界通过「对照引擎快照锚点重校验」来履行的**集成义务**，而非引擎侧的副作用执行保证。

**对抗性合规向量（V-STATE）**：`authorized@N → evaluate(ALLOW@N) → revoke@N+1（效果提交前）→ 尝试执行效果`。期望：该效果 MUST NOT 在过期的 `ALLOW` 下执行；边界重校验并 fail-closed（或等效封闭边界）。这是 AV-05 / AV-10 在执行边界的**有状态延续**。

### 6a.9 最新权威头新鲜度（反回滚，集成要求）

§6a.5 的重放验证证明「快照与某个有效的转移链前缀一致」（完整性 / 来源），但**不**证明「该前缀是当前最新的权威前缀」（新鲜度）。二者 MUST 区分。

**回滚攻击（对抗性场景）**：`authorized@N / HN` → `revoke` 提交 `@N+1 / HN+1` → 重启 / 恢复 / 副本还原出一个结束于 `{N, HN}` 的有效历史前缀 → 该前缀重放验证**通过**（它未被伪造或修改，只是被取代）→ 求值看到 `authorization = authorized` → 执行边界对同一被还原实例重校验，再次观察到 `{N, HN}`。结果：已撤销的授权被恢复为可行使，且不违反现有哈希链重放检查。

**最新权威头新鲜度（MUST）**：对授权依赖 §6a 状态的安全敏感副作用，执行 / 恢复边界 MUST 保证：在授权该副作用之前，接受的 `{ state_version, transitions_head }` 是同一文档实例的**最新权威**状态，而非被后续权威状态取代的历史前缀。合规边界通过以下任一方式满足：

1. **单调外部锚点**：以单调递增的外部 epoch（或持久化的最新头锚点、签名 / 版本化 checkpoint、共识背书的状态版本）确立最新权威头；或
2. **等价反回滚机制**：任何实现中立的等价机制，使被取代的历史前缀无法被接受为当前。

若最新权威状态的新鲜度无法确立，授权行使 MUST fail closed（按不可用 / 过期授权处理，AV-05 / AV-10 / AV-14 语义）。

**分层（引擎 vs 边界）**：哈希链完整性由引擎保证（§6a.5）；跨重启 / 恢复 / 副本边界的最新权威头新鲜度，是执行 / 恢复边界通过「外部锚点」履行的**集成义务**——引擎不维护跨实例的持久 epoch，也不替边界决定恢复策略（E1：求值纯）。**持久新鲜度锚点（durable freshness anchor）由组织 / 部署层负责提供**；且 MUST 保留 fail-closed 属性：若执行边界无法确立恢复所得的 `{ state_version, transitions_head }` 相对于权威持久化状态足够新鲜，则受保护（authority-bearing）效果 MUST NOT 继续执行——成功重放 / 完整性验证永远不构成「权威仍最新」的充分证据。

**对抗性合规向量（V-STATE）**：`authorized@N / HN → revoke 提交 @N+1 / HN+1 → 还原有效历史前缀（结束于 @N / HN）→ 重放验证通过 → 求值受保护操作 → 尝试效果`。期望：受保护效果 MUST NOT 使用被取代的授权状态执行；系统 MUST 确立 `{N, HN}` 仍是最新权威状态、发现其已被取代、或在新鲜度无法确立时 fail closed。

### 6a.10 授权建立/重建的根源绑定（授权根源 provenance，集成要求）

§6a.2 把 `authorize` / `revoke` 统一建模为事件触发的状态转移（FSM 的 F 函数），事件注入经 `actor` 认证（§6a.5.4）。但 `actor` 认证只证明「谁触发了事件」，**不**证明「触发者是否有权建立该授权」。若不约束授权状态的「建立/重建」来源，撤销即退化为可逆的本地状态位——被撤销的主体可仅通过触发 `authorize` / `re-authorize` 转移使 `revoked → authorized`，而无需证明新的授权从何而来。

**授权根源绑定（MUST）**：承载授权语义的状态变量，其「使授权可行使」的转移（即 `set` 使授权变量进入「可行使」值，如 `authorized`）MUST 有授权根源 provenance——触发该转移的事件 `actor` MUST 归因于一个有权建立/重建该授权的 principal/authority（授权根，authorization root），而非被授权主体自身。撤销后，`revoked → authorized` 的 re-authorization MUST 有新的有效授权基础；仅凭本地状态转移（无授权根源 provenance）不得使授权重新可行使。被授权的后代/主体 MUST NOT 通过仅触发 `authorize` / `re-authorize` 状态转移来恢复自己被撤销的授权。

**分层（引擎 vs 边界）**：引擎暴露「授权建立/重建」转移的可识别标记（`reason` 语义标识，如 `reason: authorize`）并将 `actor` 记录进转移审计链（§6a.5.4 已有）；**授权根源资格的判定（谁有权建立该授权）是执行边界/组织层的集成义务**——§6a 单实例 FSM 不建模 P→A→B 授权链（§6a.1 分层边界），谁有权授权由组织层裁决。执行边界在提交 `authorize` / `re-authorize` 事件前 MUST 校验 `actor` 的授权根源资格；无法确立授权根源即 fail-closed（按不可用/未授权处理，AV-05 / AV-10 / AV-14 语义）。

**与组织层不变量的接口**：本节的授权根源绑定是组织层委托权威不变量（权威不放大 INV-01、窄化继承 INV-03、传递撤销 INV-04）在单实例 FSM 层的**原语支撑**——组织层消费「授权建立/重建必须归因于授权根」的原语来保证委派链的 INV 不变量。这些不变量的完整定义见 §6b，超出本节单实例 FSM 范围（§6a.1 分层边界）。

**对抗性合规向量（V-STATE，conformance 向量 AV-15 attack 侧）**：`授权根建立授权（authorized）→ 撤销（revoked）→ 被授权主体（非授权根）触发 re-authorize → 状态 authorized → 尝试受保护效果`。期望：DENY——受保护效果 MUST NOT 执行，除非 re-authorization 归因于一个有效的、能建立该授权的当前授权基础。

**正向控制向量（V-STATE，conformance 向量 AV-15 legal 侧）**：`授权根建立授权 → 撤销 → 授权根重新签发新授权基础 → 重建 → 被授权主体在新授权范围内行使`。期望：ALLOW。

## 6b. 委托权威安全模型（组织行为层）

§6a 定义单实例 FSM（单个授权关系的状态机）；本节定义**委派链**（多个授权关系沿「授权根 → 中间节点 → 被授权主体」组合）的安全不变量——约束「授权如何沿委派链传播」，是组织行为层的规范性语义。分层：§6a 提供「授权状态的可验证裁决」，本节保证「委派链的安全不变量」；per-授权关系的多实例状态由组织层为每个关系实例化一个文档承载（§6a.1 分层边界）。本节「委派」指**授权委派**（delegation of authority，沿授权链传播权限），与 §5 的 `DELEGATE` 决策类型（人机协同：把「机器搞不定」交给人或流程）语义不同。

### 6b.1 总纲：委派不得制造权威（MUST）

一切委派、下达、再委托、传递委派、特权中介、下游约束变更、撤销，都 MUST NOT 让有效权威**超出或逃逸**起源权威链：

> `effective_authority(subject) ⊆ authority(chain)` —— 有效权威是起源权威链的**子集**，任何操作不得放大它。

### 6b.2 五条委托权威不变量（INV-01~05）

每条不变量 = 性质 + 违反形态 + 规范性断言。

#### INV-01 权威不放大（authority non-amplification）

- **性质**：`effective_authority ⊆ authority(chain)`。委派方授予的权限 ⊆ 委派方自己拥有的权限；权限不能通过委派链被放大。
- **违反形态**：直接放大（授出超出自身权限）、传递放大（多层委派累积放大）、**聚合放大**（多个独立合法的 child grant 聚合消耗同一有界起源权威——per-hop 非放大必要但不充分）。
- **规范性断言**：任何委派/下达/晋升动作后，`effective_authority(delegate) MUST ⊆ authority(chain)`；多个 child grant 对同一有界起源权威的聚合消耗 MUST 满足起源权威守恒（aggregate conservation）。

#### INV-02 溯源连续性（provenance continuity）

- **性质**：每个决策有连续可验证的溯源链（授权基础 → 委派 → 行使），身份绑定不可破坏。
- **违反形态**：溯源链断裂、重放已消费的委派、身份绑定破坏、特权洗权（privilege laundering，经中介节点伪装权限来源）。
- **规范性断言**：行使权威的每个决策 MUST 能追溯到一条连续的、未被消费的授权链；行使身份 MUST 绑定到授权链声明的身份。

#### INV-03 窄化继承（narrow-only constraint inheritance）

- **性质**：约束只能收窄，不能放宽。委派时施加的约束（deadline / max_autonomy / escalation_to / 范围）被继承，且下游只能进一步收窄。
- **违反形态**：下游约束移除/放宽。
- **规范性断言**：`constraints(delegate) MUST ⊆ constraints(delegator)`；下游约束变更 MUST NOT 放宽。

#### INV-04 传递撤销（transitive revocation）

- **性质**：撤销传播到所有派生权威（含未行使的、已再委托的）。
- **违反形态**：已撤销祖先委托（再委托后祖先撤销 → 下游派生权威未失效）、陈旧负面、状态缺失、已完成动作不可逆。
- **规范性断言**：撤销某节点，其下游子树 MUST **全部失效**（传递闭包），无论已行使与否；撤销**不可逆**，重新可行使 MUST 走新的授权基础（§6a.10）。当多个独立授权基础收敛到同一主体时，该失效是**按授权基础收敛**的（§6b.4）——作用于被撤销授权基础的子树，而非主体的全局权威。

#### INV-05 能力边界轴（capability boundary axis）

- **性质**：权威沿 agent → skill → tool → protected-resource 只减不增。
- **违反形态**：越界。
- **规范性断言**：`authority(resource) MUST ⊆ authority(tool) ⊆ authority(skill) ⊆ authority(agent)`。

### 6b.3 撤销新鲜度（机制中立）

本节是 §6a.9（最新权威头新鲜度）在委派链层的推广：§6a.9 约束单实例 FSM 的状态头新鲜度，本节约束委派链祖先撤销状态的新鲜度。

行使依赖可撤销祖先的权威前，执行边界 MUST 确立撤销状态满足配置的新鲜度要求；**可见撤销的缺失 MUST NOT 单独构成持续有效**；无法确立新鲜度即 fail-closed。机制中立：monotonic epoch / lease / version vector / signed status object / online introspection / 等价机制。

### 6b.4 按授权基础收敛的撤销（basis-scoped revocation，多根组合）

主体可能通过**多个相互独立的授权基础**持有相同（或重叠）的有效权威——例如 `P1 → A → B` 授 `{read, write}` 给 B，而 `P2 → C → B` 独立地授 `{read}` 给 B。INV-04（传递撤销）确立了「撤销某节点 → 其派生权威失效」；本节固定该失效的**作用域**：当多个独立授权基础收敛到同一主体时，撤销是**按授权基础收敛（basis-scoped）**的，绝不是主体全局的。

**有效权威合成（MUST）**：主体的有效权威是其**当前有效的每个授权基础**可导出权威的并集：

> `EffectiveAuthority(B) = ⋃_{X ∈ B 的当前有效授权基础} authority_derivable(B, X)`

`authority_derivable(B, X)` 是 B 沿 `X → … → B` 路径派生的有效权威——basis-X 授予范围与该路径继承约束（INV-03）的交集（meet）。授权基础**当前有效**当且仅当：未被撤销（INV-04）、其撤销状态新鲜（§6b.3）、且携带授权根源 provenance（§6a.10）。

**按授权基础收敛的撤销（MUST）**：`revoke(basis-X)` 移除**恰恰好** basis-X 可导出的权威——不多（basis-X 下游派生的完整传递闭包，依 INV-04）、不少（独立由仍有效 basis-Y 导出的权威保持可行使）。撤销一条派生路径**不等于**撤销该主体持有的每一个独立授权基础。

**禁止的归约（MUST NOT）**：合规实现 MUST NOT 把主体的权威归约为单一的主体级全局状态——既不得用主体级全局 `revoked` 位（**过撤销**：摧毁由仍有效授权基础独立建立的权威），也不得用主体级全局 `authorized` 位（**欠撤销**：保留只属于已撤销谱系的权威）。权威状态 MUST 按授权基础/谱系收敛，使一个授权基础的失效既不坍缩也不保留另一个授权基础的权威。

**禁止跨基础保留（MUST NOT）**：存活的授权基础 MUST NOT 被用来保留只属于已撤销谱系的权威。并集是对每个授权基础各自可导出的权威求的——`revoke(basis-X)` 移除 basis-X 的贡献，即使另一个授权基础授予了重叠（但不完全相同）的范围。

**与 INV-04 的关系**：本节把 INV-04 的「整个下游子树」细化为**按授权基础相对**的——是被撤销授权基础的子树，而非主体的全局权威。INV-04 的不可逆性与 §6a.10 的「新授权基础」要求仍然成立：被撤销谱系权威的重新可行使 MUST 走一个新的、独立建立的授权基础，不得因某个无关授权基础的存活而被恢复。§6b.1 的 `effective_authority ⊆ authority(chain)` 是**按授权基础**成立的——每个授权基础的贡献受其自身起源权威链约束，并集只是组合这些按基础约束的贡献，不制造权威。这一多根组合区别于 INV-01 的聚合放大（多个子授权共同消耗**一个**起源的共享预算）：此处每个授权基础都是独立起源，各自受自身的守恒约束。

**判别性合规场景（V-STATE，conformance 向量 AV-16：attack 侧 write → DENY，legal 侧 read → ALLOW）**：`P1 → A → B` 授 `{read, write}`；`P2 → C → B` 独立授 `{read}`；`revoke(P1 → A)`。期望：B 的 `write` → DENY（write 仅通过被撤销授权基础存在，MUST NOT 借存活 `P2` 基础而存活——欠撤销）；B 的 `read` → ALLOW（read 独立由仍有效的 `P2 → C → B` 基础导出且满足其继承约束（INV-03）——过撤销）。主体级全局 `revoked` 位会在 `read → ALLOW` 一侧失败；主体级全局 `authorized` 位会在 `write → DENY` 一侧失败。

### 6b.5 对抗向量族（AV-01~16）

收敛标准 = `decision` + `matched_invariant` + `first_invalid_boundary`。完整向量表见独立 conformance 套件（`vectors/` + `conformance/CONFORMANCE.md`）。新增 AV-15（re-authorization provenance，§6a.10：attack 侧非授权根 re-authorize → DENY，legal 侧授权根重建 → ALLOW）、AV-16（multi-root basis-scoped revocation，§6b.4：attack 侧 write → DENY，legal 侧 read → ALLOW）。

## 7. 求值语义

### 7.0 求值概览

求值 = 表达式树（规则编译产物）对**输入事实**（fact）逐节点判定的纯函数过程（E1）。本节定义求值的输入契约、算法步骤与输出契约，供实现者与使用者对齐。

#### 7.0.1 输入契约（事实对象）

求值输入是一个**事实对象**（fact），承载规则作用主体的当前状态，以 Entity（§3）为命名空间：

```yaml
fact:
  tool:                 # Entity: tool
    name: "issue_refund"
    args: { amount: 8000, order_id: "O1024" }
  context:              # 自由上下文字段（规则以 context.* 引用）
    country: "CN"
    role: "operator"
  # 其他 Entity：agent / task / workflow / human / guardian（按需提供）
```

- 字段引用（`tool.name`、`context.amount`、`tool.args.amount`）按事实对象的键路径解析（§3）；
- `as_of`（求值时刻，UTC）、`temporal_state`（within/rate 滑动窗口状态）与 `state.*`（§6a 授权状态快照）由引擎注入，属受控外部输入（E1）；
- 缺失字段按 E11 空值传播处理（§7.3(a)）。

#### 7.0.2 求值算法

```
输入：规则集 rules[] + 事实对象 fact（状态机事件已先行处理，见步骤 0）
输出：决策结果（见 7.0.3）

0. 事件先行（happens-before 声明，无额外动作）：事件已在到达时即时处理（eager，§6a.2）。
   evaluate() 获取实例锁（§6a.5），其 state.* 输入即所有已到达事件提交后的状态。
1. 排序：按 priority 从小到大（值越小越优先）
2. 分组：按 ring 从 0 到 3 顺序执行（0 内核 → 1 恢复 → 2 审批 → 3 建议）
3. 每个 ring 内，按序求值每条规则：
   a. unless 豁免先于 when 判定——命中豁免则记录后跳过该规则（unless 与 when 共享同一求值上下文：fact + state.* 只读注入）
   b. 编译后的 when 表达式树对 fact 逐节点求值（true / false / 错误）
   c. 命中不短路（仅 `EMERGENCY_HALT` / `WORKFLOW` 例外，见下）：除 `EMERGENCY_HALT` / `WORKFLOW` 命中即短路外，其余决策（含 DENY/ROLLBACK/QUARANTINE）命中后继续求值（override ALLOW 可能覆盖）
   d. override：仅 DENY → ALLOW 方向覆盖，不得覆盖到更不安全状态（§7.1）
4. 兜底：无规则命中 → metadata.decision（fallback 决策，§2.2）
5. 汇总：产出 decision + matched_rules + 证据（canonical_tree / hash / eval_trace / state_snapshot）
```

- **catch-all 惰性两趟**：catch-all（空条件）规则仅当**无任何显式条件规则命中**时才求值——显式规则（ring-major）先求值，无命中再求值 catch-all（ring-major）；catch-all 一旦任一显式规则命中即惰性跳过（不计入 `total_evaluated`）。
- **catch-all（空条件）判定（MUST，编译期定义，与书写形态无关）**：一条规则为 catch-all，当且仅当其 `when` 为以下两者之一：① `when: "true"`；② 编译产物为**字面量 `true` 节点**（含决策表仅默认行的编译产物）。判定发生在**编译期**，不依赖书写形态；实现 MUST NOT 做字面量以外的常量折叠（`1 eq 1` 不折叠为 catch-all，避免跨实现分歧）。注：`rules[].when` 为 MUST 字段（§4.1），不存在「`when` 省略」的规则形态；`transitions[].when` 可省略（§6a.2），其无条件转移由同节冲突检查 (0) 单独判定。
- 求值错误按 E12 折叠：Guard 上下文（安全边界求值）一律 fail-close、覆盖所有 tier；非 Guard 上下文中 tier≤2 fail-close、tier 3–5 折叠为 false；
- `EMERGENCY_HALT` 命中即短路；`WORKFLOW` 命中即短路（进入工作流状态机，§6 决策类型 WORKFLOW；**注意：授权状态机在 §6a**，二者不同）；`DENY`/`ROLLBACK`/`QUARANTINE` 不短路——继续求值以判断是否有 override ALLOW 覆盖。

#### 7.0.3 输出契约（求值结果）

求值结果 MUST 包含以下字段：

> **缺席编码（MUST，§8.2a）**：对象型可空字段（`primary_instruction`、`primary_reason`、`primary_explanation`、`primary_correction`、`temporal_state`、`state_snapshot`）无值时编码为 `null`，键 MUST NOT 省略；列表型字段（`unless_exemptions`、`eval_warnings`、`canonical_trees`）空态编码为 `[]`（键不省略），`matched_rules` 恒为数组——保证 DO 哈希原像结构恒定。`errored` 例外：它是布尔标志位（E3），永远有值（EvaluationError → true，否则 false），不参与缺席编码。空态编码完整边界见 §8.2a。

| 字段 | 说明 |
|------|------|
| `decision` | 最终决策（§6 枚举之一，或 fallback 决策） |
| `matched_rules` | 命中的规则（按求值顺序） |
| `unless_exemptions` | 被 unless 豁免的规则（单独记录，不计入 matched_rules） |
| `primary_instruction` | 首要指令（ALLOW + instruction 场景） |
| `primary_reason` | 首要理由（DENY 等拦截场景） |
| `primary_explanation` | 首要解释（可中英双语） |
| `primary_correction` | 纠正文本（CORRECT 决策；来源为规则字段 `correction`，见 §4.1） |
| `total_evaluated` | 实际进入 `unless`/`when` 求值的规则总数（被 catch-all 惰性跳过的规则不计入） |
| `total_matched` | 命中的规则总数 |
| `temporal_state` | within/rate 滑动窗口状态快照（无命中时编码为 `null`，键不省略，§8.2a） |
| `state_snapshot` | 求值时 `state.*` 读取到的状态快照：`{ values, state_version, transitions_head }`（无状态被读取时编码为 `null`，键不省略，§8.2a）；进 DO 哈希原像（§6a.5） |
| `canonical_trees` | 命中规则的 canonical 树快照（tree = 规范化树 JSON）与哈希（sha256: 前缀），E6 证据 |
| `eval_warnings` | 求值过程中的非致命警告（E3） |
| `errored` | 求值是否发生错误（E3）；Guard 上下文 fail-close、覆盖所有 tier（E12） |
| `as_of` | 引擎注入的求值时刻（ISO UTC，E9） |

> 求值证据（canonical_tree 快照、结果哈希、eval_trace）为可独立重算的派生产物（§8.2、E6）——canonical_tree 进哈希，eval_trace 不进哈希（§8.3）。

### 7.1 优先级与冲突解决

1. 按 `priority` 从小到大排序（值越小越先）；
2. 同 priority 有 `override` 标记的排前；
3. `override` 枚举：`critical` > `high` > `normal` > `low`（默认 `normal`）；
4. 同 priority 同 override 按定义顺序；
5. `override` 仅允许 DENY → ALLOW 方向覆盖（不得覆盖到更不安全状态）；`override` 为 `critical`/`high` 时跨 ring 生效：一个更高 ring 的 override ALLOW 可覆盖较低 ring 的 DENY（**不比较 ring**）；
6. **空条件规则（catch-all / 兜底）不得改写显式条件规则所确立的决议**：`when` 为空（无条件命中）的规则，无论 `then` 是 DENY 还是 ALLOW，也无论是否携带 `override`，都 MUST NOT 推翻任何显式条件（`when` 非空）规则已建立的决策。兜底规则仅在**没有任何显式条件规则命中**时才生效（§5.4 决策表「默认行」同义）。依据：兜底规则代表「其余情形」的弱、通用意图，显式条件规则代表「特定情形」的强、特定意图；令兜底改写显式决议属「覆盖到更不安全状态」，违反第 5 条的安全单调性。

### 7.2 求值约束（E1–E12，全部 MUST）

| 编号 | 约束 |
|------|------|
| E1 | 求值是纯函数：无副作用、无隐式外部状态、无时钟读取；`within`/`rate` 的状态注入（`temporal_state`）、授权状态快照（`state.*`，§6a）与 `as_of` 同级，属受控外部输入——状态本体由引擎维护，表达式树只读快照 |
| E2 | 定点小数 scale=14 + half-even 字符串序列化（求值口径：运算输出精度，非 canonical 编码）；中间计算用高精度有界有理数，仅输出节点舍入 |
| E3 | 求值错误记 eval_warnings 并置 errored=true，折叠方向按 E12 分 tier |
| E4 | 资源上限（分级）：Grade A 算术深度≤2 / 树深≤6 / 节点≤64 / 数组≤10000 / 单规则≤50ms（防 DoS 实现建议，非求值语义；参考实现以确定性节点/深度上限替代墙钟计时，见 E1/E9） / 量词不嵌套 / 正则步数≤10000；Grade B 树深≤10 / 节点≤256 / 算术深度≤4，量词嵌套≤2 层；Grade C 不适用 |
| E5 | 加载时类型检查；`when` 与 `expr` 不得共存 |
| E6 | 树即证据：canonical_tree（树快照）作为求值证据参与哈希；eval_trace 为可重算派生产物，不进哈希 |
| E7 | Simple 与 Expression 编译到同一求值核心，禁止两个求值器 |
| E8 | 量词安全折叠：空数组 → all/any/none 一律 false（反空洞真） |
| E9 | 禁读墙钟；as_of 由引擎注入并记入审计记录 |
| E10 | 字符串 NFC 规范化 |
| E11 | undefined 哨兵语义（空值传播，见 §7.3） |
| E12 | 求值错误处理：**Guard 上下文**（安全边界的求值；参考实现 `evaluate()` 即 Guard 上下文）缺省 fail-close——所有 tier 的求值错误一律折叠向拦截侧（DENY）；**非 Guard 上下文**（模拟/分析）中 tier≤2 fail-close、tier 3–5 折叠为 false |

内核显式排除：字符串拼接、正则替换、位运算、日期格式化、递归引用、用户自定义节点——以维持求值的封闭性与可验证性。

### 7.3 确定性语义（跨实现分叉防护）

以下语义 MUST 在文档与向量中显式标注，避免与标准实现产生语义误解：

#### 7.3(a) 空值传播（E11）

Agent 上下文高度动态，字段缺失是常态。求值 MUST 三值逻辑安全失败：

| 场景 | 行为 |
|------|------|
| 字段不存在时的相等/数值比较 | 返回 false（非 NPE） |
| `== null` / `!= null` 检查 | 正常返回 true / false |
| 类型不匹配的比较 | 返回 false（禁止隐式转换；非错误，errored=false） |
| 字段不存在时的算术运算 | 比较节点（Simple 条件）→ 返回 false（errored=false）；算术节点（arith）→ EvaluationError（errored=true） |
| 逻辑节点（`and`/`or`）的非布尔操作数 | 静默折叠为 false（不记 warning；非错误，errored=false） |

> **warning 不对称（跨实现须精确复现）**：比较节点、`between`、以及逻辑节点（`and`/`or`）的非布尔操作数对类型不匹配「静默折叠为 false」，**不记 warning**；而 `in`（右操作数非数组）、字符串节点（`contains`/`match`/`starts_with`/`ends_with`）、`length`（非 str/array）、`aggregate`（非数组/非数值元素）、量词（`all`/`any`/`none` 的非数组操作数）记 `type_mismatch` warning——这些的 `errored` 均为 **false**（它们只是 type-mismatch warning，不是 E3 的 EvaluationError）。此不对称在向量集内部自洽（如 `gt-003` 与 `E3-002` 均 warnings=[]），第三方实现 MUST 精确复现。

#### 7.3(b) 量词的安全折叠（E8）

标准量词语义下 `all(空)=true`（空洞真）。本规范刻意偏离：`all/any/none(空)` 一律折叠为 false——防「无元素可校验却被判为放行」，并在审计记录中记录安全折叠。`over` 为**非数组**（缺失/标量/对象）时记 `type_mismatch` warning：`all/any/none` 折叠为 `false` 且 `errored: false`。第三方实现 MUST 采用本折叠语义。

#### 7.3(c) 定点小数的中间精度（E2）

中间计算采用高精度有界有理数（如 128 位整数分子/分母），仅输出节点按 scale=14 + half-even 舍入为字符串序列化（IEEE 754-2019 ROUND_HALF_EVEN）。一致性比较的是 **scale-14 定点值**（数值相等），而非字符串拼写：尾零无意义（`"35"` ≡ `"35.0"`）。此「字符串序列化」为**求值口径**（运算输出精度），不进入 canonical_tree 哈希；canonical **编码口径**见 §8.2（JCS number 序列化）。

#### 7.3(d) 正则的 ReDoS 防护

`match` 节点 MUST 同时满足：① 单次匹配步数 ≤10000；② 输入长度上限；③ 优先确定性引擎（RE2 类）或安全语法子集。安全语法子集 MUST 限制为正则语言：**禁止反向引用（`\1`–`\9`、`\k<name>`）与环视（`(?=)` / `(?!)` 前瞻、`(?<=)` / `(?<!)` 后顾）**——此类非正则构造依赖回溯顺序、无法逐字节确定，且无法由 SMT 验证器（erdl-formal）表达。内联大小写标志（`(?i)`）不提供（匹配始终大小写敏感，§5.2）。违反上述限制（嵌套量词、反向引用、环视或步数超限）的正则折叠为 `false` + `regex_re_dos` warning，且 `errored: false`——它不是 E3 的 EvaluationError。

#### 7.3(e) aggregate 空数组的安全折叠

| 函数 | 空数组结果 | 依据 |
|------|-----------|------|
| `count(空)` | `0` | 标准计数语义 |
| `sum(空)` | `0` | 空和恒等元 |
| `avg(空)` | `false` | 安全失败折叠（避免除零） |
| `min(空)` | `false` | 安全失败折叠（标准 +Infinity，禁用） |
| `max(空)` | `false` | 安全失败折叠（标准 −Infinity，禁用） |

`aggregate` 的 `over` MUST 为数组；非数组（缺失/标量/对象）返回 `null` + `type_mismatch` warning（折叠为 false）。`count(缺失)` 与 `count(空数组)` 语义不同：前者 type_mismatch，后者 0。

#### 7.3(f) 时间节点的 UTC 语义（E9）

所有时间节点统一以 UTC 求值，保证跨实现、跨时区逐字节一致：

- 输入解析：date-only（`YYYY-MM-DD`）按 UTC 解析；date-time 按 ISO 8601 带时区解析（整秒精度，不支持小数秒），无时区后缀按 UTC；
- 分量提取（`date_part`）：一律取 UTC 分量；
- 日期推演（`date_add`、`month_last_day`）：按 UTC 日历运算；`date_add` 的 `amount` MUST 为**整数**（非整数返回 `null` + `type_mismatch` warning，折叠为 false）——时长是整数单位，半偶数舍入「加 1.5 个月」无业务语义，禁止隐式舍入；
- 时间差（`days_between`）：UTC 毫秒差 ÷ 86400000 向下取整（floor）；
- 序列化：ISO 8601 UTC（`toISOString`）。

业务本地时区由引擎注入 `as_of` 时转换为 UTC 时刻，求值器以 UTC 纯函数运算。

#### 7.3(g) 资源限制违规（E4）与加载时互斥（E5）是约束验证结果，而非求值结果

E4 结构性资源限制违规（nodes / tree-depth / arithmetic-depth / array / quantifier-nesting 超出分级上限）**抛出**——引擎返回 `value: null` 且 `value_type: "null"`、`threw: true`（非 E3 的 EvaluationError；`errored` 仍为 `false`）。正则 ReDoS 违规（§7.3(d)）折叠为 `false` + `regex_re_dos`（非抛出）。E5 加载时互斥违规记录 `value: true`（= 检测到违规）。上述 E12 折叠与 `errored` 规则仅适用于**求值**向量。

### 7.4 when 最小完整度约束

`when: "true"` 的语义是「对所有操作生效」，仅适用于建议性规则：

| 规则 | 级别 |
|------|------|
| `when: "true"` MUST NOT 与 `then: DENY` 搭配 | MUST NOT |
| `when: "true"` MUST NOT 与 `then: EMERGENCY_HALT` 搭配 | MUST NOT |
| `when: "true"` MUST NOT 与 `then: CORRECT` 搭配 | MUST NOT |
| `when: "true"` MUST NOT 与 `then: REQUEST_HUMAN` 搭配 | MUST NOT |
| `when: "true"` MAY 与 `then: ALLOW + instruction` 搭配 | MAY |
| `when: "true"` MAY 与 `then: NOTIFY` 搭配 | MAY |
| 安全类规则（category=security）MUST 至少含 1 个 condition | MUST |
| 工具拦截类规则 SHOULD 含 `tool.name` 条件 | SHOULD |
| 文件操作规则 SHOULD 含 `tool.args.path` | SHOULD |
| 命令操作规则 SHOULD 含 `tool.args.command` | SHOULD |

---

## 8. 序列化与规范化

### 8.1 序列化

ERDL 文档以 YAML 承载，可无损转换为 JSON。规范化树（canonical_tree）以 JSON 对象形态序列化。

### 8.2 规范化树（Canonical Form）

表达式树是唯一求值、唯一哈希、唯一重算的基准对象。要使其哈希可跨实现逐字节一致，树 MUST 具有唯一规范化形式：

| 规范化规则 | 说明 |
|-----------|------|
| 节点序固定 | 子节点按规范顺序排列（左→右严格定序），与源书写顺序无关 |
| 字段名承重 | 字段引用路径承重——字段名发布即冻结 `[FREEZE-1]`，别名 MUST 先行归一化 |
| 字面量规范 | 数字字面量的 canonical **编码口径**为 JCS（RFC 8785）IEEE 754 number 序列化（区别于 E2 的求值口径）；字符串 NFC 规范化 |
| var 规范 | 仅支持 `$` / `$.path`，路径段为确定字节序列 |
| 元数据剥离 | 注释、来源行号、格式、作者等非语义元数据一律不进规范化树 |

> **树哈希的对象是规范化树，而非任何特定实现的内存表示或序列化文本。** 两个结构等价的树（仅字段书写顺序、空格、变量命名不同）规范化后产生完全相同的字节序列与哈希。

### 8.2a DO 哈希原像（字段序 + 固定键集合 + 缺席编码）

求值结果的 DO 哈希原像，其**字段序、键集合、缺席编码** MUST 如下定义，否则两个实现必然算出不同哈希（v2.2 往 DO 新增了 `state_snapshot` 结构化字段，其局部键序已定义但整体原像未定义，属全局失锚）：

#### 8.2a.1 求值结果 DO 的字段序与固定键集合

**字段固定序（MUST）**：

```
decision → matched_rules → unless_exemptions → primary_instruction → primary_reason
→ primary_explanation → primary_correction → total_evaluated → total_matched
→ temporal_state → state_snapshot → canonical_trees → eval_warnings → errored → as_of
```

**固定键集合（MUST）**：无值的键编码为 `null`，键 MUST NOT 省略（保证原像结构恒定）；数组按出现顺序；字符串 NFC（E10）；数字 JCS（§8.2 编码口径）。**空态编码（MUST）**：列表型字段（`matched_rules`、`unless_exemptions`、`eval_warnings`、`canonical_trees`）空态编码为 `[]`（键不省略）；仅对象型可空字段（`primary_instruction`/`primary_reason`/`primary_explanation`/`primary_correction`、`temporal_state`、`state_snapshot`）无值时编码为 `null`——数组恒数组、对象可 null，边界唯一。

#### 8.2a.2 转移链审计记录的原像（三类记录）

**转移链审计记录的原像字段序（MUST，分三类）**：转移链由三类审计记录构成——成功转移（`type: "transition"`）、转移错误（`type: "transition_error"`）、起源（`type: "genesis"`）。三类字段集不同，**各自字段序与固定键集 MUST 如下**（`type` 字段进原像以区分类型）：

**成功转移记录（`transition`）**：

```
type → event_id → on → actor → at → audit_as → set → state_version → previous_hash
```

**转移错误记录（`transition_error`）**：

```
type → event_id → on → actor → at → audit_as → error → errored → previous_hash
```

**起源记录（`genesis`）**：

```
type → protocol → doc_tree_hash → initial → at → previous_hash
```

**固定键集与缺席编码（MUST）**：每类记录的键集即上列字段序（不跨类型补齐缺失字段）；`set`/`initial` 的键按状态变量名 UTF-8 码点升序；字符串 NFC（E10）；数字 JCS（§8.2 编码口径）；`previous_hash` 缺席（仅 genesis）时编码为 `null` 且键不省略。

### 8.3 规范化树与 gloss 的关系

- gloss 由冻结渲染模板从树生成（G1）；
- **进哈希的是树（规范化形式），不含 gloss 文本**——树逐字节确定，满足哈希要求；
- gloss 文本不进哈希，因此措辞可有实现差异，不破坏树哈希的跨实现一致性；
- gloss 与树由渲染校验绑定（G2）——改 gloss 不改树即被判定无效。

这一「哈希树、校验 gloss 与树一致」的机制，使 gloss 在哈希模式下无需逐字节一致、也无需进哈希，即可获得树的密码学锚定。

---

## 9. 如何集成 ERDL

ERDL 的集成目标，是把关键判断从模型推理、框架代码或口头约定中抽离出来，变成可加载、可执行、可验证的规则资产。它通常以 YAML/JSON 规则文档承载，通过 `when → then` 完成决策，并输出可哈希、可逐字节复算的求值证据。以下三种集成路径，对应三类典型工程落点。

### 9.1 场景一：AI Agent（行为约束层 / Action Guard）

**角色**：在 AI Agent 链路中，ERDL 是 LLM 意图与系统执行之间的「确定性闸门」——Agent 可以生成动作，但动作是否允许执行，必须由规则求值决定。

**模拟**：客服 Agent 收到用户「退款 8000 元」的请求。LLM 将意图转换为工具调用：`issue_refund(amount=8000, order_id=O1024)`。在真正触达支付系统前，Action Guard 把工具名、参数、会话上下文打包成事实对象，交给 ERDL 求值。规则集中，R1 写作：`when tool.name == "issue_refund" 且 tool.args.amount > 5000 → REQUEST_HUMAN`；R2 写作：`when tool.name == "issue_refund" → ALLOW`。由于 R1 先命中，系统返回 `REQUEST_HUMAN`。Agent 停止调用支付工具，转为生成人工审批任务，并向用户返回「需人工复核」的话术。

**集成要点**：第一，规则在模型之外独立求值，Prompt 不再承担安全边界；第二，命中记录、输入摘要、`canonical_tree` 与结果哈希一并写入审计日志，任何一次拦截都可回放；第三，规则变更只需更新 ERDL 文档，不必重写 Agent 框架、工具实现或模型提示词。

### 9.2 场景二：MCP（协议分发 / 跨实现互操作）

**角色**：在 MCP 生态中，ERDL 规则通过 ERDL MCP Server 暴露为标准工具，任何 MCP 兼容 Agent 都能调用同一套规则，实现跨实现的合规分发与互认。

**模拟**：某企业将资金合规规则部署为 ERDL MCP Server，并暴露 `guard_check` 工具。第三方 Agent 准备执行一笔高额退款，但自身不掌握企业规则。执行前，它通过 MCP 调用 `guard_check`，传入动作描述：`action="issue_refund"`、`amount=8000`、`channel="payment"`。ERDL MCP Server 加载规则集，完成求值，返回：`decision=REQUEST_HUMAN`、`matched_rule=R1`、`hash=0x9f...`。第三方 Agent 根据返回值停止直接执行，转入人工审批流程，并将该决策凭据写入自己的执行日志。

**集成要点**：这里的关键是「规则即服务」。规则不再硬编码在某个 Agent 框架里，而是通过标准协议分发；不同厂商、不同语言、不同运行时的客户端，都可以消费同一份判断逻辑。由于返回结果携带规则命中与哈希信息，调用方即使不保存规则原文，也能把决策凭据归档，供后续审计或独立复算。规则升级时，只需更新 MCP Server 端，客户端无需重构执行链。

### 9.3 场景三：规则引擎（规则定义语言 / 确定性求值）

**角色**：在规则引擎内部，ERDL 是规则定义语言本身，负责以声明式方式表达业务策略，并提供确定性求值语义。

**模拟**：反洗钱引擎需要表达「大额交易且高风险国家 → 拦截」。业务团队编写 ERDL 规则：`when context.amount > 10000 且 context.country in ["高风险国家列表"] → DENY`。引擎加载 YAML 后，不会把它当成普通配置，而是编译为表达式树：比较节点处理金额阈值，集合节点判断国家归属，逻辑节点完成与运算。随后，引擎按照 E1–E12 求值语义执行，输出 `DENY`。该规则还可生成 `canonical_tree` 与哈希值；另一实现只要加载同一规则、同一输入，就能重算出相同结果。

**集成要点**：这里的核心价值是「可验证的确定性」。ERDL 不只让规则可读，还让引擎实现可以被测试向量约束。V-ENGINE 类测试向量可以证明：不同引擎、不同平台、不同版本，对同一规则应产生逐字节一致的结果。由此，规则引擎不再只是业务系统内部黑盒，而是可以接受第三方独立验证的执行器。监管方、审计方或平台方都能依据输入、规则哈希与求值证据，判断「引擎算得对不对」。

---

## 10. 示例与一致性验证

### 10.1 Quick Start（快速上手）

一个最小 ERDL 文档 + 一次求值，走完「写 → 加载 → 求值 → 得结果」全链路（管线见 §2.4）。

**第一步 · 写规则**（`refund.erdl.yaml`）：

```yaml
protocol: "erdl/v2"
version: "2.2.0"
metadata:
  name: "refund-guard"
  description: "退款金额管控"
  category: coding
  decision: ALLOW
rules:
  - name: "SEC-001-refund-limit"
    description: "退款超过 5000 需人工审批"
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
    gloss: "tool.name equals issue_refund and tool.args.amount is greater than 5000"  # 引擎生成（G2）
    then: REQUEST_HUMAN
    message: "退款金额超过 5000，需人工审批"
```

**第二步 · 加载 + 校验 + 编译**：解析 YAML，校验通过后把 `when` 编译为表达式树（§2.4 步骤①②③）。

**第三步 · 求值**：给定事实对象：

```yaml
fact:
  tool:
    name: "issue_refund"
    args: { amount: 8000 }
```

规则 `SEC-001` 命中（`tool.name == "issue_refund"` 且 `amount > 5000`）。

**第四步 · 结果**：

```yaml
decision: REQUEST_HUMAN
matched_rules: ["SEC-001-refund-limit"]
primary_reason: "退款金额超过 5000，需人工审批"
total_evaluated: 1
total_matched: 1
```

若输入改为 `amount: 100`，规则不命中，走 `metadata.decision` fallback → `decision: ALLOW`。

### 10.2 完整示例

见 §4.2（Simple 规则）与 §5.3（Expression 规则）、§5.4（决策表）。

#### 10.2.1 状态块完整示例（§6a）

**状态块完整示例（§6a）**：

```yaml
protocol: "erdl/v2"
version: "2.2.0"
metadata:
  name: "delegated-refund-authority"
  description: "委托退款授权的撤销与新鲜度"
  category: security
  decision: DENY
state:
  - name: authorization
    values: [authorized, revoked]
    initial: revoked
    display_name: { zh: 授权状态, en: authorization state }
transitions:
  - on: bootstrap
    audit_as: DELEGATE
    reason: authorize
    when: { eq: [{ field: "state.authorization" }, "revoked"] }
    gloss: "authorization state equals revoked"  # 引擎生成（G2），lint 校验
    set: { authorization: authorized }
  - on: revoke
    audit_as: DELEGATE
    reason: revoke
    gloss: "true"                                # 无条件转移：字面量 true
    set: { authorization: revoked }
rules:
  - name: "SEC-001-revoked-denies-exercise"
    description: "授权已撤销时拦截受保护操作"
    priority: 10
    ring: 0
    when:
      logic: AND
      conditions:
        - field: "state.authorization"
          operator: eq
          value: revoked
    then: DENY
    message: "授权已撤销"
```

> 注意：`state` 块在 rules 求值前已由事件（`transitions`）更新；`state.*` 是受控注入（§6a.3），不是 fact 字段。

#### 10.2.2 求值输出示例（含 `state_snapshot`）

**求值输出示例（含 `state_snapshot`，V-STATE 雏形）**：上例经 `bootstrap`（授权）与 `revoke`（撤销）两次事件后，规则求值输出如下：

```yaml
# 事件序列（先于规则求值处理，eager）：
#   bootstrap → set authorization: authorized   （state_version 0 → 1）
#   revoke    → set authorization: revoked      （state_version 1 → 2）

decision: DENY                                  # 命中 SEC-001，authorization=revoked
matched_rules: ["SEC-001-revoked-denies-exercise"]
primary_reason: "授权已撤销"
total_evaluated: 1
total_matched: 1
temporal_state: null                            # 无 within/rate 命中
state_snapshot:                                 # §6a.5，进 DO 哈希原像
  values: { authorization: revoked }            # 求值读到的状态（on-demand，非全量）
  state_version: 2                              # 2 个成功事务（bootstrap + revoke）
  transitions_head: "sha256:…"                  # revoke 记录的哈希
canonical_trees: [ { ruleId: "SEC-001-…", tree: …, hash: "sha256:…" } ]
eval_warnings: []                               # 列表型字段空态为 []
errored: false
as_of: "2026-09-12T10:00:00Z"
```

### 10.3 一致性验证

#### 10.3.1 向量覆盖

本规范的语义 MUST 由可独立重算的测试向量证明。表达层向量（V-ENGINE / V-GLOSS / V-PROJ）覆盖：34 节点 × 4 场景（正常/边界/异常/空值）、E1-E12 语义、Simple 30 运算符编译映射、gloss 渲染模板；**状态层向量（V-STATE）**覆盖 §6a 全部 MUST 语义：事件对象校验（`event_id`/`on`/`actor`/`at`/`payload` 受限负载）、同变量冲突检查 (0)–(4) 正/反例与同事件 `audit_as` 一致性、单事件多规则原子性（遇首个 EvaluationError 即停止、全过则一次性提交）、守卫错误 fail-closed 与 `transition_error` 链位置（不应用 set/不递增版本/不移动 head）、`state_version`/`transitions_head` 重放验证、重复 `event_id` 幂等丢弃、无匹配事件静默、规则侧引用 `event.*`/未声明 `state.*` 加载失败、catch-all 与显式规则两趟交互、执行边界 check/act 重校验（`authorized@N → ALLOW@N → revoke@N+1` 于效果提交前、fail-closed，§6a.8）、最新权威头新鲜度（`authorized@N/HN → revoke@N+1/HN+1 → 还原历史前缀 → 重放通过 → 拒绝效果`，反回滚，§6a.9）。

#### 10.3.2 五步验证法

**五步验证法**：加载向量输入 → 生成表达式树 → 重算求值结果 → 与答案对比 → 判定一致。

#### 10.3.3 第三方 Runner 验证流程（从零到合规）

**第三方 Runner 验证流程（从零到合规）**：

1. 读本规范；
2. 用自己选择的技术栈实现独立验证器（不引用任何既有实现代码）；
3. 加载测试向量，逐字节比对；
4. 对照 Runner 契约确认自建实现满足契约；
5. 提交结果至实现注册表，供第三方审计复验。

---

## 附录 A · 34 节点参考表

| 组 | 节点 | 数量 |
|----|------|:---:|
| 取值 | field · var · 字面量 | 3 |
| 逻辑 | and · or · not | 3 |
| 比较 | eq · ne · gt · gte · lt · lte | 6 |
| 集合 | in | 1 |
| 字符串 | contains · match · starts_with · ends_with | 4 |
| 存在/量纲 | exists · length · between | 3 |
| 量词 | all · any · none | 3 |
| 算术 | add · sub · mul · div · round | 5 |
| 时间 | days_between · epoch_ms · date_add · date_part · month_last_day | 5 |
| 聚合 | aggregate（count/sum/avg/min/max） | 1 |

合计 **34 节点**。

## 附录 B · Simple 30 运算符参考表

| 族 | 运算符 | 数量 |
|----|------|:---:|
| 比较 | eq · ne · gt · gte · lt · lte | 6 |
| 列表 | in · not_in | 2 |
| 字符串 | contains · not_contains · match · starts_with · ends_with | 5 |
| 边界否定 | not_starts_with · not_ends_with | 2 |
| 存在性 | exists · not_exists | 2 |
| 长度 | length_gt · length_gte · length_lt · length_lte · length_eq | 5 |
| 范围 | between · not_between | 2 |
| 计数 | count_gt · count_gte · count_lt · count_lte | 4 |
| 修饰符 | within · rate | 2 |

合计 **30 运算符**（28 条件运算符 + 2 条件修饰符）。

## 附录 C · 决策类型枚举（13 种）

见 §6。

## 附录 D · 函数委派与规则分级

对于内核显式排除、确有需求的场景，提供函数委派（FnRegistry）作为受控兜底：

| 约束 | 说明 |
|------|------|
| 注册制 | 函数 MUST 注册方可引用，未注册不可调用 |
| 沙箱执行 | 受限环境，受资源配额与超时约束 |
| 确定性豁免声明 | 用于 Guard 求值路径的函数 MUST 声明并保证确定性 |
| 审计可溯 | 每次调用记入审计记录，可离线核验 |

> **fn 节点读状态（§6a）**：fn 节点**不属于 34 节点冻结内核**（附录 D 受控兜底，Grade C）——fn 的**参数**可引用 `state.*`/`event.*`（受控状态经 field 节点注入后作为参数传入）；但 fn 本身 MUST 保持确定性（上述「确定性豁免声明」），且**不得直接写状态**（状态只能由 `transitions[].set` 更新，§6a.3）。

**规则分级（Grade）**：

| Grade | 表达方式 | 审计 SLA |
|:---:|------|------|
| A | 纯 Simple（30 运算符） | 最高，纯文本可重算 |
| B | Expression 树 | 高，eval_trace MUST |
| C | 含函数委派 | 分层，C 级不得冒充纯文本可重算 |

含函数委派的规则（Grade C）MUST 在 gloss 中显式标记「含不可重算的函数委派」；函数委派的调用输入 + 输出哈希 MUST 纳入结果哈希的原像。

---

## 附录 E · 术语表

| 术语 | 一句话定义 |
|------|-----------|
| Entity（实体） | 规则作用的主体类型（agent/tool/task/workflow/human/guardian），字段引用的命名空间（§3） |
| Rule（规则） | `when → then` 决策单元 |
| DO（决策输出记录） | Decision Object：单次求值的密码学审计记录，JCS（RFC 8785）+ SHA-256，可独立验证 |
| genesis | 状态块加载时为 `initial` 生成的链起点审计记录（初始快照 + 文档规范树哈希，§6a.5） |
| transition_error | 转移守卫求值错误（EvaluationError）产生的链上一等记录（不应用 set、不递增版本、不移动 head，§6a.5） |
| event（事件对象） | 状态转移的触发输入 `{ event_id, on, at, actor, payload }`（§6a.7） |
| actor | 已认证的事件源标识（身份层提供，进转移审计记录，§6a.7） |
| when | 规则触发条件（编译为表达式树） |
| then | 规则命中后的决策类型（§6） |
| tier | 规则层级 0–5，由低到高表示约束强度；tier 0–2 用 Simple，≥3 可用 Expression |
| ring | 执行环 0–3（内核/恢复/审批/建议），求值按环序执行 |
| Guard 上下文 | 安全边界的求值上下文（参考实现 `evaluate()`）；求值错误一律 fail-close（E12），覆盖所有 tier |
| 非 Guard 上下文 | 模拟/分析等非安全边界的求值；tier 3-5 的求值错误折叠 false（E12） |
| override | 覆盖级别 critical > high > normal > low，仅允许 DENY → ALLOW 方向 |
| 表达式树 | 求值语义内核（34 节点，10 组），三种书写形态编译归一化到它 |
| canonical_tree | 规范化树，唯一哈希、唯一重算的基准对象（§8.2） |
| gloss | 从树确定性生成的自然语言可读投影（§5.5） |
| eval_trace | 逐节点求值轨迹（可重算派生产物，不进哈希，E6） |
| eval_warnings | 求值过程中的非致命警告（E3） |
| errored | 求值是否发生错误（E3）：EvaluationError（除零/非法日期/元数错误/算术类型不匹配）→ true（即便 E12 折叠为 false）；类型不匹配比较与空值传播 → false |
| temporal_state | **时序状态**：within/rate 滑动窗口状态（有状态算子，计数语义）——与「授权状态」（state block）异义 |
| 状态块（state block） | **授权状态**：§6a 声明的命名状态机（`state` 顶层块 + `transitions` 转移规则）——与「时序状态」temporal_state 异义，两者互不共享命名空间 |
| 状态变量（state variable） | 状态块声明的命名状态（§6a），`state.<name>` 命名空间，仅由转移规则更新 |
| 状态空间（state space） | 文档声明的全部状态变量及其枚举值集合（有限，受资源上限约束） |
| 状态转移（state transition） | 事件触发的确定性状态变更 `state.<name> ← value`（状态机 F 函数，§6a.2） |
| 受控注入（controlled injection） | 引擎持有的输入（as_of/temporal_state/state.*），外部不可写，仅由引擎机制更新（§6a.3、E1） |
| state_snapshot | 求值时状态快照，进 DO 哈希原像（§6a.5） |
| 执行边界（enforcement boundary） | 消费 §6a 决策并提交被门控副作用的组件（Action Guard / 工具调用守卫，§6a.8） |
| check/act 原子性 | §6a.8 义务：授权决策与被门控副作用提交之间，无授权谱系状态变更落地 |
| 最新权威头（latest authoritative head） | 同一文档实例当前最新的权威状态锚点 `{state_version, transitions_head}`；跨重启/恢复/副本边界需外部锚点确立新鲜度（§6a.9） |
| 持久新鲜度锚点（durable freshness anchor） | 组织/部署层提供的持久锚点，跨重启/恢复/副本边界确立最新权威头的新鲜度（单调 epoch / 持久锚点 / 签名 checkpoint / 共识背书）；执行边界据此判定恢复状态是否足够新鲜（§6a.9） |
| 授权基础（authorization basis） | 某权威的**来源**——建立/重建该权威的 root grant 或独立验证的 re-authorization 决策对象；区别于授权根（有权建立它的 principal）与起源权威链（谱系）。撤销按授权基础收敛：撤销一个授权基础只移除该基础可导出的权威（§6b.4） |
| 授权根源（authorization root） | 有权建立/重建某授权的 principal/authority；授权「可行使化」转移的事件 `actor` MUST 归因于它（§6a.10） |
| 委派链（delegation chain） | 多个授权关系沿「授权根 → 中间节点 → 被授权主体」的组合（§6b） |
| 有效权威（effective authority） | 主体实际可行使的权限；MUST ⊆ 起源权威链（§6b） |
| 起源权威链（authority chain） | 从授权根到被授权主体的完整授权谱系；有效权威 MUST 是它的子集（§6b） |
| 委托权威不变量（delegated-authority invariants） | 委派链的五条安全不变量 INV-01~05（权威不放大/溯源连续/窄化继承/传递撤销/能力边界轴，§6b） |
| 转移合法性（transition validity） | 引擎验证转移：仅执行声明的转移、值属枚举、未声明转移不执行（fail-closed） |
| as_of | 引擎注入的求值时刻（UTC，E9） |
| 事实对象（fact） | 求值输入，承载 Entity 当前状态（§7.0.1） |
| fallback 决策 | 无规则命中时 metadata.decision 的兜底裁决（§2.2） |
| NFC | Unicode 规范化形式 C（字符串归一，E10） |
| ReDoS | 正则拒绝服务攻击；match 节点 MUST 步数上限防护（§7.3(d)） |
| half-even | 银行家舍入（ROUND_HALF_EVEN），E2 定点小数输出舍入 |
| 空值传播 | 字段缺失统一返回 false 的安全失败语义（E11） |
| 求值口径 | E2 定点小数的运算输出精度（scale=14 + half-even 字符串序列化）；不进入 canonical_tree 哈希 |
| 编码口径 | §8.2 数字字面量的 canonical 序列化（JCS number）；进哈希 |

---

## 修订历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.2 | 2026-09-17 | 落实 conformance 向量 AV-15（re-authorization provenance，§6a.10）与 AV-16（multi-root basis-scoped revocation，§6b.4）——各为 attack（→DENY）/legal（→ALLOW）双面的单一向量；§6a.10/§6b.4 的 V-STATE 标注对应向量编号；§6b.5 对抗向量族由「AV-01~14 + AV-15/16」对齐为「AV-01~16」（修正「两向量」表述：AV-15/16 非两个独立 DENY/ALLOW 向量，而是各含双面） |
| v2.2 | 2026-09-16 | 新增 §6b.4 按授权基础收敛的撤销（basis-scoped revocation，多根组合）——主体有效权威是其当前有效各授权基础可导出权威的并集；`revoke(basis-X)` 移除恰恰好 basis-X 可导出的权威（不多：下游完整传递闭包；不少：其他授权基础的贡献保留）；MUST NOT 把主体权威归约为单一主体级全局 revoked/authorized 位（禁止过撤销与欠撤销）；存活授权基础 MUST NOT 保留只属于已撤销谱系的权威；将 INV-04 的「下游子树」细化为按授权基础相对；术语表新增 authorization basis |
| v2.2 | 2026-09-15 | §6 决策类型补设计说明：13 种决策类型的设计思想——AI 时代发挥 LLM 价值而非简单放行/拒绝；五类分组（放行与拦截 / 引导而非放弃 / 人机协同 / 安全兜底 / 过程性） |
| v2.2 | 2026-09-15 | 新增 §6a.9 最新权威头新鲜度（反回滚，集成要求）——成功重放验证 ≠ 状态最新（区分完整性/来源与新鲜度）；授权敏感副作用前执行/恢复边界 MUST 确立 `{state_version, transitions_head}` 是最新权威头（未被后续权威状态取代），机制实现中立（单调 epoch/持久锚点/签名 checkpoint/共识背书）；无法确立新鲜度即 fail-closed；V-STATE 增 `authorized@N/HN → revoke@N+1/HN+1 → 还原历史前缀 → 重放通过 → 拒绝效果` 的反回滚向量 |
| v2.2 | 2026-09-15 | §6a.9 分层澄清（回应 Finding 2 收尾）：持久新鲜度锚点由组织/部署层负责提供；保留 fail-closed 属性——执行边界无法确立恢复的 `{state_version, transitions_head}` 相对权威持久化状态足够新鲜时，受保护效果 MUST NOT 继续执行；成功重放/完整性验证不构成「权威仍最新」的充分证据 |
| v2.2 | 2026-09-15 | 新增 §6a.10 授权建立/重建的根源绑定（授权根源 provenance，集成要求）——授权「可行使化」转移 MUST 有授权根源（actor 归因于有权建立该授权的 principal）；撤销后 re-authorization MUST 有新的有效授权基础；被授权主体 MUST NOT 自恢复被撤销授权；授权根源资格判定是边界/组织层集成义务（无法确立即 fail-closed）；V-STATE 增 授权根建立→撤销→非授权根 re-authorize→尝试效果（DENY）与 授权根重建→ALLOW 两向量 |
| v2.2 | 2026-09-15 | 新增 §6b 委托权威安全模型（组织行为层）——总纲「委派不得制造权威」；五条不变量 INV-01~05（权威不放大/溯源连续/窄化继承/传递撤销/能力边界轴，每条=性质+违反形态+规范性断言）；撤销新鲜度机制中立；对抗向量族 AV-01~14 + AV-15/16 |
| v2.2 | 2026-09-14 | 新增 §6a.8 执行边界 check/act 原子性（集成要求）——授权依赖 §6a 状态的安全敏感副作用，执行边界 MUST 重校验或封闭同步边界，使决策与效果之间无授权谱系状态变更落地；引擎暴露重校验原语、边界履行义务（保留 E1 纯性）；V-STATE 增 `authorized@N → ALLOW@N → revoke@N+1 → 尝试执行效果` 的 fail-closed 向量 |
| v2.2 | 2026-09-12 | 新增 §6a 状态块与状态转移（受控状态源）：`state`/`transitions` 两个可选顶层字段；状态受控注入（`state.*` 复用 field 节点，不新增节点）；资源上限（≤4 变量/2–4 枚举/≤256 组合/≤32 转移规则/≤16 事件名/≤8 键 payload） |
| v2.2 | 2026-09-12 | 状态转移审计闭环：转移链 + 快照 + 合法性 + 出处锚定；`state_snapshot` 扩展为 {values,state_version,transitions_head}，键按状态变量名码点升序 + 字符串 NFC 规范化 |
| v2.2 | 2026-09-12 | 同变量冲突可判定互斥检查（(0)-(4) sound 约束：无条件唯一 + 仅顶层合取项作证明依据，宁拒勿纵） |
| v2.2 | 2026-09-12 | §6a.7 事件与转移求值上下文：事件对象 event_id/on/at/actor/payload；守卫只读 state.*+event.*，不读自由 fact |
| v2.2 | 2026-09-12 | 事件处理原子性（按定义顺序逐条求值→遇首个 EvaluationError 即停止不提交任何 set fail-closed→全过则一次性提交；单事件内顺序不影响结果）；事件注入认证（actor 进审计记录、未认证拒绝）；并发串行化（事件处理与 evaluate 互斥）；genesis 记录（initial 生成初始快照 + 规范树哈希） |
| v2.2 | 2026-09-12 | 加载时校验全集（任意表达式位置引用未声明 state.<name>、field 恰为 state、transitions.when 引用自由 fact 均拒绝）；状态作用域（仅首段为 state 进受控命名空间，context.state.* 仍走 fact 但 lint 警告） |
| v2.2 | 2026-09-12 | `decision` 更名 `audit_as`（仅审计承载、不参与求值/短路，取值收窄为 {ALLOW,NOTIFY,DELEGATE,ESCALATE,REQUEST_HUMAN}）；`transitions` 增 `enabled`（默认 true）、`reason` 约束（`[a-z][a-z0-9_]{0,31}` + 文档内唯一）；`state` 增 `display_name`（双语，gloss 取 en 回退 name） |
| v2.2 | 2026-09-12 | `transitions.when` 节点白名单（Simple 条件 + 时间节点，禁量词/算术/聚合/fn/within/rate）；状态机无时间触发器（新鲜度靠外部 sweeper 或守卫时间比对） |
| v2.2 | 2026-09-12 | §7.0.2 求值算法补事件先行声明（步骤 0）与 catch-all 惰性两趟、修正 WORKFLOW 交叉引用（状态机区分 §6 工作流 / §6a 授权）；§7.0.3 新增 `state_snapshot` 输出字段（进哈希原像）；E1 扩展授权状态快照为受控外部输入；术语表补状态变量/状态空间/状态转移/受控注入/state_snapshot/转移合法性 |
| v2.1 | 2026-09-12 | §8.2 字面量规范的数字 canonical 编码定为 JCS（RFC 8785）IEEE 754 number 序列化（对齐参考实现）；区分「求值口径」（E2 定点小数）与「编码口径」（§8.2 canonical 序列化）；E12 明确 Guard 上下文语义（Guard 上下文覆盖所有 tier 一律 fail-close；非 Guard 上下文 tier≤2 fail-close、tier 3–5 折叠 false）；术语表补「非 Guard 上下文」「求值口径」「编码口径」；§7.3(a) 明确字段缺失算术分界（比较节点→false、算术节点→EvaluationError）；§7.0.2/§7.0.3 与 E12 口径统一 |
| v2.1 | 2026-09-10 | §7.3(c) 明确一致性比较的是 scale-14 定点值**数值**（尾零不敏感：`"35"` ≡ `"35.0"`），而非字符串拼写——十进制字符串是*编码*，不是比较单位；§7.3(a) 将 warning 不对称扩展至逻辑节点（`and`/`or` 非布尔操作数静默折叠）与量词（`all`/`any`/`none` 非数组操作数记 `type_mismatch`）；§7.3(b) 明确量词非数组 `over`；§7.3(d) 明确 ReDoS 折叠（`false` + `regex_re_dos`、`errored: false`）；§7.3(g) 新增：E4 结构性资源限制违规抛出（`value: null` + `threw: true`），E5 互斥记录 `value: true`；§5.5 补 gloss 渲染细节（not(eq) 规范化、字符串/list 字面量带引号、算术带括号）；§7.3(a) 明确 `errored` 口径：`in`/字符串/`length`/`aggregate` 记 `type_mismatch` warning 但 `errored: false`（仅 warning，非 E3 的 EvaluationError） |
| v2.1 | 2026-09-09 | §7.3(a) 补 warning 不对称标注（比较/`between` 静默 false 无 warning；`in`/字符串/`length`/`aggregate` 记 `type_mismatch`）；§5.5 gloss 渲染模板英文措辞对齐实际渲染（`in`/`between`/`length`/`match`/`epoch_ms`/`date_part`/`date_add`/`aggregate`/`quantifier`/`var`）；§5.5 gloss 渲染语言定为英文 canonical（G3 display_name 取英文值；中文模板为展示层可选投影，不参与跨实现验证）；§7.2 E3 / §7.3(a) / 附录 E 补 `errored` 求值错误标志语义：EvaluationError（除零/非法日期/元数错误/算术类型不匹配）→ `errored=true`（即便 E12 折叠为 false）；类型不匹配比较与空值传播 → `errored=false`（非错误） |
| v2.1 | 2026-09-05 | §7.1 新增第 6 条：空条件规则（catch-all/兜底）MUST NOT 改写显式条件规则所确立的决策（双向）；兜底规则仅在无显式条件规则命中时生效；§7.3(f) 明确 date-time 输入解析为整秒精度（不支持小数秒），跨实现对齐 |
| v2.1 | 2026-09-04 | §7.3(d) 明确安全语法子集为「正则语言」：禁止反向引用（`\1`–`\9`、`\k<name>`）与环视（`(?=)`/`(?!)`/`(?<=)`/`(?<!)`）；明确内联大小写标志不提供（匹配始终大小写敏感） |
| v2.1 | 2026-09-03 | §4.1 新增 `category`（规则级覆盖）、`enabled`（启用标志）、`correction`（CORRECT 纠偏文本）三个可选字段，补全字段表与固定顺序；§7.0.3 补 `primary_correction` 来源交叉引用。协议 `erdl/v2` 不变；规则格式版本 2.0.0 → 2.1.0（新增可选字段，Non-breaking） |
| v2.0 | 2026-08-30 | 定稿 |

---

## 规范性引用

- **[RFC 2119]** Key words for use in RFCs to Indicate Requirement Levels.

---

*© 2026 深圳市秒镜科技有限公司 · MIT License*
