# SwiftletCare — Sổ tài liệu tham khảo & minh chứng

| Trường | Nội dung |
| --- | --- |
| **Mã tài liệu** | SC-DOC-EVID |
| **Phiên bản** | 0.1 (khung, chưa điền nguồn) |
| **Ngày tạo** | 18/10/2026 |
| **Người phụ trách** | _(tên người giữ file)_ |
| **Áp dụng cho** | SRS v2.x — yêu cầu EVID-NFR-003 (mục 6.8): mỗi ngưỡng mặc định phải có nguồn trích dẫn hoặc xác nhận của người nuôi yến |
| **Trạng thái** | Đang thu thập |

---

## 1. Mục đích

File này là nơi **cả nhóm cùng ghi lại tài liệu đã tìm được** để chứng minh rằng các con số, thiết bị và cách vận hành của SwiftletCare có căn cứ, không phải tự đặt ra. Hội đồng hay người đọc báo cáo cầm một con số trong SRS hoặc trong code, tra bảng ở mục 5 là thấy nó lấy từ đâu, trang nào, đã có ai kiểm lại chưa.

Bảng ở mục 5 đã liệt kê sẵn những khẳng định đang có trong SRS và code. **Cột nguồn để trống**: ai tìm được tài liệu thì ghi tài liệu vào mục 4, rồi điền mã tài liệu vào dòng tương ứng ở mục 5.

## 2. Cách điền (đọc trước khi thêm)

1. **Đọc tận mắt rồi mới ghi.** Chỉ ghi tài liệu mình đã mở và đọc được đoạn chứa con số. Không chép nguồn từ trang tổng hợp, blog hay câu trả lời AI mà chưa mở bản gốc.
2. **Ghi chỗ cụ thể.** Mỗi con số phải kèm trang / bảng / hình / mục, và trích nguyên văn đoạn có số đó (giữ ngôn ngữ gốc, dịch ở cột ghi chú nếu cần).
3. **Ghi đúng phạm vi của nguồn.** Nguồn đo ở loài khác, nước khác, hay cho gà/lợn chứ không phải chim yến thì ghi rõ ở cột "Phạm vi áp dụng". Đừng nói nguồn chứng minh nhiều hơn những gì nó viết.
4. **Không có nguồn thì nói không có.** Đặt trạng thái `⛔ Không có nguồn` và ghi cách xử lý (hạ thành giả định, chỉ cảnh báo, hoặc để Domain Expert đặt) — đúng quy tắc ở SRS §0 và §0.5.
5. **Người khác kiểm lại.** Một dòng chỉ lên `✅ Đã kiểm chứng` khi một thành viên **khác** người tìm đã mở nguồn và thấy đúng con số.
6. **File gốc.** Không commit PDF/ảnh có bản quyền vào repo. Ghi link + DOI ở đây; bản lưu trữ đặt trong thư mục chung của nhóm (ghi đường dẫn ở cột "Bản lưu"). Ảnh/biên bản do nhóm tự làm (mục 7, 8) thì ghi đường dẫn nơi lưu.
7. **Không xoá dòng.** Nguồn bị loại thì đổi trạng thái thành `🗑 Loại` và ghi lý do, để người sau không tìm lại đúng nguồn đó.

## 3. Quy ước

### 3.1. Mã

| Tiền tố | Dùng cho | Ví dụ |
| --- | --- | --- |
| `TL-xx` | Tài liệu bên ngoài (bài báo, sách, datasheet, văn bản pháp luật, trang tài liệu chính thức) — mục 4 | `TL-07` |
| `KD-xx` | Khẳng định / con số cần minh chứng — mục 5 | `KD-01` |
| `TB-xx` | Thiết bị — mục 6 | `TB-03` |
| `MC-xx` | Minh chứng do nhóm tự tạo (ảnh, số đo, log, video, biên bản) — mục 7, 8 | `MC-02` |

### 3.2. Mức tin cậy của nguồn

| Mức | Loại nguồn |
| --- | --- |
| **A** | Bài báo có bình duyệt, sách chuyên khảo, tiêu chuẩn (TCVN/ISO/IEEE), văn bản pháp luật, datasheet của chính hãng sản xuất chip/thiết bị |
| **B** | Tài liệu chính thức của tổ chức hoặc dự án (trang docs, đặc tả giao thức), luận văn/luận án, báo cáo của cơ quan nhà nước, viện, trường |
| **C** | Tài liệu của nhà cung cấp/đại lý, tài liệu kỹ thuật ngành không bình duyệt, báo chí |
| **D** | Xác nhận của người nuôi yến / Domain Expert (phải có biên bản ở mục 8), số đo của nhóm (mục 7) |

