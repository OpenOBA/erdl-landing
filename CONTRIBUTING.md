# Contributing to ERDL

ERDL welcomes contributions from independent runners, security researchers, and domain experts. If you can read the SPEC and build a conformant implementation, you are qualified to contribute.

## Ways to Contribute

### Submit Rule Patterns

If you have Agent safety practices for a specific industry (finance, healthcare, manufacturing, etc.), submit best-practice rule sets to `examples/`.

Format requirements:
- `.erdl.yaml` extension
- SPEC v1.1 naming convention `[CAT]-[NNN]-description`
- Include a README explaining the scenario and design rationale

### Expand the Test Vector Set

Submit edge-case test scenarios to the authoritative [erdl-vectors](https://github.com/OpenOBA/erdl-vectors) repository. Each vector must include:
- `id` — unique identifier
- `scenario` — scenario description
- `rules` — rule definitions
- `context` — trigger context
- `expected` — expected decision output

### Build Tooling

Develop ERDL parsers or IDE plugins for specific languages:
- Reference SPEC v1.1 — 13 operators and 17 Then actions
- Verify against the 101 vectors in [erdl-vectors](https://github.com/OpenOBA/erdl-vectors) (v1.3)
- Submit your implementation to [A2A Discussion #2031](https://github.com/a2aproject/A2A/discussions/2031) for independent verification

### Become an Independent Runner

The highest-value contribution: implement an ERDL engine from the spec text alone, without reading the answers file. See [RUNNERS-GUIDE.md](vectors-v1.3/RUNNERS-GUIDE.md) for the implementation guide.

Neutrality is tested, not declared.

## Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit changes (`git commit -m 'feat: add something'`)
4. Push (`git push origin feat/your-feature`)
5. Open a Pull Request

## Spec Change Proposal (SCP)

For changes to the SPEC itself, use the Spec Change Proposal process:

1. Create an Issue describing the change, rationale, and impact scope
2. Include updated audit vectors
3. Obtain approval from at least one community maintainer before merging

## Code of Conduct

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

> Deterministic architecture, not prompt engineering.
> OpenOBA · 2026
