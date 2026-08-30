# Security Policy

ERDL™ is a deterministic rule evaluation language. The evaluation kernel is
designed to be safe by construction: no code injection paths, a bounded
resource model (spec §7.2 E4), ReDoS-protected regex (§7.3(d)), and pure
function semantics (E1).

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public
issue. Instead, report it privately to:

- Email: support@openoba.com

Please include:

- A description of the vulnerability.
- Steps to reproduce, or a minimal repro.
- The affected version(s).
- Any suggested fix (optional).

We will acknowledge receipt, investigate, and coordinate a fix and disclosure
with you.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.0.x   | Yes       |
| < 2.0   | No        |

## Security Model

The ERDL evaluation kernel maintains the following security properties (see the
spec §7):

- **E1** — evaluation is a pure function (no side effects, no wall-clock reads).
- **E2** — fixed-point rational arithmetic (no float precision leakage).
- **E4** — bounded resources (AST depth, node count, regex steps, time).
- **E11** — null propagation (safe-fail on missing fields).
- **E12** — fail-close on evaluation errors at tier ≤ 2.

If you believe any of these properties is violated, please report it.
