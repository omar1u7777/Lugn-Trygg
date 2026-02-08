# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

If you discover a security vulnerability in Lugn & Trygg, please report it responsibly:

1. **Email**: [omaralhaek97@gmail.com](mailto:omaralhaek97@gmail.com)
2. **Subject line**: `[SECURITY] Lugn & Trygg — <brief description>`
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

| Action | Timeframe |
| ------ | --------- |
| Acknowledgement | 48 hours |
| Initial assessment | 5 business days |
| Fix release | 30 days (critical), 90 days (non-critical) |

## Scope

The following are in scope for security reports:

- Authentication and authorization bypass
- Injection vulnerabilities (SQL, NoSQL, XSS, CSRF)
- Sensitive data exposure (PII, health data, credentials)
- Server-side request forgery (SSRF)
- Insecure direct object references
- Broken access control

## Data Protection

Lugn & Trygg handles sensitive mental health data. We take the following measures:

- All API endpoints require authentication (`@AuthService.jwt_required`)
- Passwords are never stored — Firebase Auth handles identity
- Health data is encrypted at rest (Firebase Firestore)
- Rate limiting on all endpoints (Redis-backed)
- Audit logging for security-sensitive actions
- GDPR-compliant data export and deletion endpoints
- CORS restricted to authorized origins only

## Dependencies

We monitor dependencies for known vulnerabilities using:

- **npm audit** — frontend JavaScript packages
- **Bandit** — Python static security analysis
- **Trivy** — container and filesystem scanning
- **GitHub Dependabot** — automated dependency updates
