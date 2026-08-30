# ERDL™ Development Tooling

This document describes the development toolchain for ERDL and the tooling
roadmap. The tooling is **open to the community** — contributions here are
welcome and encouraged.

## Current Toolchain

| Tool | Command | Purpose |
|------|---------|---------|
| TypeScript (`tsc`) | `npm run build` | Compile `src/` to `dist/` |
| TypeScript (`tsc --noEmit`) | `npm run typecheck` | Type-check without emitting |
| Vitest | `npm test` | Unit and regression tests |

The reference implementation is pure TypeScript with ESM (`"type": "module"`),
strict mode, and no runtime framework dependencies beyond `yaml` and
`json-canonicalize`.

## Tooling Roadmap (help wanted)

The following items would strengthen the ERDL ecosystem. Each is a concrete,
scoped piece of work; contributions are welcome — open an issue or PR to take
one on.

1. **Independent conformance runner** — an independent verifier, in a
   language/stack of your choice, that loads the spec's test vectors and
   verifies byte-for-byte output (see spec §10.2). This is the highest-value
   tooling contribution: it proves cross-implementation determinism.

2. **Decision-table loader** — `parseErdlDocument` currently rejects the §5.4
   matrix form; implement its compilation to `RuleDefinition[]`.

3. **Test-vector generator** — emit the expression-layer vectors
   (34 nodes × 4 scenarios, E1–E12, Simple 30 compile mapping) from the spec.

4. **CI/CD** — GitHub Actions running `typecheck` + `test` on every push and PR.

5. **Linter** — an ESLint config encoding the coding standards in
   [CONTRIBUTING.md](./CONTRIBUTING.md) (no `@ts-ignore`, no `as any`, etc.).

6. **Benchmarks** — evaluation performance and determinism benchmarks.

7. **Language tooling** — editor support (syntax highlighting, LSP) for
   `*.erdl.yaml` files.

## How to Propose Tooling

1. Open an issue describing the tool, its value, and a rough scope.
2. Discuss the design before implementing (for non-trivial items).
3. Submit a PR following [CONTRIBUTING.md](./CONTRIBUTING.md).

If you are building tooling on top of ERDL (editors, runners, integrations),
the single source of truth is the specification (`erdl-spec.md` /
`erdl-spec.en.md`); the reference implementation in `src/` is one conforming
implementation, not the definition.
