---
name: git-commit-convention
description: Chuẩn commit message cho SwiftletCare theo Conventional Commits + Changelog tự động. Bắt buộc áp dụng mỗi khi AI thực hiện git commit hoặc push lên GitHub.
when_to_use: "LUÔN áp dụng khi thực hiện git add, git commit, hoặc git push. Áp dụng khi tạo nhánh mới, viết changelog, hoặc tổng kết thay đổi theo sprint."
allowed-tools: Read, Write, Edit, Bash
version: 1.0.0
priority: HIGH
---

# Git Commit Convention – SwiftletCare

> **MANDATORY:** Mọi commit do AI thực hiện PHẢI tuân thủ chuẩn này.
> Không có ngoại lệ. Commit sai format = **VIOLATION**.

---

## 1. Cấu trúc Commit Message

```
<type>(<scope>): <subject>

[body]  ← Tùy chọn, cách dòng tiêu đề 1 dòng trống

[footer]  ← Tùy chọn: BREAKING CHANGE, closes #issue
```

### ✅ Ví dụ đúng
```
feat(env): add PID closed-loop humidity control for ESP32

Implement PID algorithm on ESP32 that auto-triggers misting relay
when humidity drops below configured threshold_min.

Closes #12
```

```
fix(vision): correct ByteTrack direction logic for evening session
```

```
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
| `breaking` | **Thay đổi phá vỡ backward compat** | ⚠️ BREAKING CHANGE |

---

## 3. Danh sách `scope` của SwiftletCare

> Scope phản ánh module/layer của hệ thống. **Chỉ dùng các scope sau:**

| Scope | Mô tả |
|---|---|
| `auth` | Xác thực, phân quyền, JWT |
| `farm` | Quản lý trang trại, nhà yến, zone |
| `env` | Cảm biến môi trường, PID, relay control |
| `vision` | AI camera, YOLO, ByteTrack, bird counting |
| `threat` | Phát hiện thiên địch, audio anomaly |
| `alert` | Hệ thống cảnh báo, notification |
| `analytics` | Dashboard phân tích, báo cáo |
| `api` | REST API endpoints, middleware |
| `mqtt` | MQTT broker, topics, telemetry |
| `ws` | WebSocket / Socket.io events |
| `db` | MongoDB schema, Mongoose models |
| `hardware` | ESP32 firmware, sensors, relays |
| `rpi` | Raspberry Pi edge node, AI inference |
| `pwa` | ReactJS PWA, Service Worker, mobile |
| `web` | Web dashboard, React components |
| `ci` | CI/CD, GitHub Actions |
| `deps` | Thay đổi dependencies |
| `srs` | Tài liệu SRS, đặc tả yêu cầu |
| `config` | Cấu hình hệ thống, env vars |
| `agents` | AI agent rules, skills, workflows |

---

## 4. Quy tắc viết `subject`

| ✅ Đúng | ❌ Sai |
|---|---|
| Viết chữ thường (lowercase) | Viết hoa chữ đầu |
| Không kết thúc bằng dấu chấm | Kết thúc bằng `.` |
| Dưới 72 ký tự | Quá dài, vượt 72 ký tự |
| Dùng thì hiện tại ("add", "fix") | Dùng thì quá khứ ("added", "fixed") |
| Mô tả WHAT thay đổi | Mô tả HOW thay đổi |
| Tiếng Anh | Tiếng Việt trong subject |

---

## 5. Quy tắc `body` (khi cần)

- Viết sau 1 dòng trống kể từ subject
- Giải thích **WHY** (tại sao thay đổi), không giải thích HOW
- Dùng tiếng Anh hoặc tiếng Việt đều được
- Mỗi dòng tối đa 100 ký tự
- Dùng dấu `-` hoặc `*` cho bullet points

---

## 6. `footer` – BREAKING CHANGE & Issue Reference

```
BREAKING CHANGE: MQTT topic schema changed from v1 to v2.
All ESP32 firmware must be updated to >= 1.2.0.

Closes #45
Refs #23, #31
```

- `BREAKING CHANGE:` → phải có description rõ ràng
- `Closes #N` → tự động đóng GitHub issue
- `Refs #N` → reference không đóng issue

---

## 7. Quy trình AI Commit (MANDATORY CHECKLIST)

Trước khi chạy `git commit`, AI PHẢI thực hiện theo thứ tự:

```
□ 1. REVIEW: Xem lại tất cả file đã thay đổi (git diff --staged)
□ 2. CLASSIFY: Xác định type và scope phù hợp
□ 3. WRITE: Viết subject ngắn gọn, rõ ràng
□ 4. BODY: Thêm body nếu thay đổi phức tạp hoặc có lý do đặc biệt
□ 5. VALIDATE: Kiểm tra format trước khi commit
□ 6. STAGE: git add chỉ các file liên quan đến commit này
□ 7. COMMIT: git commit -m "..."
□ 8. VERIFY: git log --oneline -3 để kiểm tra lại
```

