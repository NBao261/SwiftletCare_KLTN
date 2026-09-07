#!/usr/bin/env python3
"""
validate_commit.py – SwiftletCare Git Commit Message Validator v2.0
Validates commit messages against Conventional Commits + SwiftletCare convention.

Usage:
    python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py "<message>"
    python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py --staged
    python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py --log 10
"""

import sys
import re
import subprocess
import argparse
import io

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Constants ──────────────────────────────────────────────────────────────────

VALID_TYPES = {
    "feat", "fix", "docs", "refactor", "perf", "test",
    "chore", "ci", "style", "revert", "security", "breaking",
}

VALID_SCOPES = {
    "auth", "farm", "env", "vision", "threat", "alert", "analytics",
    "api", "mqtt", "ws", "db", "hardware", "rpi", "pwa", "web",
    "ci", "deps", "srs", "config", "agents",
}

CHANGELOG_TYPES = {"feat", "fix", "refactor", "perf", "security", "breaking", "docs", "revert"}

SUBJECT_MAX_LEN = 72
HEADER_MAX_LEN = 100
BODY_LINE_MAX_LEN = 100

# type(scope)!: subject  OR  type!: subject  OR  type(scope): subject [#N]
COMMIT_REGEX = re.compile(
    r'^(?P<type>[a-z]+)(?:\((?P<scope>[a-z0-9\-]+)\))?(?P<breaking>!)?: (?P<subject>.+)$'
)

TICKET_REGEX = re.compile(r'\[#\d+\]$|\[#[A-Z]+-\d+\]$')

# ── Changelog Generator ────────────────────────────────────────────────────────

CHANGELOG_SECTION = {
    "feat": "Added",
    "fix": "Fixed",
    "docs": "Changed",
    "refactor": "Changed",
    "perf": "Changed",
    "security": "Security",
    "breaking": "Breaking Changes",
    "revert": "Fixed",
}


def generate_changelog_entry(commit_type: str, scope: str, subject: str,
                              ticket: str = "", is_breaking: bool = False) -> str:
    """Generate a CHANGELOG.md entry from commit components."""
    section = CHANGELOG_SECTION.get(commit_type, "Changed")
    scope_badge = f"**{scope}**: " if scope else ""
    breaking_badge = "**[BREAKING]** " if is_breaking else ""
    ticket_ref = f" ({ticket})" if ticket else ""

    # Capitalize first letter of subject for changelog
    subject_cap = subject[0].upper() + subject[1:] if subject else subject

    return (
        f"\n  Suggested CHANGELOG.md entry:\n"
        f"  ### {section}\n"
        f"  - {scope_badge}{breaking_badge}{subject_cap}{ticket_ref}.\n"
    )


# ── Validation Logic ───────────────────────────────────────────────────────────

