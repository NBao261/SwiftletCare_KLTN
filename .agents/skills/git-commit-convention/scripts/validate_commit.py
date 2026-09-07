#!/usr/bin/env python3
"""
validate_commit.py – SwiftletCare Git Commit Message Validator
Validates commit messages against Conventional Commits standard.

Usage:
    python .agents/skills/git-commit-convention/scripts/validate_commit.py "<message>"
    python .agents/skills/git-commit-convention/scripts/validate_commit.py --staged
    python .agents/skills/git-commit-convention/scripts/validate_commit.py --log 10
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

SUBJECT_MAX_LEN = 72
BODY_LINE_MAX_LEN = 100

# Regex: type(scope): subject  OR  type: subject
COMMIT_REGEX = re.compile(
    r'^(?P<type>[a-z]+)(?:\((?P<scope>[a-z0-9\-]+)\))?(?P<breaking>!)?:\s(?P<subject>.+)$'
)

# ── Validation Logic ───────────────────────────────────────────────────────────

class CommitValidator:
    def __init__(self, message: str):
        self.message = message.strip()
        self.lines = self.message.splitlines()
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.passed: list[str] = []

    def validate(self) -> bool:
        if not self.lines:
            self.errors.append("❌ Commit message is empty.")
            return False

        self._validate_header()
        self._validate_body()
        self._validate_footer()
        return len(self.errors) == 0

    def _validate_header(self):
        header = self.lines[0]

        # Check length
        if len(header) > SUBJECT_MAX_LEN:
            self.errors.append(
                f"❌ Subject too long: {len(header)} chars (max {SUBJECT_MAX_LEN}). "
                f"Got: '{header}'"
            )
        else:
            self.passed.append(f"✅ Subject length OK ({len(header)} chars)")

        # Check format with regex
        match = COMMIT_REGEX.match(header)
        if not match:
            self.errors.append(
                f"❌ Invalid format. Expected: '<type>(<scope>): <subject>'\n"
                f"   Got: '{header}'\n"
                f"   Example: 'feat(env): add PID humidity control'"
            )
            return

        commit_type = match.group("type")
        scope = match.group("scope")
        subject = match.group("subject")

        # Validate type
        if commit_type not in VALID_TYPES:
            self.errors.append(
                f"❌ Invalid type: '{commit_type}'. "
                f"Valid types: {', '.join(sorted(VALID_TYPES))}"
            )
        else:
            self.passed.append(f"✅ Type '{commit_type}' is valid")

        # Validate scope (if provided)
        if scope:
            if scope not in VALID_SCOPES:
                self.warnings.append(
                    f"⚠️  Unknown scope: '{scope}'. "
                    f"Valid scopes: {', '.join(sorted(VALID_SCOPES))}\n"
                    f"   Consider adding it to SKILL.md if it's a new module."
                )
            else:
                self.passed.append(f"✅ Scope '{scope}' is valid")
        else:
            self.warnings.append(
                "⚠️  No scope provided. Strongly recommended for SwiftletCare. "
                "Example: feat(env): ..."
            )

        # Validate subject
        if subject[0].isupper():
            self.errors.append(
                f"❌ Subject must start with lowercase. Got: '{subject}'"
            )
        else:
            self.passed.append("✅ Subject starts with lowercase")

        if subject.endswith("."):
            self.errors.append(
                f"❌ Subject must NOT end with a period. Got: '{subject}'"
            )
        else:
            self.passed.append("✅ Subject has no trailing period")

        # Check for Vietnamese in subject
        vietnamese_pattern = re.compile(
            r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ'
            r'ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]'
        )
        if vietnamese_pattern.search(subject):
            self.warnings.append(
                f"⚠️  Subject contains Vietnamese characters. "
                f"Use English for subject line. Body can be Vietnamese."
            )

        # Check past tense
        past_tense = re.compile(r'\b(added|fixed|updated|changed|removed|deleted|created|implemented)\b', re.I)
        if past_tense.search(subject):
            self.warnings.append(
                f"⚠️  Subject may use past tense. Use present tense: "
                f"'add' not 'added', 'fix' not 'fixed'"
            )
        else:
            self.passed.append("✅ Subject uses present tense (no past tense detected)")

    def _validate_body(self):
        if len(self.lines) < 2:
            return  # No body, that's fine

        # There must be a blank line between header and body
        if len(self.lines) >= 2 and self.lines[1] != "":
            self.errors.append(
                "❌ Missing blank line between subject and body. "
                "Add an empty line after the subject."
            )
            return
        else:
            if len(self.lines) > 2:
                self.passed.append("✅ Blank line between subject and body")

        # Check body line lengths
        for i, line in enumerate(self.lines[2:], start=3):
            if line.startswith("BREAKING CHANGE") or line.startswith("Closes") or line.startswith("Refs"):
                continue  # These are footer lines
            if len(line) > BODY_LINE_MAX_LEN:
                self.warnings.append(
                    f"⚠️  Body line {i} too long: {len(line)} chars "
                    f"(recommended max {BODY_LINE_MAX_LEN})"
                )

    def _validate_footer(self):
        for line in self.lines:
            if line.startswith("BREAKING CHANGE:"):
                if len(line) <= len("BREAKING CHANGE:"):
                    self.errors.append(
                        "❌ 'BREAKING CHANGE:' must have a description after the colon."
                    )
                else:
                    self.passed.append("✅ BREAKING CHANGE has description")

            if line.startswith("Closes #") or line.startswith("Refs #"):
                issue_num = re.findall(r'#(\d+)', line)
                if issue_num:
                    self.passed.append(f"✅ Issue reference found: {', '.join(['#' + n for n in issue_num])}")

    def report(self):
        """Print formatted validation report."""
        SEP = "=" * 60
        SUB = "-" * 60
        print("\n" + SEP)
        print("  SwiftletCare Commit Message Validator")
        print(SEP)
        print(f"\n[MSG] {self.lines[0]}")

        if len(self.errors) == 0:
            print(f"\n{SUB}")
            print(f"[PASS] PASSED ({len(self.passed)} checks, {len(self.warnings)} warnings)")
        else:
            print(f"\n{SUB}")
            print(f"[FAIL] FAILED ({len(self.errors)} errors, {len(self.warnings)} warnings)")

        if self.errors:
            print("\n[ERRORS]")
            for e in self.errors:
                print(f"  {e}")

        if self.warnings:
            print("\n[WARNINGS]")
            for w in self.warnings:
                print(f"  {w}")

        if self.passed:
            print("\n[PASSED CHECKS]")
            for p in self.passed:
                print(f"  {p}")

        print("\n" + SEP + "\n")


# ── Entry Point ────────────────────────────────────────────────────────────────

def get_staged_commit_message() -> str:
    """Get the latest staged commit message (from COMMIT_EDITMSG)."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%B"],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def get_recent_commits(n: int) -> list[str]:
    """Get last N commit messages."""
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
        description="SwiftletCare Git Commit Message Validator"
    )
    parser.add_argument("message", nargs="?", help="Commit message to validate")
    parser.add_argument("--staged", action="store_true", help="Validate last commit")
    parser.add_argument("--log", type=int, metavar="N", help="Validate last N commits")

    args = parser.parse_args()

    messages_to_validate: list[str] = []

    if args.message:
        messages_to_validate = [args.message]
    elif args.staged:
        msg = get_staged_commit_message()
        if not msg:
            print("❌ No commit found.")
            sys.exit(1)
        messages_to_validate = [msg]
    elif args.log:
        messages_to_validate = get_recent_commits(args.log)
        if not messages_to_validate:
            print("❌ No commits found in git log.")
            sys.exit(1)
    else:
        parser.print_help()
        sys.exit(1)

    all_passed = True
    for msg in messages_to_validate:
        validator = CommitValidator(msg)
        passed = validator.validate()
        validator.report()
        if not passed:
            all_passed = False

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
