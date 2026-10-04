/**
 * §7.1 override 排序 — 多方式回归测试（正向 / 异常 / 逆向 / 边界 / 差分）。
 *
 * Locks `overrideSortRank`: an absent `override` defaults to `normal`
 * (rank 2), NOT a lowest rank below `low`. SPEC §7.1 item 3.
 *
 * @license MIT
 */

import { describe, it, expect } from 'vitest'
import { Evaluator } from './evaluator.js'
import type { RuleDefinition } from './rule-definition.js'

/** A helper ALLOW rule; every rule matches the same fact, so matchedRules order == sort order. */
function allow(name: string, o: { override?: string; priority?: number; ring?: number; instr?: string } = {}): RuleDefinition {
  const r: RuleDefinition = {
    id: name,
    name,
    description: name,
    category: 'custom',
    enabled: true,
    conditions: [{ field: 'x', operator: 'eq', value: 1 }],
    conditionLogic: 'AND',
    action: { decision: 'ALLOW', ring: o.ring ?? 0, instruction: o.instr ?? name },
    priority: o.priority ?? 1,
  } as RuleDefinition
  if (o.override !== undefined) (r as unknown as { override?: string }).override = o.override
  return r
}

/** A DENY (restrictive) rule at a given priority/override. */
function deny(name: string, o: { priority?: number; override?: string; ring?: number } = {}): RuleDefinition {
  const r: RuleDefinition = {
    id: name,
    name,
    description: name,
    category: 'custom',
    enabled: true,
    conditions: [{ field: 'x', operator: 'eq', value: 1 }],
    conditionLogic: 'AND',
    action: { decision: 'DENY', ring: o.ring ?? 0 },
    priority: o.priority ?? 1,
  } as RuleDefinition
  if (o.override !== undefined) (r as unknown as { override?: string }).override = o.override
  return r
}

/** matchedRules order = effective sort order (all rules match the same fact). */
function order(rules: RuleDefinition[]): string[] {
  const r = new Evaluator().evaluate(rules, { x: 1 })
  return r.matchedRules.map((m) => m.ruleName)
}

describe('§7.1 override 排序（多方式）', () => {
  describe('正向：override 级别排序链', () => {
    it('critical < high < normal < low（乱序输入，输出按级别）', () => {
      const rules = [allow('low', { override: 'low' }), allow('normal', { override: 'normal' }), allow('high', { override: 'high' }), allow('critical', { override: 'critical' })]
      expect(order(rules)).toEqual(['critical', 'high', 'normal', 'low'])
    })

    it('缺席 override 等价 normal，排在 low 之前', () => {
      const rules = [allow('absent'), allow('low', { override: 'low' })]
      expect(order(rules)).toEqual(['absent', 'low'])
    })

    it('缺席 override 与显式 normal 同 rank，按定义顺序', () => {
      const rules = [allow('absent'), allow('explicit-normal', { override: 'normal' })]
      expect(order(rules)).toEqual(['absent', 'explicit-normal'])
    })
  })

  describe('异常：非法 override 值', () => {
    it('未知 override 值按 normal 处理（不 crash，不排到最低）', () => {
      const rules = [allow('unknown', { override: 'foo' }), allow('low', { override: 'low' })]
      expect(order(rules)).toEqual(['unknown', 'low'])
    })

    it('大写 override 值按 normal 处理', () => {
      const rules = [allow('upper', { override: 'CRITICAL' }), allow('low', { override: 'low' })]
      expect(order(rules)).toEqual(['upper', 'low'])
    })

    it('空字符串 override 按 normal 处理', () => {
      const rules = [allow('empty', { override: '' }), allow('low', { override: 'low' })]
      expect(order(rules)).toEqual(['empty', 'low'])
    })
  })

  describe('逆向：排序不破坏 decision 正确性（判别性）', () => {
    it('缺席 override 的 ALLOW 不能覆盖 DENY（放松方向需 override 授权）', () => {
      // DENY 先建立（priority 更小），缺席 ALLOW 排在 normal rank，非 override → 不能覆盖 DENY
      const rules = [deny('block', { priority: 1 }), allow('absent-allow', { priority: 2 })]
      const r = new Evaluator().evaluate(rules, { x: 1 })
      expect(r.decision).toBe('DENY')
    })

    it('critical override ALLOW 仍能覆盖 DENY（修复不回归）', () => {
      const rules = [deny('block', { priority: 1 }), allow('override-allow', { priority: 2, override: 'critical' })]
      const r = new Evaluator().evaluate(rules, { x: 1 })
      expect(r.decision).toBe('ALLOW')
    })

    it('low override 的 ALLOW 不能覆盖 DENY（low 不启用 override）', () => {
      const rules = [deny('block', { priority: 1 }), allow('low-allow', { priority: 2, override: 'low' })]
      const r = new Evaluator().evaluate(rules, { x: 1 })
      expect(r.decision).toBe('DENY')
    })

    it('收紧方向：低 ring ALLOW + 高 ring DENY → DENY（不比较 ring，无需 override）', () => {
      const rules = [allow('ring0-allow', { ring: 0, priority: 1 }), deny('ring3-deny', { ring: 3, priority: 2 })]
      const r = new Evaluator().evaluate(rules, { x: 1 })
      expect(r.decision).toBe('DENY')
    })
  })

  describe('边界：定义顺序（稳定排序）', () => {
    it('同 priority 同 override（都缺席）按定义顺序', () => {
      const rules = [allow('first'), allow('second'), allow('third')]
      expect(order(rules)).toEqual(['first', 'second', 'third'])
    })

    it('priority 优先于 override（小 priority 先，即使 override 级别低）', () => {
      // low override 但 priority=1，critical override 但 priority=2 → priority 先
      const rules = [allow('critical-p2', { override: 'critical', priority: 2 }), allow('low-p1', { override: 'low', priority: 1 })]
      expect(order(rules)).toEqual(['low-p1', 'critical-p2'])
    })
  })

  describe('差分：instruction 累积顺序跟随排序', () => {
    it('缺席（normal）规则先于 low 规则累积 instruction', () => {
      const rules = [allow('absent', { instr: 'absent-instr' }), allow('low', { override: 'low', instr: 'low-instr' })]
      const r = new Evaluator().evaluate(rules, { x: 1 })
      expect(r.primaryInstruction).toBe('absent-instr; low-instr')
    })
  })
})
