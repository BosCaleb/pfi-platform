# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅        |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

To report a vulnerability responsibly:

1. Email **statedgeltd@gmail.com** with the subject line `[SECURITY] CyberFit Vulnerability`.
2. Include:
   - A clear description of the vulnerability.
   - Steps to reproduce (proof-of-concept if possible).
   - Affected versions or components.
   - Potential impact assessment.
3. You will receive an acknowledgement within **48 hours** and a resolution plan within **7 days**.

We will credit reporters (unless they prefer anonymity) once the issue is resolved.

---

## Security Design Notes

### Authentication
- JWT tokens are signed with HS256 using a server-side secret (`SECRET_KEY`).
- Tokens expire after 8 hours by default (`ACCESS_TOKEN_EXPIRE_MINUTES`).
- Passwords are hashed with bcrypt (via Passlib).

### Sensitive Data
- The platform stores health and medical information (injuries, medications, conditions).
- Data is stored in a DuckDB file — ensure the file is on an encrypted volume in production.
- No field-level encryption is currently implemented; this is on the roadmap.

### CORS
- Development defaults to `allow_origins=["*"]`. 
- **Production deployments must set `CORS_ORIGINS`** to the specific frontend origin(s).

### Admin Seeding
- The `/api/auth/seed` endpoint creates a default admin account.
- `ALLOW_ADMIN_SEED` must be `false` in production.
- Default credentials in `.env.example` are placeholders — they must be changed before use.

### Known Limitations (Roadmap Items)
- No rate limiting on authentication endpoints (brute-force protection).
- No audit log for data access (access to sensitive member records is not logged).
- No field-level encryption for health data at rest.
- HTTPS is not enforced in-app — a reverse proxy (nginx / Caddy) must handle TLS in production.
