---
description: Review a pull request on NBao261/SwiftletCare_KLTN against per-module rules and post one review (a COMMENT-only review on your own PRs)
argument-hint: <PR number>
model: claude-sonnet-5-5
---

Review pull request #$ARGUMENTS on GitHub repo NBao261/SwiftletCare_KLTN on behalf of the repo owner, GitHub user NBao261. Use the gh CLI when `gh auth status` works, otherwise the GitHub MCP tools (mcp__github__*; load them with ToolSearch if needed). If no PR number was given, stop and ask for one.

COST RULES (apply throughout):
- Never run npm install/npm ci, builds, test suites, dev servers, or create extra git worktrees. Review by reading code and diffs (`git diff`, `git show`, reading files). If a lockfile/dependency change looks wrong, flag it from the diff alone. Whether the code builds and its tests pass is judged from the PR's CI run (STEP 3c), which runs exactly those commands for every module the PR touches.
- Read only what the review needs: the PR diff, the full content of changed files, and callers/callees of changed functions when needed to judge correctness. Do not read unrelated modules.

STEP 0 - identity guard. Check the authenticated GitHub user (`gh api user --jq .login` or MCP get_me). If it is not exactly `NBao261` or you are not authenticated, post nothing; stop and report what identity/auth you found.

STEP 1 - check the PR.
- FIRST check its state (state, merged, draft). If it is MERGED or CLOSED, stop immediately: do not check out code, do not run /code-review, post nothing; report that it is already merged/closed.
- If its author is NBao261, switch to SELF-REVIEW mode (see the SELF-REVIEW section below).
- If it is a draft, or its title contains WIP, stop and report why.
- Get its head SHA and NBao261's reviews. The last NBao261 review whose body contains `<!-- auto-review sha=XXXX -->` gives the last reviewed commit:
  - no marker -> FULL REVIEW;
  - marker sha != head sha -> FOLLOW-UP REVIEW;
  - marker sha == head sha -> nothing new to review; stop and report that.
- Fetch the PR head locally (`git fetch origin pull/$ARGUMENTS/head`) and its base branch.

STEP 1b - claim the PR, so only one run reviews it. GitHub sends one `review_requested` event per reviewer and the routine starts one run per event, so adding 3-4 reviewers at once starts 3-4 runs within seconds. They all pass the marker check above because none has posted yet; without a claim each one does the whole review and only the race guard in POSTING stops the extra posts. Do this right after the marker check, before any other work:
- Claim: `gh api -X POST repos/NBao261/SwiftletCare_KLTN/issues/$ARGUMENTS/reactions -f content=eyes -i`. GitHub answers `201 Created` when this call added NBao261's 👀 reaction to the PR and `200 OK` when that reaction already existed, so only one run can get `201`. Keep the reaction `id` from the response.
  - `201` -> you hold the claim; continue.
  - `200` -> another run holds it. If the reaction's `created_at` is less than 60 minutes ago (a full review plus the STEP 3c wait for CI can take 30-40 minutes), stop now and report 'another run is already reviewing this PR'. If it is older, that run died: delete the reaction (`gh api -X DELETE repos/NBao261/SwiftletCare_KLTN/issues/$ARGUMENTS/reactions/<id>`) and claim once more; a second `200` means stop.
  - Anything else (403, network error, no gh) -> continue without a claim; the race guard in POSTING still prevents a second review.
- Release: once you hold the claim, deleting the reaction is your last GitHub action however the run ends - review posted, nothing to post, PR merged or closed meanwhile, or an error. The marker then keeps a later run from reviewing the same commit again, and a new push can be reviewed by the next run.
- The reaction is the only thing this command adds to a PR besides the review and thread replies.