class CommitValidator:
    def __init__(self, message: str):
        self.message = message.strip()
        self.lines = self.message.splitlines()
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.passed: list[str] = []
        self.info: list[str] = []

        # Parsed fields
        self.commit_type = ""
        self.scope = ""
        self.subject = ""
        self.is_breaking = False
        self.ticket = ""

    def validate(self) -> bool:
        if not self.lines:
            self.errors.append("Commit message is empty.")
            return False

        self._validate_header()
        self._validate_body()
        self._validate_footer()
        return len(self.errors) == 0

    def _validate_header(self):
        header = self.lines[0]

        # Header total length (up to 100 with ticket)
        if len(header) > HEADER_MAX_LEN:
            self.errors.append(
                f"Header too long: {len(header)} chars (max {HEADER_MAX_LEN}). "
                f"Got: '{header}'"
            )
        else:
            self.passed.append(f"Header length OK ({len(header)} chars)")

        # Extract ticket if present at end: [#123] or [ABC-123]
        ticket_match = TICKET_REGEX.search(header)
        header_no_ticket = header
        if ticket_match:
            self.ticket = ticket_match.group().strip("[]")
            header_no_ticket = header[:ticket_match.start()].strip()
            self.passed.append(f"Ticket reference found: [{self.ticket}]")

        # Subject length check (without ticket)
        if len(header_no_ticket) > SUBJECT_MAX_LEN:
            self.warnings.append(
                f"Subject (without ticket) is {len(header_no_ticket)} chars. "
                f"Recommended max: {SUBJECT_MAX_LEN}."
            )

        # Parse with regex
        match = COMMIT_REGEX.match(header_no_ticket)
        if not match:
            self.errors.append(
                f"Invalid format. Expected: 'type(scope): subject'\n"
                f"   Got: '{header_no_ticket}'\n"
                f"   Examples:\n"
                f"     feat(env): add PID humidity control\n"
                f"     fix(vision): correct ByteTrack direction logic [#41]\n"
                f"     feat(mqtt)!: migrate topic schema to v2 [#55]"
            )
            return

        self.commit_type = match.group("type")
        self.scope = match.group("scope") or ""
        self.subject = match.group("subject").strip()
        self.is_breaking = bool(match.group("breaking"))

        # Validate type
        if self.commit_type not in VALID_TYPES:
            self.errors.append(
                f"Invalid type: '{self.commit_type}'. "
                f"Valid: {', '.join(sorted(VALID_TYPES))}"
            )
        else:
            self.passed.append(f"Type '{self.commit_type}' is valid")

        # Validate scope
        if self.scope:
            if self.scope not in VALID_SCOPES:
                self.warnings.append(
                    f"Unknown scope: '{self.scope}'. "
                    f"Valid: {', '.join(sorted(VALID_SCOPES))}\n"
                    f"   Add to SKILL.md §3.2 if this is a new module."
                )
            else:
                self.passed.append(f"Scope '{self.scope}' is valid")
        else:
            self.warnings.append(
                "No scope provided. Strongly recommended.\n"
                "   Example: feat(env): ..., fix(vision): ..."
            )

        # Breaking change flag
        if self.is_breaking:
            self.info.append(
                "Breaking change (!) detected. "
                "Ensure BREAKING CHANGE: description is in footer."
            )

        # Subject checks
        if self.subject and self.subject[0].isupper():
            self.errors.append(
                f"Subject must start with lowercase. Got: '{self.subject}'"
            )
        else:
            self.passed.append("Subject starts with lowercase")

        if self.subject.endswith("."):
            self.errors.append(
                f"Subject must NOT end with a period. Got: '{self.subject}'"
            )
        else:
            self.passed.append("Subject has no trailing period")

        # Vietnamese in subject
        viet_pattern = re.compile(
            r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'
            r'ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]'
        )
        if viet_pattern.search(self.subject):
            self.warnings.append(
                "Subject contains Vietnamese. Use English. Body/footer can be Vietnamese."
            )

        # Past tense check
        past = re.compile(
            r'\b(added|fixed|updated|changed|removed|deleted|created|implemented|migrated)\b', re.I
        )
        if past.search(self.subject):
            self.warnings.append(
                "Subject may use past tense. Use imperative present: "
                "'add' not 'added', 'fix' not 'fixed'"
            )
        else:
            self.passed.append("Subject uses present tense (imperative)")

    def _validate_body(self):
        if len(self.lines) < 2:
            # No body — warn only for complex types that should have one
            if self.commit_type in {"feat", "refactor", "breaking", "security"}:
                self.warnings.append(
                    f"No body provided for type '{self.commit_type}'. "
                    "Consider adding Why/What/Impact for clarity."
                )
            return

        if self.lines[1] != "":
            self.errors.append(
                "Missing blank line between subject and body. "
                "Add an empty line after the subject line."
            )
            return
        else:
            if len(self.lines) > 2:
                self.passed.append("Blank line between subject and body")

        # Check for structured body (Why/What/Impact) — award info
        body_text = "\n".join(self.lines[2:])
        if "Why:" in body_text or "What:" in body_text:
            self.passed.append("Structured body (Why/What) detected")

        # Check body line lengths
        for i, line in enumerate(self.lines[2:], start=3):
            if any(line.startswith(kw) for kw in
                   ["BREAKING CHANGE", "Closes", "Refs", "Why:", "What:", "Impact:"]):
                continue
            if len(line) > BODY_LINE_MAX_LEN:
                self.warnings.append(
                    f"Body line {i} is {len(line)} chars "
                    f"(recommended max {BODY_LINE_MAX_LEN})"
                )

    def _validate_footer(self):
        has_breaking_footer = False
        for line in self.lines:
            if line.startswith("BREAKING CHANGE:"):
                if len(line.replace("BREAKING CHANGE:", "").strip()) == 0:
                    self.errors.append(
                        "'BREAKING CHANGE:' must have a description. "
                        "Explain what changed and migration path."
                    )
                else:
                    self.passed.append("BREAKING CHANGE has description")
                has_breaking_footer = True

            if re.match(r'^Closes #\d+', line) or re.match(r'^Refs #\d+', line):
                nums = re.findall(r'#(\d+)', line)
                self.passed.append(f"Issue reference: {', '.join(['#' + n for n in nums])}")

        # Warn if ! used but no BREAKING CHANGE footer
        if self.is_breaking and not has_breaking_footer:
            self.warnings.append(
                "Breaking change (!) used in header but no 'BREAKING CHANGE:' in footer. "
                "Add a footer explaining what changed and migration steps."
            )

    def changelog_suggestion(self) -> str:
        """Generate suggested CHANGELOG.md entry."""
        if self.commit_type not in CHANGELOG_TYPES:
            return ""
        return generate_changelog_entry(
            self.commit_type, self.scope, self.subject,
            self.ticket, self.is_breaking
        )

    def report(self):
        """Print formatted validation report."""
        SEP = "=" * 65
        SUB = "-" * 65
        print(f"\n{SEP}")
        print("  SwiftletCare Commit Validator v2.0")
        print(SEP)
        print(f"\n[MSG] {self.lines[0]}")
        if len(self.lines) > 1:
            print(f"      (+ {len(self.lines) - 1} more lines)")

        result = "PASS" if len(self.errors) == 0 else "FAIL"
        print(f"\n{SUB}")
        print(
            f"[{result}] "
            f"{len(self.errors)} errors | "
            f"{len(self.warnings)} warnings | "
            f"{len(self.passed)} passed"
        )

        if self.errors:
            print("\n[ERRORS]")
            for e in self.errors:
                print(f"  [X] {e}")

        if self.warnings:
            print("\n[WARNINGS]")
            for w in self.warnings:
                print(f"  [!] {w}")

        if self.info:
            print("\n[INFO]")
            for i in self.info:
                print(f"  [i] {i}")

        if self.passed:
            print("\n[PASSED]")
            for p in self.passed:
                print(f"  [v] {p}")

        # Changelog suggestion
        cl = self.changelog_suggestion()
        if cl:
            print(f"\n{SUB}")
            print(cl)

        print(f"{SEP}\n")


