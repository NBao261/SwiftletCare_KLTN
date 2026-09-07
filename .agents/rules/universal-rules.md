---
name: universal-rules
version: 1.1.0
priority: P0
trigger: always_on
---

# Universal Rules (TIER 0) - AG Kit

> Always-active rules that apply to every request, regardless of domain.

---

## 🌐 Language Handling

When user's prompt is NOT in English:

1. **Internally translate** for better comprehension
2. **Respond in user's language** - match their communication
3. **Code comments/variables** remain in English

---

## 🧹 Clean Code (Global Mandatory)

**ALL code MUST follow `@[skills/clean-code]` rules. No exceptions.**

- **Code**: Concise, direct, no over-engineering. Self-documenting.
- **Testing**: Mandatory. Pyramid (Unit > Int > E2E) + AAA Pattern.
- **Performance**: Measure first. Adhere to current Core Web Vitals standards.
- **Infra/Safety**: 5-Phase Deployment. Verify secrets security.

---

## 🔴 Git Commit Gate (MANDATORY — ALL AGENTS)

**Trigger keywords:** `git commit`, `git push`, `commit`, `push to github`, `push lên`, `commit code`, `stage`, `tạo commit`, `đẩy code`

**When ANY of these keywords appear in the user's request or in your planned actions, you MUST:**

1. **STOP** before running any git command
2. **LOAD** `@[skills/git-commit-convention]` — Read and apply it fully
3. **ANNOUNCE**: `📚 Using skill: @git-commit-convention...`
4. **VALIDATE** the commit message:
   ```bash
   python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py "<message>"
   ```
5. **ONLY proceed** after the validator returns `[PASS]`

> 🔴 **VIOLATION:** Running `git commit` or `git push` without loading this skill = **PROTOCOL VIOLATION**.
> 🔴 **VIOLATION:** Committing with wrong format (no type/scope) = **QUALITY FAILURE**.
> 🔴 **VIOLATION:** Pushing directly to `main` branch = **SECURITY FAILURE**.

### Quick Trigger Reference

| User says... | Action |
|---|---|
| "commit này lên" / "commit changes" | Load skill → validate message → commit |
| "push lên github" / "push to develop" | Load skill → verify last commit format → push |
| "tạo commit cho file này" | Load skill → classify type+scope → write message → validate |
| "đẩy code lên" | Load skill → check branch (never main) → push |
| "commit all" | Load skill → stage selectively → commit per logical unit |

---
