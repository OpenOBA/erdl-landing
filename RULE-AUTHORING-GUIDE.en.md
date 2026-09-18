# ERDL Rule-Authoring Guide

> For developers new to ERDL. Uses the **insurance industry** as the running example domain — insurance clauses are inherently rules, and concepts like waiting periods, exclusions, deductibles, and reimbursement ratios are universally understood.
> Goal: after reading, you can turn a business clause into a working rule.

---

## 0. What is ERDL (30 seconds)

**In one sentence**: ERDL turns rules / policies / regulations / standards into *deterministic* — machine-executable, verifiable, traceable — rules.

A rule = **condition (when) + conclusion (then) + explanation text**. A complete minimal example:

```yaml
protocol: "erdl/v2"
metadata:
  name: "health-insurance-claims"
  decision: ALLOW                      # fallback when no rule matches
rules:
  - name: "SEC-001-waiting-period"
    description: "No payout for diagnosis within the waiting period"
    priority: 10
    when:
      logic: AND
      conditions:
        - field: "days_since_effective"
          operator: lt
          value: 90
    then: DENY
    message: "Diagnosis within the 90-day waiting period; no payout"
```

Read it as: **when** "days since the policy took effect is under 90" **→ DENY**, with a reason.

---

## 1. The result first: 13 decision types = normative force

ERDL's conclusion (`then`) is not just "allow/deny" — it is 13 kinds of **normative force**, mirroring the MUST / SHOULD / MAY wording of regulations:

| Force | Regulation wording | Decision types | In plain words |
|---|---|---|---|
| Prohibition | "must not", "shall not" | DENY / EMERGENCY_HALT / ROLLBACK / QUARANTINE | Don't do it |
| Obligation | "must", "shall" | (a mandatory rule that fires on match) | Must satisfy |
| Recommendation | "should", "ought to" | **CORRECT / GUIDE / NOTIFY** | Suggest doing this |
| Permission | "may", "allowed to" | ALLOW / DELEGATE / DEFER | Allowed to do |
| Human required | "subject to review" | REQUEST_HUMAN / ESCALATE | Hand to a human |
| Process | "per the workflow" | WORKFLOW | Follow the flow |

Example:

```yaml
# SHOULD → correct (detected a mismatch, correct and resubmit)
- name: "COR-001-fix-id"
  when: { conditions: [{ field: "claimant_id", operator: ne, value: { field: "policyholder_id" } }] }
  then: CORRECT
  correction: "ID does not match the policyholder; please verify and resubmit"

# Human required → large claim goes to manual review
- name: "HUM-001-large-claim"
  when: { conditions: [{ field: "claim_amount", operator: gt, value: 500000 }] }
  then: REQUEST_HUMAN
  message: "Large claim; escalate to manual review"
```

---

## 2. Two ways to write the condition (when)

**① Simple form (28 operators)**: flat, most common, low barrier (tier 0–2 safety baseline).

```yaml
when:
  logic: AND                    # AND or OR
  conditions:
    - field: "field.path"
      operator: eq              # one of 28 operators
      value: "compare value"
```

**② Expression form (34 nodes)**: the full expression tree — nested logic, quantifiers, arithmetic, time, aggregation (tier ≥3 business scenarios).

```yaml
when:
  expr:
    and:                        # node name as key, sub-expressions as value
      - { eq: [{ field: "a" }, 1] }
      - { or: [{ field: "b" }, { field: "c" }] }
```

> The distinction in one line: **Simple can only "flatly AND/OR a list of conditions"; Expression can "nest combinations arbitrarily".** Section 3 groups nodes and marks which have a Simple-operator counterpart.

---

## 3. Operator / node reference (grouped + insurance examples)

### 3.1 Values (field / var / literal) — referencing data

| Node | In plain words | Analogy | Form |
|---|---|---|---|
| `field` | read a field | variable access | `{ field: "policy.effective_date" }` |
| `var` | read a context variable | environment variable | `{ var: "$" }` or `{ var: "$.taskId" }` |
| `literal` | a hardcoded value | constant | just write `90`, `"malignant"`, `true` |

### 3.2 Comparison (eq / ne / gt / gte / lt / lte) — compare values & dates

Simple operators: `eq` `ne` `gt` `gte` `lt` `lte`. Expression nodes share the same names.

