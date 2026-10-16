---
description: Review a pull request on NBao261/SwiftletCare_KLTN against per-module rules and post one review (a COMMENT-only review on your own PRs)
argument-hint: <PR number>
model: claude-sonnet-5-5
---

Review pull request #$ARGUMENTS on GitHub repo NBao261/SwiftletCare_KLTN on behalf of the repo owner, GitHub user NBao261. Use the gh CLI when `gh auth status` works, otherwise the GitHub MCP tools (mcp__github__*; load them with ToolSearch if needed). If no PR number was given, stop and ask for one.

COST RULES (apply throughout):
- Never run npm install/npm ci, builds, test suites, dev servers, or create extra git worktrees. Review by reading code and diffs (`git diff`, `git show`, reading files). If a lockfile/dependency change looks wrong, flag it from the diff alone.
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
  - `200` -> another run holds it. If the reaction's `created_at` is less than 30 minutes ago, stop now and report 'another run is already reviewing this PR'. If it is older, that run died: delete the reaction (`gh api -X DELETE repos/NBao261/SwiftletCare_KLTN/issues/$ARGUMENTS/reactions/<id>`) and claim once more; a second `200` means stop.
  - Anything else (403, network error, no gh) -> continue without a claim; the race guard in POSTING still prevents a second review.
- Release: once you hold the claim, deleting the reaction is your last GitHub action however the run ends - review posted, nothing to post, PR merged or closed meanwhile, or an error. The marker then keeps a later run from reviewing the same commit again, and a new push can be reviewed by the next run.
- The reaction is the only thing this command adds to a PR besides the review and thread replies.

