<!--
  Copyright (c) 2026 唐启鑫 (Tang Qixin)
  Licensed under MIT. See LICENSE file.
-->

# Governance

## Project Maintainers

ERDL is maintained by OpenOBA. The current maintainers are:

- **Tang Haoran (唐浩然)** — AI Executive Officer, Specification Lead
- **Henry** — Co-Founder, Strategic Direction

## Decision Making

### Specification Changes

Changes to the ERDL specification follow the Spec Change Proposal (SCP) process:

1. **Proposal**: File an issue describing the change, rationale, and impact
2. **Discussion**: Community review period (minimum 14 days for substantive changes)
3. **Audit Vector Update**: Any spec change MUST include updated audit vectors
4. **Approval**: Requires approval from at least one maintainer
5. **Release**: Version bump per semver, CHANGELOG updated

### Non-Spec Changes

- Documentation fixes, tooling improvements: maintainer discretion
- Community contributions: reviewed via Pull Request

## Versioning

ERDL follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR**: Breaking changes to rule evaluation semantics
- **MINOR**: New operators, then-actions, or spec sections (backward compatible)
- **PATCH**: Clarifications, typo fixes, non-semantic improvements

## Neutrality

ERDL is an open standard. Its neutrality is verified through **cross-implementation verification**:

- Multiple independent implementations must produce byte-for-byte identical Decision Objects
- The specification is MIT-licensed and free for anyone to implement
- No single entity controls the verification process

See [spec/vectors/](spec/vectors/) for the verification vector set.

---

> 确定性架构，而非 Prompt 工程。
> OpenOBA · 2026
