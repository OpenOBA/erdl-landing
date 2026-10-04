# ERDL 规范 RFC 化重构 —— 结构设计（草案）

> 本文档是「结构先行」的产物：只定义 RFC 风格的目标结构与章节映射，**不改动原文档** `erdl-language-spec-v2.3.md`。
> 内容填充留待结构评审通过后进行。
> 调研基线：RFC 7322《RFC Style Guide》§4（Structure of an RFC）；需求语言依据 RFC 2119 / BCP 14。

---

## 一、调研结论：RFC 文档结构规范（RFC 7322 §4）

RFC 7322 §4 规定一篇 RFC 由三类元素组成，顺序要求如下：

### 1. 前端材料（Front Matter）—— **不编号**

| 元素 | 必需性 | 说明 |
|---|---|---|
| First-Page Header | Required | 作者/组织/RFC 编号/类别/日期/ISSN |
| Title | Required | 完整标题（缩写首次出现须展开） |
| Abstract | Required | 全文目的与内容的简洁完整概述，不含引用 |
| RFC Editor / Stream Note | 按需 | 编辑说明 |
| Status of This Memo | Required | 文档状态（Standards Track / Informational 等） |
| Copyright Notice | Required | 版权与许可声明 |
| Table of Contents | Required | 目录 |

### 2. 正文（Body of the Memo）—— **编号**（顺序强推荐，可被质疑）

```
1.  Introduction                              [Required]
2.  Requirements Language (RFC 2119)          [有需求语言时必须]
3.  …主技术章节…
N.  IANA Considerations                       [I-D 必填]
N+1. Internationalization Considerations
N+2. Security Considerations                  [Required]
N+3. References
     N+3.1. Normative References
     N+3.2. Informative References
```

### 3. 后端材料（Back Matter）—— **附录用字母，其后不编号**

```
Appendix A. / B. …（字母标注）
Acknowledgements
Contributors
Authors' Addresses                            [Required]
```

### 关键规则（RFC 7322 §4 原文要点）

- 「正文之前的元素不应编号；正文编号；附录用字母；附录之后的部分不编号不标注。」
- 正文中 `Security Considerations` 是 **Required**，任何协议规范都必须有。
- 参考文献必须拆 **Normative（规范性，实现所必需）** 与 **Informative（信息性，仅供参考）** 两类。
- 需求语言（MUST/SHOULD/MAY 等）必须显式引用 RFC 2119。

---

## 二、目标结构（ERDL 规范 RFC 化 TOC）

> 章节标题以英文为 canonical（RFC 惯例，RFC 7322 §3.1 规定 RFC 语言为英文），中文为对照。

### 前端（不编号）

```
ERDL: Entity-Rule Definition Language Specification
（ERDL：实体规则定义语言规范）

Abstract
Status of This Memo
Copyright Notice
Table of Contents
```

### 正文（编号 1–16）

```
1.   Introduction                                    引言
     1.1  Purpose and Scope                          目的与范围
     1.2  Design Philosophy                          设计哲学
     1.3  Design Goals                               设计目标
     1.4  Core Promises                              核心承诺
2.   Requirements Language                           需求语言（RFC 2119）
3.   Document Model                                  文档模型
     3.1  Top-Level Structure                        顶层格式
     3.2  Metadata                                   元数据
     3.3  Format Conventions                         格式约定
     3.4  Parsing and Evaluation Overview            解析与求值概览
4.   Entity Definition                               实体定义
5.   Rule Definition                                 规则定义
     5.1  Rule Fields                                规则字段
6.   Condition Expressions (when)                    条件表达式
     6.1  Projection Surfaces                        书写形态（投影面）
     6.2  Simple Projection (30 Operators)            Simple 投影面
     6.3  Expression Projection (34-Node Tree)        Expression 投影面
     6.4  Decision Table Projection                  决策表投影面
     6.5  Gloss Projection                           自然语言投影（gloss）
7.   Decision Types (then)                           决策类型
8.   State Blocks and Transitions                    状态块与状态转移
     8.1  State Space Declaration                    状态空间声明
     8.2  Transition Rules                           状态转移规则
     8.3  Controlled State Injection                 状态受控注入
     8.4  Resource Limits                            资源上限
     8.5  State Transition Audit Closure             状态转移审计闭环
     8.6  Relationship to within/rate                与 within/rate 的关系
     8.7  Event and Transition Evaluation Context    事件与转移求值上下文
     8.8  Enforcement-Boundary Check/Act Atomicity   执行边界 check/act 原子性
9.   Evaluation Semantics                            求值语义
     9.1  Evaluation Overview                        求值概览
     9.2  Priority and Conflict Resolution           优先级与冲突解决
     9.3  Evaluation Constraints (E1–E12)            求值约束
     9.4  Deterministic Semantics                    确定性语义
     9.5  When Completeness Constraints              when 最小完整度
10.  Serialization and Canonicalization              序列化与规范化
     10.1 Serialization                              序列化
     10.2 Canonical Form                             规范化树
     10.3 DO Hash Preimage                           DO 哈希原像
     10.4 Canonical Tree and Gloss                   规范树与 gloss 的关系
11.  Integration                                     集成
     11.1 AI Agent (Action Guard)                    AI Agent 行为约束
     11.2 MCP (Protocol Distribution)                MCP 协议分发
     11.3 Rule Engine                                规则引擎
12.  Conformance                                     一致性
     12.1 Quick Start                                快速上手
     12.2 Examples                                   完整示例
     12.3 Conformance Verification                   一致性验证
13.  IANA Considerations                             IANA 考虑（无 IANA 行动）
14.  Internationalization Considerations             国际化考虑
15.  Security Considerations                         安全考虑
16.  References                                      参考文献
     16.1 Normative References                       规范性引用
     16.2 Informative References                     信息性引用
```

