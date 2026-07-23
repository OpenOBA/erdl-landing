# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.1.x   | ✅ Active          |
| 1.0.x   | ⚠️ Security fixes only |

## Reporting a Vulnerability

If you discover a security vulnerability in the ERDL specification or its reference implementations, please **do not** file a public issue.

Instead, send a detailed report to **support@openoba.com** with:

- A clear description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

We aim to acknowledge receipt within 48 hours and provide an initial assessment within 5 business days.

## Scope

This policy covers:

- The ERDL specification documents in this repository
- The reference vector generation scripts
- The Decision Object format and audit chain design

This policy does **not** cover third-party implementations of the ERDL specification.

## SafeExpr Security

The ERDL specification mandates SafeExpr — a deterministic expression engine with built-in protections against:

- ReDoS (Regular Expression Denial of Service): regex step limit ≤ 10,000
- AST resource exhaustion: max depth ≤ 64, max nodes ≤ 256
- Null propagation: three-value logic with safe failure

If you find a bypass for any of these protections, please report immediately.

---

> 确定性架构，而非 Prompt 工程。
> OpenOBA · 2026
