## 📋 Mô tả

<!-- Giải thích ngắn gọn thay đổi này làm gì và tại sao cần thiết -->

## 🔗 Liên kết

- Closes #<!-- issue number, ví dụ: Closes #42 -->
- Branch: `<!-- feat/ | fix/ | docs/ | chore/ -->/<!-- tên nhánh -->`

## 🗂️ Loại thay đổi

<!-- Đánh dấu X vào ô phù hợp -->

- [ ] `feat` – Tính năng mới
- [ ] `fix` – Sửa bug
- [ ] `docs` – Cập nhật tài liệu
- [ ] `refactor` – Tái cấu trúc code
- [ ] `perf` – Cải thiện hiệu năng
- [ ] `test` – Thêm/sửa test
- [ ] `chore` – Cấu hình, dependency
- [ ] `security` – Vá bảo mật
- [ ] `breaking` – Breaking change ⚠️

## ✅ Checklist trước khi tạo PR

- [ ] Code chạy được trên máy local không có lỗi
- [ ] Commit message đúng format: `type(scope): subject`
- [ ] Đã validate commit: `python -X utf8 .agents/skills/git-commit-convention/scripts/validate_commit.py --staged`
- [ ] Không có conflict với `develop` (đã `git pull origin develop`)
- [ ] Đã test tính năng/fix thủ công
- [ ] **KHÔNG** commit file `.env`, credentials, API key, secret
- [ ] Không còn `console.log`, `print` debug thừa
- [ ] Tên biến/hàm rõ ràng (không dùng `a`, `b`, `temp`, `data`...)

## 📸 Screenshot / Video (nếu thay đổi UI)

<!-- Kéo thả ảnh hoặc video vào đây để reviewer hình dung -->

## 📝 Ghi chú cho Reviewer

<!-- Điều gì cần reviewer chú ý đặc biệt?
     Ví dụ: logic phức tạp, trade-off đã chọn, dependency bên ngoài... -->

## ⚠️ Breaking Changes (nếu có)

<!-- Mô tả những gì thay đổi không tương thích ngược.
     Ai bị ảnh hưởng? Cần làm gì để migrate? -->