| Operator | In plain words | SQL analogy |
|---|---|---|
| `eq` | equal | `=` |
| `ne` | not equal | `<>` |
| `gt` | greater / later | `>` |
| `gte` | greater or equal | `>=` |
| `lt` | less / earlier | `<` |
| `lte` | less or equal | `<=` |

**Insurance examples:**

```yaml
# Waiting period: days since effective < 90 → deny
- when: { conditions: [{ field: "days_since_effective", operator: lt, value: 90 }] }
  then: DENY

# Coverage cap: cumulative paid > policy coverage → deny
- when:
    expr: { gt: [{ field: "cumulative_paid" }, { field: "policy.coverage_amount" }] }
  then: DENY
  message: "Cumulative payout exceeds coverage"
```

### 3.3 Set (in / not_in) — membership in a list

Simple operators: `in` `not_in`. Expression node: `in` (`not_in` compiles to `not(in(...))`).

- Analogy: SQL `IN (...)` / `NOT IN (...)`.
- The right side of `in` must be a list.

**Insurance examples:**

```yaml
# Excluded hospitals: treated at rehab/nursing/hospice → deny
- when: { conditions: [{ field: "hospital_type", operator: in, value: ["rehab", "nursing", "hospice"] }] }
  then: DENY

# Excluded disease: diagnosis not in the covered list → deny
- when: { conditions: [{ field: "disease_code", operator: not_in, value: "covered_disease_list" }] }
  then: DENY
```

### 3.4 String (contains / match / starts_with / ends_with + negated forms)

Simple operators: `contains` `not_contains` `match` `starts_with` `ends_with` `not_starts_with` `not_ends_with`.
Expression nodes: `contains` `match` `starts_with` `ends_with`.

| Operator | In plain words | Analogy |
|---|---|---|
| `contains` | contains a substring | SQL `LIKE '%x%'` |
| `starts_with` | begins with | `LIKE 'x%'` |
| `ends_with` | ends with | `LIKE '%x'` |
| `match` | regex match (safe subset) | regex |

> `match` uses a **safe regex**: no backreferences, no lookaround, case-sensitive — to prevent ReDoS.

**Insurance examples:**

```yaml
# Diagnosis contains "malignant" → apply critical-illness clause
- when: { conditions: [{ field: "discharge_diagnosis", operator: contains, value: "malignant" }] }
  then: ALLOW

# ID number begins with "44" (Guangdong) → region check
- when: { conditions: [{ field: "id_number", operator: starts_with, value: "44" }] }
  then: NOTIFY
```

### 3.5 Existence / measure (exists / not_exists / length / between + length_* / count_*)

Simple operators: `exists` `not_exists` `length_gt` `length_gte` `length_lt` `length_lte` `length_eq` `between` `not_between` `count_gt` `count_gte` `count_lt` `count_lte`.
Expression nodes: `exists` `length` `between`.

| Operator | In plain words | Analogy |
|---|---|---|
| `exists` | field present (non-null) | `IS NOT NULL` |
| `not_exists` | field missing | `IS NULL` |
| `length` | string/array length | `LENGTH()` |
| `between` | value in closed range [min, max] | `BETWEEN` |
| `count_*` | array element count compare | `COUNT()` |

**Insurance examples:**

```yaml
# Missing document: no pathology report → request correction
- when: { conditions: [{ field: "pathology_report", operator: not_exists, value: true }] }
  then: REQUEST_HUMAN
  message: "Pathology report missing; request correction"

# Insurable age 18–60
- when: { conditions: [{ field: "age", operator: between, value: [18, 60] }] }
  then: ALLOW

# ID number must be 18 digits
- when: { conditions: [{ field: "id_number", operator: length_eq, value: 18 }] }
  then: DENY
```

### 3.6 Logic (and / or / not) — combine conditions

Expression nodes: `and` `or` `not` (arbitrarily nestable). Simple form uses `logic: AND/OR` (flat).

- Analogy: `&&` / `||` / `!`.
- `and` / `or` are variadic (accept 2 or more).

**Insurance examples:**

