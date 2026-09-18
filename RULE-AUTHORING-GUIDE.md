# ERDL 表达力参考手册

> 面向没接触过 ERDL 的普通开发者。统一用「保险行业」做例子域——保险条款本身就是规则，等待期、除外责任、免赔额、赔付比例这些概念大家都懂。
> 目标：看完能对着一条业务条款，写出对应的规则。

---

## 0. ERDL 是什么（30 秒）

**一句话**：把「规则 / 制度 / 法规 / 标准」写成「机器可执行、可验证、可追溯」的确定性规则。

一条规则 = **条件（when）+ 结论（then）+ 说明文本**。下面是完整的最小例子：

```yaml
protocol: "erdl/v2"
metadata:
  name: "health-insurance-claims"
  decision: ALLOW                      # 没命中任何规则时的兜底结论
rules:
  - name: "SEC-001-waiting-period"
    description: "等待期内确诊不赔"
    priority: 10
    when:
      logic: AND
      conditions:
        - field: "确诊日期与生效日间隔天数"
          operator: lt
          value: 90
    then: DENY
    message: "等待期 90 天内确诊，不予赔付"
```

读法：**当「确诊日距生效日不足 90 天」时 → 拒绝，并给出理由。**

---

## 1. 先看「结果」：13 种决策类型 = 规范力

ERDL 的结论（`then`）不是「放行/拒绝」两态，而是 13 种**规范力**，对应法规措辞的「必须 / 应该 / 可以」：

| 规范力 | 法规措辞 | 决策类型 | 一句话 |
|---|---|---|---|
| 禁止 | 「禁止」「不得」「不承担」 | DENY / EMERGENCY_HALT / ROLLBACK / QUARANTINE | 不许做 |
| 必须 | 「必须」「须」 | （强制规则：when 命中必触发） | 必须满足 |
| 应该 | 「应当」「宜」「建议」 | **CORRECT（纠偏）/ GUIDE（引导）/ NOTIFY（提示）** | 建议这样 |
| 可以 | 「可以」「允许」「有权」 | ALLOW / DELEGATE / DEFER | 允许做 |
| 必须人介入 | 「报请」「由…决定」 | REQUEST_HUMAN / ESCALATE | 转给人 |
| 流程 | 「按流程」 | WORKFLOW | 走流程 |

例子：

```yaml
# 应该 → 纠偏（发现保单信息填错，纠正后重来）
- name: "COR-001-fix-id"
  when: { conditions: [{ field: "身份证号", operator: ne, value: { field: "投保人身份证号" } }] }
  then: CORRECT
  correction: "身份证号与投保人不符，请核对后重新提交"

# 必须人介入 → 大额理赔转人工
- name: "HUM-001-large-claim"
  when: { conditions: [{ field: "理赔金额", operator: gt, value: 500000 }] }
  then: REQUEST_HUMAN
  message: "大额理赔，转人工复核"
```

---

## 2. 条件（when）的两种写法

**① Simple 形式（28 个运算符）**：扁平、最常用、门槛低（tier 0–2 安全基线）。

```yaml
when:
  logic: AND                    # AND 或 OR
  conditions:
    - field: "字段路径"
      operator: eq              # 28 个运算符之一
      value: "比较值"
```

**② Expression 形式（34 个节点）**：完整表达式树，可嵌套逻辑、量词、算术、时间、聚合（tier ≥3 业务全景）。

```yaml
when:
  expr:
    and:                        # 节点名作为 key，子表达式作为 value
      - { eq: [{ field: "a" }, 1] }
      - { or: [{ field: "b" }, { field: "c" }] }
```

> 一句话区分：**Simple 只能「扁平地 AND/OR 一堆条件」；Expression 能「任意嵌套组合」。** 本手册第 3 节按节点分组，标注哪些有 Simple 运算符对应。

---

## 3. 运算符 / 节点速查（按组 + 保险例子）

### 3.1 值（field / var / literal）—— 引用数据

| 节点 | 一句话 | 类比 | 写法 |
|---|---|---|---|
| `field` | 读一个字段 | 变量取值 | `{ field: "保单.生效日" }` |
| `var` | 读上下文变量 | 环境变量 | `{ var: "$" }` 或 `{ var: "$.taskId" }` |
| `literal` | 写死一个值 | 常量 | 直接写 `90`、`"恶性肿瘤"`、`true` |

### 3.2 比较（eq / ne / gt / gte / lt / lte）—— 比大小、比相等

Simple 运算符：`eq` `ne` `gt` `gte` `lt` `lte`。Expression 节点同名。

