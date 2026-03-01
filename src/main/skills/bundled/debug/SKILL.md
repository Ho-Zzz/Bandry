---
name: debug
description: Systematic debugging methodology
tags: debug, troubleshooting
---

# Debug Skill

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
Use `read_file` and `exec` tools to gather evidence.