STEP 2 - per-module rules. A changed file is judged ONLY by the rules of the module it lives in (backend/, frontend/, mobile/, firmware/, ai-pipeline/; never apply one module's rules to another). Read rule sources AS THEY ARE ON THE PR'S BASE BRANCH (`git fetch origin <base>`, `git show origin/<base>:<path>`), never the PR's version. If the PR edits a rule file, review that edit as a normal change but judge code by the base version.
- Read rules only for modules the PR touches. Map: the 'Per-module rules' table in root CLAUDE.md on the base branch, in precedence order. Fallback if missing: backend/ -> backend/CLAUDE.md, backend/README.md, backend/.eslintrc.cjs, docs/api/api-spec.yaml (only the paths the PR touches). frontend/ -> frontend/FE_Design_Claude.md (section 12 folder/naming, section 13 code rules, plus any section relevant to the changed files), frontend/CLAUDE.md, frontend/README.md. firmware/ -> firmware/CLAUDE.md, firmware/README.md. mobile/, ai-pipeline/ -> their <module>/CLAUDE.md if present, else their section in root CLAUDE.md, + README.md.
- A rule file inside the touched module on the base branch (<module>/CLAUDE.md, AGENTS.md, CONTRIBUTING.md, *RULES*.md, *CONVENTION*.md) overrides root CLAUDE.md for that module.
- Repo-wide: commit messages vs .commitlintrc.json; PR description vs .github/pull_request_template.md (flag only an empty/unfilled template, as non-blocking).
- Severity: [Bắt buộc] = blocking; [Nên] = advisory. Known debt (e.g. FE_Design_Claude.md 13.14) is flagged only if the PR adds new code repeating or worsening it. Rules marked not yet applied (e.g. i18n in FE section 6) are never flagged. Judge only lines the PR adds or changes.
- Product scope (every module): `SwiftletCare_SRS.md` §0 on the base branch (scope v2.0.0 after Review 1, plus later additions such as v2.1.0) wins over older text in the SRS, CLAUDE.md, READMEs and FE_Design_Claude.md; much of the code and those docs still describe the older v1.24.0 scope. Read §0.2 (scope decisions), §0.3 (roles) and the §0.5 checklist rows of the modules the PR touches, then flag:
  - [blocking] New features, endpoints, screens or enum values that extend something §0.2 removes (Marketplace/Buyer listings and inquiries, the Farm Operator role and its zone scope, predator detection, the heating relay, Zalo/SMS channels, NH3/CO2 driving the fan). Removing or migrating them, and keeping existing code working, is fine.
  - [blocking] A threshold, limit or behaviour introduced without a source (SRS, the Domain Expert, a cited reference): CLAUDE.md says never invent one; ask for the source or a downgrade to alert-only / "set by the Domain Expert".
  - [blocking] A change that implements a §0.5 item but changes routes without updating `docs/api/api-spec.yaml` in the same PR, or changes a shared enum (`Role`, `AlertType`…) on only one of backend/frontend/mobile.
  - [non-blocking] New work on a side flow (Technician, Admin, tickets) beyond keeping it working, since §0.2 #11 says not to extend it.
  - When the PR implements a §0.5 item, say which one (FR code) in the summary.
- Cross-module rules: the 'Cross-module rules' section of root CLAUDE.md on the base branch (API contract, shared enums, MQTT `deviceId`, `FuzzyControl.cpp` ↔ `fuzzyModel.util.ts`, runtime parameter names and ranges). They apply to every module the PR touches; a PR that breaks one is blocking.

STEP 3 - find issues. EVERY review - full or follow-up, at every level, own PR or not - is done by subagents with the Agent tool: finders first, then independent verifiers. Never review in a single pass yourself, and never rely on /code-review alone. You (the main session) only split the work, merge the results and write the review.
- Choose the level from the diff itself (count changed lines excluding lockfiles/generated files; for a FOLLOW-UP REVIEW count only `git diff <marker sha>..<head sha>`). A file is SENSITIVE if it touches auth/JWT/permissions (auth.*, farmAccess.util.ts, *.middleware.ts, requireRole), MQTT handlers or firmware control logic, DB models/schemas, docs/api/api-spec.yaml, or fuzzy/relay control (`pid/FuzzyControl.cpp`, `pid/PIDController.cpp`, `utils/fuzzyModel.util.ts`, relay/override services). Pick the first level that matches:
  - `xhigh`: SENSITIVE files AND > 400 changed lines (a large change to a sensitive area, e.g. a role or permission refactor).
  - `high`: SENSITIVE files, OR > 400 changed lines.
  - `low`: only docs/Markdown, comments, config or styling with no logic change, OR < 30 changed lines that touch no SENSITIVE file.
  - `medium`: everything else.
  The level sets how many bug finders run; it never lets you skip the subagents.
- Finders - spawn ALL of them in parallel in one message. Give every finder the PR number, base and head sha, its file list, the exact diff command to read (`git diff <base>...<head>`, or `git diff <marker sha>..<head sha>` for a FOLLOW-UP REVIEW), and tell it to read the full changed files plus the callers/callees it needs, and to return candidates only as `path:line` + claim + concrete failing scenario (or, for rule findings, the document and section broken and whether it blocks merge). Finders never post anything to GitHub.
  - Bug finders, by level: `low` 2, `medium` 3, `high` 5, `xhigh` 6. Split the diff into areas (by module, then by feature folder or service) and give each finder one area. When there are fewer areas than finders, put two finders on the same area with different focus: one on logic, edge cases and regressions in code that calls the changed code; one on security, permissions, data integrity, error handling and race conditions. Every finder also checks the API contract against `docs/api/api-spec.yaml` for its area.
  - One rule checker per module the PR touches, with the rule sources from STEP 2 (read from the base branch) and the module's changed files; it returns rule violations with the citation.
  - One scope checker for the whole PR: SRS §0 product scope and the root CLAUDE.md cross-module rules, as listed in STEP 2.
  - When STEP 3b applies, one API checker that does STEP 3b and returns its classification table and findings.
- Verifiers - merge duplicate candidates, then spawn verifier subagents in parallel, one per batch of about 5 candidates. A verifier is a fresh subagent that found nothing itself and never sees a finder's confidence, only the claim: it reads the code at the PR head (and the base-branch rule text for rule findings) and answers CONFIRMED with the evidence (file, line, why the scenario really happens) or REJECTED with the reason. Keep only CONFIRMED findings. Then re-read each kept finding yourself before writing it up; drop anything you still cannot confirm.
- For a FOLLOW-UP REVIEW, keep only findings on lines changed in `git diff <marker sha>..<head sha>`.
- If /code-review is available, you may also run `/code-review <level> $ARGUMENTS` (always WITHOUT --comment and WITHOUT --fix) and send its findings through the same verifiers as extra candidates; it adds to the subagents, it never replaces them.
- If the Agent tool itself is unavailable, do the two passes yourself (list every candidate first, then re-read the code to verify each), and say plainly in the review body and the final report that this was a reduced review without subagents.
- No lint-level style nitpicks, no praise padding.

STEP 3b - frontend <-> backend API check (only when the PR changes files under frontend/src/; for a FOLLOW-UP REVIEW only the screens changed since the marker). Done by the API checker subagent spawned with the finders in STEP 3; its findings go through the STEP 3 verifiers like any other.
- For each screen/component/hook the PR adds or changes, list the data it shows or the actions it performs, and where that data comes from: an `@/apis/*` function (through its hook), or hardcoded/mock data (literal arrays or objects, `mock*`/`fake*` constants, the "This data is FAKE" notice).
- For each of those needs, find the matching backend endpoint as it exists on the base branch plus anything this same PR adds: the route in `backend/src/routes/*.route.ts`, its `requireRole(...)`, the controller/service behind it, and its path in `docs/api/api-spec.yaml`. Classify it:
  - DONE: the route exists and calls a real service.
  - STUB: the route exists but its service only throws `NotImplementedError` (501, `utils/appError.util.ts`) or returns placeholder data.
  - MISSING: no route.
  - REMOVING: the endpoint belongs to something SRS §0.2 removes (e.g. `/marketplace/*`) or a §0.5 row says it is being replaced.
  Use `SwiftletCare_SRS.md` §5, column "Trạng thái Backend" (rows marked `🔄 Cần sửa code (v2.0.0)` or `❌ Ngoài phạm vi v2.0.0` matter here), and FE_Design_Claude.md section 7 only to confirm; when they disagree with the code, trust the code and mention the mismatch.
- Then flag, citing FE_Design_Claude.md 13.9 / 13.8 (all [Bắt buộc], blocking):
  - Mock/hardcoded data on a screen whose endpoint is DONE: must switch to the real API. Name the endpoint and the existing `apis/` function or hook to use, or say one has to be added in the right `apis/<role|shared>/` file.
  - New UI built on a REMOVING endpoint: must not be added (see the product-scope rule in STEP 2); point to the §0.5 replacement if there is one.
  - A call to an endpoint that is STUB or MISSING: must not ship as if real. Ask for mock data with the FAKE notice (section 5.4) or `ComingSoon`, and name the missing endpoint so backend can build it.
  - Mock data shown without the FAKE notice: add the notice.
  - A call to a DONE endpoint whose method, path, params, request body or response fields do not match the backend/spec, or whose `requireRole` does not allow the roles the screen's `<RequireRole allow>` / `usePermission` lets in: contract or permission break.
- Add a short section to the review body titled "Đối chiếu API backend" with one line per data need: endpoint (or "chưa có endpoint"), DONE/STUB/MISSING/REMOVING, what the FE uses now (API thật / mock), and what to do ("OK", "chuyển sang API thật", "mock + nhãn FAKE", "thiếu endpoint, báo backend", "tính năng bị bỏ theo SRS §0"). Put the blocking items as inline comments on the lines that fetch or hardcode the data.

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

SELF-REVIEW mode (the PR's author is NBao261, i.e. the repo owner's own PR). GitHub does not let an author approve or request changes on their own PR, so this mode posts a COMMENT review instead; it is a check the owner runs before asking teammates to review.
- Use the marker logic of STEP 1 as for any other PR: no marker -> FULL REVIEW; marker sha != head sha -> FOLLOW-UP REVIEW (including the FOLLOW-UP extra step: reply in each earlier thread whether it is fixed); marker sha == head sha -> nothing new, stop.
- Run STEP 2, STEP 3 and STEP 3b exactly as for any other PR (same per-module rules, same review level choice, same frontend <-> backend API check).
- STEP 4 does not apply: the event is ALWAYS `COMMENT`, never APPROVE or REQUEST_CHANGES.
- POSTING applies unchanged (race guard, one review with inline comments, the `<!-- auto-review sha=<head sha> -->` marker, Vietnamese wording), except that the body starts with a one-line verdict: 'Sẵn sàng nhờ review' if nothing blocking is left, otherwise 'Cần sửa trước khi nhờ review', and does not ask anyone to click "Re-request review". Mark each inline comment as 'chặn merge' or 'góp ý, không chặn merge' as usual, and include the "Đối chiếu API backend" section when STEP 3b applied.
- If nothing at all was found, still post the COMMENT review (verdict plus what was checked) so the marker records the reviewed commit.
- This command never edits or pushes code; fixing the findings is a separate task.

Finish with a short report in Vietnamese (or, when STEP 1b stopped you, one line saying another run holds the claim): full or follow-up review, review level used (low/medium/high/xhigh) and why, how many finder and verifier subagents ran and how many candidates were confirmed out of how many found, modules and rule files read, event used (COMMENT for a SELF-REVIEW of your own PR), number of comments, for frontend PRs the API check result (how many data needs are DONE/STUB/MISSING/REMOVING and how many still use mock data), any SRS §0 scope findings, and a link to the PR.
