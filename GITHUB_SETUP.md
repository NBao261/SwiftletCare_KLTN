# 🚀 GitHub Setup Guide – SwiftletCare KLTN

> **Dành cho:** Chủ repo (Owner) và tất cả thành viên team  
> **Mục tiêu:** `develop` = nhánh tích hợp hàng ngày | `main` = chỉ dùng khi deploy production

---

## Mục lục

- [Phần A — Chủ repo cần làm (một lần duy nhất)](#phần-a--chủ-repo-cần-làm-một-lần-duy-nhất)
- [Phần B — Thành viên setup máy cá nhân](#phần-b--thành-viên-setup-máy-cá-nhân)
- [Phần C — Luồng làm việc hàng ngày](#phần-c--luồng-làm-việc-hàng-ngày)
- [Phần D — Quy trình merge vào develop](#phần-d--quy-trình-merge-vào-develop)
- [Phần E — Quy trình deploy lên main](#phần-e--quy-trình-deploy-lên-main)
- [Phần F — Xử lý tình huống thường gặp](#phần-f--xử-lý-tình-huống-thường-gặp)

---

## Phần A — Chủ repo cần làm (một lần duy nhất)

### A.1 Tạo nhánh `main` từ `develop`

Vì hiện tại repo chỉ có nhánh `develop`, cần tạo `main`:

```bash
# Trên máy Owner
git checkout develop
git pull origin develop

# Tạo main từ develop (lần đầu tiên)
git checkout -b main
git push origin main
```

Sau đó vào **GitHub → Settings → General → Default branch** → đổi sang `develop`.

---

### A.2 Cài đặt Branch Protection Rules

> **GitHub → Repository → Settings → Branches → Add branch ruleset**

#### Ruleset cho `main` (Production — khóa chặt nhất)

| Setting                                    | Giá trị                                       |
| --------------------------------------------| -----------------------------------------------|
| Branch name pattern                        | `main`                                        |
| Restrict deletions                         | ✅ BẬT                                         |
| Require linear history                     | ✅ BẬT (merge sạch, không có merge commit rối) |
| Require a pull request before merging      | ✅ BẬT                                         |
| → Required approvals                       | **1** (Owner phải approve)                    |
| → Dismiss stale reviews                    | ✅ BẬT                                         |
| → Require review from code owners          | ✅ BẬT                                         |
| Require status checks to pass              | ✅ BẬT (nếu có CI)                             |
| Block force pushes                         | ✅ BẬT                                         |
| Restrict who can push to matching branches | ✅ BẬT → chỉ **Owner**                         |

#### Ruleset cho `develop` (Integration — kiểm soát vừa phải)

| Setting                               | Giá trị                         |
| ---------------------------------------| ---------------------------------|
| Branch name pattern                   | `develop`                       |
| Restrict deletions                    | ✅ BẬT                           |
| Require a pull request before merging | ✅ BẬT                           |
| → Required approvals                  | **1** (ít nhất 1 member review) |
| → Dismiss stale reviews               | ✅ BẬT                           |
| Block force pushes                    | ✅ BẬT                           |
| Allow force pushes                    | ❌ TẮT                           |

> **Lưu ý:** Không cần `Require linear history` cho `develop` — team merge thường xuyên nên cho phép merge commit.

---

### A.3 Tạo file CODEOWNERS

> Đảm bảo Owner phải review mọi thay đổi vào `main`.

```bash
# Tạo thư mục .github nếu chưa có
mkdir .github
```

Tạo file `.github/CODEOWNERS`:

```
# Mọi file trong repo — Owner phải review khi merge vào main
*   @NBao261

# Các file agents — chỉ Owner mới có quyền sửa
.agents/   @NBao261
```

---

### A.4 Tạo Pull Request Template

Tạo file `.github/pull_request_template.md`:

```markdown
## 📋 Mô tả

<!-- Giải thích ngắn gọn thay đổi này làm gì -->

## 🔗 Liên kết

- Closes #<!-- issue number -->
- Branch: `feat/` | `fix/` | `docs/` | `chore/`

## ✅ Checklist trước khi tạo PR

- [ ] Code đã chạy được trên máy local
- [ ] Commit message đúng format `type(scope): subject`
- [ ] Không có conflict với `develop`
- [ ] Đã test tính năng/fix thủ công
- [ ] Không commit file `.env`, credentials, secret key

## 📸 Screenshot (nếu có thay đổi UI)

<!-- Kéo thả ảnh vào đây -->

## 📝 Ghi chú cho Reviewer

<!-- Điều gì cần reviewer chú ý đặc biệt? -->
```

---

### A.5 Mời thành viên vào repo

**GitHub → Settings → Collaborators → Add people**

| Vai trò               | GitHub Permission |
| --------------------- | ----------------- |
| Thành viên team chính | **Write**         |
| Reviewer bên ngoài    | **Read**          |
| Owner (bạn)           | **Admin**         |

---

### A.6 Cấu hình GitHub Actions (CI tự động — tùy chọn)

Tạo file `.github/workflows/ci.yml`:

```yaml
name: CI – SwiftletCare

on:
  pull_request:
    branches: [develop, main]
  push:
    branches: [develop]

jobs:
  validate-commits:
    name: Validate Commit Messages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Validate commit messages
        run: |
          python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py --log 5

  # Thêm các job khác khi có code: lint, test, build...
```

---

## Phần B — Thành viên setup máy cá nhân

### B.1 Clone repo lần đầu

```bash
git clone https://github.com/NBao261/SwiftletCare_KLTN.git
cd SwiftletCare_KLTN
```

### B.2 Cấu hình Git cá nhân (bắt buộc)

```bash
# Đặt tên và email khớp với GitHub account
git config user.name "Tên của bạn"
git config user.email "email@github.com"

# Kiểm tra lại
git config --list | grep user
```

### B.3 Cấu hình Git toàn cục cho Windows

```bash
# Tránh lỗi line ending trên Windows
git config --global core.autocrlf true

# Đặt editor mặc định (VS Code)
git config --global core.editor "code --wait"

# Tắt fast-forward merge để luôn tạo merge commit rõ ràng
git config --global merge.ff false
```

### B.4 Xác nhận nhánh mặc định

```bash
# Sau khi clone, chuyển sang develop
git checkout develop
git pull origin develop

# Kiểm tra nhánh hiện tại
git branch -a
```

### B.5 Cài đặt Commit Hook (Khuyến nghị)

> Nếu dự án có `package.json`, cài Husky để enforce commit convention:

```bash
npm install
npx husky init
echo 'npx --no -- commitlint --edit "$1"' > .husky/commit-msg
```

---

## Phần C — Luồng làm việc hàng ngày

### Nguyên tắc cốt lõi

```
main ← develop ← feat/xxx, fix/xxx, docs/xxx
```

- **Không bao giờ** commit thẳng vào `develop` hoặc `main`
- **Luôn** tạo branch mới từ `develop` cho mỗi task
- **Luôn** tạo PR để merge vào `develop`

### Quy trình chuẩn cho mỗi task

```bash
# Bước 1: Đảm bảo develop mới nhất
git checkout develop
git pull origin develop

# Bước 2: Tạo nhánh mới TỪ develop
git checkout -b feat/ten-tinh-nang
# Ví dụ:
# git checkout -b feat/pid-control
# git checkout -b fix/bytetrack-direction
# git checkout -b docs/srs-update

# Bước 3: Làm việc, code, sửa files...

# Bước 4: Stage file liên quan (KHÔNG dùng git add .)
git add src/env/pid_controller.py
git add tests/test_pid.py

# Bước 5: Validate commit message TRƯỚC
python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py \
  "feat(env): add PID closed-loop humidity control"

# Bước 6: Commit đúng format
git commit -m "feat(env): add PID closed-loop humidity control"

# Bước 7: Push lên remote
git push origin feat/pid-control

# Bước 8: Tạo Pull Request trên GitHub
# → Base: develop | Compare: feat/pid-control
```

### Tên nhánh chuẩn

| Loại           | Pattern         | Ví dụ                          |
| -------------- | --------------- | ------------------------------ |
| Feature        | `feat/<name>`   | `feat/pid-humidity-control`    |
| Bug fix        | `fix/<name>`    | `fix/bytetrack-double-count`   |
| Documentation  | `docs/<name>`   | `docs/srs-express-update`      |
| Chore/Config   | `chore/<name>`  | `chore/setup-mqtt-broker`      |
| Hotfix từ main | `hotfix/<name>` | `hotfix/auth-crash-production` |

---

## Phần D — Quy trình merge vào develop

### D.1 Tạo Pull Request

1. Push branch xong → GitHub tự gợi ý **"Compare & pull request"**
2. Click vào, điền form theo template
3. **Base branch:** `develop` ← **Compare:** `feat/ten-nhanh`
4. Assign reviewer (ít nhất 1 người)
5. Thêm label nếu có: `feat`, `fix`, `docs`...

### D.2 Review checklist (dành cho Reviewer)

```
□ Commit messages đúng format type(scope): subject?
□ Code không có console.log/debug statements thừa?
□ Không có file .env, secret, credentials bị commit?
□ Logic có bug obvious không?
□ Tên biến/hàm rõ ràng, self-documenting?
□ Tests đã được thêm (nếu là feat/fix)?
```

### D.3 Merge PR vào develop

> Owner hoặc reviewer approve → dùng **"Squash and merge"** hoặc **"Merge commit"**

| Strategy             | Khi nào dùng                                            |
| -------------------- | ------------------------------------------------------- |
| **Squash and merge** | Feature nhỏ, nhiều commit WIP → gộp thành 1 commit sạch |
| **Merge commit**     | Feature lớn, muốn giữ lịch sử chi tiết                  |
| **Rebase and merge** | Muốn lịch sử tuyến tính (linear history)                |

**Khuyến nghị cho SwiftletCare:** Dùng **Squash and merge** để `develop` log sạch.

### D.4 Sau khi merge — Dọn nhánh cũ

```bash
# Xóa nhánh local sau khi PR merged
git checkout develop
git pull origin develop
git branch -d feat/pid-control

# Xóa nhánh remote (GitHub thường tự xóa nếu bật option)
git push origin --delete feat/pid-control
```

---

## Phần E — Quy trình deploy lên main

> **Chỉ thực hiện khi đã test kỹ trên `develop` và sẵn sàng release.**

### E.1 Chuẩn bị release

```bash
# Cập nhật CHANGELOG.md trước
# Thêm section mới với version và ngày:
# ## [1.0.0] – 2026-11-01
# ### Added
# - ...
```

Commit CHANGELOG:

```bash
git checkout develop
git add CHANGELOG.md
git commit -m "docs(config): update CHANGELOG for v1.0.0 release"
git push origin develop
```

### E.2 Tạo PR từ develop → main

1. **GitHub → Pull requests → New pull request**
2. **Base:** `main` ← **Compare:** `develop`
3. Tiêu đề PR: `release: v1.0.0`
4. Mô tả: paste nội dung CHANGELOG vừa cập nhật
5. **Owner review và approve**

### E.3 Merge vào main

> Dùng **"Merge commit"** (KHÔNG squash) để giữ đầy đủ lịch sử release.

```
Merge commit message: "chore(ci): release v1.0.0"
```

### E.4 Tạo Git Tag

```bash
git checkout main
git pull origin main

# Tạo annotated tag
git tag -a v1.0.0 -m "Release v1.0.0 – MVP Sprint 1"
git push origin v1.0.0
```

### E.5 Tạo GitHub Release

1. **GitHub → Releases → Create a new release**
2. Choose tag: `v1.0.0`
3. Title: `SwiftletCare v1.0.0 – MVP`
4. Description: paste CHANGELOG section
5. Click **Publish release**

---

## Phần F — Xử lý tình huống thường gặp

### F.1 Conflict khi pull develop

```bash
# Tình huống: develop đã có commit mới trong khi bạn đang làm feat branch
git checkout feat/my-feature
git fetch origin
git rebase origin/develop   # Rebase branch lên đỉnh develop mới nhất

# Nếu conflict:
# 1. Mở file conflict → sửa thủ công
# 2. git add <file đã sửa>
# 3. git rebase --continue

# Nếu muốn bỏ rebase:
git rebase --abort
```

### F.2 Lỡ commit vào develop trực tiếp

```bash
# Undo commit cuối (giữ lại code, chỉ bỏ commit)
git reset HEAD~1 --soft

# Tạo nhánh mới từ điểm đó
git stash
git checkout -b fix/ten-fix
git stash pop

# Commit đúng
git commit -m "fix(env): ..."
git push origin fix/ten-fix
```

### F.3 Commit message sai format sau khi đã commit

```bash
# Sửa commit message của commit CUỐI (chưa push)
git commit --amend -m "feat(env): correct message format"

# Đã push rồi → KHÔNG sửa. Tạo commit fix:
git commit -m "docs(config): fix previous commit message reference"
# Hoặc chấp nhận và chú ý lần sau
```

### F.4 Xem lịch sử đẹp trên terminal

```bash
# Log dạng tree
git log --oneline --graph --decorate --all

# Alias tiện lợi (chạy 1 lần)
git config --global alias.lg "log --oneline --graph --decorate --all"

# Sau đó dùng:
git lg
```

### F.5 Khi cần hotfix gấp trên production

```bash
# Tạo hotfix từ main (không phải develop!)
git checkout main
git pull origin main
git checkout -b hotfix/auth-crash

# Sửa bug...
git add .
git commit -m "fix(auth): prevent null pointer on token refresh"
git push origin hotfix/auth-crash

# Tạo 2 PR:
# 1. hotfix/auth-crash → main  (deploy ngay)
# 2. hotfix/auth-crash → develop  (sync lại)
```

---

## Tóm tắt nhanh

```
┌─────────────────────────────────────────────────┐
│              SWIFTLETCARE GIT FLOW               │
├─────────────────────────────────────────────────┤
│                                                  │
│  feat/xxx ──┐                                    │
│  fix/xxx  ──┼──► PR Review ──► develop ──► main  │
│  docs/xxx ──┘         ↑            ↑             │
│                   1 approve    Owner only        │
│                                + CI pass        │
└─────────────────────────────────────────────────┘

Quy tắc vàng:
✅ Mỗi task = 1 branch riêng từ develop
✅ Mỗi PR = 1 tính năng/fix logic
✅ Commit message: type(scope): subject
✅ Validate trước commit:
   python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py "<msg>"
❌ KHÔNG commit thẳng vào develop hoặc main
❌ KHÔNG push force vào develop hoặc main
❌ KHÔNG merge develop → main nếu chưa test kỹ
```

---

## Checklist Owner (lưu lại)

```
□ Tạo nhánh main từ develop
□ Đặt main làm default branch: KHÔNG (develop mới là default)
□ Đặt develop làm default branch: ✅
□ Branch protection: main (strict) + develop (medium)
□ Tạo file .github/CODEOWNERS
□ Tạo file .github/pull_request_template.md
□ Invite thành viên với quyền Write
□ Bật "Automatically delete head branches" trong Settings
□ (Tùy chọn) Tạo .github/workflows/ci.yml
```

---

_Tài liệu này được lưu tại `GITHUB_SETUP.md` trong repo SwiftletCare._  
_Cập nhật lần cuối: 2026-09-07_
