# Language & Scope
- Always respond **in English**.
- **Stay within the exact user request. Do not add extra tasks** (no side quests).
- **Never** create, modify, or delete files unless the user asked for it explicitly (by name or glob) or approved a plan that lists those files.

# Plan → Confirm → Execute
- Before changing code, **propose a short plan** with numbered steps and the **exact files** to touch.
- **Wait for user confirmation** before executing plans that include any of:
  - Changing `package.json` or dependencies; adding scripts or tools.
  - Creating documentation, diagrams, READMEs, ADRs, or design docs.
  - Writing Dockerfiles, docker-compose, or infra as code.
  - Adding CI/CD configs, GitHub Actions, or changing project settings.
  - Generating migrations or touching the database schema.
  - Committing, pushing, or opening PRs.
- For small, trivial edits (≤ 3 files, clearly requested), you may proceed without confirmation **but still show a plan**.

# Output Format
- Prefer **concise** answers. Use one of these formats:
  - **Plan:** numbered steps + target files.
  - **Patch:** unified diff (only changed hunks).
  - **Commands:** minimal bash needed to run or test.
  - **Notes:** short bullet points with rationale/assumptions.
- **Do not** paste full files if a diff suffices. Avoid verbose commentary.

# NestJS Backend Standards
- **Controllers are thin**; business logic lives in **services**. Repositories or data access in dedicated providers.
- **Validation**: All inputs validated with **DTOs** + class-validator/class-transformer using Nest ValidationPipe. Reject unknown properties unless user requests otherwise.
- **AuthN vs AuthZ**: Keep authentication and authorization **separate**. Use guards, decorators, and policies (RBAC/ABAC) for roles/permissions.
- **Configuration**: Values come from environment variables. **Do not hardcode secrets**. Use a configuration module/provider; read once, inject where needed.
- **Error handling**: No stack traces or sensitive data in API responses. Use `HttpException`/filters and map internal errors to safe responses.
- **Logging**: Use **structured logging** (e.g., Pino/Nest integrations). **No `console.log`** in production paths.
- **OpenAPI**: Keep Swagger/OpenAPI definitions **accurate** with proper DTOs, decorators, and response types.
- **Testing**: Provide/maintain unit tests for services and e2e/integration tests for routes where appropriate.
- **Performance/Security**: Follow safe defaults (timeouts, rate limiting if present, pagination on list endpoints, input size limits, avoid N+1 DB queries).

# Dependency & Tooling Policy
- **Do not add dependencies** unless explicitly requested. If you believe one is needed, propose:
  1) rationale,
  2) minimal viable package(s),
  3) alternatives (including “do nothing”),
  4) migration/rollback notes.
  Wait for approval.
- **Do not** modify Node/TypeScript toolchains, linters, formatters, or project scaffolding unless asked.

# Documentation & Artifacts
- **Never** generate docs, diagrams, or Markdown files unless explicitly requested.
- If documentation is requested, keep it **short** and place it **exactly** where specified.

# Git & Commits (when the user asks to commit)
- Follow **Conventional Commits**. Keep headers ≤ 72 chars; imperative mood.
- **Atomic commits** only. Do not mix unrelated changes.
- Propose a **commit plan** (2–6 commits) mapping files → commit messages. Wait for approval if changes are non-trivial.
- **Do not** run `git commit -a`; stage deliberately (file or hunk).
- **Never** push or open PRs unless explicitly asked.

# Clarifications & Assumptions
- If requirements are unclear, ask **at most 1–3 targeted questions**. If still ambiguous, state assumptions up front and proceed minimally.
- Prefer **safe defaults** that do not impact infra/tooling or public APIs without approval.

# Response Quality
- Be precise. Prefer small diffs over long prose. Explain **what and why**, not lengthy tutorials.
- If you detect risky side effects (schema changes, breaking APIs), **stop and request confirmation** with a brief risk summary.

# Examples (format only)
- **Plan**
  1) Update `src/users/users.service.ts`: fix null token handling.
  2) Add DTO validation in `src/auth/dto/login.dto.ts`.
  3) Adjust OpenAPI decorators in `src/auth/auth.controller.ts`.

- **Patch** (unified diff, trimmed to relevant hunks)
  ```diff
  --- a/src/auth/auth.controller.ts
  +++ b/src/auth/auth.controller.ts
  @@
  -  async login(@Body() body: any) {
  +  async login(@Body() dto: LoginDto) {
       return this.authService.login(dto);
     }
  ```