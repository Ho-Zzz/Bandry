---
name: commit
description: Git commit best practices and conventional commit format
tags: git, workflow
---

# Git Commit Skill

When the user asks to commit changes or review commit messages:

1. Use conventional commit format: `<type>(<scope>): <description>`
   - Types: feat, fix, refactor, docs, test, chore, style, perf, ci, build
   - Scope is optional but recommended

2. Commit message rules:
   - Subject line <= 72 characters
   - Use imperative mood ("Add feature" not "Added feature")
   - No period at end of subject
   - Separate subject from body with blank line
   - Body explains WHAT and WHY, not HOW

3. Before committing:
   - Review staged changes with `git diff --cached`
   - Ensure no secrets or credentials in staged files
   - Group related changes into single commits

4. Example:
   ```
   feat(auth): add OAuth2 login flow

   Implement Google OAuth2 authentication with PKCE.
   Closes #42
   ```
