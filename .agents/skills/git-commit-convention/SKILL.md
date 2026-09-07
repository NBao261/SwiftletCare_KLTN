---
name: git-commit-convention
description: Chuẩn commit message cho SwiftletCare theo Conventional Commits + Changelog tự động. Bắt buộc áp dụng mỗi khi AI thực hiện git commit hoặc push lên GitHub.
when_to_use: "LUÔN áp dụng khi thực hiện git add, git commit, hoặc git push. Áp dụng khi tạo nhánh mới, viết changelog, hoặc tổng kết thay đổi theo sprint."
allowed-tools: Read, Write, Edit, Bash
version: 2.0.0
priority: HIGH
---

# Git Commit Convention – SwiftletCare

> **MANDATORY:** Mọi commit do AI thực hiện PHẢI tuân thủ chuẩn này.
> Không có ngoại lệ. Commit sai format = **VIOLATION**.

---

## 1. Cấu trúc Commit Message

```
<type>(<scope>): <subject> [TICKET-ID]

Why: <Lý do thay đổi — bắt buộc khi body phức tạp>
What:
- <Thay đổi cụ thể 1>
- <Thay đổi cụ thể 2>
Impact: <Phạm vi ảnh hưởng>

BREAKING CHANGE: <mô tả> ← Chỉ khi có breaking change
Closes #<issue>
```

### ✅ Ví dụ nhanh
```
feat(env): add PID closed-loop humidity control for ESP32

fix(vision): correct ByteTrack direction logic for evening session

docs(srs): update tech stack from NestJS to Express.js
```

---

## 2. Danh sách `type` hợp lệ

| Type | Khi nào dùng | Ảnh hưởng Changelog |
|---|---|---|
| `feat` | Thêm tính năng mới | ✅ Added |
| `fix` | Sửa bug | ✅ Fixed |
| `docs` | Thay đổi tài liệu (SRS, README, md files) | ✅ Changed |
| `refactor` | Tái cấu trúc code, không thêm feature/fix bug | ✅ Changed |
| `perf` | Cải thiện hiệu năng | ✅ Changed |
| `test` | Thêm/sửa test | ✅ Changed |
| `chore` | Cấu hình, build, dependency update | Không ghi Changelog |
| `ci` | CI/CD pipeline thay đổi | Không ghi Changelog |
| `style` | Formatting, không đổi logic | Không ghi Changelog |
| `revert` | Hoàn tác commit trước | ✅ Fixed |
| `security` | Vá lỗ hổng bảo mật | ✅ Security |
| `breaking` | **Thay đổi phá vỡ backward compat** | ⚠️ Breaking Changes |

---

## 3. Taxonomy Mapping (Types & Business Scope)

> Bảng ánh xạ giữa **loại thay đổi nghiệp vụ** → `type` + `scope` để AI tự phân loại đúng.

### 3.1 Type Decision Tree

```
Thay đổi này là gì?
│
├── Thêm hành vi mới mà trước đây không có?
│   └── feat
│
├── Hành vi cũ bị sai và cần sửa?
│   └── fix
│
├── Chỉ đổi cấu trúc code, logic không đổi?
│   └── refactor
│
├── Cải thiện tốc độ, giảm latency, tối ưu query?
│   └── perf
│
├── Thêm/sửa/xóa test?
│   └── test
│
├── Cập nhật tài liệu (SRS, README, CHANGELOG)?
│   └── docs
│
├── Cài đặt dependency, cấu hình build/env?
│   └── chore
│
├── Thay đổi CI pipeline, GitHub Actions?
│   └── ci
│
├── Vá lỗ hổng bảo mật?
│   └── security
│
└── Thay đổi interface/API không tương thích ngược?
    └── feat! hoặc fix! (có BREAKING CHANGE footer)
```

### 3.2 Scope → Module Mapping (SwiftletCare)