STEP 2 - per-module rules. A changed file is judged ONLY by the rules of the module it lives in (backend/, frontend/, mobile/, firmware/, ai-pipeline/; never apply one module's rules to another). Read rule sources AS THEY ARE ON THE PR'S BASE BRANCH (`git fetch origin <base>`, `git show origin/<base>:<path>`), never the PR's version. If the PR edits a rule file, review that edit as a normal change but judge code by the base version.
- Read rules only for modules the PR touches. Map: the 'Per-module rules' table in root CLAUDE.md on the base branch, in precedence order. Fallback if missing: backend/ -> backend/CLAUDE.md, backend/README.md, backend/.eslintrc.cjs, docs/api/api-spec.yaml (only the paths the PR touches). frontend/ -> frontend/FE_Design_Claude.md (section 12 folder/naming, section 13 code rules, plus any section relevant to the changed files), frontend/CLAUDE.md, frontend/README.md. firmware/ -> firmware/CLAUDE.md, firmware/README.md. mobile/, ai-pipeline/ -> their <module>/CLAUDE.md if present, else their section in root CLAUDE.md, + README.md.
- A rule file inside the touched module on the base branch (<module>/CLAUDE.md, AGENTS.md, CONTRIBUTING.md, *RULES*.md, *CONVENTION*.md) overrides root CLAUDE.md for that module.
- Repo-wide: commit messages vs .commitlintrc.json; PR description vs .github/pull_request_template.md (flag only an empty/unfilled template, as non-blocking).
- Severity: [Bắt buộc] = blocking; [Nên] = advisory. Known debt (e.g. FE_Design_Claude.md 13.14) is flagged only if the PR adds new code repeating or worsening it. Rules marked not yet applied (e.g. i18n in FE section 6) are never flagged. Judge only lines the PR adds or changes.
- Product scope (every module): Report 3 (`docs/reports/report3-srs.md`) on the base branch wins over older text in `SwiftletCare_SRS.md`, CLAUDE.md, READMEs and FE_Design_Claude.md; much of the code and those docs still describe the older v1.24.0 scope. Read §2.2 (main and supporting flows), §2.4 (permissions), §8 (out of scope) and the gaps of `docs/reports/project-tracking.md` §6 for the modules the PR touches, then flag:
  - [blocking] New features, endpoints, screens or enum values that extend something §8 puts out of scope (Marketplace/Buyer listings and inquiries, the Farm Operator role and its zone scope, predator detection, the heating relay, Zalo/SMS channels, NH3/CO2 driving the fan). Removing or migrating them, and keeping existing code working, is fine.
  - [blocking] A threshold, limit or behaviour introduced without a source (Report 3, the Domain Expert, a cited reference): CLAUDE.md says never invent one; ask for the source or a downgrade to alert-only / "set by the Domain Expert". A hand-picked constant goes into Report 3 §4.5 in the same PR.
  - [blocking] A change that closes a gap but changes routes without updating `docs/api/api-spec.yaml` in the same PR, or changes a shared enum (`Role`, `AlertType`…) on only one of backend/frontend/mobile.
  - [non-blocking] New work on a supporting flow (remote device maintenance, accounts, Admin, harvest — Report 3 §2.2 SF-02…04) beyond keeping it working. Tickets, SLA, ticket routing, Technician regions and KPIs are out of scope (Report 3 §8): code for them may only be removed. Device setup is main flow MF-10, not a supporting flow.
  - When the PR closes a gap of `docs/reports/project-tracking.md` §6, say which one (G-xx and FR code) in the summary.
- Cross-module rules: the 'Cross-module rules' section of root CLAUDE.md on the base branch (API contract, shared enums, MQTT `deviceId`, `FuzzyControl.cpp` ↔ `fuzzyModel.util.ts`, runtime parameter names and ranges). They apply to every module the PR touches; a PR that breaks one is blocking.

STEP 3 - find issues. First scan the PR, then decide how to review it; say in the final report what you saw and what you chose.
- Scan (cheap, before any deep reading): the changed files with their added/removed line counts (`git diff --stat`, excluding lockfiles/generated files; for a FOLLOW-UP REVIEW only `git diff <marker sha>..<head sha>`), the modules touched, which files are SENSITIVE, whether `frontend/src/` is touched (STEP 3b), and what kind of change it is (new feature, bug fix, refactor/rename/move, migration, config, docs). A file is SENSITIVE if it touches auth/JWT/permissions (auth.*, farmAccess.util.ts, *.middleware.ts, requireRole), MQTT handlers or firmware control logic, DB models/schemas or migrations, docs/api/api-spec.yaml, or fuzzy/relay control (`pid/FuzzyControl.cpp`, `pid/PIDController.cpp`, `utils/fuzzyModel.util.ts`, relay/override services).
- Level - start from the first rule that matches:
  - `xhigh`: SENSITIVE files AND > 400 changed lines (a large change to a sensitive area, e.g. a role or permission refactor).
  - `high`: SENSITIVE files, OR > 400 changed lines.
  - `low`: only docs/Markdown, comments, config or styling with no logic change, OR < 30 changed lines that touch no SENSITIVE file.
  - `medium`: everything else.
  Then adjust with what the scan showed: go up a level when a small diff carries more risk than its size (a changed permission or validation check, a query filter, a migration, a function many callers use, money/relay/alert logic); go down a level only for a mechanical change (rename, move, generated code, formatting) where you checked that no logic changed. Give the reason for any adjustment.
- Approach by level. Every approach finds first and verifies second; only confirmed findings are posted.
  - `low`: review it yourself in two passes - list every candidate, then re-read the code to verify each before keeping it. No subagents.
  - `medium`: 2 finder subagents (split by area, or by focus if there is one area: logic/edge cases vs security/permissions/error handling) plus one rule checker subagent per module touched, then verify the candidates yourself by re-reading the code.
  - `high`: 3-4 finder subagents by area, plus one rule checker subagent per module touched; then verifier subagents.
  - `xhigh`: 5 finder subagents by area, one rule checker per module, one scope checker (Report 3 scope and cross-module rules); then verifier subagents.
  - When STEP 3b applies at `high`/`xhigh`, hand it to its own API checker subagent; at `low`/`medium` do it yourself.
- Subagent rules (when the chosen approach uses them): spawn all finders in parallel in one message. Give each the PR number, base and head sha, its file list, the diff command to read, the module rules from STEP 2 that apply, and the bug classes to hunt (logic and edge cases, security and permissions, API contract vs docs/api/api-spec.yaml, error handling, race conditions, regressions in code that calls the changed code, and run breakers: imports/exports or `@/` paths that do not resolve, types or fields that do not exist, calls with the wrong arguments, a renamed or removed symbol still used somewhere, env vars, files, routes or MQTT topics referenced but not defined, tests that no longer match the code they test). Each returns candidates as `path:line` + claim + concrete failing scenario (rule findings: document + section + blocking or not) and never posts to GitHub. Verifiers: merge duplicates, then one verifier per batch of about 5 candidates; a verifier did not find them, never sees the finder's confidence, reads the code at the PR head and answers CONFIRMED with evidence or REJECTED with the reason. Keep only CONFIRMED findings and re-read each yourself before writing it up.
- Rule check, at every level: for each module touched, go through EVERY `[Bắt buộc]` rule in its rule sources from STEP 2 (for frontend also every rule of FE_Design_Claude.md §12 and §13 that the changed files fall under) one by one, plus the Report 3 scope rules and the cross-module rules, and mark each OK / VIOLATED / N/A against the diff; every VIOLATED rule becomes a finding citing document + section. `[Nên]` rules are checked the same way but posted as non-blocking. At `low` do it yourself; from `medium` up the rule checker subagents do it and return the full list, not only the violations. Also check the API contract (backend routes/responses vs docs/api/api-spec.yaml, frontend/mobile calls vs it) unless an API checker subagent did.
- If /code-review is available, you may use `/code-review <level> $ARGUMENTS` (always WITHOUT --comment and WITHOUT --fix) as the finding step at `low`/`medium`; its findings still get verified.
- If the chosen approach needs subagents and the Agent tool is unavailable, do the two passes yourself and say in the final report that the review ran without subagents.
- For a FOLLOW-UP REVIEW, keep only findings on lines changed in `git diff <marker sha>..<head sha>`.
- No lint-level style nitpicks, no praise padding.

STEP 3b - frontend <-> backend API check (only when the PR changes files under frontend/src/; for a FOLLOW-UP REVIEW only the screens changed since the marker). At `high`/`xhigh` an API checker subagent does it (see STEP 3); its findings are verified like any other.
- For each screen/component/hook the PR adds or changes, list the data it shows or the actions it performs, and where that data comes from: an `@/apis/*` function (through its hook), or hardcoded/mock data (literal arrays or objects, `mock*`/`fake*` constants, the "This data is FAKE" notice).
- For each of those needs, find the matching backend endpoint as it exists on the base branch plus anything this same PR adds: the route in `backend/src/routes/*.route.ts`, its `requireRole(...)`, the controller/service behind it, and its path in `docs/api/api-spec.yaml`. Classify it:
  - DONE: the route exists and calls a real service.
  - STUB: the route exists but its service only throws `NotImplementedError` (501, `utils/appError.util.ts`) or returns placeholder data.
  - MISSING: no route.
  - REMOVING: the endpoint belongs to something Report 3 §8 puts out of scope (e.g. `/marketplace/*`) or a gap of `docs/reports/project-tracking.md` §6 says it is being replaced.
  Use `docs/reports/project-tracking.md` §6 (gaps) and FE_Design_Claude.md section 7 only to confirm; when they disagree with the code, trust the code and mention the mismatch.
- Then flag, citing FE_Design_Claude.md 13.9 / 13.8 (all [Bắt buộc], blocking):
  - Mock/hardcoded data on a screen whose endpoint is DONE: must switch to the real API. Name the endpoint and the existing `apis/` function or hook to use, or say one has to be added in the right `apis/<role|shared>/` file.
  - New UI built on a REMOVING endpoint: must not be added (see the product-scope rule in STEP 2); point to the replacement in Report 3 if there is one.
  - A call to an endpoint that is STUB or MISSING: must not ship as if real. Ask for mock data with the FAKE notice (section 5.4) or `ComingSoon`, and name the missing endpoint so backend can build it.
  - Mock data shown without the FAKE notice: add the notice.
  - A call to a DONE endpoint whose method, path, params, request body or response fields do not match the backend/spec, or whose `requireRole` does not allow the roles the screen's `<RequireRole allow>` / `usePermission` lets in: contract or permission break.
- Add a short section to the review body titled "Đối chiếu API backend" with one line per data need: endpoint (or "chưa có endpoint"), DONE/STUB/MISSING/REMOVING, what the FE uses now (API thật / mock), and what to do ("OK", "chuyển sang API thật", "mock + nhãn FAKE", "thiếu endpoint, báo backend", "ngoài phạm vi theo Report 3 §8"). Put the blocking items as inline comments on the lines that fetch or hardcode the data.

STEP 3c - does it run. CI (`.github/workflows/ci.yml`) runs, for every module the PR touches, the module's own lint, type-check, tests and build (backend: lint, build:check, jest with the coverage threshold; frontend: lint, tsc, vitest, build; firmware: `pio test -e native`; mobile: lint, typecheck, jest), plus commitlint and the secret scan.
- Read the check runs on the head sha (`gh api repos/NBao261/SwiftletCare_KLTN/commits/<head sha>/check-runs`, or the MCP equivalent). If some are still queued or running, do the rest of the review first, then re-check about once a minute for at most 20 minutes.
- A check that failed on the head sha is a blocking finding: name the job and the failing step, and quote the few error lines from its log (MCP `get_job_logs`, or the job's steps and annotations when the log cannot be read) with the file and line they point to. If the same job also fails on the base branch's latest run, say it is not caused by this PR and keep it non-blocking.
- A job skipped because its module is untouched is fine. A module with no CI job (ai-pipeline today) or a run that never started: say plainly that nothing was built or tested for it and rely on the run-breaker hunt in STEP 3. CI never runs the app itself, so for mobile and frontend UI changes also check that the PR shows the device/emulator or browser test and screenshots their rules require.
- Still running after 20 minutes: say in the review that the CI result was not available yet.

FOLLOW-UP extra step. For every earlier inline comment by NBao261 on this PR (all rounds), decide from the new code whether it is fixed / not fixed / partially fixed and reply briefly in its thread ('Đã sửa, ok.' or exactly what is still missing). Skip threads already answered 'fixed'.

STEP 4 - review event. Base branches require NBao261's approval; COMMENT does not clear an earlier CHANGES_REQUESTED.
- APPROVE when all hold: (a) every earlier blocking point by NBao261 is verified fixed in code, not from the author's reply; (b) no new confirmed bug, security issue, API-contract break, or blocking rule violation; (c) no merge conflict with base (GitHub mergeability or `git merge-tree`); (d) not draft/WIP; (e) every CI check on the head sha has passed or was skipped (STEP 3c). [Nên] items go in as non-blocking comments. Body: short Vietnamese summary of what was checked, remaining notes optional, e.g. 'Mình đã kiểm tra lại, các điểm trước đã sửa đúng. OK để merge.'
- REQUEST_CHANGES if (a), (b), (c) fails, or (e) fails because of this PR. End the body by asking the author to click "Re-request review" after fixing everything.
- COMMENT only if genuinely unsure about a blocking item, or when CI has still not finished (never APPROVE before CI passes); say what needs checking.
Never merge, push, close PRs, edit labels, or dismiss others' reviews.

POSTING.
- Race guard: right before posting (the review and any thread replies), re-fetch the PR's state, head sha and NBao261's reviews. If the PR is now MERGED or CLOSED, post nothing and stop. If a review with marker sha=<current head> exists, post nothing. If head changed while you worked, redo against the new head.
- ONE review per PR: inline comments on path + line of the head commit, plus a short summary body. With gh, post atomically (`gh api repos/NBao261/SwiftletCare_KLTN/pulls/$ARGUMENTS/reviews --input <json file>` with {commit_id, event, body, comments:[{path,line,side:'RIGHT',body}]}). With the MCP tools, create a pending review, add the inline comments to it, then submit it with the chosen event.
- Body must contain `<!-- auto-review sha=<head sha> -->`.
- Write every finding in natural, concise Vietnamese, first person as a teammate: what is wrong, why it matters (concrete scenario), how to fix. For rule violations cite document + section (e.g. 'theo mục 13.5 trong frontend/FE_Design_Claude.md') and say whether it blocks merge ('chặn merge') or not ('góp ý, không chặn merge'). No signatures, no emoji, no tool severity labels.

SELF-REVIEW mode (the PR's author is NBao261, i.e. the repo owner's own PR). GitHub does not let an author approve or request changes on their own PR, so this mode posts a COMMENT review instead; it is a check the owner runs before asking teammates to review.
- Use the marker logic of STEP 1 as for any other PR: no marker -> FULL REVIEW; marker sha != head sha -> FOLLOW-UP REVIEW (including the FOLLOW-UP extra step: reply in each earlier thread whether it is fixed); marker sha == head sha -> nothing new, stop.
- Run STEP 2, STEP 3, STEP 3b and STEP 3c exactly as for any other PR (same per-module rules, same review level choice, same frontend <-> backend API check, same CI check); a failing check makes the verdict 'Cần sửa trước khi nhờ review'.
- STEP 4 does not apply: the event is ALWAYS `COMMENT`, never APPROVE or REQUEST_CHANGES.
- POSTING applies unchanged (race guard, one review with inline comments, the `<!-- auto-review sha=<head sha> -->` marker, Vietnamese wording), except that the body starts with a one-line verdict: 'Sẵn sàng nhờ review' if nothing blocking is left, otherwise 'Cần sửa trước khi nhờ review', and does not ask anyone to click "Re-request review". Mark each inline comment as 'chặn merge' or 'góp ý, không chặn merge' as usual, and include the "Đối chiếu API backend" section when STEP 3b applied.
- If nothing at all was found, still post the COMMENT review (verdict plus what was checked) so the marker records the reviewed commit.
- This command never edits or pushes code; fixing the findings is a separate task.

Finish with a short report in Vietnamese (or, when STEP 1b stopped you, one line saying another run holds the claim): full or follow-up review, what the scan showed, the review level and approach chosen and why (including any level adjustment), how many subagents ran if any, how many candidates were confirmed out of how many found, how many rules were checked and how many were violated, the CI result on the head sha (passed / failed jobs / still running / no CI for the module), modules and rule files read, event used (COMMENT for a SELF-REVIEW of your own PR), number of comments, for frontend PRs the API check result (how many data needs are DONE/STUB/MISSING/REMOVING and how many still use mock data), any Report 3 scope findings, and a link to the PR.
