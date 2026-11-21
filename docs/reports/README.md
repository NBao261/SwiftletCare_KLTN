# Hồ sơ Review 2 — mục lục

Bản tiếng Anh của các hồ sơ nộp ở Review 2, theo "Hướng dẫn chuẩn bị Review 2" (SEP490, v1.0, 10/2026). Mỗi hồ sơ xuất ra PDF theo mẫu của môn, tên file `SEP490_<Mã đề tài>_R2_<Tên hồ sơ>.pdf`.

| File | Hồ sơ |
| --- | --- |
| [`registration-v3.md`](registration-v3.md) | Phiếu đăng ký bản đề xuất chốt v3 (docx để nộp: `registration/`) |
| [`bm03-record-of-changes.md`](bm03-record-of-changes.md) | BM03 – Record of Changes (phiếu v2 → v3 bản cuối, 19 dòng) |
| [`report1-introduction.md`](report1-introduction.md) | Report 1 – Introduction |
| [`report2-project-management-plan.md`](report2-project-management-plan.md) | Report 2 – Project Management Plan |
| [`report3-srs.md`](report3-srs.md) | Report 3 – SRS 4.2.16: chỉ yêu cầu, không ghi trạng thái code |
| [`report4-sdd.md`](report4-sdd.md) | Report 4 – SDD 2.2.21: thiết kế cuối, không ghi trạng thái code |
| [`report5-test.md`](report5-test.md) | Report 5 – Test (171 test case cam kết), **sinh** từ `report5/tc.py` bằng `report5/gen_report5.py`, không sửa tay |
| [`project-tracking.md`](project-tracking.md) | Project Tracking — **nguồn trạng thái duy nhất**: tính năng, test, defect, danh sách gap G-01…G-32 |
| [`design-brief.md`](design-brief.md) | Design Brief BM01 + Phụ lục A (docx: `design-brief/`) |
| [`bm02-self-review.md`](bm02-self-review.md) | BM02 – Self-Review Report: kết quả gốc của prompt chuẩn trên tag `review-2` + Team response (docx: `registration/`) |
| BM04 – Review 2 Commitment | Sinh bằng `tools/make_bm04.py` từ `report5/tc.py` (docx: `registration/`); chữ ký và kết luận để trống cho hội đồng |
| [`todo-review2.md`](todo-review2.md) | Việc cần làm, theo gap của Project Tracking (tiếng Việt) |
| [`todo-final-scope.md`](todo-final-scope.md) | Việc cần làm cho phần scope cuối (G-20…G-27), làm tiếp sau `todo-review2.md` (tiếng Việt) |
| [`todo-audit-1118.md`](todo-audit-1118.md) | Việc cần sửa sau đợt soát web và backend 18–19/11/2026 (W-01…W-13, B-01…B-06, D-01…D-04; gap G-28) (tiếng Việt) |
| [`todo-audit-1119.md`](todo-audit-1119.md) | Đợt soát thứ hai 19/11/2026, theo tiêu chí chấp nhận và giao diện web từng role (B-01…B-03, W-01…W-09, U-01…U-09, C-01…C-05, D-01; gap G-29) (tiếng Việt) |
| [`todo-owner-expert-1121.md`](todo-owner-expert-1121.md) | Chủ nhà yến quyết, chuyên gia duyệt: BR-22 theo ba nhóm (B-01…B-12, W-01…W-06; gap G-31) (tiếng Việt) |
| [`todo-audit-1121.md`](todo-audit-1121.md) | Đợt soát backend, web, mobile 21/11/2026 (B-01…B-09, W-01…W-12 cho Bảo, M-01…M-14 cho Len, D-01…D-05; gap G-32) (tiếng Việt) |

## Quy tắc giữ hồ sơ nhất quán

- Một giá trị chỉ định nghĩa một lần: thời gian offline ở BR-10, mức độ cảnh báo ở BR-15, thời hạn lưu dữ liệu ở BR-36, hằng số tự chọn ở Report 3 §4.5 (vị trí trong code ở Report 4 §5.5). Chỗ khác chỉ tham chiếu.
- Trạng thái (Done, gap, defect, số test đạt) chỉ ghi ở `project-tracking.md`. SRS và SDD không ghi "planned", "chưa làm", số PR.
- Sửa một thay đổi phạm vi thì sửa cùng lúc: BM03, phiếu v3, mục 1.1 của Design Brief.
- Report 5 chỉ ghi "Pass" từ lần chạy CI trên tag `review-2`.
- Word: sinh lại từ Markdown bằng `tools/` (`make_registration_v3.py`, `make_bm03.py`, `make_bm01.py`, `make_bm02.py`).
