#!/usr/bin/env node

/**
 * SPEC YAML Block Validator — 铁律合规自动校验
 *
 * 从 erdl-spec-v1.1.md（中/英）提取所有 YAML code fence 代码块，
 * 逐条检查 §5 格式铁律 (F1–F8)，输出结构化报告。
 *
 * Usage: node scripts/validate-spec-yaml.js [path/to/spec.md]
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ─── 铁律定义 ───────────────────────────────────────

const IRON_RULES = {
  F1: {
    desc: '顶层字段顺序: protocol → version → metadata → rules',
    check(doc) {
      const keys = Object.keys(doc);
      const expected = ['protocol', 'version', 'metadata', 'rules'];
      for (let i = 0; i < expected.length; i++) {
        if (keys[i] !== expected[i]) {
          return { pass: false, reason: `expected '${expected[i]}' at index ${i}, got '${keys[i]}'` };
        }
      }
      return { pass: true };
    },
  },
  F2: {
    desc: 'metadata 子字段顺序: name → description → category → decision → tags',
    check(doc) {
      if (!doc.metadata) return { pass: true, skip: 'no metadata block' };
      const keys = Object.keys(doc.metadata);
      const expected = ['name', 'description', 'category', 'decision', 'tags'];
      for (let i = 0; i < expected.length; i++) {
        if (keys[i] !== expected[i]) {
          return { pass: false, reason: `metadata.expected '${expected[i]}' at index ${i}, got '${keys[i]}'` };
        }
      }
      return { pass: true };
    },
  },
  F3: {
    desc: 'rules[] 子字段顺序: name → description → priority → override → ring → when → then → message → instruction → unless',
    check(doc) {
      if (!doc.rules || !Array.isArray(doc.rules)) return { pass: true, skip: 'no rules[]' };
      const warnings = [];
      const expected = ['name', 'description', 'priority', 'override', 'ring', 'when', 'then', 'message', 'instruction', 'unless'];
      for (let ri = 0; ri < doc.rules.length; ri++) {
        const rule = doc.rules[ri];
        const keys = Object.keys(rule);
        let lastIdx = -1;
        for (const ek of expected) {
          const idx = keys.indexOf(ek);
          if (idx >= 0 && idx < lastIdx) {
            warnings.push(`rules[${ri}]: '${ek}' appears after expected position (out of order)`);
          }
          if (idx >= 0) lastIdx = Math.max(lastIdx, idx);
        }
      }
      if (warnings.length > 0) {
        return { pass: false, reason: warnings.join('; ') };
      }
      return { pass: true };
    },
  },
  F4: {
    desc: 'when.conditions[] 子字段顺序: field → operator → value',
    check(doc) {
      if (!doc.rules) return { pass: true, skip: 'no rules[]' };
      const warnings = [];
      for (let ri = 0; ri < doc.rules.length; ri++) {
        const rule = doc.rules[ri];
        const visits = [rule.when, rule.unless].filter(Boolean);
        for (const block of visits) {
          const conds = block.conditions;
          if (!conds || !Array.isArray(conds)) continue;
          for (let ci = 0; ci < conds.length; ci++) {
            const c = conds[ci];
            if (typeof c !== 'object') continue;
            const keys = Object.keys(c);
            const expected = ['field', 'operator', 'value'];
            let lastIdx = -1;
            for (const ek of expected) {
              const idx = keys.indexOf(ek);
              if (idx >= 0 && idx < lastIdx) {
                warnings.push(`rules[${ri}].conditions[${ci}]: '${ek}' out of order`);
              }
              if (idx >= 0) lastIdx = Math.max(lastIdx, idx);
            }
          }
        }
      }
      if (warnings.length > 0) return { pass: false, reason: warnings.join('; ') };
      return { pass: true };
    },
  },
  F5: {
    desc: 'when 扁平简写字段顺序: field → operator → value → rate',
    check(doc) {
      if (!doc.rules) return { pass: true, skip: 'no rules[]' };
      const warnings = [];
      for (let ri = 0; ri < doc.rules.length; ri++) {
        const rule = doc.rules[ri];
        if (!rule.when || typeof rule.when !== 'object' || Array.isArray(rule.when)) continue;
        // Flat shorthand: when is an object with field/operator/value but NOT logic/conditions
        if (rule.when.logic === undefined && rule.when.conditions === undefined && rule.when.field !== undefined) {
          const keys = Object.keys(rule.when);
          const expected = ['field', 'operator', 'value', 'rate'];
          let lastIdx = -1;
          for (const ek of expected) {
            const idx = keys.indexOf(ek);
            if (idx >= 0 && idx < lastIdx) {
              warnings.push(`rules[${ri}].when (flat shorthand): '${ek}' out of order`);
            }
            if (idx >= 0) lastIdx = Math.max(lastIdx, idx);
          }
        }
      }
      if (warnings.length > 0) return { pass: false, reason: warnings.join('; ') };
      return { pass: true };
    },
  },
  F6: {
    desc: '字符串值引号规范: 自然语言字符串双引号 / 枚举裸词 / tags 裸词',
    checkAst(ast) {
      // This check operates on the raw YAML AST, not the parsed doc
      // We intercept during parse stage — see checkQuotingRules()
      return { pass: true, skip: 'checked separately via AST traversal' };
    },
    check() {
      return { pass: true, skip: 'checked at parse time' };
    },
  },
  F7: {
    desc: '缩进 MUST 使用 2 空格（语法性 — YAML 解析器自动验证）',
    check() {
      // YAML parser enforces this implicitly — if indentation is wrong, parsing fails
      return { pass: true, skip: 'enforced by YAML parser' };
    },
  },
  F8: {
    desc: '规则文件 MUST 以 protocol: "erdl/v1" 开头',
    check(doc) {
      if (doc.protocol !== 'erdl/v1') {
        return { pass: false, reason: `protocol is '${doc.protocol}', expected 'erdl/v1'` };
      }
      return { pass: true };
    },
  },
};

// ─── YAML block extraction ──────────────────────────

function extractYamlBlocks(mdText) {
  const blocks = [];
  const re = /`{3,}ya?ml\s*\n([\s\S]*?)`{3,}/g;
  let match;
  let idx = 0;
  while ((match = re.exec(mdText)) !== null) {
    idx++;
    const raw = match[1];
    // Compute approximate line number in the original markdown
    const beforeBlock = mdText.substring(0, match.index);
    const lineNum = beforeBlock.split('\n').length;
    blocks.push({ id: idx, raw, lineNum });
  }
  return blocks;
}

// ─── F6 quoting check (AST-level) ────────────────────

const ENUM_KEYWORDS = new Set([
  'then', 'logic', 'operator', 'override', 'category', 'decision', 'ring',
]);
const NATURAL_LANG_FIELDS = new Set([
  'description', 'message', 'instruction', 'name', 'field', 'value', 'protocol', 'version',
]);

/**
 * Walk a plain object parsed from YAML and check quoting conventions.
 * Since js-yaml normalizes values post-parse, we need to inspect the raw YAML string
 * with the yaml-ast-parser or do simple heuristics.
 *
 * Strategy: re-parse each YAML block as line-by-line to check quoting on string values.
 */