Một con số dùng làm **ngưỡng mặc định** nên có ít nhất một nguồn mức A hoặc B, hoặc một xác nhận mức D có biên bản.

### 3.3. Trạng thái

| Ký hiệu | Nghĩa |
| --- | --- |
| `⬜ Chưa tìm` | Chưa ai tìm nguồn |
| `🔍 Đang tìm` | Có người nhận, chưa có kết quả |
| `🟡 Có nguồn` | Đã ghi nguồn, chưa có người thứ hai kiểm lại |
| `✅ Đã kiểm chứng` | Người thứ hai đã mở nguồn và thấy đúng |
| `⚠️ Lệch nguồn` | Nguồn có số khác với số đang dùng — ghi rõ chênh lệch và đề xuất sửa |
| `⛔ Không có nguồn` | Đã tìm, không có — là giả định, ghi cách xử lý |
| `🗑 Loại` | Nguồn bị loại, ghi lý do |

### 3.4. Cách trích dẫn

Dùng kiểu **IEEE** (thống nhất với báo cáo KLTN):

- Bài báo: `Tác giả, "Tên bài," *Tên tạp chí*, tập, số, trang, năm. DOI: …`
- Sách: `Tác giả, *Tên sách*, lần xuất bản. Nơi XB: NXB, năm.`
- Datasheet / trang web: `Hãng, "Tên tài liệu," phiên bản/ngày. [Online]. Available: URL (truy cập dd/mm/yyyy).`
- Văn bản pháp luật: `Cơ quan ban hành, Số/ký hiệu, "Tên văn bản," ngày ban hành.`

---

## 4. Danh mục tài liệu (`TL-xx`)

Mỗi tài liệu một dòng. Thêm dòng vào đúng nhóm; số `TL` tăng dần, không dùng lại số đã xoá.

### 4.1. Nuôi chim yến & vi khí hậu nhà yến

| Mã | Trích dẫn (IEEE) | Link / DOI | Mức | Nội dung liên quan | Phạm vi áp dụng (loài, nơi đo) | Bản lưu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| TL-01 | | | | | | | | |

### 4.2. Pháp lý & quy chuẩn Việt Nam

| Mã | Trích dẫn (IEEE) | Link | Mức | Điều/khoản liên quan | Ảnh hưởng tới hệ thống | Bản lưu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| | | | | | | | | |

### 4.3. Chất lượng không khí (NH3, CO2) và tiếng ồn

| Mã | Trích dẫn (IEEE) | Link / DOI | Mức | Nội dung liên quan | Phạm vi áp dụng (người / vật nuôi nào) | Bản lưu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| | | | | | | | | |

### 4.4. Datasheet & tài liệu thiết bị

| Mã | Trích dẫn (IEEE) | Link | Mức | Thiết bị (`TB-xx`) | Thông số dùng trong hệ thống | Bản lưu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| | | | | | | | | |

### 4.5. Thuật toán: điều khiển mờ, lọc tín hiệu, phát hiện bất thường

| Mã | Trích dẫn (IEEE) | Link / DOI | Mức | Dùng cho phần nào | Bản lưu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- |
| | | | | | | | |

### 4.6. Thị giác máy tính: phát hiện, theo vết, đếm, dữ liệu

| Mã | Trích dẫn (IEEE) | Link / DOI | Mức | Dùng cho phần nào | Giấy phép (với dữ liệu/model) | Bản lưu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| | | | | | | | | |

### 4.7. Giao thức & nền tảng phần mềm

| Mã | Trích dẫn (IEEE) | Link | Mức | Dùng cho phần nào | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- |
| | | | | | | |

### 4.8. Hệ thống tương tự / công trình liên quan

Các hệ thống IoT, đếm chim hay giám sát nhà yến đã được công bố — dùng cho chương "Related work" và để so sánh.

| Mã | Trích dẫn (IEEE) | Link / DOI | Mức | Họ làm gì | Khác SwiftletCare ở đâu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- |
| | | | | | | | |

### 4.9. Thị trường & kinh tế ngành yến

| Mã | Trích dẫn (IEEE) | Link | Mức | Con số | Thời điểm của số liệu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- |
| | | | | | | | |

