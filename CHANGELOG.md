# Changelog

本项目的所有重要变更记录于此。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

本仓库包含**两条正交的版本线**（详见 `erdl-spec.md` 头部「版本语义」）：
- **规范文档版本**（本文件追踪）：`v2.0` → `v2.1` …
- **规则格式版本**（`*.erdl.yaml` 顶层 `version:` 字段）：`2.0.0` → `2.1.0` …
- **协议标识** `protocol: "erdl/v2"` 为冻结值，不随规范升级而变。

## [2.1.0] - 2026-09-03

### Added
- **`correction` 规则字段**（§4.1）：CORRECT 决策的纠偏文本，是求值输出 `primary_correction`（§7.0.3）的输入来源。补齐了规范此前「输出契约要求 primary_correction、输入字段表却无 correction」的自相矛盾。
- **`category` 规则字段**（§4.1，规则级）：缺省继承 `metadata.category`，允许同一文档内混合分类。
- **`enabled` 规则字段**（§4.1）：规则启用标志，默认 `true`；`false` 时求值跳过该规则。
- 参考实现 `erdl-loader` 映射 `correction` → `action.correction`；`rule-yaml-serializer` 补 emit `correction`/`category`/`enabled`（修复 round-trip 丢失）。
- 规范文档末尾新增「修订历史」章节。

### Fixed
- §4.1 字段表与固定字段顺序补齐上述三个字段（此前 `correction` 在实现/预设中已被使用，但规范从未定义——实现先于规范，现回写对齐）。
- `rule-yaml-serializer` 的 F3 字段顺序注释过时（只写到 `unless`，实际还 emit `explanation`/`alternative`/`legal_basis`/`source_text`），已对齐规范全序。

### Changed
- 规则格式版本 `2.0.0` → `2.1.0`（新增可选字段，Non-breaking；存量 2.0.0 规则仍有效）。
- 规范文档版本 `v2.0` → `v2.1`。
- README 双语拆分：`README.md` 重写为开发者优先叙事（英文）后按本仓命名约定双语化——中文版升为 `README.md`（主），英文版移至 `README.en.md`，互设语言切换链接；与 `erdl-spec.md`/`.en.md` 及姊妹仓（erdl-formal、erdl-vectors）的 `.md`/`.en.md` 约定一致。

## [2.0.0] - 2026-08-30

### Added
- ERDL 语言规范 v2.0 定稿（`erdl-spec.md` 中文 + `erdl-spec.en.md` 英文）。
- 表达式树语义内核（34 节点 / 10 组）、Simple 30 运算符、13 种决策类型。
- 参考实现：`erdl-loader`（文档加载）、`evaluator`（求值引擎）、`rule-yaml-serializer`（序列化）。