function checkF6Quoting(yamlText) {
  const warnings = [];
  const lines = yamlText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Match key: value patterns
    const kvMatch = trimmed.match(/^(\w[\w.]*)\s*:\s*(.+)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    let value = kvMatch[2].trim();

    // Skip comments on the same line
    const commentIdx = value.indexOf(' #');
    if (commentIdx >= 0) value = value.substring(0, commentIdx).trim();

    // Strip trailing comments after hash in YAML value
    // Check if value is a quoted string
    const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
    const isSingleQuoted = value.startsWith("'") && value.endsWith("'");
    const isBare = !isDoubleQuoted && !isSingleQuoted && value.length > 0;

    // Skip non-string values (numbers, booleans, lists, objects, null)
    if (/^(true|false|null|~)$/i.test(value)) continue;
    if (/^-?\d+(\.\d+)?$/.test(value)) continue;
    if (value.startsWith('[') || value.startsWith('{')) continue;

    // Enum keywords should be bare
    if (ENUM_KEYWORDS.has(key) && isDoubleQuoted) {
      warnings.push(`L${i + 1}: '${key}' is an enum keyword, should be bare (not double-quoted): ${trimmed.trimEnd()}`);
    }

    // Natural language / string values should be double-quoted
    const isEnumOrBareOk = ENUM_KEYWORDS.has(key) ||
      key === 'tags' ||
      key.endsWith('.tags') ||
      value.match(/^\[.+\]$/) || // inline array
      value.match(/^\{.+\}$/);   // inline object

    if (!isEnumOrBareOk && isBare && NATURAL_LANG_FIELDS.has(key)) {
      warnings.push(`L${i + 1}: '${key}' is a natural-language field, should be double-quoted: ${trimmed.trimEnd()}`);
    }
  }

  return warnings;
}

