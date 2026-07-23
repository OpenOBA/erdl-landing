# ERDL Rule Examples

This directory contains production-ready ERDL rule examples for various industries.

## Categories

| Directory | Industry | Rules |
|-----------|----------|-------|
| [`finance/`](finance/) | Financial Services | Payment security, PCI-DSS, trading compliance, rate limiting |
| [`healthcare/`](healthcare/) | Healthcare | PHI protection, HIPAA compliance, clinical decision review |
| [`manufacturing/`](manufacturing/) | Manufacturing / Industrial | ICS safety interlocks, operational bounds, predictive maintenance |
| [`general/`](general/) | General Purpose | Universal safety rules, loop detection, rate limiting, unless exemption |

## Usage

1. Copy the relevant `.erdl.yaml` file to your Agent workspace
2. Load it via the ERDL engine or MCP Server
3. Customize the rules for your specific environment

## Contributing

Have rules for another industry? See [CONTRIBUTING.md](../CONTRIBUTING.md) and submit a PR.