> 🔴 **RULE:** Không commit "tất cả" (`git add .`) trừ khi đây là commit khởi tạo.
> Mỗi commit phải là 1 thay đổi logic độc lập.

---

## 8. Chiến lược Nhánh (Branch Strategy)

```
main          ← Production only. Merge từ develop khi release.
develop       ← Integration branch. Default branch làm việc.
feat/<name>   ← Feature branch. Ví dụ: feat/pid-control
fix/<name>    ← Bugfix branch. Ví dụ: fix/bytetrack-direction
docs/<name>   ← Documentation. Ví dụ: docs/srs-update
chore/<name>  ← Setup, config. Ví dụ: chore/setup-mqtt
```

### Quy tắc merge:
- `feat/*`, `fix/*` → merge vào `develop` qua Pull Request
- `develop` → merge vào `main` khi release (cập nhật CHANGELOG.md trước)
- **Không commit thẳng vào `main`**

---

## 9. Cập nhật CHANGELOG.md (Khi merge vào main)

### Format chuẩn (Keep a Changelog):

```markdown
## [version] – YYYY-MM-DD

### Added
- feat(scope): Mô tả tính năng mới

### Changed
- refactor(scope): Mô tả thay đổi

### Fixed
- fix(scope): Mô tả bug đã sửa

### Security
- security(scope): Mô tả vá lỗ hổng

### Breaking Changes
- breaking(scope): Mô tả thay đổi phá vỡ compat
```

### Quy tắc cập nhật CHANGELOG:
1. Chỉ ghi các commit có type: `feat`, `fix`, `refactor`, `perf`, `security`, `breaking`
2. Bỏ qua: `chore`, `ci`, `style`
3. Nhóm theo section: Added / Changed / Fixed / Security / Breaking Changes
4. Ghi theo thứ tự từ mới nhất đến cũ nhất trong mỗi section
5. Cập nhật phiên bản theo SemVer:
   - `breaking` → Major version bump (1.0.0 → 2.0.0)
   - `feat` → Minor version bump (1.0.0 → 1.1.0)
   - `fix`, `perf`, `security` → Patch version bump (1.0.0 → 1.0.1)

---

## 10. Ví dụ thực tế cho SwiftletCare

### ✅ Commit tốt
```bash
git commit -m "feat(env): add SHT31 sensor polling with 10s interval"

git commit -m "fix(vision): prevent duplicate bird count on frame boundary crossing"

git commit -m "feat(alert): integrate Firebase FCM push notification for CRITICAL alerts"

git commit -m "docs(srs): revise tech stack - replace NestJS with Express.js"

git commit -m "chore(deps): add socket.io and mqtt.js to package.json"

git commit -m "feat(pwa): configure vite-plugin-pwa with service worker for offline support"

git commit -m "refactor(api): extract auth middleware into separate module"

git commit -m "test(env): add unit tests for PID control edge cases"
```

### ❌ Commit sai
```bash
git commit -m "update code"               # ❌ Không có type/scope
git commit -m "Fixed bug"                 # ❌ Viết hoa, quá khứ
git commit -m "feat: Add new feature."    # ❌ Kết thúc bằng dấu chấm, viết hoa
git commit -m "Thêm tính năng cảm biến"  # ❌ Tiếng Việt trong subject, không có type
git commit -m "WIP"                       # ❌ Không mô tả gì
```

---

## 11. Script Validation (Tự kiểm tra trước commit)

> AI phải chạy script này trước khi thực hiện commit:

```bash
python .agents/skills/git-commit-convention/scripts/validate_commit.py "<commit_message>"
```

---

## 12. Anti-Patterns (Tuyệt đối tránh)

| ❌ Anti-Pattern | ✅ Thay bằng |
|---|---|
| `git add .` rồi commit tất cả | Stage từng nhóm file liên quan |
| Commit "fix" nhưng thực chất là feat | Dùng đúng type |
| Commit message bằng tiếng Việt | Subject bằng tiếng Anh |
| Commit nhiều tính năng không liên quan | Tách thành nhiều commit |
| Không viết body cho commit phức tạp | Giải thích WHY trong body |
| Push thẳng lên main | Dùng PR từ develop |
| Bỏ qua cập nhật CHANGELOG khi release | Luôn cập nhật trước khi merge vào main |

---

> **Remember:** Commit message là tài liệu sống của dự án.
> Một commit tốt giúp team (và AI tương lai) hiểu lịch sử mà không cần hỏi.