---

## 5. Bảng truy vết: khẳng định → minh chứng (`KD-xx`)

Danh sách dưới đây lấy từ SRS và code **tại thời điểm tạo file**; cột "Dùng ở đâu" chỉ chỗ con số đang nằm. Khi điền:

- **Nguồn**: mã `TL-xx` và/hoặc `MC-xx`, có thể nhiều mã.
- **Trích đoạn & vị trí**: trang/bảng/mục + câu trích ngắn có chứa con số.
- Nếu nguồn cho số khác, đặt `⚠️ Lệch nguồn` và ghi số của nguồn — **không tự sửa SRS/code trong file này**, sửa bằng PR riêng.

### 5.1. Ngưỡng môi trường mặc định (ENV-FR-007)

| Mã | Khẳng định | Giá trị đang dùng | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-01 | Nhiệt độ thích hợp trong nhà yến | 26–31 °C | SRS ENV-FR-007; firmware `Config.h` `DEFAULT_TEMP_MIN/MAX`; backend `utils/thresholds.util.ts` | | | | ⬜ Chưa tìm | |
| KD-02 | Độ ẩm thích hợp trong nhà yến | 75–95 %RH | SRS ENV-FR-007; firmware `DEFAULT_HUMIDITY_MIN/MAX`; backend `thresholds.util.ts` | | | | ⬜ Chưa tìm | |
| KD-03 | Nhà yến cần tối gần như hoàn toàn | ánh sáng < 0.2 lux | SRS ENV-FR-007; firmware `DEFAULT_LIGHT_MAX` | | | | ⬜ Chưa tìm | |
| KD-04 | Ngưỡng cảnh báo NH3 | < 25 ppm (**tạm**, SRS ghi chưa có nguồn riêng cho nhà yến) | SRS ENV-FR-007, §0.2 #7; backend `thresholds.util.ts` | | | | ⬜ Chưa tìm | |
| KD-05 | Ngưỡng cảnh báo CO2 | < 1500 ppm (**tạm**, như trên) | SRS ENV-FR-007, §0.2 #7; backend `thresholds.util.ts` | | | | ⬜ Chưa tìm | |
| KD-06 | Độ ẩm < 75 % hoặc nhiệt độ > 31 °C gây thoái hoá tổ, chim bỏ tổ, chim non chết nhiều | < 75 %RH / > 31 °C | SRS §2.1 | | | | ⬜ Chưa tìm | |
| KD-07 | NH3 trong nhà yến chủ yếu từ phân chim; người nuôi dùng phân để dẫn dụ | — | SRS §0.2 #7 | | | | ⬜ Chưa tìm | |

### 5.2. Vận hành & tập tính chim yến

| Mã | Khẳng định | Giá trị đang dùng | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-10 | Loa dẫn dụ phát vào giờ chim ra/vào tổ | 5–7 h và 17–19 h | SRS §7.1, §7.2; firmware `SPEAKER_WINDOW_*` | | | | ⬜ Chưa tìm | |
| KD-11 | Chim rời tổ buổi sáng, về tổ buổi chiều (cơ sở để chia phiên đếm sáng/chiều) | phiên sáng / phiên chiều | SRS §5.4, VISION-FR-009; `ai-pipeline/config/config.yaml` | | | | ⬜ Chưa tìm | |
| KD-12 | Tỷ lệ chim về là chỉ số then chốt đánh giá sức khoẻ đàn và dự báo năng suất | — | SRS §2.1 | | | | ⬜ Chưa tìm | |
| KD-13 | Phun sương làm tăng độ ẩm, quạt làm giảm nhiệt trong nhà yến (hai cơ cấu chấp hành của vòng điều khiển) | — | SRS §5.3.3 | | | | ⬜ Chưa tìm | |
| KD-14 | Đèn hồng ngoại 850 nm có ánh đỏ nhìn thấy được, có thể làm chim khó chịu; 940 nm an toàn hơn | IR 850 nm | `docs/bird-counting-plan.md` §3.2, §19.5 cổng 6 | | | | ⬜ Chưa tìm | |
| KD-15 | Một nhà yến đã có đàn chim cần được kiểm chứng bởi người có chuyên môn (lý do có vai trò Domain Expert) | — | SRS §0.3, §5.12 | | | | ⬜ Chưa tìm | |