| Scope | Layer | Ví dụ nghiệp vụ cụ thể |
|---|---|---|
| `auth` | Cloud API | JWT refresh, OAuth2 Google, 2FA TOTP |
| `farm` | Cloud API | CRUD trang trại, zone, gán thiết bị |
| `env` | ESP32 Firmware + API | PID control, relay trigger, sensor polling |
| `vision` | RPi Edge + API | YOLO inference, ByteTrack counting, RTSP |
| `threat` | RPi + ESP32 + API | Phát hiện chuột/rắn, audio anomaly detection |
| `alert` | Cloud API + FCM | Push notification, Zalo ZNS, deduplication |
| `analytics` | Cloud API + Web | Correlation report, bird trend chart |
| `api` | Cloud API | Middleware, router, error handler |
| `mqtt` | Broker + Edge | Topic schema, QoS, telemetry format |
| `ws` | Cloud API + Web | Socket.io events, room subscription |
| `db` | MongoDB | Schema migration, index, Mongoose model |
| `hardware` | ESP32 | Sensor wiring, relay logic, OTA update |
| `rpi` | Raspberry Pi | Edge AI pipeline, ONNX runtime, PM2 |
| `pwa` | ReactJS | Service Worker, Web Push, offline cache |
| `web` | ReactJS | Dashboard, chart, UI component |
| `ci` | GitHub Actions | Build workflow, test pipeline, deploy |
| `deps` | package.json | Thêm/xóa/nâng cấp thư viện |
| `srs` | Docs | Cập nhật Software Requirements Spec |
| `config` | Env/Config | .env, docker-compose, nginx config |
| `agents` | .agents/ | Skill, workflow, rule, agent definition |

### 3.3 Từ khóa nghiệp vụ → Type

| Từ khóa trong task | Type phù hợp |
|---|---|
| "Thêm", "Tích hợp", "Xây dựng", "Hiện thực" | `feat` |
| "Sửa lỗi", "Khắc phục", "Ngăn chặn", "Fix" | `fix` |
| "Tái cấu trúc", "Tách module", "Clean up" | `refactor` |
| "Tối ưu", "Giảm latency", "Cải thiện tốc độ" | `perf` |
| "Viết test", "Bổ sung test case", "E2E" | `test` |
| "Cập nhật tài liệu", "Sửa SRS", "README" | `docs` |
| "Cài package", "Update dependency", "Setup env" | `chore` |
| "Vá bảo mật", "Fix CVE", "Sanitize input" | `security` |
| "Đổi API contract", "Thay đổi schema webhook" | `feat!` / `fix!` |

---

## 4. Execution Workflow for Agent

> Quy trình bắt buộc AI phải thực hiện từng bước — không được bỏ qua.

### Step 1 — ANALYZE (Phân tích thay đổi)

```bash
# Xem tất cả file đã staged
git diff --staged --stat

# Xem nội dung thay đổi chi tiết
git diff --staged
```

**Câu hỏi AI phải tự trả lời:**
- Files thay đổi thuộc layer nào? → xác định `scope`
- Thay đổi thêm hành vi mới hay sửa hành vi cũ? → xác định `type`
- Có ảnh hưởng đến interface public (API, MQTT, WebSocket)? → có cần `BREAKING CHANGE`?
- Có liên quan đến GitHub Issue nào không? → `Closes #N`

### Step 2 — CLASSIFY (Phân loại)

```
type   = [Lookup §3.1 decision tree]
scope  = [Lookup §3.2 scope mapping]
ticket = [Issue ID từ GitHub nếu có, format: #123]
```

**Quy tắc ưu tiên khi nhiều scope liên quan:**
- Chọn scope của **layer bị thay đổi chính** (nơi logic nghiệp vụ sống)
- Nếu thay đổi span nhiều layer → tách thành nhiều commit riêng biệt

### Step 3 — COMPOSE (Soạn message)

```
subject = Viết tiếng Anh, thì hiện tại, < 72 ký tự, không dấu chấm cuối
body    = Viết nếu: (a) thay đổi phức tạp, (b) có lý do nghiệp vụ cụ thể,
                    (c) ảnh hưởng đến module khác
footer  = Luôn thêm "Closes #N" nếu resolve issue
          Thêm "BREAKING CHANGE:" nếu phá vỡ backward compat
```

