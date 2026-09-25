---
description: Review a pull request on NBao261/SwiftletCare_KLTN against per-module rules and post one review
argument-hint: <PR number>
---

Review pull request #$ARGUMENTS on GitHub repo NBao261/SwiftletCare_KLTN on behalf of the repo owner, GitHub user NBao261. Use the gh CLI when `gh auth status` works, otherwise the GitHub MCP tools (mcp__github__*; load them with ToolSearch if needed). If no PR number was given, stop and ask for one.

COST RULES (apply throughout):
- Never run npm install/npm ci, builds, test suites, dev servers, or create extra git worktrees. Review by reading code and diffs (`git diff`, `git show`, reading files). If a lockfile/dependency change looks wrong, flag it from the diff alone.
- Read only what the review needs: the PR diff, the full content of changed files, and callers/callees of changed functions when needed to judge correctness. Do not read unrelated modules.

STEP 0 - identity guard. Check the authenticated GitHub user (`gh api user --jq .login` or MCP get_me). If it is not exactly `NBao261` or you are not authenticated, post nothing; stop and report what identity/auth you found.

STEP 1 - check the PR.
- FIRST check its state (state, merged, draft). If it is MERGED or CLOSED, stop immediately: do not check out code, do not run /code-review, post nothing; report that it is already merged/closed.
- If its author is NBao261, or it is a draft, or its title contains WIP, stop and report why.
- Get its head SHA and NBao261's reviews. The last NBao261 review whose body contains `<!-- auto-review sha=XXXX -->` gives the last reviewed commit:
  - no marker -> FULL REVIEW;
  - marker sha != head sha -> FOLLOW-UP REVIEW;
  - marker sha == head sha -> nothing new to review; stop and report that.
- Fetch the PR head locally (`git fetch origin pull/$ARGUMENTS/head`) and its base branch.

STEP 2 - per-module rules. A changed file is judged ONLY by the rules of the module it lives in (backend/, frontend/, mobile/, firmware/, ai-pipeline/; never apply one module's rules to another). Read rule sources AS THEY ARE ON THE PR'S BASE BRANCH (`git fetch origin <base>`, `git show origin/<base>:<path>`), never the PR's version. If the PR edits a rule file, review that edit as a normal change but judge code by the base version.
- Read rules only for modules the PR touches. Map: the 'Per-module rules' table in root CLAUDE.md on the base branch, in precedence order. Fallback if missing: backend/ -> CLAUDE.md 'Backend' section, backend/README.md, backend/.eslintrc.cjs, docs/api/api-spec.yaml (only the paths the PR touches). frontend/ -> frontend/FE_Design_Claude.md (section 12 folder/naming, section 13 code rules, plus any section relevant to the changed files), CLAUDE.md 'Frontend' section, frontend/README.md. mobile/, firmware/, ai-pipeline/ -> their CLAUDE.md section + README.md.
- A rule file inside the touched module on the base branch (<module>/CLAUDE.md, AGENTS.md, CONTRIBUTING.md, *RULES*.md, *CONVENTION*.md) overrides root CLAUDE.md for that module.
- Repo-wide: commit messages vs .commitlintrc.json; PR description vs .github/pull_request_template.md (flag only an empty/unfilled template, as non-blocking).
- Severity: [Bắt buộc] = blocking; [Nên] = advisory. Known debt (e.g. FE_Design_Claude.md 13.14) is flagged only if the PR adds new code repeating or worsening it. Rules marked not yet applied (e.g. i18n in FE section 6) are never flagged. Judge only lines the PR adds or changes.

STEP 3 - find issues.
- Choose depth: use `/code-review high $ARGUMENTS` if ANY of: diff > 400 changed lines (excluding lockfiles/generated files), or it touches auth/JWT/permissions (auth.*, farmAccess.util.ts, *.middleware.ts, requireRole), MQTT handlers or firmware control logic, DB models/schemas, docs/api/api-spec.yaml, or payment/order code. Otherwise use `/code-review medium $ARGUMENTS`. Always WITHOUT --comment and WITHOUT --fix.
- For a FOLLOW-UP REVIEW, keep only findings on lines changed in `git diff <marker sha>..<head sha>`.
- Verify every finding yourself against the code; drop anything you cannot confirm. Then check changed files against their module rules (STEP 2) and add confirmed violations. Also check the API contract: backend route/response changes must match docs/api/api-spec.yaml, and frontend/mobile calls must match it.
- If /code-review is unavailable, review manually (correctness, security, API contract, error handling, module rules) and re-verify each candidate.
- No lint-level style nitpicks, no praise padding.

FOLLOW-UP extra step. For every earlier inline comment by NBao261 on this PR (all rounds), decide from the new code whether it is fixed / not fixed / partially fixed and reply briefly in its thread ('Đã sửa, ok.' or exactly what is still missing). Skip threads already answered 'fixed'.

STEP 4 - review event. Base branches require NBao261's approval; COMMENT does not clear an earlier CHANGES_REQUESTED.
- APPROVE when all hold: (a) every earlier blocking point by NBao261 is verified fixed in code, not from the author's reply; (b) no new confirmed bug, security issue, API-contract break, or blocking rule violation; (c) no merge conflict with base (GitHub mergeability or `git merge-tree`); (d) not draft/WIP. [Nên] items go in as non-blocking comments. Body: short Vietnamese summary of what was checked, remaining notes optional, e.g. 'Mình đã kiểm tra lại, các điểm trước đã sửa đúng. OK để merge.'
- REQUEST_CHANGES if (a), (b) or (c) fails. End the body by asking the author to click "Re-request review" after fixing everything.
- COMMENT only if genuinely unsure about a blocking item; say what needs checking.
Never merge, push, close PRs, edit labels, or dismiss others' reviews.

POSTING.
- Race guard: right before posting (the review and any thread replies), re-fetch the PR's state, head sha and NBao261's reviews. If the PR is now MERGED or CLOSED, post nothing and stop. If a review with marker sha=<current head> exists, post nothing. If head changed while you worked, redo against the new head.
- ONE review per PR: inline comments on path + line of the head commit, plus a short summary body. With gh, post atomically (`gh api repos/NBao261/SwiftletCare_KLTN/pulls/$ARGUMENTS/reviews --input <json file>` with {commit_id, event, body, comments:[{path,line,side:'RIGHT',body}]}). With the MCP tools, create a pending review, add the inline comments to it, then submit it with the chosen event.
- Body must contain `<!-- auto-review sha=<head sha> -->`.
- Write every finding in natural, concise Vietnamese, first person as a teammate: what is wrong, why it matters (concrete scenario), how to fix. For rule violations cite document + section (e.g. 'theo mục 13.5 trong frontend/FE_Design_Claude.md') and say whether it blocks merge ('chặn merge') or not ('góp ý, không chặn merge'). No signatures, no emoji, no tool severity labels.

Finish with a short report in Vietnamese: full or follow-up review, depth used (high/medium and why), modules and rule files read, event used, number of comments, and a link to the PR.