### 5.3. Tham số phát hiện sự cố (EXPERT-FR-008, mặc định do code chọn)

SRS ghi các số này là mặc định kỹ thuật, Domain Expert chỉnh được theo Zone. Mục tiêu ở đây: tìm nguồn hoặc số đo hỗ trợ, nếu không có thì giữ trạng thái `⛔ Không có nguồn` và ghi là "giả định, chờ hiệu chỉnh bằng dữ liệu thật".

| Mã | Khẳng định | Giá trị mặc định (khoảng hợp lệ) | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-20 | Ồn bất thường: cao hơn mức nền của giờ đó | 15 dB (5–30) | firmware `DEFAULT_NOISE_MARGIN_DB`; THREAT-FR-007 | | | | ⬜ Chưa tìm | |
| KD-21 | Ồn bất thường: số giây vượt trong cửa sổ 15 giây | 10 s (5–15) | firmware `DEFAULT_NOISE_MIN_SEC` | | | | ⬜ Chưa tìm | |
| KD-22 | Mức nền tiếng ồn = phân vị 90 theo từng giờ, học khi loa tắt | P90 × 24 giờ | THREAT-FR-007; firmware `sensors/NoiseAnomalyDetector` | | | | ⬜ Chưa tìm | |
| KD-23 | Bơm khô: thời gian bơm bật cộng dồn trước khi xét | 300 s (120–900) | firmware `DEFAULT_PUMP_DRY_ON_SEC`; THREAT-FR-011 | | | | ⬜ Chưa tìm | |
| KD-24 | Bơm khô: độ ẩm phải tăng tối thiểu | 2 %RH (0.5–10) | firmware `DEFAULT_PUMP_DRY_MIN_RISE_PCT` | | | | ⬜ Chưa tìm | |
| KD-25 | Hỏng loa: mức âm giảm so với nền | 70 % (30–90) | firmware `DEFAULT_SPEAKER_DROP_PCT`; THREAT-FR-006 | | | | ⬜ Chưa tìm | |
| KD-26 | Tỷ lệ chim về giảm so với trung bình 7 ngày thì cảnh báo | 20 % (5–50) | backend `zones.detection_tuning.return_rate_drop_pct`; VISION-FR-011 | | | | ⬜ Chưa tìm | |
| KD-27 | Cảm biến bất thường: đứng yên ≥ 2 giờ, nhảy 2 °C / 10 %, lệch 2 °C / 8 % | như bên trái | SRS ALERT-FR-010 | | | | ⬜ Chưa tìm | |

### 5.4. Bộ điều khiển mờ (ENV-FR-010/011/021)

| Mã | Khẳng định | Giá trị mặc định (khoảng hợp lệ) | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-30 | Dùng logic mờ Sugeno (thay vì bật/tắt theo ngưỡng) để điều khiển phun sương và quạt | — | SRS §5.3.3; firmware `pid/FuzzyControl.cpp`; backend `utils/fuzzyModel.util.ts` | | | | ⬜ Chưa tìm | |
| KD-31 | Độ rộng vùng chuyển tiếp độ ẩm | 8 %RH (2–20) | firmware `DEFAULT_FUZZY_HUMIDITY_BAND` | | | | ⬜ Chưa tìm | |
| KD-32 | Độ rộng vùng nóng | 4 °C (1–10) | firmware `DEFAULT_FUZZY_TEMP_BAND` | | | | ⬜ Chưa tìm | |
| KD-33 | Mức quạt khi nóng mà khô | 40 % (0–100) | firmware `DEFAULT_FUZZY_FAN_DRY_LEVEL` | | | | ⬜ Chưa tìm | |
| KD-34 | Điều khiển theo tỷ lệ thời gian (time-proportioning) với cửa sổ | 120 s (60–600) | firmware `DEFAULT_FUZZY_WINDOW_SEC` | | | | ⬜ Chưa tìm | |
| KD-35 | Chu kỳ đọc cảm biến 1 Hz, quyết định điều khiển mỗi 10 giây | 1 s / 10 s | SRS PERF-NFR-005; firmware `SENSOR_INTERVAL_MS`, `PID_INTERVAL_MS` | | | | ⬜ Chưa tìm | |

### 5.5. Đếm chim & AI (Module VISION)

