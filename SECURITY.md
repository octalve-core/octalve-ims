# Security Policy

Octalve IMS is a commercial inventory management codebase. This policy covers the current `main` branch.

## Supported versions

| Version       | Supported |
| ------------- | --------- |
| Latest `main` | Yes       |
| Older tags    | No        |

## Reporting a vulnerability

**Do not** open a public GitHub issue for security vulnerabilities.

Report privately via this repository's GitHub Security Advisories ("Security" tab → "Report a vulnerability"), or through your usual Octalve support channel.

Please include:

- Short summary and potential impact
- Steps to reproduce (or a proof of concept)
- Affected path or commit SHA, if known
- Your preferred contact for follow-up

**Do not** include production secrets, `.env` files, API keys, or credentials in the report.

## Out of scope

- Abuse of demo / test accounts in non-production environments
- Denial-of-service or volumetric attacks
- Social engineering, phishing, or physical attacks
- Issues solely in third-party services (Stripe, Shippo, Brevo, ImageKit, Upstash, Sentry, PostgreSQL hosting, Vercel, Google OAuth, etc.) unless caused by clear misconfiguration in this repo
- Findings that require already-compromised admin credentials with no additional bug

## Response

Reports are triaged best-effort. Prefer coordinated disclosure: private report → fix → optional public disclosure after a fix is available.