### 后端（字母标注 + 不编号）

```
Appendix A.  34-Node Reference Table                  34 节点参考表
Appendix B.  Simple 30-Operator Reference Table       Simple 30 运算符参考表
Appendix C.  Decision Type Enumeration                决策类型枚举
Appendix D.  Function Delegation and Rule Grading     函数委派与规则分级
Appendix E.  Glossary                                 术语表

Revision History                                       修订历史（OpenOBA 保留）
Acknowledgements                                       致谢
Authors' Addresses                                     作者地址
```

---

## 三、原文档 → 新结构映射

| 原 SPEC（v2.2） | 新结构（RFC 化） | 说明 |
|---|---|---|
| （无） | 前端 Abstract / Status / Copyright / TOC | **新增**：RFC 必需的前端材料 |
| 1. Introduction | 1. Introduction | 拆出「需求语言」到第 2 章 |
| （散落各处的 MUST/SHOULD/MAY 说明） | 2. Requirements Language | **新增**：显式引用 RFC 2119 |
| 2. 文档结构 | 3. Document Model | 顺延 |
| 3. Entity 定义 | 4. Entity Definition | 顺延 |
| 4. Rule 定义 | 5. Rule Definition | 顺延 |
| 5. when 条件表达式 | 6. Condition Expressions | 顺延，5 个子节归 6.1–6.5 |
| 6. then 决策类型 | 7. Decision Types | 顺延 |
| 6a. 状态块与状态转移 | 8. State Blocks and Transitions | **提升**：6a 改为独立第 8 章，8 个子节归 8.1–8.8 |
| 7. 求值语义 | 9. Evaluation Semantics | 顺延 |
| 8. 序列化与规范化 | 10. Serialization and Canonicalization | 顺延 |
| 9. 如何集成 ERDL | 11. Integration | 顺延 |
| 10. 示例与一致性验证 | 12. Conformance | 顺延 |
| （无） | 13. IANA Considerations | **新增**：声明「无 IANA 行动」 |
| （无） | 14. Internationalization Considerations | **新增**：gloss 双语、display_name 国际化 |
| （散落各章的安全内容） | 15. Security Considerations | **新增**：归拢安全语义（fail-closed、注入、TOCTOU、ReDoS 等） |
| 规范性引用 | 16. References | **拆分**：Normative / Informative |
| 附录 A–E | Appendix A–E | 保留，标题英文化 |
| 修订历史 | Revision History | 保留 |
| （无） | Acknowledgements / Authors' Addresses | **新增**：RFC 必需的后端 |

---

## 四、关键改造点（需要评审确认）

1. **前端补齐**：Abstract / Status of This Memo / Copyright Notice / Table of Contents 四个前端元素，原文档完全缺失，需新写。

2. **需求语言独立成章**：原文 MUST/SHOULD/MAY 关键词散落全文，且未显式引用 RFC 2119。RFC 化后需在引言后紧接第 2 章 `Requirements Language`，显式声明关键词按 RFC 2119 解释。

3. **Security Considerations 独立成章（Required）**：原文安全语义分散在 §5.2（E11 空值传播）、§6a.3（受控注入）、§6a.8（TOCTOU）、§7.3.4（ReDoS）、§9.1（Action Guard）等处。RFC 要求安全考虑集中成章，需把这些归拢为一份安全性质清单（fail-closed 默认、注入面、时序攻击、资源耗尽、审计不可抵赖等）。

4. **6a 状态块提升为第 8 章**：原文用「6a」这种非标准编号（RFC 无字母后缀章节），RFC 化后改为独立编号第 8 章。

5. **IANA Considerations**：ERDL 是 OpenOBA 私有规范，不涉及 IANA 注册，此章仅声明「本规范不要求 IANA 采取任何行动」。

6. **参考文献拆分**：原文「规范性引用」是单一列表，需拆为 Normative（RFC 2119、RFC 8785 JCS、RFC 4648、IEEE 754、ECMA-404 等实现必需的标准）与 Informative（Rego/Cedar 文档、CVE 等背景资料）。

7. **标题英文化**：RFC 惯例语言为英文（RFC 7322 §3.1），正文标题以英文为准，中文作为对照或移入附录。

---

## 五、待确认的决策点

1. **文档身份**：本规范并非 IETF 标准，`Status of This Memo` 应怎么写？（建议：`This memo documents an OpenOBA community specification for informational purposes.`——非标准轨道，信息性。）

2. **单语 vs 双语**：RFC 惯例纯英文。但现有工作流中英同步。两个选项：
   - A. 英文为 canonical，中文另出翻译稿（严格 RFC 惯例）
   - B. 正文英中对照（偏离 RFC 惯例，但保留现有双语习惯）

3. **版本号与文件名**：RFC 化的新文档，版本号沿用 v2.2 还是升 v3.0？文件名用 `erdl-language-spec-rfc.md` 还是 RFC 风格命名（如 `draft-openoba-erdl-spec-00.md`）？

4. **「修订历史」去留**：RFC 无「修订历史」章节（用 Updates/Obsoletes 表达版本关系）。是否保留为 OpenOBA 内部元素（放后端，不编号）？

---

以上为结构设计草案，等你评审确认后再进入内容填充阶段。