| Mã | Khẳng định | Giá trị | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-40 | YOLOv8n đủ nhẹ để phát hiện chim thời gian thực | YOLOv8n, ONNX Runtime | SRS §3.2, VISION-FR-002 | | | | ⬜ Chưa tìm | |
| KD-41 | ByteTrack giữ được ID từng con chim để đếm qua vạch ảo | ByteTrack | SRS §3.2; `ai-pipeline/src/tracker.py` | | | | ⬜ Chưa tìm | |
| KD-42 | Đánh giá phát hiện bằng Precision, Recall, mAP50; đánh giá đếm bằng sai số so với đếm tay | — | SRS EVID-NFR-001, VISION-FR-016; plan §7.7 | | | | ⬜ Chưa tìm | |
| KD-43 | Ngưỡng nội bộ sai số đếm | ≤ 10 % (đề xuất nội bộ, phiếu không cam kết) | `docs/bird-counting-plan.md` §7.7 | | | | ⬜ Chưa tìm | |
| KD-44 | Không có bộ dữ liệu công khai quay chim yến bay qua lỗ ra vào | tra cứu 10/2026 | plan §7.8 | | | | ⬜ Chưa tìm | |
| KD-45 | Dữ liệu ngoài (FBD-SV-2024, SOD4SB, Roboflow…) — giấy phép cho phép dùng | — | plan §7.8 | | | | ⬜ Chưa tìm | |
| KD-46 | Nút AI xử lý kịp luồng camera | ≥ tốc độ khung hình camera (SRS ghi 25 fps, plan ghi 20 fps với camera đã chốt) | SRS PERF-NFR-004; plan §6.8 | | | | ⬜ Chưa tìm | |

### 5.6. Kinh tế & bối cảnh

| Mã | Khẳng định | Giá trị | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-50 | Giá tổ yến | 20–60 triệu đồng/kg | SRS §2.1 | | | | ⬜ Chưa tìm | |
| KD-51 | Nuôi yến là ngành có giá trị kinh tế cao ở Việt Nam | — | SRS §2.1 | | | | ⬜ Chưa tìm | |
| KD-52 | Phần lớn người nuôi dùng cảm biến rời, kiểm tra thủ công nhiều lần/ngày | — | SRS §2.1 | | | | ⬜ Chưa tìm | |
| KD-53 | Sự cố thiết bị (hỏng loa, bơm cạn, cảm biến sai, mất điện) thường phát hiện muộn | — | SRS §2.1 | | | | ⬜ Chưa tìm | |
| KD-54 | Điều kiện pháp lý khi xây và vận hành nhà yến (vị trí, loa phóng thanh…) | — | chưa có trong SRS | | | | ⬜ Chưa tìm | |

### 5.7. Giả định kỹ thuật đã biết là chưa có nguồn (SRS §0.5)

Những mốc này SRS đã ghi là do người viết code chọn. Không cần tìm tài liệu nuôi yến cho chúng; cần **số đo thực tế** (mục 7) hoặc xác nhận của nhóm/Domain Expert. Khi có, điền mã `MC-xx` và cập nhật SRS §0.5 bằng PR riêng.

| Mã | Mốc | Giá trị | Ở đâu | Minh chứng (`MC-xx`) | Kết luận | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| KD-60 | Tự thử phun lại sau khi chốt bơm khô | 30 phút | firmware `PUMP_DRY_RETRY_MIN` | | | ⛔ Không có nguồn |
| KD-61 | Độ ẩm còn tính là hợp lệ | tới 101 % | firmware `HUMIDITY_SATURATION_MAX`, backend `fuzzyModel.util.ts` | | | ⛔ Không có nguồn |
| KD-62 | Gửi lại cảnh báo theo đợt | 15 phút | firmware `EPISODE_ALERT_RESEND_MS` | | | ⛔ Không có nguồn |
| KD-63 | Tự đóng cảnh báo theo đợt | 60 phút | backend `EPISODE_CLEAR_MS` | | | ⛔ Không có nguồn |
| KD-64 | Số đo nhiệt-ẩm hợp lệ gần nhất còn dùng được | 2 chu kỳ (20 s) | firmware `CONTROL_INPUT_MAX_AGE_CYCLES` | | | ⛔ Không có nguồn |
| KD-65 | Bỏ qua bản tin AUTO sau khi vừa bật tay | 30 s | backend `DEVICE_CONFIRM_GRACE_MS` | | | ⛔ Không có nguồn |
| KD-66 | Thời hạn tối đa / tối thiểu của 1 lần can thiệp tay | 24 giờ / 1 phút | backend `MAX_OVERRIDE_MS`, `MIN_OVERRIDE_MS` | | | ⛔ Không có nguồn |

