# ERDL Rule Examples

Production-ready ERDL rule examples aligned to SPEC v1.1 §5.1 standard templates (fields ordered per F1-F8). All `value` fields use double-quoted strings per F6.

| Directory | Industry | Rules |
|-----------|----------|-------|
| [`finance/`](finance/) | Financial Services | Payment security, PCI-DSS, trading compliance |
| [`healthcare/`](healthcare/) | Healthcare | PHI protection, HIPAA compliance, clinical decision review |
| [`manufacturing/`](manufacturing/) | Manufacturing / Industrial | ICS safety interlocks, operational bounds, ISO 9001 quality gates |
| [`general/`](general/) | General Purpose | Universal safety, loop detection, rate limiting, unless exemption |

## Usage

1. Copy the relevant `.erdl.yaml` file to your Agent workspace
2. Load it via the ERDL engine or MCP Server
3. Customize the rules for your specific environment

## Format

All examples follow SPEC v1.1 §5.1 format rules:
- **F1**: Top-level field order `protocol → version → metadata → rules`
- **F2**: `metadata` sub-fields `name → description → category → decision → tags`
- **F3**: `rules[]` sub-fields `name → description → priority → override → ring → when → then → message`
- **F6**: String values (`description`, `message`, `field`, `value`) use double quotes
- **F7**: 2-space indentation
- **F8**: Each file starts with `protocol: "erdl/v1"`

## Contributing

Have rules for another industry? See [CONTRIBUTING.md](../CONTRIBUTING.md) and submit a PR.
