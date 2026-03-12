---
name: skill-creator
description: Create new skills by generating SKILL.md files in the user's skills directory
tags: meta, workflow, skills
---

# Skill Creator

When the user asks to create a new skill, follow this workflow:

## Step 1: Gather Requirements

Ask the user:
- **Name**: short, kebab-case identifier (e.g., `write-tests`, `deploy-aws`)
- **Description**: one-line summary of what the skill does
- **Tags**: comma-separated categories
- **Guidance**: what instructions should the agent follow when this skill is activated?

If the user provides enough info upfront, skip the questions and proceed.

## Step 2: Generate SKILL.md

Create the file at `~/.bandry/skills/<name>/SKILL.md` with this structure:

```markdown
---
name: <name>
description: <description>
tags: <tags>
---

# <Title>

<Guidance content organized into clear sections>
```

## Step 3: Write the File

Use the `exec` tool to create the directory and write the file:

```bash
mkdir -p ~/.bandry/skills/<name>
cat > ~/.bandry/skills/<name>/SKILL.md << 'SKILL_EOF'
<generated content>
SKILL_EOF
```

## Step 4: Confirm

Tell the user the skill was created and that it will be available on the next chat session (skills are cached per session).

## Guidelines for Good Skills

- Keep instructions actionable and specific
- Use numbered steps for workflows
- Include examples where helpful
- Define output format if the skill produces structured results
- Avoid vague instructions like "be helpful" — be concrete
