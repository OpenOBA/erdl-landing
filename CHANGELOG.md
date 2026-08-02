<!--
  Copyright (c) 2026 唐启鑫 (Tang Qixin)
  Licensed under MIT. See LICENSE file.
-->

# ERDL Specification — Changelog

> Maintainer: OpenOBA · https://github.com/OpenOBA/erdl-landing

---

## [1.3.1] — 2026-08-02

### Vector Set
- Static vector count: 37→75 (63 DO + 12 AV). Dynamic vectors (26) managed separately in rulsynor.
- 7 vector data fixes: DO-011/DO-030/DO-042 (override), DO-012 (ring/category), DO-027 (neq→ne), DO-034 (category)
- `compliance_profile.profile_id`: v1.2→v1.3 (76 occurrences)
- `agent.version`: v1.2.0→v1.3.0 (75 occurrences)
- **Answers file withdrawn** from repository per Erik Newton's recommendation and E1–E3 principles
- **audit.hash** regenerated for all 74 non-canary vectors after profile/version field changes
- AV-013 chain integrity canary audit.hash preserved as regressed-runner value

### RFC-001
- Version unified to v1.3 throughout (CN+EN)
- AV-008 documented as superseded by AV-013

### Documentation
- README (CN+EN): vector counts 101→75 static, dates→2026-08-02
- All 16 MD files across erdl-landing: dates, vector counts, terminology, references synchronized
- RUNNERS-GUIDE.md, IMPLEMENTERS-GUIDE.md: dedicated Acknowledgments sections per SPEC v1.1 §14 format
- `ci-verify.yml`: paths corrected for `vectors-v1.3/` working directory
- Online verifier (`verify.js`): synced from erdl-vectors

---

## [1.1.1] — 2026-08-01

### Spec Amendments (per Erik Newton third-party audit)
- **§3.6 Guard**: "cannot bypass" → precise mediation language ("all MCP calls routed through the proxy are mediated by the Guard")
- **§8.4 Proxy Mode**: same mediation language correction
- **RFC §7.5**: same correction applied

### Documentation Infrastructure
- **README Quick Start**: honest disclosure that `erdl-engine-js` is not yet public; Concordia listed as the only independently cloneable implementation
- **SPEC §12 verification table**: added "Executable" column (zh+en) — only independently cloneable implementations listed
- **All README layers** (root → spec/vectors, vectors-v1.3): vector count updated from 44 to 101 (v1.3); Christopher moved from verification table to Acknowledgments; ERDL Engine JS removed from verification table (not publicly available)
- **spec/vectors/README.md (zh)**: fully aligned with README.en.md — added Version Identification warning, verification table, Acknowledgments, Verification Method

### Vectors v1.3 Integration
- **vectors-v1.3/**: full v1.3 vector set mirrored from erdl-vectors (75 static: 63 DO + 12 AV + 26 dynamic in rulsynor). No answers file included.
- **Tooling**: verify.js, reference-runner.js, generate-vectors.cjs, test suites (67 generator + 86 verification tests), CI pipeline, verified-runners.json, RUNNERS-GUIDE.md
- **v1.0/v1.1 vectors**: retained as historical archive; v1.3 is the sole authoritative version

### Examples Alignment
- **All rule examples** aligned to SPEC v1.1 §5.1 format rules (F1-F8): added missing `metadata.name`/`decision`/`tags`/`override`; removed non-SPEC fields (`guard`, `triggers`, `owner`, `owasp_alignment`); double-quoted all string values; fixed field ordering
- **examples/README.md**: added SPEC F1-F8 reference

---

## [1.1.0] — 2026-07-23

### Added
- **§3.2.1** Minimum `when` completeness requirements — prevents `when: 'true'` + blocking `then` from rendering system unusable
- **§3.2.2** `unless` exemption mechanism — short-circuit evaluation semantics and audit behavior fully defined
- **§3.2.3** Mandatory `message` requirement — DENY/HALT/CORRECT/REQUEST_HUMAN must include reason
- **§3.2.4** Rule naming convention — `[CAT]-[NNN]-description` format with CAT abbreviation table
- **§3.4.1** Priority definition between `metadata.decision` and `rules[].then`
- **§3.4** WORKFLOW, WORKFLOW_WAITING, WORKFLOW_PROGRESS decision types registered
- **§6.1** Null propagation semantics + resource quotas (depth ≤ 64, nodes ≤ 256, regex ≤ 10,000)
- **§11.5** Rule quality gates (11 load-time checks)
- **§12** Decision Object audit subset — full integration of decision-object-v1.0 (frozen 2026-07-15)
- **§1.5** BCP 14 (RFC 2119 & RFC 8174) keyword declaration
- **§9.3** v1.1 backward compatibility declaration (non-breaking)
- Chapter table adds "Compatibility" column
- **Appendix E** v1.2 planned goals
- **Verification vector set v1.1** — 37 decision engine vectors + 7 audit hash vectors = 44 total
- **13 operators full coverage** (added `not_in`, `not_contains`)

### Changed
- Operators: 11 → 13 (added `not_in`, `not_contains`)
- Then actions: 14 → 17 (added 3 WORKFLOW variants)
- `when` syntax: 2 → 3 forms (added flat shorthand)
- "Unmodified chapters" → "Inherited and refined chapters" — eliminates style contradiction
- §12 chapter numbering format unified (removed emoji prefixes)
- `owasp` field unified to array format

### Fixed
- Chapter numbering conflict (two §5, two §10 → unique numbers)
- Operator table BNF omissions completed
- Audit vector count 5 → 7, synchronized in text
- DELEGATE → ESCALATE mapping rule added
- Name uniqueness case-sensitivity clarification added
- Appendix E idempotency status corrected

### Audited
- Technical self-consistency deep audit (2026-07-22)
- Engineering feasibility audit (2026-07-22)
- Third-party pre-release final audit (2026-07-23)
- Three-way cross-audit: SPEC v1.1 ↔ Decision Object v1.0 ↔ Vector Set v1.1

---

## [1.0.0] — 2026-07-10

### Added
- ERDL Protocol Specification v1.0 Community Preview
- Decision Object v1.0 draft specification (CN+EN)
- 10 external decision types + 4 internal reasoning actions
- 11 operators + 4 Execution Rings
- 23 cross-implementation verification vectors + 5 audit hash vectors

---

> Deterministic architecture, not prompt engineering.
> OpenOBA · 2026
