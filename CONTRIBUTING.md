# Contributing to ERDL™

Thank you for your interest in contributing to ERDL (Entity-Rule Definition
Language). ERDL is an open, deterministic, declarative rule definition
language. This repository contains:

- `erdl-spec.md` / `erdl-spec.en.md` — the language specification (中文 / English).
- `src/` — the reference implementation: parser, evaluator, validator,
  serializer, template engine, and the expression-tree kernel, in TypeScript.

## Ways to Contribute

- **Report bugs** — open an issue with the unexpected behavior and a minimal repro.
- **Suggest features** — open an issue describing the use case and expected behavior.
- **Fix or implement** — submit a pull request (see below).
- **Improve docs or tests** — spec edits, README, examples, test coverage.
- **Improve tooling** — see [DEVELOPMENT.md](./DEVELOPMENT.md) for the tooling roadmap.

## Development Setup

Prerequisites:

- Node.js >= 18
- npm

```bash
git clone https://github.com/OpenOBA/erdl-landing.git
cd erdl
npm install
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Type-check without emitting (`tsc --noEmit`) |
| `npm test` | Run the vitest suite |

## Coding Standards

- TypeScript, strict mode.
- No `// @ts-ignore`; no `as any` (use `unknown` + narrowing; `as any` is
  tolerated only at API boundaries with a justifying comment).
- `catch (e)` must narrow the error (`e instanceof Error ? e.message : String(e)`).
- Public APIs declare explicit return types.
- Comments and error messages are in English.
- The expression-tree kernel MUST remain a pure, deterministic function —
  no wall-clock reads, no implicit type conversion, no float for fixed-point
  arithmetic. See the spec §7.2 (E1–E12) and §7.3.

## Pull Request Process

1. Fork and branch.
2. Make focused changes; one logical change per commit.
3. Run `npm run typecheck` and `npm test` — both must pass (0 errors).
4. Add or update tests for any behavior change.
5. Open a pull request describing the change and its motivation.

## License

By contributing, you agree that your contributions are licensed under the MIT
License (see [LICENSE](./LICENSE)). Note that "ERDL" is a trademark of
深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.); the license
covers code only and grants no trademark rights (see the Trademark Notice in
LICENSE).