### Step 4 — VALIDATE (Kiểm tra)

```bash
# Bắt buộc chạy trước khi commit
python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py "<message>"
```

> 🔴 Nếu script báo lỗi → PHẢI sửa message trước. Không được bỏ qua.

### Step 5 — STAGE (Chọn file)

```bash
# Chỉ stage file liên quan đến commit này
git add <file1> <file2>

# KHÔNG dùng git add . trừ commit đầu tiên
```

### Step 6 — COMMIT

```bash
# Commit đơn giản (subject only)
git commit -m "type(scope): subject"

# Commit với body
git commit -m "type(scope): subject" -m "body text here"

# Commit phức tạp nhiều dòng — dùng heredoc hoặc editor
git commit
```

### Step 7 — VERIFY (Xác nhận)

```bash
git log --oneline -5
git show --stat HEAD
```

> Kiểm tra: đúng branch? đúng message? đúng files?

### Step 8 — PUSH

```bash
git push origin <branch-name>
```

> 🔴 **NEVER push thẳng vào `main`**. Luôn push lên feature/fix branch.

---

## 5. Output Format Templates

### Template 1: Feature có nghiệp vụ phức tạp

```bash
git commit -m "feat(<scope>): <mô tả ngắn> [#ISSUE]

Why: <Lý do nghiệp vụ — chính sách, yêu cầu từ SRS, stakeholder>
What:
- <Thay đổi cụ thể 1>
- <Thay đổi cụ thể 2>
Impact: <Chỉ ảnh hưởng X; không ảnh hưởng Y>"
```

**Ví dụ thực tế — SwiftletCare:**
```bash
git commit -m "feat(vision): implement ByteTrack multi-object tracking for bird counting [#28]

Why: Đếm chim đơn thuần bằng YOLO bị lỗi đếm trùng khi nhiều chim đi qua
     cùng lúc. ByteTrack duy trì track_id liên tục giữa các frame.
What:
- Tích hợp ByteTrack tracker vào inference pipeline trên Raspberry Pi.
- Thêm virtual crossing line logic (inward/outward vector detection).
- Publish entry_count, exit_count mỗi 30 giây qua MQTT.
Impact: Chỉ thay đổi pipeline xử lý trên RPi; cloud API không đổi."
```

**CHANGELOG.md entry:**
```markdown
### Added
- **vision**: Tích hợp ByteTrack tracker cho đếm chim chính xác qua đường ảo ([#28]).
```

---

### Template 2: Quick Bug Fix (One-liner)

```bash
git commit -m "fix(<scope>): <mô tả ngắn gọn> [#ISSUE]"
```

**Ví dụ thực tế — SwiftletCare:**
```bash
git commit -m "fix(env): prevent relay from toggling when humidity is within hysteresis band [#41]"
```

**CHANGELOG.md entry:**
```markdown
### Fixed
- **env**: Ngăn relay bật/tắt liên tục khi độ ẩm dao động trong dải hysteresis ([#41]).
```

---

### Template 3: Breaking Change

```bash
git commit -m "feat(<scope>)!: <mô tả thay đổi> [#ISSUE]

BREAKING CHANGE: <Mô tả rõ điều gì thay đổi, ai bị ảnh hưởng,
deadline migration nếu có>."
```

**Ví dụ thực tế — SwiftletCare:**
```bash
git commit -m "feat(mqtt)!: migrate telemetry topic schema to v2 format [#55]

BREAKING CHANGE: Cấu trúc MQTT topic thay đổi từ:
  swiftletcare/{farmId}/{houseId}/{zoneId}/sensors
sang:
  swiftletcare/v2/{farmId}/{houseId}/{zoneId}/telemetry
Tất cả ESP32 firmware phải nâng cấp lên >= 1.2.0 trước ngày 01/11/2026.
Firmware cũ sẽ không nhận được config update từ cloud."
```