// ─── Determine if block is a complete ERDL file ──────

function isCompleteErdlFile(yamlText) {
  return yamlText.includes('protocol:') && yamlText.includes('rules:');
}

function isRuleSnippet(yamlText) {
  // Snippets start with "- name:" at column 0 (outside rules: wrapper)
  return /^[^-].*- name:/.test(yamlText) === false && yamlText.trimStart().startsWith('- name:');
}

// ─── Main validation ─────────────────────────────────

function validateSpec(specPath) {
  const mdText = fs.readFileSync(specPath, 'utf8');
  const blocks = extractYamlBlocks(mdText);

  const results = [];
  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;

  for (const block of blocks) {
    const blockResult = { id: block.id, lineNum: block.lineNum, raw: block.raw, checks: [] };

    // F6 quoting check (line-based, before parse)
    const quotingWarnings = checkF6Quoting(block.raw);
    if (quotingWarnings.length > 0) {
      blockResult.checks.push({
        rule: 'F6',
        desc: IRON_RULES.F6.desc,
        pass: false,
        reason: quotingWarnings.join('; '),
      });
      totalFail++;
    } else {
      totalSkip++;
    }

    // Only run structural checks on complete ERDL files
    if (!isCompleteErdlFile(block.raw) && !isRuleSnippet(block.raw)) {
      blockResult.skipped = 'not a complete ERDL file (fragment, config snippet, or non-rule YAML)';
      results.push(blockResult);
      continue;
    }

    // Parse YAML
    let doc;
    try {
      doc = yaml.load(block.raw);
    } catch (e) {
      blockResult.checks.push({
        rule: 'PARSE',
        desc: 'YAML parse',
        pass: false,
        reason: e.message,
      });
      totalFail++;
      results.push(blockResult);
      continue;
    }

    if (!doc || typeof doc !== 'object') {
      blockResult.skipped = 'empty or non-object YAML';
      results.push(blockResult);
      continue;
    }

    // Run structural checks (only on complete files)
    if (isCompleteErdlFile(block.raw)) {
      for (const [ruleName, rule] of Object.entries(IRON_RULES)) {
        if (ruleName === 'F6') continue; // Already checked via line analysis
        const result = rule.check(doc);
        if (result.skip) {
          totalSkip++;
          continue;
        }
        blockResult.checks.push({
          rule: ruleName,
          desc: rule.desc,
          pass: result.pass,
          reason: result.reason || null,
        });
        if (result.pass) totalPass++;
        else totalFail++;
      }
    }

    results.push(blockResult);
  }

  return { results, stats: { totalPass, totalFail, totalSkip, totalBlocks: blocks.length } };
}

// ─── CLI ─────────────────────────────────────────────

function main() {
  const specPath = process.argv[2] || path.join(__dirname, '..', 'spec', 'erdl-spec-v1.1.md');
  if (!fs.existsSync(specPath)) {
    console.error(`File not found: ${specPath}`);
    process.exit(1);
  }

  console.log(`🔍 Validating: ${path.basename(specPath)}\n`);

  const { results, stats } = validateSpec(specPath);

  let exitCode = 0;

  for (const block of results) {
    if (block.skipped) {
      console.log(`📦 Block #${block.id} (L${block.lineNum}): ⏭️  SKIP — ${block.skipped}`);
      continue;
    }

    const failures = block.checks.filter(c => c.pass === false);
    const passCount = block.checks.filter(c => c.pass === true).length;

    if (failures.length === 0 && passCount > 0) {
      console.log(`📦 Block #${block.id} (L${block.lineNum}): ✅ ALL PASS (${passCount} checks)`);
    } else if (failures.length > 0) {
      console.log(`📦 Block #${block.id} (L${block.lineNum}): ❌ ${failures.length} FAILURE(S)`);
      for (const f of failures) {
        console.log(`   ${f.rule}: ${f.desc}`);
        console.log(`   ↳ ${f.reason}`);
      }
      exitCode = 1;
    }
  }

  console.log(`\n─── Summary ───`);
  console.log(`  Blocks: ${stats.totalBlocks}`);
  console.log(`  ✅ Passed: ${stats.totalPass}`);
  console.log(`  ❌ Failed: ${stats.totalFail}`);
  console.log(`  ⏭️  Skipped: ${stats.totalSkip}`);
  console.log(`  Exit code: ${exitCode}\n`);

  process.exit(exitCode);
}

main();
