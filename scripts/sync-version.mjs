#!/usr/bin/env node
/**
 * scripts/sync-version.mjs — 版本单一事实源的派生同步 + 漂移检查。
 *
 * 单一事实源（source of truth）：
 *   - src/version.ts       → SPEC_VERSION（规范文档版本）、RULE_FORMAT_VERSION（规则格式版本）
 *   - package.json         → npm 包版本
 *
 * 用法：
 *   node scripts/sync-version.mjs          # 只检查（漂移报告，退出码非 0 表示有漂移）
 *   node scripts/sync-version.mjs --fix    # 同步安全派生处（README badge、package.json files）
 *
 * 设计原则：
 *   - 代码常量一律 import src/version.ts，禁止硬编码（已由 tsc/import 保证）。
 *   - 文档层无法 import，故本脚本负责把「安全、无歧义」的派生处自动对齐；
 *     其余（spec 标题/文件名/示例、测试 fixture）仅报告，需人工判断（历史引用、向后兼容测试）。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FIX = process.argv.includes('--fix')

function read(p) { return readFileSync(resolve(ROOT, p), 'utf8') }
function write(p, t) { writeFileSync(resolve(ROOT, p), t, 'utf8') }

// ---------- 1. 读单一事实源 ----------
const versionTs = read('src/version.ts')
const mSpec = versionTs.match(/SPEC_VERSION\s*=\s*'([^']+)'/)
const mRule = versionTs.match(/RULE_FORMAT_VERSION\s*=\s*'([^']+)'/)
if (!mSpec || !mRule) { console.error('FAIL: src/version.ts 缺少 SPEC_VERSION / RULE_FORMAT_VERSION'); process.exit(1) }
const SPEC_VERSION = mSpec[1]
const RULE_FORMAT_VERSION = mRule[1]
const NPM_VERSION = JSON.parse(read('package.json')).version

console.log('单一事实源：')
console.log('  SPEC_VERSION          = ' + SPEC_VERSION)
console.log('  RULE_FORMAT_VERSION   = ' + RULE_FORMAT_VERSION)
console.log('  npm version           = ' + NPM_VERSION)

const problems = []
let fixed = 0

// ---------- 2. README badge（spec-v<SPEC_VERSION>）自动同步 ----------
const SPEC_BADGE = 'spec-' + SPEC_VERSION // 'v2.3' -> 'spec-v2.3'
for (const f of ['README.md', 'README.zh-CN.md']) {
  let t = read(f)
  const re = /spec-v\d+\.\d+/g
  const hits = t.match(re) || []
  for (const h of hits) {
    if (h !== SPEC_BADGE) {
      problems.push(`${f}: badge ${h} != ${SPEC_BADGE}`)
      if (FIX) { t = t.split(h).join(SPEC_BADGE); fixed++ }
    }
  }
  if (FIX) write(f, t)
}

// ---------- 3. package.json files（erdl-language-spec-<SPEC_VERSION>.md）自动同步 ----------
{
  const pkg = JSON.parse(read('package.json'))
  const files = (pkg.files || []).filter((f) => f.startsWith('erdl-language-spec-'))
  const expected = [
    `erdl-language-spec-${SPEC_VERSION}.md`,
    `erdl-language-spec-${SPEC_VERSION}.en.md`,
  ]
  const missing = expected.filter((e) => !files.includes(e))
  const extra = files.filter((f) => !expected.includes(f))
  if (missing.length || extra.length) {
    problems.push(`package.json files: 缺 ${missing.join(',') || '无'} 多 ${extra.join(',') || '无'}`)
    if (FIX) {
      pkg.files = (pkg.files || []).filter((f) => !f.startsWith('erdl-language-spec-')).concat(expected)
      write('package.json', JSON.stringify(pkg, null, 2) + '\n')
      fixed++
    }
  }
}

// ---------- 4. spec 标题（仅报告） ----------
for (const f of [`erdl-language-spec-${SPEC_VERSION}.md`, `erdl-language-spec-${SPEC_VERSION}.en.md`]) {
  let t
  try { t = read(f) } catch { problems.push(`spec 文件缺失: ${f}`); continue }
  const title = t.split('\n')[0]
  if (!title.includes(SPEC_VERSION)) problems.push(`${f}: 标题 "${title}" 不含 ${SPEC_VERSION}`)
}

// ---------- 5. spec 示例的规则格式版本（仅报告计数，不自动改，防历史引用误伤） ----------
for (const f of [`erdl-language-spec-${SPEC_VERSION}.md`, `erdl-language-spec-${SPEC_VERSION}.en.md`]) {
  let t
  try { t = read(f) } catch { continue }
  const versions = new Set([...t.matchAll(/version:\s*"(\d+\.\d+\.\d+)"/g)].map((m) => m[1]))
  const bad = [...versions].filter((v) => v !== RULE_FORMAT_VERSION)
  if (bad.length) problems.push(`${f}: 示例 version 字段含非当前值 ${bad.join(',')}（当前 ${RULE_FORMAT_VERSION}）`)
}

// ---------- 6. 测试 fixture（仅报告计数，向后兼容测试需人工判断） ----------
{
  const files = execSync('git ls-files "*.spec.ts" "*.spec.*"', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
  const counts = {}
  for (const f of files) {
    const t = read(f)
    for (const m of t.matchAll(/version:\s*['"](\d+\.\d+\.\d+)['"]/g)) {
      const v = m[1]
      if (v !== RULE_FORMAT_VERSION) counts[v] = (counts[v] || 0) + 1
    }
  }
  const entries = Object.entries(counts)
  if (entries.length) problems.push(`测试 fixture 含非当前规则格式版本: ${entries.map(([v, n]) => v + '×' + n).join(', ')}（需人工判断是否向后兼容）`)
}

// ---------- 结果 ----------
if (problems.length) {
  console.log('\n漂移发现：')
  problems.forEach((p) => console.log('  - ' + p))
  if (FIX) console.log(`\n已自动同步 ${fixed} 处（README badge / package.json files）。其余请人工处理。`)
  else console.log('\n用 --fix 自动同步安全项，其余人工处理。')
  process.exit(1)
} else {
  console.log('\n✓ 无漂移：所有派生处与单一事实源一致。')
  process.exit(0)
}