**CHANGELOG.md entry:**
```markdown
### Changed
- **mqtt**: **[BREAKING]** Cập nhật MQTT topic schema lên v2; firmware ESP32 cần nâng cấp >= 1.2.0 ([#55]).
```

---

### Template 4: Security Fix

```bash
git commit -m "security(<scope>): <mô tả vá lỗi> [#ISSUE]

Fix <CVE hoặc mô tả lỗ hổng>.
Impact: <Phạm vi ảnh hưởng>."
```

**Ví dụ thực tế — SwiftletCare:**
```bash
git commit -m "security(auth): enforce PKCE flow and rotate refresh token on each use [#67]

Fix potential refresh token replay attack in mobile PWA auth flow.
Impact: Mọi session hiện tại sẽ bị invalidate; user cần đăng nhập lại."
```

**CHANGELOG.md entry:**
```markdown
### Security
- **auth**: Bổ sung PKCE flow và xoay vòng refresh token sau mỗi lần sử dụng ([#67]).
```

---

### Template 5: Refactor / Perf (không thêm tính năng)

```bash
git commit -m "refactor(<scope>): <mô tả tái cấu trúc>"

git commit -m "perf(<scope>): <mô tả cải thiện hiệu năng>"
```

**Ví dụ thực tế — SwiftletCare:**
```bash
git commit -m "perf(analytics): add compound index on telemetry collection for time-range queries"

git commit -m "refactor(api): extract alert deduplication into standalone AlertDedupService"
```

---

## 6. Automation Configuration (Husky + Commitlint)

> Cưỡng chế toàn bộ team và agent tuân thủ chuẩn này ở cấp độ repository Git.

### 6.1 Cài đặt

```bash
# Cài packages
npm install --save-dev @commitlint/config-conventional @commitlint/cli husky

# Khởi tạo Husky v9
npx husky init

# Đăng ký hook commit-msg
echo 'npx --no -- commitlint --edit "$1"' > .husky/commit-msg
```

### 6.2 `.commitlintrc.json` — Cấu hình cho SwiftletCare

```json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "refactor", "perf", "test",
       "chore", "ci", "style", "revert", "security", "breaking"]
    ],
    "scope-enum": [
      1,
      "always",
      ["auth", "farm", "env", "vision", "threat", "alert", "analytics",
       "api", "mqtt", "ws", "db", "hardware", "rpi", "pwa", "web",
       "ci", "deps", "srs", "config", "agents"]
    ],
    "scope-case": [2, "always", "lower-case"],
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "subject-full-stop": [2, "never", "."],
    "subject-empty": [2, "never"],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [1, "always"],
    "footer-leading-blank": [1, "always"]
  }
}
```

> **Lưu ý:** `scope-enum` dùng level `1` (warning, không block) để cho phép thêm scope mới linh hoạt khi project mở rộng.

### 6.3 Kiểm tra setup

```bash
# Test hook hoạt động với message hợp lệ
echo "feat(env): add sensor polling" | npx commitlint

# Test hook chặn message sai
echo "update code" | npx commitlint
# → Expected output: ✖ type may not be empty [type-empty]
```

### 6.4 Thêm npm script để validate nhanh

Thêm vào `package.json`:
```json
{
  "scripts": {
    "commit:validate": "python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py",
    "commit:log": "git log --oneline -10",
    "commit:check": "python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py --log 5"
  }
}
```

### 6.5 Nếu commit bị Husky chặn — Cách xử lý

```bash
# Xem lỗi commitlint trả về
git commit -m "bad message"
# → ✖   type may not be empty [type-empty]

# Sửa và thử lại với đúng format
git commit -m "fix(env): correct sensor polling interval from 5s to 10s"

# Bypass khẩn cấp (KHÔNG khuyến nghị, chỉ dùng hotfix)
git commit --no-verify -m "chore: emergency hotfix bypass"
```

---

## 7. Quy tắc viết `subject`

