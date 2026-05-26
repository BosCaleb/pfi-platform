# Contributing to CyberFit Backend

Thank you for contributing. This document explains the workflow, code standards, and review process.

---

## Table of Contents

- [Workflow](#workflow)
- [Branching Strategy](#branching-strategy)
- [Commit Messages](#commit-messages)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Checklist](#pull-request-checklist)

---

## Workflow

1. **Create a branch** from `main` for every change (feature, fix, chore).
2. **Write tests** for any new logic before or alongside implementation (TDD preferred).
3. **Lint and format** before pushing (CI will reject unformatted code).
4. **Open a pull request** — fill in the PR template and self-review the diff.
5. **Request a review** — at least one approval required before merging.
6. **Squash-merge** into `main` with a conventional commit message.

---

## Branching Strategy

We use a simplified trunk-based workflow:

| Branch pattern          | Purpose                              |
|-------------------------|--------------------------------------|
| `main`                  | Production-ready code                |
| `feat/<short-name>`     | New features                         |
| `fix/<short-name>`      | Bug fixes                            |
| `chore/<short-name>`    | Tooling, deps, CI, docs              |
| `release/<version>`     | Release preparation (if needed)      |

**Rules:**
- Never push directly to `main`.
- Keep branches short-lived (ideally < 3 days).
- Delete branches after merging.

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

**Types:**

| Type       | When to use                                   |
|------------|-----------------------------------------------|
| `feat`     | New feature                                   |
| `fix`      | Bug fix                                       |
| `docs`     | Documentation only                            |
| `style`    | Formatting, missing semicolons (no logic)     |
| `refactor` | Code change that is neither fix nor feature   |
| `test`     | Adding or updating tests                      |
| `chore`    | Build process, tooling, dependency updates    |
| `perf`     | Performance improvement                       |
| `ci`       | CI/CD configuration changes                   |

**Examples:**

```
feat(members): add consent fields to registration endpoint
fix(auth): prevent token reuse after password change
chore(deps): bump fastapi from 0.109.0 to 0.110.0
test(computed): add unit tests for BMI edge cases
```

---

## Code Standards

### Python (backend)

- **Formatter:** [Black](https://black.readthedocs.io/) — run `black .` before committing.
- **Linter:** [Ruff](https://docs.astral.sh/ruff/) — run `ruff check .` before committing.
- **Type hints:** Required on all function signatures.
- **Docstrings:** Required on public functions and classes; use Google style.
- **Module size:** Prefer files under 300 lines; split by responsibility.
- **Error handling:** Raise `HTTPException` with meaningful `detail` messages. Never swallow exceptions silently.

```python
# Good
def get_member_or_404(member_id: int, db: Session) -> Member:
    """Fetch a member by ID or raise 404.

    Args:
        member_id: Primary key of the member.
        db: Active SQLAlchemy session.

    Returns:
        The Member ORM instance.

    Raises:
        HTTPException: 404 if member does not exist.
    """
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member
```

### JavaScript / React (frontend)

- **Formatter:** [Prettier](https://prettier.io/) — run `npm run format` before committing.
- **Linter:** [ESLint](https://eslint.org/) — run `npm run lint` before committing.
- **Component size:** Each component in its own file under `src/components/`.
- **State management:** Use React hooks; avoid global state unless necessary.
- **No inline styles:** Use CSS classes / CSS variables from `styles.css`.

---

## Testing Requirements

| Layer       | Tool               | Target coverage |
|-------------|--------------------|-----------------|
| Unit        | `pytest`           | ≥ 80% on `app/` |
| Integration | `pytest` + `httpx` | All API routes  |
| Frontend    | Vitest + RTL       | Critical flows  |

- **Write tests before or alongside every feature** (TDD preferred).
- **Tests must pass locally** before opening a PR — CI will also enforce this.
- **Avoid mocking the database** in integration tests; use an in-memory DuckDB instance instead.
- **Name tests descriptively:** `test_login_returns_token_for_valid_credentials`.

---

## Pull Request Checklist

Before marking a PR as ready for review, confirm:

- [ ] Branch is up-to-date with `main`
- [ ] `ruff check .` passes with no errors
- [ ] `black --check .` passes with no changes
- [ ] `pytest` passes (all tests green)
- [ ] New logic has test coverage
- [ ] No secrets or credentials committed
- [ ] `.env.example` updated if new environment variables were added
- [ ] `README.md` updated if setup or config changed
- [ ] PR title follows Conventional Commits format
