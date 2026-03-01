import type { SkillEntry } from "./types";

/**
 * Bundled skills embedded as code constants.
 * This avoids __dirname path issues after tsup bundles to dist-electron/.
 */
export const BUNDLED_SKILLS: SkillEntry[] = [
  {
    name: "commit",
    description: "Git commit best practices and conventional commit format",
    tags: ["git", "workflow"],
    sourcePath: "bundled://commit",
    content: `# Git Commit Skill

When the user asks to commit changes or review commit messages:

1. Use conventional commit format: \`<type>(<scope>): <description>\`
   - Types: feat, fix, refactor, docs, test, chore, style, perf, ci, build
   - Scope is optional but recommended

2. Commit message rules:
   - Subject line <= 72 characters
   - Use imperative mood ("Add feature" not "Added feature")
   - No period at end of subject
   - Separate subject from body with blank line
   - Body explains WHAT and WHY, not HOW

3. Before committing:
   - Review staged changes with \`git diff --cached\`
   - Ensure no secrets or credentials in staged files
   - Group related changes into single commits

4. Example:
   \`\`\`
   feat(auth): add OAuth2 login flow

   Implement Google OAuth2 authentication with PKCE.
   Closes #42
   \`\`\``,
  },
  {
    name: "review-code",
    description: "Code review checklist and best practices",
    tags: ["review", "quality"],
    sourcePath: "bundled://review-code",
    content: `# Code Review Skill

When reviewing code, follow this checklist:

## Correctness
- Does the code do what it claims to do?
- Are edge cases handled (null, empty, boundary values)?
- Are error paths handled properly?

## Security
- No hardcoded secrets or credentials
- Input validation present
- No SQL injection / XSS vectors

## Readability
- Clear naming conventions
- Appropriate abstraction level
- No unnecessary complexity

## Performance
- No obvious N+1 queries
- No unnecessary re-renders (React)
- Appropriate data structures

## Output Format
Present findings as:
- **Critical**: Must fix before merge
- **Suggestion**: Nice to have improvements
- **Nitpick**: Style/preference items`,
  },
  {
    name: "debug",
    description: "Systematic debugging methodology",
    tags: ["debug", "troubleshooting"],
    sourcePath: "bundled://debug",
    content: `# Debug Skill

When the user reports a bug or asks for debugging help:

## Step 1: Reproduce
- Ask for exact steps to reproduce
- Ask for error messages, stack traces, logs
- Identify environment (OS, Node version, browser)

## Step 2: Isolate
- Read relevant source files using tools
- Identify the failing code path
- Check recent changes that might have introduced the bug

## Step 3: Diagnose
- Form hypotheses about root cause
- Validate hypotheses by reading code/running commands
- Narrow down to the exact line/function

## Step 4: Fix
- Propose minimal fix
- Consider side effects
- Suggest test cases to prevent regression

## Key Principle
Always prefer reading actual source code over guessing.
Use \`read_file\` and \`exec\` tools to gather evidence.`,
  },
  {
    name: "skill-creator",
    description:
      "Create new skills by generating SKILL.md files in the user's skills directory",
    tags: ["meta", "workflow", "skills"],
    sourcePath: "bundled://skill-creator",
    content: `# Skill Creator

When the user asks to create a new skill, follow this workflow:

## Step 1: Gather Requirements

Ask the user:
- **Name**: short, kebab-case identifier (e.g., \`write-tests\`, \`deploy-aws\`)
- **Description**: one-line summary of what the skill does
- **Tags**: comma-separated categories
- **Guidance**: what instructions should the agent follow when this skill is activated?

If the user provides enough info upfront, skip the questions and proceed.

## Step 2: Generate SKILL.md

Create the file at \`~/.bandry/skills/<name>/SKILL.md\` with this structure:

\`\`\`markdown
---
name: <name>
description: <description>
tags: <tags>
---

# <Title>

<Guidance content organized into clear sections>
\`\`\`

## Step 3: Write the File

Use the \`exec\` tool to create the directory and write the file:

\`\`\`bash
mkdir -p ~/.bandry/skills/<name>
cat > ~/.bandry/skills/<name>/SKILL.md << 'SKILL_EOF'
<generated content>
SKILL_EOF
\`\`\`

## Step 4: Confirm

Tell the user the skill was created and that it will be available on the next chat session (skills are cached per session).

## Guidelines for Good Skills

- Keep instructions actionable and specific
- Use numbered steps for workflows
- Include examples where helpful
- Define output format if the skill produces structured results
- Avoid vague instructions like "be helpful" — be concrete`,
  },
];