# ── Entry Point ────────────────────────────────────────────────────────────────

def get_last_commit() -> str:
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%B"],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def get_recent_commits(n: int) -> list[str]:
    try:
        result = subprocess.run(
            ["git", "log", f"-{n}", "--format=%B---END---"],
            capture_output=True, text=True, check=True
        )
        return [m.strip() for m in result.stdout.split("---END---") if m.strip()]
    except subprocess.CalledProcessError:
        return []


def main():
    parser = argparse.ArgumentParser(
        description="SwiftletCare Git Commit Message Validator v2.0"
    )
    parser.add_argument("message", nargs="?", help="Commit message to validate")
    parser.add_argument("--staged", action="store_true", help="Validate last commit in git log")
    parser.add_argument("--log", type=int, metavar="N", help="Validate last N commits")

    args = parser.parse_args()
    messages: list[str] = []

    if args.message:
        messages = [args.message]
    elif args.staged:
        msg = get_last_commit()
        if not msg:
            print("[ERROR] No commit found in git log.")
            sys.exit(1)
        messages = [msg]
    elif args.log:
        messages = get_recent_commits(args.log)
        if not messages:
            print("[ERROR] No commits found.")
            sys.exit(1)
    else:
        parser.print_help()
        sys.exit(1)

    all_passed = True
    for msg in messages:
        v = CommitValidator(msg)
        passed = v.validate()
        v.report()
        if not passed:
            all_passed = False

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