| 运算符 | 一句话 | SQL 类比 |
|---|---|---|
| `eq` | 等于 | `=` |
| `ne` | 不等于 | `<>` |
| `gt` | 大于 / 晚于 | `>` |
| `gte` | 大于等于 | `>=` |
| `lt` | 小于 / 早于 | `<` |
| `lte` | 小于等于 | `<=` |

**保险例子：**

```yaml
# 等待期：确诊日距生效日 < 90 天 → 拒
- when: { conditions: [{ field: "确诊日距生效日", operator: lt, value: 90 }] }
  then: DENY

# 保额上限：累计赔付 > 保额 → 拒
- when:
    expr: { gt: [{ field: "累计赔付金额" }, { field: "保单保额" }] }
  then: DENY
  message: "累计赔付已超保额上限"
```

### 3.3 集合（in / not_in）—— 属于 / 不属于清单

Simple 运算符：`in` `not_in`。Expression 节点：`in`（`not_in` 编译成 `not(in(...))`）。

- 类比：SQL 的 `IN (...)` / `NOT IN (...)`。
- `in` 的右侧必须是数组（清单）。

**保险例子：**

```yaml
# 除外医院：就诊于康复/疗养/护理院 → 拒
- when: { conditions: [{ field: "就诊医院类型", operator: in, value: ["康复医院", "疗养院", "护理院"] }] }
  then: DENY

# 除外疾病：病种不在承保清单 → 拒
- when: { conditions: [{ field: "病种代码", operator: not_in, value: "承保病种清单" }] }
  then: DENY
```

### 3.4 字符串（contains / match / starts_with / ends_with + 否定版）

Simple 运算符：`contains` `not_contains` `match` `starts_with` `ends_with` `not_starts_with` `not_ends_with`。
Expression 节点：`contains` `match` `starts_with` `ends_with`。

| 运算符 | 一句话 | 类比 |
|---|---|---|
| `contains` | 包含子串 | SQL `LIKE '%x%'` |
| `starts_with` | 以…开头 | `LIKE 'x%'` |
| `ends_with` | 以…结尾 | `LIKE '%x'` |
| `match` | 正则匹配（安全子集） | 正则 |

> `match` 是**安全正则**：禁反向引用、禁 lookaround、大小写敏感，防止 ReDoS。

**保险例子：**

```yaml
# 诊断包含「恶性肿瘤」→ 按重疾条款
- when: { conditions: [{ field: "出院诊断", operator: contains, value: "恶性肿瘤" }] }
  then: ALLOW

# 身份证以「44」开头（广东）→ 地区核验
- when: { conditions: [{ field: "身份证号", operator: starts_with, value: "44" }] }
  then: NOTIFY
```

### 3.5 存在 / 度量（exists / not_exists / length / between + length_* / count_*）

Simple 运算符：`exists` `not_exists` `length_gt` `length_gte` `length_lt` `length_lte` `length_eq` `between` `not_between` `count_gt` `count_gte` `count_lt` `count_lte`。
Expression 节点：`exists` `length` `between`。

| 运算符 | 一句话 | 类比 |
|---|---|---|
| `exists` | 字段存在（非空） | `IS NOT NULL` |
| `not_exists` | 字段缺失 | `IS NULL` |
| `length` | 字符串/数组长度 | `LENGTH()` |
| `between` | 数值落在闭区间 [min, max] | `BETWEEN` |
| `count_*` | 数组元素个数比较 | `COUNT()` |

**保险例子：**

```yaml
# 材料缺失：未上传病理报告 → 转人工补正
- when: { conditions: [{ field: "病理报告", operator: not_exists, value: true }] }
  then: REQUEST_HUMAN
  message: "缺少病理报告，需补正"

# 投保年龄 18–60 周岁
- when: { conditions: [{ field: "年龄", operator: between, value: [18, 60] }] }
  then: ALLOW

# 身份证号长度必须是 18 位
- when: { conditions: [{ field: "身份证号", operator: length_eq, value: 18 }] }
  then: DENY
```

### 3.6 逻辑（and / or / not）—— 组合多个条件

Expression 节点：`and` `or` `not`（可任意嵌套）。Simple 形式用 `logic: AND/OR`（扁平）。

- 类比：编程的 `&&` / `||` / `!`。
- `and` / `or` 是多参数（可以接 2 个以上）。

**保险例子：**