---

## 6. Thiết bị (`TB-xx`)

Mỗi thiết bị trong BOM (SRS §7.1, `docs/hardware/BOM.md`) cần: datasheet, các thông số hệ thống đang dựa vào, và bằng chứng nhóm đã có thiết bị thật (ảnh, hoá đơn).

| Mã | Thiết bị | Model | Thông số hệ thống dựa vào (cần datasheet xác nhận) | Datasheet (`TL-xx`) | Ảnh thật (`MC-xx`) | Hoá đơn / nguồn mua | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TB-01 | Vi điều khiển | ESP32 NodeMCU 38 chân (ESP32-WROOM-32, CP2102) | Wi-Fi, dual-core 240 MHz, NVS, watchdog | | | | ⬜ Chưa tìm |
| TB-02 | Module UART TTL ↔ RS485 | V2, tự đảo chiều | Auto-direction, đấu thẳng TX/RX | | | | ⬜ Chưa tìm |
| TB-03 | Cảm biến nhiệt-ẩm | ES35-SW (chip SHT35) | Modbus RTU, reg 0+1 ÷ 10, mặc định 9600 bps, trở 120 Ω qua DIP 5; độ chính xác của SHT35 | | | | ⬜ Chưa tìm |
| TB-04 | Cảm biến ánh sáng | ES-ALS-02 | 0–200 000 lux, reg 0x0002 (32-bit) × 100 → **độ phân giải ở mức < 0.2 lux có đủ không?** | | | | ⬜ Chưa tìm |
| TB-05 | Cảm biến NH3 | ES-NH3-01 | 0–500 ppm, điện hoá, reg 0x0000 | | | | ⬜ Chưa tìm |
| TB-06 | Cảm biến CO2 | ES-CO2-01 | 0–5000 ppm, reg 0x0000 | | | | ⬜ Chưa tìm |
| TB-07 | Cảm biến tiếng ồn | ES-NOISE-01 | 30–130 dB, reg 0x0000 ÷ 10; chỉ trả mức dB, không trả dạng sóng | | | | ⬜ Chưa tìm |
| TB-08 | Module relay 4 kênh | 5 V opto, kích H/L (JQC-3FF-S-Z) | 250 VAC / 10 A, ~200 mA/relay | | | | ⬜ Chưa tìm |
| TB-09 | Mạch hạ áp ×2 | LM2596 3 A | in 3–30 V, out 1.5–30 V | | | | ⬜ Chưa tìm |
| TB-10 | Domino phân phối | TB1504 | 4 mối, 15 A / 600 V | | | | ⬜ Chưa tìm |
| TB-11 | Module phát MP3 | DFPlayer Mini | microSD ≤ 32 GB FAT16/32, UART, volume 0–30 | | | | ⬜ Chưa tìm |
| TB-12 | Amply | PAM8403 6 W có volume | Class-D 2 × 3 W, 5 V | | | | ⬜ Chưa tìm |
| TB-13 | Nguồn | Adapter 12 V / 2 A | Ngân sách nguồn (components-guide §13) | | | | ⬜ Chưa tìm |
| TB-14 | Camera IP | TP-Link VIGI C320I ống kính 6 mm | 2 MP, IR 850 nm, IP66, RTSP, tốc độ khung hình | | | | ⬜ Chưa tìm |
| TB-15 | Bộ cấp nguồn PoE | TP-Link TL-POE150S | Chuẩn PoE, công suất cấp | | | | ⬜ Chưa tìm |
| TB-16 | Phun sương, quạt, loa | (ghi model thật) | Điện áp, công suất | | | | ⬜ Chưa tìm |
| TB-17 | Công tắc bypass Auto/Off/Hand | chưa mua | Dòng định mức > dòng bơm/quạt (ENV-FR-023) | | | | ⬜ Chưa tìm |

---

## 7. Minh chứng do nhóm tạo (`MC-xx`)

