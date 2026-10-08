/**
 * 单一事实源（single source of truth）——版本常量。
 *
 * 禁止在其他文件硬编码版本号；一律从本文件 import。
 * 变更版本时只改这里 + `package.json` 的 npm 版本，其余派生处由 `scripts/sync-version.mjs` 同步。
 */

/** 规范文档版本（SPEC document version）。进 DO 哈希原像 `eval_profile.spec_version`（§8.2a.1b）。 */
export const SPEC_VERSION = 'v2.3'

/** 规则格式版本（`*.erdl.yaml` 顶层 `version:` 字段的当前值，§2.3）。 */
export const RULE_FORMAT_VERSION = '2.2.0'
