# Contributing to ERDL

感谢你对 ERDL（Entity-Rule Definition Language）的贡献！

## 参与方式

### 提交规则模式 (Rule Patterns)

如果你有特定行业（金融、医疗、制造等）的 Agent 安全实践，欢迎向 `examples/` 目录提交最佳实践规则集。

格式要求：
- 使用 `.erdl.yaml` 扩展名
- 遵循 SPEC v1.1 命名规范 `[CAT]-[NNN]-描述`
- 附带 README 说明场景和设计理由

### 完善测试向量集

在 `spec/vectors/` 中补充边缘场景测试用例。每条向量必须包含：
- `id`：唯一标识
- `scenario`：场景描述
- `rules`：规则定义
- `context`：触发上下文
- `expected`：预期决策输出

### 构建工具链

开发针对特定语言的 ERDL 解析器或 IDE 插件：
- 参照 SPEC v1.1 的 13 种运算符和 17 种 Then 动作
- 通过 `spec/vectors/` 中的 44 条跨实现验证向量确保兼容性
- 将你的实现提交到 [A2A Discussion #2038](https://github.com/google/A2A) 进行独立验证

## 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feat/your-feature`)
3. 提交变更 (`git commit -m 'feat: add something'`)
4. 推送到分支 (`git push origin feat/your-feature`)
5. 创建 Pull Request

## 规范修订提案 (SCP)

对于 SPEC 正文的修改，请通过 Spec Change Proposal (SCP) 流程：

1. 在 Issues 中创建提案，说明修改内容、理由和影响范围
2. 附带更新的审计向量集
3. 至少获得一位社区维护者的 Approve 后合并

## 行为准则

请遵守我们的 [Code of Conduct](CODE_OF_CONDUCT.md)。

---

> 确定性架构，而非 Prompt 工程。
> OpenOBA · 2026
