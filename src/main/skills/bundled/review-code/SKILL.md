---
name: review-code
description: Code review checklist and best practices
tags: review, quality
---

# Code Review Skill

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
- **Nitpick**: Style/preference items
