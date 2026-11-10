# Security policy — Eco Mentors

This policy covers the modified code in [Topleess/eco-mentors](https://github.com/Topleess/eco-mentors), based on OpenMentor. It does not authorize testing of openmentor.io, any upstream infrastructure, or any other third-party service.

## Report privately

**Do not publish vulnerabilities, credentials, personal data, exploit details, or database dumps in public issues or pull requests.**

Use [GitHub private vulnerability reporting](https://github.com/Topleess/eco-mentors/security/advisories/new). Include:

- the affected commit and component;
- a description of the impact;
- minimal reproduction steps against an isolated local installation;
- a redacted proof of concept, using synthetic data only.

If private reporting is unavailable, do not post the details publicly. There is currently no dedicated security email address, contractual response-time commitment, or paid bounty programme for this edition.

## Responsible testing

- Use the isolated [local development environment](infra/local/README.md), your own accounts, and synthetic data.
- Never access, modify, or retain another person's profile, request, or message.
- Do not run destructive tests, denial-of-service attacks, or automated scanning against external deployments without the operator's explicit permission.
- Report third-party service vulnerabilities to the relevant provider.
- If you encounter an exposed secret or personal data, stop testing and report the minimum necessary information privately; do not copy the sensitive value into the report.

## Version and deployment status

The code on `main` is the current development version. Client production infrastructure is not yet configured; this repository does not claim that its code is deployed at the upstream project's public domain.

Self-hosting operators are responsible for their deployment, provider credentials, backups, access control, and updates. Development login bypasses and local demonstration credentials must never be exposed to the internet.