Ảnh lắp đặt, số đo, log, video, kết quả test. Đây là bằng chứng mạnh nhất cho phần "hệ thống chạy thật" (SRS §0.2 #12, §6.8, §13.6).

| Mã | Loại | Mô tả (cái gì, đo ở đâu, điều kiện) | Thời gian | Người tạo | Nơi lưu (link thư mục chung / file trong `docs/test-reports/`) | Chứng minh cho (`KD-xx` / `TB-xx` / FR) |
| --- | --- | --- | --- | --- | --- | --- |
| MC-01 | | | | | | |

Gợi ý những minh chứng còn thiếu (theo SRS §0.2 #12 và §6.8):

- [ ] Ảnh/video bộ điều khiển đã lắp (hộp, dây, nhãn) và tại nhà yến.
- [ ] Số đo nhiệt độ, độ ẩm, ánh sáng, NH3, CO2, tiếng ồn ở nhà yến thật (xuất từ hệ thống, ghi rõ khoảng thời gian).
- [ ] Tỷ lệ thời gian tự động và tỷ lệ thời gian trong ngưỡng (AUTO-NFR-001, ANALYTICS-FR-011).
- [ ] Bảng độ chính xác đếm chim: Precision, Recall, sai số đếm, tách đủ sáng / thiếu sáng (EVID-NFR-001, VISION-FR-016).
- [ ] Sai số dự báo MAE ở 30 và 60 phút (EVID-NFR-002).
- [ ] Kết quả các kịch bản mất mạng / lỗi thiết bị (SRS §13.6).
- [ ] Kết quả `pio test -e native` và test backend dùng chung case cho bộ mờ.

---

## 8. Biên bản xác nhận của người nuôi yến / Domain Expert

EVID-NFR-003 chấp nhận "xác nhận của người nuôi yến" là nguồn cho ngưỡng mặc định, và SRS §5.12 yêu cầu biên bản ý kiến của một người nuôi yến có kinh nghiệm được đưa vào báo cáo (§13.6). Để xác nhận đó dùng được làm minh chứng, mỗi lần phỏng vấn/xác nhận lập một biên bản theo mẫu dưới, lưu bản có chữ ký (ảnh/scan) ở thư mục chung và ghi vào bảng.

### 8.1. Danh sách biên bản

| Mã | Người xác nhận | Kinh nghiệm (số năm, số nhà yến) | Ngày | Hình thức (gặp trực tiếp / gọi / văn bản) | Xác nhận cho (`KD-xx`) | Nơi lưu bản ký |
| --- | --- | --- | --- | --- | --- | --- |
| MC-xx | | | | | | |

### 8.2. Mẫu biên bản

```text
BIÊN BẢN XÁC NHẬN THÔNG SỐ — SwiftletCare            Mã: MC-__

Ngày: __/__/2026        Địa điểm / hình thức: ____________________
Người xác nhận: ______________________  SĐT/Email: ________________
Kinh nghiệm: ___ năm nuôi yến, quản lý ___ nhà yến tại ______________
Người phỏng vấn (nhóm SwiftletCare): ______________________

Nội dung xác nhận:
| Mã KD | Thông số                | Giá trị hệ thống đang dùng | Ý kiến (Đồng ý / Đề xuất khác: ___) | Ghi chú |
|-------|-------------------------|----------------------------|--------------------------------------|---------|
| KD-01 | Nhiệt độ nhà yến        | 26–31 °C                   |                                      |         |
| KD-02 | Độ ẩm nhà yến           | 75–95 %RH                  |                                      |         |
| KD-03 | Ánh sáng                | < 0.2 lux                  |                                      |         |
| KD-10 | Giờ phát loa dẫn dụ      | 5–7 h, 17–19 h             |                                      |         |
| KD-14 | Đèn hồng ngoại camera    | 850 nm                     |                                      |         |
| ...   |                         |                            |                                      |         |

Ý kiến khác: ______________________________________________________

Người xác nhận (ký, ghi rõ họ tên)        Người phỏng vấn (ký, ghi rõ họ tên)
```

---

## 9. Khoảng trống & việc cần làm

Tổng hợp những gì chưa có minh chứng sau mỗi đợt rà soát; sắp theo mức quan trọng với hội đồng.

| # | Khẳng định / thiết bị chưa có minh chứng | Ảnh hưởng nếu không có | Hướng xử lý | Người nhận | Hạn |
| --- | --- | --- | --- | --- | --- |
| 1 | | | | | |

## 10. Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung |
| --- | --- | --- | --- |
| 0.1 | 18/10/2026 | | Tạo khung: quy ước, danh mục tài liệu trống, bảng truy vết các khẳng định đang có trong SRS/code, bảng thiết bị, mẫu biên bản xác nhận |