```yaml
# 带病投保 = 曾患重疾 AND 投保日晚于确诊日
- when:
    expr:
      and:
        - { eq: [{ field: "曾患重疾标志" }, true] }
        - { gt: [{ field: "投保日期" }, { field: "确诊日期" }] }
  then: DENY
  message: "带病投保，不予承保"

# 除外责任 = 酒驾 OR 无证驾驶 OR 驾驶无牌车
- when:
    expr:
      or:
        - { eq: [{ field: "事故原因" }, "酒驾"] }
        - { eq: [{ field: "事故原因" }, "无证驾驶"] }
        - { eq: [{ field: "事故原因" }, "无牌车"] }
  then: DENY
```

---

### 3.7 量词（all / any / none）—— 对清单逐项判断

- 类比：编程的 `every()` / `some()` / 「全都不」
- 语义：对数组每个元素判断一个条件；**空数组 → 三个都返回 false**（防「真空真理」）
- 写法：`{ all: { binding: "x", over: <数组>, predicate: <条件> } }`，predicate 里用 binding 名引用每个元素

**保险例子：**

```yaml
# 所有票据日期都在住院期内（否则拒）
- when:
    expr:
      all:
        binding: "b"
        over: { field: "票据清单" }
        predicate:
          between:
            - { var: "$b.日期" }
            - { field: "住院开始日" }
            - { field: "住院结束日" }
  then: DENY
  message: "存在住院期外的票据"

# 任意一张票据金额为负（异常）→ 转人工
- when:
    expr:
      any:
        binding: "b"
        over: { field: "票据清单" }
        predicate: { lt: [{ var: "$b.金额" }, 0] }
  then: REQUEST_HUMAN
  message: "票据金额异常，转人工"

# 没有任何一项免责条款触发
- when:
    expr:
      none:
        binding: "c"
        over: { field: "免责条款清单" }
        predicate: { eq: [{ var: "$c.触发" }, true] }
  then: ALLOW
```

> 注：predicate 内引用当前元素用 `var`（如 `$b.日期`），具体 `var` 绑定语法以 spec §5.3 为准。

### 3.8 算术（add / sub / mul / div / round）—— 算数值

- 类比：`+` `-` `*` `/` 与四舍五入
- 固定点十进制确定性运算（128 位有理数，非浮点，跨实现字节一致）

**保险例子：**

```yaml
# 保费 = 保额 × 费率（保额 100 万 × 0.3% = 3000）
- when:
    expr: { ne: [{ mul: [{ field: "保费" }, { field: "费率" }] }, { field: "应收保费" }] }
  then: CORRECT
  correction: "保费计算不符，请核对"

# 剩余可赔 = 保额 − 已赔付，小于 0 → 超保额
- when:
    expr: { lt: [{ sub: [{ field: "保单保额" }, { field: "累计已赔付" }] }, 0] }
  then: DENY
  message: "已超保额上限"
```

### 3.9 时间（days_between / epoch_ms / date_add / date_part / month_last_day）—— 算日期

- 类比：Excel 日期函数；统一按 UTC 计算，跨时区字节一致

| 节点 | 一句话 | 写法 |
|---|---|---|
| `days_between` | 两个日期相隔天数（向下取整） | `{ days_between: [从, 到] }` |
| `epoch_ms` | 转毫秒时间戳 | `{ epoch_ms: 日期 }` |
| `date_add` | 日期加一段时长（years/months/days/hours） | `{ date_add: { unit: "days", base: 日期, amount: 90 } }` |
| `date_part` | 取日期某部分（年/月/日/周几） | `{ date_part: { unit: "month", arg: 日期 } }` |
| `month_last_day` | 当月最后一天 | `{ month_last_day: 日期 }` |

**保险例子：**

```yaml
# 等待期：确诊日距生效日 < 90 天
- when:
    expr: { lt: [{ days_between: [{ field: "生效日" }, { field: "确诊日" }] }, 90] }
  then: DENY

# 保单已过期：到期日 = 生效日 + 1 年，今天晚于到期日
- when:
    expr:
      gt:
        - { field: "今天" }
        - { date_add: { unit: "years", base: { field: "生效日" }, amount: 1 } }
  then: DENY
  message: "保单已过期"
```

### 3.10 聚合（count / sum / avg / min / max）—— 对清单汇总

- 类比：SQL 的 `COUNT()` / `SUM()` / `AVG()` / `MIN()` / `MAX()`
- 写法：函数名就是 key，`{ sum: <数组> }`、`{ count: <数组> }`
- 空数组安全折叠：count=0、sum=0、avg/min/max=false（防除零/无穷）

