# Memory Index

## Project

- [project] Always create a new dedicated branch for major code changes → project-conventions.md
- [project] AG Kit only supports Gemini CLI and Google Antigravity (not other AI coding tools) → project-conventions.md
- [project] Component metadata uses SemVer while toolkit releases use CalVer → tech-decisions.md
- [project] All git commits MUST follow Conventional Commits format: `type(scope): subject` → skills/git-commit-convention/SKILL.md
- [project] Valid scopes for SwiftletCare: auth, farm, env, vision, threat, alert, analytics, api, mqtt, ws, db, hardware, rpi, pwa, web, ci, deps, srs, config, agents
- [project] Tech stack: Express.js (not NestJS), MongoDB + Redis (not PostgreSQL), ReactJS PWA (not React Native)
- [project] Branch strategy: main (production), develop (integration), feat/_, fix/_, docs/_, chore/_
- [project] Validate commit before push: `python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py "<msg>"`