| ✅ Đúng | ❌ Sai |
|---|---|
| Viết chữ thường (lowercase) | Viết hoa chữ đầu |
| Không kết thúc bằng dấu chấm | Kết thúc bằng `.` |
| Dưới 100 ký tự (header), subject < 72 ký tự | Quá dài, vượt giới hạn |
| Dùng thì hiện tại ("add", "fix") | Dùng thì quá khứ ("added", "fixed") |
| Mô tả WHAT thay đổi | Mô tả HOW thay đổi |
| Tiếng Anh | Tiếng Việt trong subject |

---

## 8. Branch Strategy

```
main          ← Production only. Merge từ develop khi release.
develop       ← Integration branch. Default branch làm việc.
feat/<name>   ← Feature branch. Ví dụ: feat/pid-control
fix/<name>    ← Bugfix branch. Ví dụ: fix/bytetrack-direction
docs/<name>   ← Documentation. Ví dụ: docs/srs-update
chore/<name>  ← Setup, config. Ví dụ: chore/setup-mqtt
release/<ver> ← Release prep. Ví dụ: release/1.2.0
hotfix/<name> ← Hotfix từ main. Ví dụ: hotfix/mqtt-auth-crash
```

### Quy tắc merge:
- `feat/*`, `fix/*` → merge vào `develop` qua Pull Request
- `develop` → merge vào `main` khi release (cập nhật `CHANGELOG.md` trước)
- `hotfix/*` → merge vào cả `main` VÀ `develop`
- **Không commit thẳng vào `main`**

---

## 9. Cập nhật CHANGELOG.md (Khi release)

### Format chuẩn (Keep a Changelog + SemVer):

```markdown
## [1.2.0] – 2026-11-01

### Added
- **vision**: Tích hợp ByteTrack tracker cho đếm chim chính xác ([#28]).
- **alert**: Thêm kênh Zalo ZNS cho cảnh báo CRITICAL ([#33]).

### Changed
- **api**: Tách auth middleware thành module độc lập.

### Fixed
- **env**: Ngăn relay bật/tắt liên tục trong dải hysteresis ([#41]).

### Security
- **auth**: Bổ sung PKCE flow và xoay vòng refresh token ([#67]).

### Breaking Changes
- **mqtt**: Topic schema v2 — firmware ESP32 >= 1.2.0 required ([#55]).
```

### Quy tắc SemVer:
| Commit type | Version bump |
|---|---|
| `BREAKING CHANGE` | Major: 1.0.0 → 2.0.0 |
| `feat` | Minor: 1.0.0 → 1.1.0 |
| `fix`, `perf`, `security` | Patch: 1.0.0 → 1.0.1 |
| `chore`, `ci`, `style` | Không bump version |

---

## 10. Script Validation

```bash
# Validate message cụ thể (trước khi commit)
python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py "feat(env): add sensor polling"

# Validate commit vừa tạo
python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py --staged

# Validate 5 commit gần nhất (audit)
python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py --log 5
```

---

## 11. Anti-Patterns (Tuyệt đối tránh)

| ❌ Anti-Pattern | ✅ Thay bằng |
|---|---|
| `git add .` rồi commit tất cả | Stage từng nhóm file liên quan |
| Commit "fix" nhưng thực chất là feat | Dùng đúng type từ §3.1 |
| Commit message bằng tiếng Việt | Subject bằng tiếng Anh |
| Commit nhiều tính năng không liên quan | Tách thành nhiều commit |
| Không viết body cho commit phức tạp | Giải thích WHY trong body |
| Push thẳng lên main | Dùng PR từ develop |
| Bỏ qua cập nhật CHANGELOG khi release | Luôn cập nhật trước merge vào main |
| Dùng `--no-verify` thường xuyên | Chỉ dùng khẩn cấp, ghi chú lý do |
| Viết "WIP", "update", "fix bug" | Mô tả cụ thể WHAT thay đổi |

---

> **Remember:** Commit message là tài liệu sống của dự án.
> Một commit tốt giúp team (và AI tương lai) hiểu lịch sử mà không cần hỏi.
> Một commit tốt = **type(scope): subject** + **WHY trong body** khi cần.