**保险例子：**

```yaml
# 历史理赔次数 ≥ 3（风控）→ 转人工
- when:
    expr: { gte: [{ count: { field: "历史理赔记录" } }, 3] }
  then: REQUEST_HUMAN
  message: "多次理赔，转人工风控"

# 累计赔付金额 ≥ 保额
- when:
    expr: { gte: [{ sum: { field: "历次赔付金额" } }, { field: "保单保额" }] }
  then: DENY
  message: "累计赔付已达保额上限"
```

### 3.11 修饰符（within / rate）—— 时间窗去重 / 频次限流

- 类比：去重、限流（nginx limit_req）
- 它们是**条件的修饰字段**（不是独立运算符），写在某个条件后面
- `within: "30d"`：窗口内去重（第 1 次放行并记录，窗口内第 2 次触发）
- `rate: "2/1s"`：限流（前 2 次放行，第 3 次触发）
- 这两者是**有状态**算子，状态由引擎单独管理、进审计记录

**保险例子：**

```yaml
# 同一保单 30 天内重复报案 → 拒
- name: "SEC-011-dup-claim"
  when:
    conditions:
      - field: "报案保单号"
        operator: eq
        value: { field: "保单号" }
        within: "30d"            # 修饰符：30 天窗口内同一保单号去重
  then: DENY
  message: "30 天内重复报案"

# 接口限流：每秒最多 2 笔
- name: "SEC-012-rate"
  when:
    conditions:
      - field: "接口名"
        operator: eq
        value: "理赔查询"
        rate: "2/1s"             # 修饰符：每秒最多 2 次
  then: DENY
  message: "超出接口限流"
```

---

## 4. 组合与多重组合

从「单运算符」到「多重组合」，一步步加复杂度：

**① 单条件**（等待期）

```yaml
when: { conditions: [{ field: "确诊日距生效日", operator: lt, value: 90 }] }
```

**② 组合（AND 多个条件）**

```yaml
# 带病投保：曾患重疾 AND 投保晚于确诊
when:
  logic: AND
  conditions:
    - { field: "曾患重疾标志", operator: eq, value: true }
    - { field: "投保日期", operator: gt, value: { field: "确诊日期" } }
```

**③ 多重组合（嵌套 and/or + 算术 + 时间 + 量词 + 聚合）**

```yaml
# 一条复杂风控规则：
# (累计赔付 + 本次申请 > 保额) OR (历史理赔次数 ≥ 3 且 本次金额 > 10 万)
when:
  expr:
    or:
      - gt:
          - add:
              - { sum: { field: "历次赔付金额" } }
              - { field: "本次申请金额" }
          - { field: "保单保额" }
      - and:
          - { gte: [{ count: { field: "历史理赔记录" } }, 3] }
          - { gt: [{ field: "本次申请金额" }, 100000] }
```

这条规则用到了：**嵌套 or/and + 算术 add + 聚合 sum/count + 比较 gt/gte + 字段引用**——一个节点族的完整组合。

---

## 5. 速查表

| 类别 | 节点/运算符 | 一句话 | 类比 |
|---|---|---|---|
| 值 | field / var / literal | 读字段 / 读变量 / 常量 | 变量、常量 |
| 比较 | eq ne gt gte lt lte | 等于/不等/大于/≥/小于/≤ | SQL 比较 |
| 集合 | in / not_in | 属于/不属于清单 | `IN` / `NOT IN` |
| 字符串 | contains match starts_with ends_with（+否定版） | 包含/正则/开头/结尾 | `LIKE`、正则 |
| 存在 | exists not_exists | 字段有/无 | `IS NULL` |
| 度量 | length between length_* count_* | 长度/区间/计数 | `LENGTH`/`BETWEEN`/`COUNT` |
| 逻辑 | and or not | 与/或/非（可嵌套） | `&&` `\|\|` `!` |
| 量词 | all any none | 全满足/任一满足/全不满足 | `every()`/`some()` |
| 算术 | add sub mul div round | 加减乘除四舍五入 | `+ - * /` |
| 时间 | days_between epoch_ms date_add date_part month_last_day | 相隔天数/时间戳/加时长/取部分/月末日 | Excel 日期函数 |
| 聚合 | count sum avg min max | 计数/求和/均值/最小/最大 | SQL 聚合 |
| 修饰符 | within rate | 窗口去重/限流 | 去重、限流 |

---

> 完整规范见 `erdl-language-spec`；本文是面向普通开发者的速查 + 例子，语法细节以规范为准。