```yaml
# Pre-existing condition = had critical illness AND policy date later than diagnosis date
- when:
    expr:
      and:
        - { eq: [{ field: "had_critical_illness" }, true] }
        - { gt: [{ field: "policy_date" }, { field: "diagnosis_date" }] }
  then: DENY
  message: "Pre-existing condition; not insurable"

# Exclusion = drunk driving OR unlicensed OR unregistered vehicle
- when:
    expr:
      or:
        - { eq: [{ field: "accident_cause" }, "drunk_driving"] }
        - { eq: [{ field: "accident_cause" }, "unlicensed"] }
        - { eq: [{ field: "accident_cause" }, "unregistered_vehicle"] }
  then: DENY
```

---

### 3.7 Quantifiers (all / any / none) — judge each element of a list

- Analogy: `every()` / `some()` / "none of them".
- Semantics: judge a predicate on each element of an array; **empty array → all three return false** (anti-vacuous-truth).
- Form: `{ all: { binding: "x", over: <array>, predicate: <cond> } }` — the predicate references each element via the binding.

**Insurance examples:**

```yaml
# All bill dates must fall within the hospital stay (otherwise deny)
- when:
    expr:
      all:
        binding: "b"
        over: { field: "bills" }
        predicate:
          between:
            - { var: "$b.date" }
            - { field: "admit_date" }
            - { field: "discharge_date" }
  then: DENY
  message: "A bill falls outside the hospital stay"

# Any bill amount is negative (anomaly) → manual review
- when:
    expr:
      any:
        binding: "b"
        over: { field: "bills" }
        predicate: { lt: [{ var: "$b.amount" }, 0] }
  then: REQUEST_HUMAN
  message: "Bill amount anomaly; manual review"

# None of the exclusion clauses triggered
- when:
    expr:
      none:
        binding: "c"
        over: { field: "exclusion_clauses" }
        predicate: { eq: [{ var: "$c.triggered" }, true] }
  then: ALLOW
```

> Note: the predicate references the current element via `var` (e.g. `$b.date`); the exact `var` binding syntax is defined in spec §5.3.

### 3.8 Arithmetic (add / sub / mul / div / round) — compute numbers

- Analogy: `+` `-` `*` `/` and rounding.
- Fixed-point deterministic arithmetic (128-bit rationals, not floats — byte-identical across implementations).

**Insurance examples:**

```yaml
# Premium = coverage × rate (1,000,000 × 0.3% = 3000)
- when:
    expr: { ne: [{ mul: [{ field: "premium" }, { field: "rate" }] }, { field: "due_premium" }] }
  then: CORRECT
  correction: "Premium calculation mismatch; please verify"

# Remaining coverage = coverage − paid; below 0 → over the cap
- when:
    expr: { lt: [{ sub: [{ field: "policy.coverage_amount" }, { field: "cumulative_paid" }] }, 0] }
  then: DENY
  message: "Coverage cap exceeded"
```

### 3.9 Time (days_between / epoch_ms / date_add / date_part / month_last_day) — compute dates

- Analogy: Excel date functions; always computed in UTC for byte-identical results across time zones.

| Node | In plain words | Form |
|---|---|---|
| `days_between` | whole days between two dates | `{ days_between: [from, to] }` |
| `epoch_ms` | convert to millisecond timestamp | `{ epoch_ms: date }` |
| `date_add` | add a duration (years/months/days/hours) | `{ date_add: { unit: "days", base: date, amount: 90 } }` |
| `date_part` | extract a part (year/month/day/weekday) | `{ date_part: { unit: "month", arg: date } }` |
| `month_last_day` | last day of the month | `{ month_last_day: date }` |

**Insurance examples:**

```yaml
# Waiting period: diagnosis < 90 days after effective date
- when:
    expr: { lt: [{ days_between: [{ field: "effective_date" }, { field: "diagnosis_date" }] }, 90] }
  then: DENY

# Policy expired: expiry = effective + 1 year, today later than expiry
- when:
    expr:
      gt:
        - { field: "today" }
        - { date_add: { unit: "years", base: { field: "effective_date" }, amount: 1 } }
  then: DENY
  message: "Policy expired"
```

### 3.10 Aggregation (count / sum / avg / min / max) — summarize a list

- Analogy: SQL `COUNT()` / `SUM()` / `AVG()` / `MIN()` / `MAX()`.
- Form: the function name is the key — `{ sum: <array> }`, `{ count: <array> }`.
- Empty-array safe folds: count=0, sum=0, avg/min/max=false (no division by zero / infinity).

