---
applyTo: "**/*"
description: "Smart Commit & PR Policy for Agent Mode (Grok Code Fast 1)"
---

# Purpose
- Generate atomic, small, and focused commits using the Conventional Commits convention.
- Produce concise and consistent commit messages with clear context.
- Create well-structured Pull Requests (PRs) with a summary, rationale, and testing plan.

# Commit Rules
1) Never use git commit -a.  
   Always stage files explicitly:
   - Inspect with git status, git diff --name-only, and git diff --staged.
   - Group related changes together (e.g., feature, refactor, test, style, docs).
   - Use git add -p or git add --patch to stage specific hunks.
   - If the total diff exceeds ~400 added lines or mixes unrelated topics, split it into multiple commits.

2) Use the Conventional Commits format:  
   Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.

   Header format:  
   ```
   type(scope?): short imperative description
   ```
   - Keep headers ≤ 72 characters (no trailing period).
   - The body (optional) should explain what and why, not how.
   - Use type!: and a BREAKING CHANGE: footer for breaking changes.

3) Link issues and add trailers when relevant:
   - Use Closes #123, Fixes #456, or Refs #789.
   - Optional trailers:  
     Co-authored-by: Name <email>  
     Signed-off-by: Name <email>

4) Best Practices:
   - Separate commits for documentation, tests, and code changes.
   - Use refactor only when behavior doesn’t change.
   - Don’t paste large diffs or code snippets in commit messages.

# Behavior in Agent Mode
When the user says “commit changes”, follow these steps:

1) Plan Commits
   - Read the git diff and propose a list of 2–6 atomic commits.  
     Each should include:  
     - Type/scope  
     - Header (≤72 chars)  
     - A short list of affected files or hunks.
   - If changes are complex, show the plan first and wait for confirmation.

2) Execute Commits
   - Stage changes granularly (git add -p or per file).  
   - Run local tests or builds if available (npm test, yarn test, etc.).  
   - Commit with a properly formatted message.

3) Output format
   - Output only bash and text blocks, per commit.
   - Example:
     ```bash
     git add -p src/auth/auth.service.ts
     git add test/auth.spec.ts
     git commit -m "fix(auth): prevent null token crash" -m "Avoids NPE when token is missing.nnCloses #123"
     ```
     ```text
     fix(auth): prevent null token crash

     Avoids NPE when token is missing.

     Closes #123
     ```

# Pull Request Guidelines
- Keep PRs small and focused.
- Use clear, imperative titles (≤72 chars).  
  Can follow Conventional Commits or summarize the purpose.
- Include:
  1. Summary
  2. Context / Motivation
  3. Test Plan
  4. Risks / Rollout Plan
  5. Linked Issues / Docs
- Split PRs that exceed ~500 net lines.

# Examples of Valid Headers
- fix(auth): handle expired JWTs
- refactor(core): extract logging middleware
- test(user): add integration tests for registration flow
- feat(api)!: rename /users endpoint to /accounts

# Internal Notes (for model)
- Prioritize reading diffs before writing messages.  
- Keep output short and formatted.  
- Always use imperative mood (“add”, “fix”, “refactor”, not “added”, “fixed”).  
- Do not merge unrelated changes into one commit.