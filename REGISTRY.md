# ERDL Registry —— 命名空间与注册项登记簿

> 中文 | [English](./REGISTRY.en.md)
> **最后更新**：2026-09-04 — 初版：从 `src/erdl-schema.ts` 单一事实源提取注册项，建立对外登记簿。

> **定位**：本文件是 ERDL **可扩展注册项**的对外登记簿。冻结的语义枚举（34 节点 / 30 运算符 / 13 决策 / 20 表达树类型）见 [erdl-spec.md](./erdl-spec.md)，本文件**只引用、不复制**。注册项的唯一代码事实源是 [`src/erdl-schema.ts`](./src/erdl-schema.ts)（前缀 / 分类）与 [`src/fn-registry.ts`](./src/fn-registry.ts)（函数委派）；本文件是它们的对外可读投影，二者冲突时以代码事实源为准。

---

## 1. 规则名前缀（CAT prefix → 分类）

> **注册制、可扩展、非封闭集**。新业务域前缀 MUST 先在此登记并同步 `erdl-schema.ts` 后才能使用——**「先用后注册」禁止**。命名门禁（`rule-validator`）无条件对照本表校验。

| 前缀 | 分类 | 说明 |
|------|------|------|
| `SEC` | security | 安全规则 |
| `COD` | coding | 编码规范 |
| `ENG` | engineering | 工程纪律 |
| `PRF` | performance | 性能 |
| `TST` | testing | 测试 |
| `WRT` | writing | 写作 |
| `OBS` | observability | 可观测性 |
| `CUS` | custom | 自定义 |
| `ETH` | compliance | 伦理（Ethics） |
| `CMP` | compliance | 合规（Compliance） |
| `POL` | compliance | 政策（Policy） |
| `CNV` | writing | 惯例（Convention） |

## 2. 规则分类（11）

规则的组织分类。分类枚举**非冻结**，可扩展（新增分类须同步登记前缀，见 §6）。

`coding` · `engineering` · `security` · `writing` · `design` · `performance` · `testing` · `compliance` · `accessibility` · `observability` · `custom`

> ⚠️ **无前缀分类**：`design` 与 `accessibility` 两个分类当前**尚无已注册前缀**。需要以这两个分类约束规则时，须先按 §6 注册新前缀（如 `DSN`→design、`A11Y`→accessibility），方可使用。

## 3. 禁用前缀（6）

以下前缀被命名门禁**无条件拒绝**，不可用于规则名（用于测试/临时代码，避免混入生产规则集）：

`test-` · `old-` · `temp-` · `debug-` · `wip-` · `tmp-`

## 4. 规则名格式

规则名 MUST 匹配 `[CAT]-[NNN]-[description]`：

- `[CAT]`：2–4 位大写前缀，必须在 §1 表中登记；
- `[NNN]`：3–4 位数字编号；
- `[description]`：英文小写 kebab-case 描述。

正则（与 `rule-validator` 一致）：`^[A-Z]{2,4}-(\d{3,4})-[a-z0-9][a-z0-9-]*$`

示例：`SEC-001-block-exec` · `CMP-014-gdpr-erasure` · `CNV-003-large-write-advisory`

## 5. 函数委派注册（FnRegistry）

ERDL 内核显式排除、确有需求的场景，经 [`src/fn-registry.ts`](./src/fn-registry.ts) 的受控兜底：注册 `fn` 并在规则中以 `fn:<name>` 委派。

| 字段 | 类型 | 说明 |
|------|------|------|
| `signature.name` | string | 函数名（注册唯一键，重复注册抛错） |
| `signature.signature` | string | 签名描述，如 `isBusinessHours(tz) → boolean` |
| `signature.params` | string[] | 参数名列表 |
| `signature.returns` | string | 返回类型 |
| `impl` | function | 实现 |
| `timeoutMs` | number | 超时（默认 5000） |
| `onTimeout` | `'throw' \| 'fallback'` | 超时降级（默认 `throw`） |
| `fallbackValue` | unknown | `onTimeout='fallback'` 时的回退值 |
| `sandbox` | `'pure' \| 'network' \| 'filesystem'` | 沙箱范围（默认 `pure`） |
| `deterministic` | boolean | 确定性声明；Guard 求值路径上的 fn **必须**声明并保证确定性（默认 false，不可上求值路径） |

## 6. 注册流程（如何新增一项）

新增一个前缀 / 分类 / fn 委派，按以下顺序：

1. **改代码事实源**：在 `src/erdl-schema.ts`（前缀 / 分类）或 `src/fn-registry.ts`（fn）登记新项；
2. **同步本文件**：在本登记簿对应章节新增一行，注明前缀、分类、说明；
3. **同步 SPEC**：若新前缀 / 分类引入新的语义约束，同步更新 `erdl-spec.md` 相关章节（§4 Rule 定义 / §9 集成）；
4. **补测试**：为命名门禁 / 求值路径补一条覆盖测试；
5. **PR 审查合并**：一个 PR 只登记一个逻辑单元，禁止「先使用后注册」。

> 红线：**「先用后注册」禁止**——未登记前缀的规则会被命名门禁拒载（`NON_STANDARD_NAME`）。

## 7. 冻结枚举（只引用，不复制）

以下语义集合在 [erdl-spec.md](./erdl-spec.md) 中冻结（`[FREEZE-2]`，只增不减、不改语义），**不在本登记簿重复维护**：

| 枚举 | 数量 | SPEC 章节 |
|------|:---:|------|
| 语义节点 | 34（10 组） | §5.3 |
| Simple 运算符 | 30（28 条件 + 2 修饰符） | §5.2 |
| 决策类型 | 13 | §6 |
| 表达树判别类型 | 20 | §5.3 |

---

*规则决定一切。注册项是语义的扩展边界，登记即承重。*