**Insurance examples:**

```yaml
# Three or more historical claims (risk) → manual review
- when:
    expr: { gte: [{ count: { field: "historical_claims" } }, 3] }
  then: REQUEST_HUMAN
  message: "Multiple claims; escalate to risk review"

# Cumulative payout reaches coverage
- when:
    expr: { gte: [{ sum: { field: "past_payouts" } }, { field: "policy.coverage_amount" }] }
  then: DENY
  message: "Cumulative payout reached the coverage cap"
```

### 3.11 Modifiers (within / rate) — time-window dedup / rate limiting

- Analogy: dedup, rate limiting (nginx limit_req).
- They are **condition modifier fields** (not standalone operators), written after a condition.
- `within: "30d"`: dedup within a window (1st allowed + recorded, 2nd within window triggers).
- `rate: "2/1s"`: rate limit (first 2 allowed, 3rd triggers).
- Both are **stateful**; the state is managed separately by the engine and enters the audit record.

**Insurance examples:**

```yaml
# Duplicate claim within 30 days → deny
- name: "SEC-011-dup-claim"
  when:
    conditions:
      - field: "policy_id"
        operator: eq
        value: { field: "claimed_policy_id" }
        within: "30d"            # modifier: dedup on the same policy within 30 days
  then: DENY
  message: "Duplicate claim within 30 days"

# API rate limit: max 2 per second
- name: "SEC-012-rate"
  when:
    conditions:
      - field: "endpoint"
        operator: eq
        value: "claim_query"
        rate: "2/1s"             # modifier: max 2 per second
  then: DENY
  message: "API rate limit exceeded"
```

---

## 4. Combinations and multi-combinations

From a single operator up to multi-combinations, step by step:

**① Single condition** (waiting period)

```yaml
when: { conditions: [{ field: "days_since_effective", operator: lt, value: 90 }] }
```

**② Combination (AND of several conditions)**

```yaml
# Pre-existing condition: had critical illness AND policy later than diagnosis
when:
  logic: AND
  conditions:
    - { field: "had_critical_illness", operator: eq, value: true }
    - { field: "policy_date", operator: gt, value: { field: "diagnosis_date" } }
```

**③ Multi-combination (nested and/or + arithmetic + time + quantifier + aggregation)**

```yaml
# A complex risk rule:
# (cumulative paid + this claim > coverage) OR (claim count ≥ 3 AND this claim > 100,000)
when:
  expr:
    or:
      - gt:
          - add:
              - { sum: { field: "past_payouts" } }
              - { field: "this_claim_amount" }
          - { field: "policy.coverage_amount" }
      - and:
          - { gte: [{ count: { field: "historical_claims" } }, 3] }
          - { gt: [{ field: "this_claim_amount" }, 100000] }
```

This one rule uses: **nested or/and + arithmetic add + aggregation sum/count + comparison gt/gte + field references** — a complete combination across node families.

---

## 5. Quick-reference table

| Category | Node / operator | In plain words | Analogy |
|---|---|---|---|
| Value | field / var / literal | read field / read var / constant | variable, constant |
| Comparison | eq ne gt gte lt lte | equal / not / greater / ≥ / less / ≤ | SQL comparison |
| Set | in / not_in | in / not in a list | `IN` / `NOT IN` |
| String | contains match starts_with ends_with (+negated) | contains / regex / prefix / suffix | `LIKE`, regex |
| Existence | exists not_exists | field present / missing | `IS NULL` |
| Measure | length between length_* count_* | length / range / count | `LENGTH`/`BETWEEN`/`COUNT` |
| Logic | and or not | and / or / not (nestable) | `&&` `\|\|` `!` |
| Quantifier | all any none | all / any / none satisfy | `every()`/`some()` |
| Arithmetic | add sub mul div round | add/sub/mul/div/round | `+ - * /` |
| Time | days_between epoch_ms date_add date_part month_last_day | day diff / timestamp / add duration / extract part / month-end | Excel date functions |
| Aggregation | count sum avg min max | count / sum / average / min / max | SQL aggregates |
| Modifier | within rate | window dedup / rate limit | dedup, rate limit |

---

> Full specification in `erdl-language-spec`; this guide is a quick reference + examples for ordinary developers — syntax details follow the spec.
