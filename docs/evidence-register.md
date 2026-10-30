# SwiftletCare — Sổ tài liệu tham khảo & minh chứng

| Trường | Nội dung |
| --- | --- |
| **Mã tài liệu** | SC-DOC-EVID |
| **Phiên bản** | 0.3 (nhóm đã điền nguồn mục 4.1–4.9, 5.1–5.6; đối chiếu lại với Report 3 3.1.0, 30/10/2026) |
| **Ngày tạo** | 18/10/2026 |
| **Người phụ trách** | _(tên người giữ file)_ |
| **Áp dụng cho** | Report 3 – SRS (`docs/reports/report3-srs.md`: A-3, REF-5, BR-01, mục 4.5) — mỗi ngưỡng mặc định phải có nguồn trích dẫn hoặc xác nhận của người nuôi yến. Cột "Dùng ở đâu" trỏ mã BR/FR/NFR của Report 3 3.1.0 |
| **Trạng thái** | Đang thu thập |

---

## 1. Mục đích

File này là nơi **cả nhóm cùng ghi lại tài liệu đã tìm được** để chứng minh rằng các con số, thiết bị và cách vận hành của SwiftletCare có căn cứ, không phải tự đặt ra. Hội đồng hay người đọc báo cáo cầm một con số trong Report 3 hoặc trong code, tra bảng ở mục 5 là thấy nó lấy từ đâu, trang nào, đã có ai kiểm lại chưa.

Bảng ở mục 5 đã liệt kê sẵn những khẳng định đang có trong Report 3 và code. Dòng nào **cột nguồn còn trống** là chưa ai tìm được: ai tìm được tài liệu thì ghi tài liệu vào mục 4, rồi điền mã tài liệu vào dòng tương ứng ở mục 5.

## 2. Cách điền (đọc trước khi thêm)

### 2.1. Quy tắc chung

1. **Đọc tận mắt rồi mới ghi.** Chỉ ghi tài liệu mình đã mở và đọc được đoạn chứa con số. Không chép nguồn từ trang tổng hợp, blog hay câu trả lời AI mà chưa mở bản gốc.
2. **Ghi chỗ cụ thể.** Mỗi con số phải kèm trang / bảng / hình / mục, và trích nguyên văn đoạn có số đó (giữ ngôn ngữ gốc, dịch ở cột ghi chú nếu cần).
3. **Ghi đúng phạm vi của nguồn.** Nguồn đo ở loài khác, nước khác, hay cho gà/lợn chứ không phải chim yến thì ghi rõ ở cột "Phạm vi áp dụng". Đừng nói nguồn chứng minh nhiều hơn những gì nó viết.
4. **Không có nguồn thì nói không có.** Đặt trạng thái **Không có nguồn** và ghi cách xử lý (hạ thành giả định, chỉ cảnh báo, hoặc để Domain Expert đặt) — đúng quy tắc ở quy tắc "không bịa ngưỡng" của Report 3 (A-3, A-4, §4.5).
5. **Người khác kiểm lại.** Một dòng chỉ lên **Đã kiểm chứng** khi một thành viên **khác** người tìm đã mở nguồn và thấy đúng con số.
6. **File gốc.** Không commit PDF/ảnh có bản quyền vào repo. Ghi link + DOI ở đây; bản lưu trữ đặt trong thư mục chung của nhóm (ghi đường dẫn ở cột "Bản lưu"). Ảnh/biên bản do nhóm tự làm (mục 6, 7) thì ghi đường dẫn nơi lưu.
7. **Không xoá dòng.** Nguồn bị loại thì đổi trạng thái thành **Loại** và ghi lý do, để người sau không tìm lại đúng nguồn đó.

### 2.2. Phân công

Cả nhóm dùng **chung một file này**, không tách bản riêng cho từng người. Việc được chia theo **khẳng định** (`KD`), không chia theo tài liệu: mỗi nhóm có một người phụ trách chính, theo 5 vai trò trong `docs/task-checklist.md`. Người phụ trách chính chịu trách nhiệm nhóm đó có nguồn; người khác thấy nguồn tốt vẫn được ghi, theo quy tắc ở 2.3.

| Người | Nhóm khẳng định (mục 5) | Nhóm tài liệu (mục 4) | Dải mã `TL` / `MC` |
| --- | --- | --- | --- |
| M1 — IoT/Firmware | 5.3 Tham số phát hiện, 5.4 Bộ điều khiển mờ | 4.4 Datasheet, 4.5 Thuật toán | 100–199 |
| M2 — AI/Vision | 5.5 Đếm chim & AI | 4.6 Thị giác máy tính | 200–299 |
| M3 — Backend | 5.1 Ngưỡng môi trường | 4.3 NH3/CO2/tiếng ồn, 4.7 Giao thức | 300–399 |
| M4 — Frontend | 5.6 Kinh tế & bối cảnh | 4.2 Pháp lý, 4.8 Hệ thống tương tự, 4.9 Thị trường | 400–499 |
| M5 — QA/Thesis | 5.2 Tập tính chim yến, 5.7 Giả định kỹ thuật (đo cùng M1, M3), mục 6 Minh chứng, mục 7 Biên bản | 4.1 Nuôi yến & vi khí hậu | 500–599 |

### 2.3. Chống trùng

1. **Tìm trước khi thêm.** Ctrl+F theo DOI, tên bài hoặc tác giả trong mục 4. Đã có thì dùng lại mã `TL` cũ, không tạo mã mới.
2. **Nhận trước khi tìm.** Đổi trạng thái dòng `KD` thành "Đang tìm" và ghi tên vào cột "Phụ trách". Dòng đã có người nhận thì không làm song song.
3. **Hai người cùng ra một khẳng định thì không phải trùng.** Người đến sau chuyển sang kiểm chứng nguồn của người trước (quy tắc 5 ở 2.1).
4. **Hai nguồn cho hai số khác nhau thì giữ cả hai.** Ghi cả hai mã `TL`, đặt **Lệch nguồn**, đem ra họp nhóm quyết. Không ai tự xoá nguồn của người khác.
5. **Đánh số trong dải của mình** (bảng 2.2), ví dụ M2 thêm tài liệu thì dùng `TL-200`, `TL-201`… Hai người thêm cùng lúc không bị trùng mã.
6. **Rà soát hằng tuần.** Người giữ file lọc các dòng "Chưa tìm" để giao (trên Google Docs dùng Nhận xét gán @tên) và các dòng "Có nguồn" để giao người kiểm chứng.

## 3. Quy ước

### 3.1. Mã

| Tiền tố | Dùng cho | Ví dụ |
| --- | --- | --- |
| `TL-xxx` | Tài liệu bên ngoài (bài báo, sách, datasheet, văn bản pháp luật, trang tài liệu chính thức) — mục 4 | `TL-201` |
| `KD-xx` | Khẳng định / con số cần minh chứng — mục 5 | `KD-01` |
| `MC-xxx` | Minh chứng do nhóm tự tạo (ảnh, số đo, log, video, biên bản) — mục 6, 7 | `MC-501` |

### 3.2. Mức tin cậy của nguồn

| Mức | Loại nguồn |
| --- | --- |
| **A** | Bài báo có bình duyệt, sách chuyên khảo, tiêu chuẩn (TCVN/ISO/IEEE), văn bản pháp luật, datasheet của chính hãng sản xuất chip/thiết bị |
| **B** | Tài liệu chính thức của tổ chức hoặc dự án (trang docs, đặc tả giao thức), luận văn/luận án, báo cáo của cơ quan nhà nước, viện, trường |
| **C** | Tài liệu của nhà cung cấp/đại lý, tài liệu kỹ thuật ngành không bình duyệt, báo chí |
| **D** | Xác nhận của người nuôi yến / Domain Expert (phải có biên bản ở mục 7), số đo của nhóm (mục 6) |

Một con số dùng làm **ngưỡng mặc định** nên có ít nhất một nguồn mức A hoặc B, hoặc một xác nhận mức D có biên bản.

### 3.3. Trạng thái

| Trạng thái | Nghĩa |
| --- | --- |
| Chưa tìm | Chưa ai nhận |
| Đang tìm | Có người nhận (ghi tên ở cột "Phụ trách"), chưa có kết quả |
| Có nguồn | Đã ghi nguồn, chưa có người thứ hai kiểm lại |
| Đã kiểm chứng | Người thứ hai đã mở nguồn và thấy đúng |
| Lệch nguồn | Nguồn có số khác với số đang dùng — ghi rõ chênh lệch và đề xuất sửa |
| Không có nguồn | Đã tìm, không có — là giả định, ghi cách xử lý |
| Loại | Nguồn bị loại, ghi lý do |

### 3.4. Cách trích dẫn

Dùng kiểu **IEEE** (thống nhất với báo cáo KLTN):

- Bài báo: `Tác giả, "Tên bài," *Tên tạp chí*, tập, số, trang, năm. DOI: …`
- Sách: `Tác giả, *Tên sách*, lần xuất bản. Nơi XB: NXB, năm.`
- Datasheet / trang web: `Hãng, "Tên tài liệu," phiên bản/ngày. [Online]. Available: URL (truy cập dd/mm/yyyy).`
- Văn bản pháp luật: `Cơ quan ban hành, Số/ký hiệu, "Tên văn bản," ngày ban hành.`

---

## 4. Danh mục tài liệu (`TL-xxx`)

Mỗi tài liệu một dòng. Thêm dòng vào đúng nhóm; số `TL` lấy trong dải của người thêm (mục 2.2), không dùng lại số đã xoá.

### 4.0. Nguồn ứng viên chờ kiểm (chưa cấp mã `TL`)

Tìm được khi soạn Report 3 (23/10/2026), mới đọc phần tóm tắt hoặc trang giới thiệu. Nghị định 13/2020/NĐ-CP Điều 25 đã được chuyển sang 4.2 (TL-421), nên không còn ở đây. Người trong nhóm đọc bản đầy đủ, rồi chuyển sang đúng bảng bên dưới với mã `TL` của mình (mục 2.2) và xoá dòng ở đây.

| Nguồn | Link | Nội dung (theo tóm tắt) | Dùng cho |
| --- | --- | --- | --- |
| MS 2273:2012 – Good animal husbandry practice: edible-nest swiftlet ranching (Standards Malaysia) | https://mysol.jsm.gov.my | Tiêu chuẩn thực hành nuôi yến nhà; phải mua bản đầy đủ | BR-01, REF-9 |
| Master house ở Malaysia, Journal of Sustainability Science and Management 16(4), 2021 | https://jssm.umt.edu.my/wp-content/uploads/2021/07/9-16.4.pdf | Trung bình 28,3 °C, 82,6 % trong 2010–2016 | BR-01, REF-11 |
| 30 nhà yến ở Terengganu, Journal of Sustainability Science and Management 13(1) | https://jssm.umt.edu.my/wp-content/uploads/2020/05/bab-11-13.1.pdf | Nhà cho nhiều tổ: 30,1 °C, 83,7 %, 0,16 lux | BR-01, REF-11 |
| Hướng dẫn xây nhà yến, JCEST (UNIMAS) | https://publisher.unimas.my/ojs/index.php/JCEST/article/view/67/44 | 26–35 °C, độ ẩm 80–90 % | BR-01, REF-11 |
| Nhà yến ở Thái Lan, Burapha Science Journal | https://li05.tci-thaijo.org/index.php/buuscij/article/view/522 | 30,3–32,9 °C, 79–88 % | BR-01, REF-11 |
| Hang tự nhiên ở Thái Lan, Thai Natural History | https://li01.tci-thaijo.org/index.php/tnh/article/download/102854/82398/260008 | 27–32 °C, 64–81 % | BR-01, REF-11 |
| Atiu swiftlet, đếm chim ra/vào sáng và chiều ở cửa hang | https://resolve.cambridge.org/core/services/aop-cambridge-core/content/view/0163B5B5027B06D0794A269BA30CBCC8/S095927091000016Xa.pdf | Đếm ra/vào sáng, chiều để ước lượng quần thể | Cách đếm (REF-12) |
| Gorresen và cộng sự, Endangered Species Research, 2024 | https://doaj.org/article/38bb7ef9e8454747982435d5a6cbe928 | Video nhiệt và hồng ngoại để đếm chim yến ở cửa hang; nêu các nguồn sai số của cách đếm | Cách đếm, sai số (REF-12, NFR-09) |

Lưu ý: các nghiên cứu trên đặt mức sàn độ ẩm khoảng 80 %, BR-01 đang dùng 75 % — hỏi người nuôi yến ở biên bản (mục 7).

### 4.1. Nuôi chim yến & vi khí hậu nhà yến

| Mã | Trích dẫn (IEEE) | Link / DOI | Mức | Nội dung liên quan | Phạm vi áp dụng (loài, nơi đo) | Bản lưu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| TL-5xx | | | | | | | | |

### 4.2. Pháp lý & quy chuẩn Việt Nam

| Mã | Trích dẫn (IEEE) | Link | Mức | Điều/khoản liên quan | Ảnh hưởng tới hệ thống | Bản lưu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| | Chính phủ, Nghị định 13/2020/NĐ-CP, điều 25 | [Quy định thời gian phát loa dẫn dụ](https://thuvienphapluat.vn/hoi-dap-phap-luat/nha-nuoi-yen-duoc-su-dung-loa-thu-hut-yen-toi-may-gio-371091.html) | C | Khoản 2 điểm d: loa ≤ 70 dBA đo tại miệng loa; phát 5:00–11:30 và 13:30–19:00. Điểm đ: nhà yến cũ không đạt khoản 1 điểm a, nằm trong hoặc cách khu dân cư dưới 300 m thì không dùng loa. | Giới hạn lịch loa (`SPEAKER_WINDOW`) và âm lượng tối đa | | | |
| TL-421 | Chính phủ, Nghị định số 13/2020/NĐ-CP, "Nghị định hướng dẫn chi tiết Luật Chăn nuôi," 21/01/2020. | [Nghị định số 13/2020/NĐ-CP của Chính phủ: Hướng dẫn chi tiết Luật Chăn nuôi](https://vanban.chinhphu.vn/default.aspx?pageid=27160&docid=198924) | A | Điều 25 (Khoản 1; Khoản 2 điểm c, d, đ) | - Ràng buộc khung giờ cho phép phát loa dẫn dụ (5h00–11h30 và 13h30–19h00); khung mặc định của hệ thống (5–7h, 17–19h) tuân thủ đúng luật.<br>- Giới hạn cường độ âm thanh tại miệng loa ≤ 70 dBA và cấm phát loa nếu cách khu dân cư < 300 m.<br>- Yêu cầu lưu trữ hồ sơ hoạt động nuôi yến (cơ sở cho tính năng lưu log tự động của hệ thống). | <https://drive.google.com/file/d/1nS2ham8s7e3Ij_MVOOCmivZM-TQdr4cQ/view?usp=drive_link> | M4 (Tuấn) | 26/10/2026 |
| | | | | | | | | |

### 4.3. Chất lượng không khí (NH3, CO2) và tiếng ồn

| Mã | Trích dẫn (IEEE) | Link / DOI | Mức | Nội dung liên quan | Phạm vi áp dụng (người / vật nuôi nào) | Bản lưu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| | | [Nồng độ NH3 trong nhà yến](https://nikodo.vn/ky-thuat-doi-luu-khong-khi-nha-yen-khac-phuc-to-yen-bi-vang) | C | Nồng độ NH3 vượt ngưỡng làm ảnh hưởng đến màu sắc của tổ yến (chuyển vàng theo nồng độ vượt ngưỡng).<br>Tốc độ đối lưu gió | Nhà yến | | | |
| | | | | | | | | |

### 4.4. Datasheet & tài liệu thiết bị

| Mã | Trích dẫn (IEEE) | Link | Mức | Thiết bị | Thông số dùng trong hệ thống | Bản lưu | Người thêm | Ngày truy cập |
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
| TL-481 | A. M. Markom, Y. Yusof, M. A. Markom, H. Haris, and A. R. Muhammad, "Digital technologies evolution in swiftlet farming: a systematic literature review," *Int. J. Electr. Comput. Eng. (IJECE)*, vol. 14, no. 4, pp. 4456–4470, Aug. 2024. | <https://doi.org/10.11591/ijece.v14i4.pp4456-4470> | A | Tổng hợp hệ thống (SLR) 16 công trình nghiên cứu công nghệ số trong nhà yến (tại Malaysia, Việt Nam, Indonesia...) gồm: giám sát và điều khiển vi khí hậu qua IoT/WSN (Raspberry Pi, ESP32, Web/App), phát hiện chim và quản lý bền vững. | Các hệ thống được tổng hợp chủ yếu dừng ở giám sát thông số cơ bản (nhiệt độ, độ ẩm, ánh sáng) hoặc bật/tắt theo ngưỡng; chưa kết hợp đồng thời bộ điều khiển mờ Sugeno đa biến, cơ chế tự phát hiện sự cố phần cứng (bơm khô, hỏng loa, cảm biến kẹt/nhảy) và pipeline đếm chim thời gian thực bằng YOLOv8n + ByteTrack như SwiftletCare. | M4 (Tuấn) | 26/10/2026 |
| TL-482 | S. Al-Kabir, F. Al-Gharyani, and A. Al-Toumi, "Design and implementation of an IoT-based automated system for monitoring and regulating temperature, humidity, lighting, and ventilation in swiftlet houses using DHT22 sensors, NodeMCU, and a Web-based interface," *Int. J. Electron. Devices Netw.*, vol. 5, no. 2, pp. 30–35, 2024 | <https://doi.org/10.22271/27084477.2024.v5.i2a.63> | A | Thiết kế hệ thống IoT dùng cảm biến DHT22, vi điều khiển NodeMCU ESP8266 và relay để giám sát, tự động đóng/ngắt quạt DC, đèn LED, máy tạo ẩm theo ngưỡng cố định (25–30 °C, 80–90 %RH) và hiển thị lên Web dashboard (PHP/MySQL). | - Họ điều khiển bật/tắt (ON/OFF) theo ngưỡng cứng; SwiftletCare dùng điều khiển mờ Sugeno kết hợp time-proportioning.<br>- Họ phụ thuộc hoàn toàn vào Wi-Fi và dễ bị gián đoạn khi mất điện/mạng, không có thuật toán phát hiện lỗi thiết bị (bơm cạn, hỏng loa, lỗi cảm biến) và không có module AI đếm chim qua lỗ ra vào. | M4 (Tuấn) | 26/10/2026 |
| | | | | | | | |

### 4.9. Thị trường & kinh tế ngành yến

| Mã | Trích dẫn (IEEE) | Link | Mức | Con số | Thời điểm của số liệu | Người thêm | Ngày truy cập |
| --- | --- | --- | :---: | --- | --- | --- | --- |
| TL-491 | T. Minh, "Tiền Giang: Tổ yến chờ xuất khẩu chính ngạch sang Trung Quốc," *Báo Nông nghiệp Việt Nam*, 28/03/2023. | <https://nongsanviet.nongnghiep.vn/tien-giang-to-yen-cho-xuat-khau-chinh-ngach-sang-trung-quoc-d346958.html> | C | - Giá yến thô chưa sơ chế: 17 triệu đồng/kg; yến thô đã sơ chế: 25 triệu đồng/kg; yến tinh chế: 35–42 triệu đồng/kg.<br>- Quy mô cả nước: ~23.800 nhà yến, sản lượng 150–200 tấn/năm, xuất khẩu tiểu ngạch thu về 200–300 triệu USD/năm. | Tháng 03/2023 | M4 (Tuấn) | 26/10/2026 |
| TL-492 | P. T. Anh, "Yến sào bứt tốc, kỳ vọng tỷ đô," *Báo Nông nghiệp Việt Nam*, 03/01/2024 | <https://nongnghiep.vn/yen-sao-but-toc-ky-vong-ty-do-d372489.html> | C | - Giá yến làm sạch bán lẻ: > 30 triệu đồng/kg.<br>- Quy mô cả nước (trên 43 tỉnh, thành): ~24.000 nhà yến, sản lượng 120–150 tấn/năm, tổng giá trị ngành đạt 500–600 triệu USD. | Đầu năm 2024 | M4 (Tuấn) | 26/10/2026 |
| | | | | | | | |

---

## 5. Bảng truy vết: khẳng định → minh chứng (`KD-xx`)

Danh sách dưới đây lấy từ Report 3 và code (đối chiếu lại 30/10/2026); cột "Dùng ở đâu" chỉ chỗ con số đang nằm. Khi điền:

- **Nguồn**: mã `TL-xxx` và/hoặc `MC-xxx`, có thể nhiều mã.
- **Trích đoạn & vị trí**: trang/bảng/mục + câu trích ngắn có chứa con số.
- Nếu nguồn cho số khác, đặt **Lệch nguồn** và ghi số của nguồn — **không tự sửa Report 3/code trong file này**, sửa bằng PR riêng.

### 5.1. Ngưỡng môi trường mặc định (ENV-FR-007)

| Mã | Khẳng định | Giá trị đang dùng | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-01 | Nhiệt độ thích hợp trong nhà yến | 26–31 °C | Report 3 BR-01 (ENV-FR-007); firmware `Config.h` `DEFAULT_TEMP_MIN/MAX`; backend `utils/thresholds.util.ts` | [sách kỹ thuật nuôi chim yến khoa học và thực tiễn, NXB khoa học - công nghệ - truyền thông, tác giả Lê Hữu Hoàng](https://ebook365.vn/ky-thuat-nuoi-chim-yen-khoa-hoc-va-thuc-tien-r8GlW.html) | chương 1. trang 22: "môi trường sống vi mô của chim yến phải đảm bảo các điều kiện thích hợp + nhiệt độ không khí nằm trong phạm vi 27-31 độ C…" | A | có nguồn | M3 |
| KD-02 | Độ ẩm thích hợp trong nhà yến | 75–95 %RH | Report 3 BR-01 (ENV-FR-007); firmware `DEFAULT_HUMIDITY_MIN/MAX`; backend `thresholds.util.ts` | [sách kỹ thuật nuôi chim yến khoa học và thực tiễn, NXB khoa học - công nghệ - truyền thông, tác giả Lê Hữu Hoàng](https://ebook365.vn/ky-thuat-nuoi-chim-yen-khoa-hoc-va-thuc-tien-r8GlW.html) | chương 1. trang 22: "môi trường sống vi mô của chim yến phải đảm bảo các điều kiện thích hợp + độ ẩm không khí 70-85%" | A | lệch nguồn | M3 |
| KD-03 | Nhà yến cần tối gần như hoàn toàn | ánh sáng < 0.2 lux | Report 3 BR-01 (ENV-FR-007); firmware `DEFAULT_LIGHT_MAX`; backend `thresholds.util.ts` | [sách kỹ thuật nuôi chim yến khoa học và thực tiễn, NXB khoa học - công nghệ - truyền thông, tác giả Lê Hữu Hoàng](https://ebook365.vn/ky-thuat-nuoi-chim-yen-khoa-hoc-va-thuc-tien-r8GlW.html) | chương 1. trang 22: "môi trường sống vi mô của chim yến phải đảm bảo các điều kiện thích hợp + ánh sáng nhỏ hơn 0,4 lux" | A | lệch nguồn | M3 |
| KD-04 | Ngưỡng cảnh báo NH3 | < 25 ppm (**tạm**, Report 3 C-2: chưa có nguồn riêng cho nhà yến) | Report 3 BR-02, C-2; backend `thresholds.util.ts` (`nh3_max`); firmware không giữ ngưỡng NH3 | | | | Chưa tìm | M3 |
| KD-05 | Ngưỡng cảnh báo CO2 | < 1500 ppm (**tạm**, như trên) | Report 3 BR-02, C-2; backend `thresholds.util.ts` (`co2_max`); firmware không giữ ngưỡng CO2 | | | | Chưa tìm | M3 |
| KD-06 | Độ ẩm < 75 % hoặc nhiệt độ > 31 °C gây thoái hoá tổ, chim bỏ tổ, chim non chết nhiều | < 75 %RH / > 31 °C | `SwiftletCare_SRS.md` §2.1 (bối cảnh; Report 3 không nhắc lại) | <https://faolex.fao.org/docs/pdf/vie223792.pdf> | phần 3. kỹ thuật xây dựng nhà nuôi chim yến. vận hành hệ thống tạo ẩm, nhiệt, thông gió: "Những nhà yến lâu năm đã nhiều chim, nhiều phân chim cần lưu ý phun sương làm mát đảm bảo vì hơi nóng của chim và sự phân giải phân chim tỏa nhiều nhiệt, nhà thường bị nóng, chim dễ bị stress và bỏ đi. " | | Chưa tìm | M3 |
| KD-07 | NH3 trong nhà yến chủ yếu từ phân chim; người nuôi dùng phân để dẫn dụ | — | Report 3 C-2 | | | | Chưa tìm | M3 |

### 5.2. Vận hành & tập tính chim yến

| Mã | Khẳng định | Giá trị đang dùng | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-10 | Loa dẫn dụ phát vào giờ chim ra/vào tổ | 5–7 h và 17–19 h | Report 3 BR-07, ENV-FR-013b; firmware `SPEAKER_WINDOW_*` | [sách kỹ thuật nuôi chim yến khoa học và thực tiễn, NXB khoa học - công nghệ - truyền thông, tác giả Lê Hữu Hoàng](https://ebook365.vn/ky-thuat-nuoi-chim-yen-khoa-hoc-va-thuc-tien-r8GlW.html) | chương 5 trang 163 : "gian. Thời gian mở âm thanh ngoài trời buổi sáng từ 5h30 đến 11h30, buổi chiều từ 13h30 đến 19h tùy theo mùa và theo vùng, miền. " | A | có nguồn | M5 |
| KD-11 | Chim rời tổ buổi sáng, về tổ buổi chiều (cơ sở để chia phiên đếm sáng/chiều) | phiên sáng 05:30–07:00 / phiên chiều 17:30–19:00 (mặc định, Report 3 BR-13) | Report 3 BR-12, BR-13, VISION-FR-009, VISION-FR-019; `ai-pipeline/config/config.yaml` (`sessions`) | [sách kỹ thuật nuôi chim yến khoa học và thực tiễn, NXB khoa học - công nghệ - truyền thông, tác giả Lê Hữu Hoàng](https://ebook365.vn/ky-thuat-nuoi-chim-yen-khoa-hoc-va-thuc-tien-r8GlW.html) | chương 1 trang 19: "+thời gian đi : 5h00-5h30, vào mùa đông thì trễ hơn lúc 6h00 +thời gian về 18h00-18h30, vào mùa đông thì sớm hơn vào lúc 17h30" | A | có nguồn | M5 |
| KD-12 | Tỷ lệ chim về là chỉ số then chốt đánh giá sức khoẻ đàn và dự báo năng suất | — | `SwiftletCare_SRS.md` §2.1; Report 3 BR-12, BR-28 | | | | Chưa tìm | M5 |
| KD-13 | Phun sương làm tăng độ ẩm, quạt làm giảm nhiệt trong nhà yến (hai cơ cấu chấp hành của vòng điều khiển) | — | Report 3 ENV-FR-010, ENV-FR-011 | [sách kỹ thuật nuôi chim yến khoa học và thực tiễn, NXB khoa học - công nghệ - truyền thông, tác giả Lê Hữu Hoàng](https://ebook365.vn/ky-thuat-nuoi-chim-yen-khoa-hoc-va-thuc-tien-r8GlW.html) | chương 5. trang 165: "Phun sương bên trong nhà yến có tác dụng tăng độ ẩm và duy trì độ ẩm trong nhà yến đạt trên 75%. Phun sương bên trong còn làm giảm nhiệt độ bên trong nhà yến vào mùa nắng nóng. " | A | có nguồn | M5 |
| KD-14 | Đèn hồng ngoại 850 nm có ánh đỏ nhìn thấy được, có thể làm chim khó chịu; 940 nm an toàn hơn | IR 850 nm | `docs/bird-counting-plan.md` §3.2, §19.5 (cổng kiểm tra 6) | <https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0110832> | đầu ra bước sóng hồng ngoại : "phạm vi chiếu hồng ngoai….rõ ràng đang sử dụng công nghệ hồng ngoại với bước sóng hoạt động trên 850 nm. Các đèn LED hồng ngoại này phát ra ánh sáng gần như vô hình đối với mắt người, nhưng lại có thể nhìn thấy đối với một số loài động vật. " | A | có nguồn | M5 |
| KD-15 | Một nhà yến đã có đàn chim cần được kiểm chứng bởi người có chuyên môn (lý do có vai trò Domain Expert) | — | Report 3 §2.3 (Domain Expert), BR-22, A-6 | | | | Chưa tìm | M5 |

### 5.3. Tham số phát hiện sự cố (EXPERT-FR-008, mặc định do code chọn)

Report 3 (BR-09) ghi các số này là mặc định kỹ thuật, Domain Expert chỉnh được theo Zone. Mục tiêu ở đây: tìm nguồn hoặc số đo hỗ trợ, nếu không có thì giữ trạng thái **Không có nguồn** và ghi là "giả định, chờ hiệu chỉnh bằng dữ liệu thật".

| Mã | Khẳng định | Giá trị mặc định (khoảng hợp lệ) | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-20 | Ồn bất thường: cao hơn mức nền của giờ đó | 15 dB (5–30) | firmware `DEFAULT_NOISE_MARGIN_DB`; backend `detectionTuning.util.ts`; Report 3 THREAT-FR-007, BR-09a | | | | Chưa tìm | M1 |
| KD-21 | Ồn bất thường: số giây vượt trong cửa sổ 15 giây | 10 s (5–15) | firmware `DEFAULT_NOISE_MIN_SEC`; Report 3 BR-09b | | | | Chưa tìm | M1 |
| KD-22 | Mức nền tiếng ồn = phân vị 90 theo từng giờ, học khi loa tắt | P90 × 24 giờ | Report 3 THREAT-FR-007; firmware `sensors/NoiseAnomalyDetector` | | | | Chưa tìm | M1 |
| KD-23 | Bơm khô (`MISTING_INEFFECTIVE`, tên cũ `PUMP_DRY`): thời gian bơm bật cộng dồn trước khi xét | 300 s (120–900) | firmware `DEFAULT_PUMP_DRY_ON_SEC` (hằng số giữ tên cũ); Report 3 THREAT-FR-011, BR-09c | | | | Chưa tìm | M1 |
| KD-24 | Bơm khô: độ ẩm phải tăng tối thiểu | 2 %RH (0.5–10) | firmware `DEFAULT_PUMP_DRY_MIN_RISE_PCT`; Report 3 BR-09d | | | | Chưa tìm | M1 |
| KD-25 | Hỏng loa: mức âm giảm so với nền | 70 % (30–90) | firmware `DEFAULT_SPEAKER_DROP_PCT`; Report 3 THREAT-FR-006, BR-09e | | | | Chưa tìm | M1 |
| KD-26 | Tỷ lệ chim về giảm so với trung bình tối đa 7 ngày trước (cần ≥ 3 ngày có tỷ lệ) thì cảnh báo `LOW_RETURN_RATE` | 20 % (5–50) | backend `houses.bird_count_tuning.return_rate_drop_pct` (tham số theo **House**, `DEFAULT_BIRD_COUNT_TUNING` trong `detectionTuning.util.ts`); Report 3 VISION-FR-011, BR-09f, BR-21 | | | | Chưa tìm | M1 |
| KD-27 | Cảm biến bất thường: nhiệt/ẩm đứng yên ≥ 2 giờ; nhảy ≥ 3 lần liên tiếp quá 2 °C / 10 %RH / 20 ppm NH3 / 500 ppm CO2; hai thiết bị cùng zone lệch > 2 °C / 8 %RH trên trung bình 1 giờ | như bên trái | Report 3 ALERT-FR-010, BR-14; backend `utils/sensorAnomaly.util.ts` | | | | Chưa tìm | M1 |

### 5.4. Bộ điều khiển mờ (ENV-FR-010/011/021)

| Mã | Khẳng định | Giá trị mặc định (khoảng hợp lệ) | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-30 | Dùng logic mờ Sugeno (thay vì bật/tắt theo ngưỡng) để điều khiển phun sương và quạt | — | Report 3 ENV-FR-010, ENV-FR-011; firmware `pid/FuzzyControl.cpp`; backend `utils/fuzzyModel.util.ts` | <https://vbpo.com.vn/fuzzy-logic-la-gi/> | trong bài | C | có nguồn | M1 |
| KD-31 | Độ rộng vùng chuyển tiếp độ ẩm | 8 %RH (2–20) | firmware `DEFAULT_FUZZY_HUMIDITY_BAND`; backend `fuzzyTuning.util.ts`; Report 3 BR-05, ENV-FR-021 | | | | Chưa tìm | M1 |
| KD-32 | Độ rộng vùng nóng | 4 °C (1–10) | firmware `DEFAULT_FUZZY_TEMP_BAND`; backend `fuzzyTuning.util.ts`; Report 3 BR-05, ENV-FR-021 | | | | Chưa tìm | M1 |
| KD-33 | Mức quạt khi nóng mà khô | 40 % (0–100) | firmware `DEFAULT_FUZZY_FAN_DRY_LEVEL`; backend `fuzzyTuning.util.ts`; Report 3 BR-05, ENV-FR-021 | | | | Chưa tìm | M1 |
| KD-34 | Điều khiển theo tỷ lệ thời gian (time-proportioning) với cửa sổ | 120 s (60–600) | firmware `DEFAULT_FUZZY_WINDOW_SEC`; backend `fuzzyTuning.util.ts`; Report 3 BR-05, ENV-FR-021 | | | | Chưa tìm | M1 |
| KD-35 | Chu kỳ đọc cảm biến 1 Hz, quyết định điều khiển mỗi 10 giây | 1 s / 10 s | Report 3 ENV-FR-002, NFR-05; firmware `SENSOR_INTERVAL_MS`, `PID_INTERVAL_MS` | | | | Chưa tìm | M1 |

### 5.5. Đếm chim & AI (Module VISION)

| Mã | Khẳng định | Giá trị | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-40 | YOLOv8n đủ nhẹ để phát hiện chim thời gian thực (25 fps). Nhóm dùng YOLOv8n hoặc YOLO11n, chưa chốt bản cuối (so ở plan §7.9) | YOLOv8n hoặc YOLO11n, ONNX Runtime | Report 3 NFR-04, VISION-FR-002; `docs/bird-counting-plan.md` §7.9 | <https://roboflow.com/blog/what-is-yolov8> | trong bài | A | có nguồn | M2 |
| KD-41 | ByteTrack giữ được ID từng con chim để đếm qua vòng quanh miệng lỗ | ByteTrack | Report 3 §2.5, BR-25; `ai-pipeline/src/pipeline.py` (`sv.ByteTrack`), `counting.py` | <https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2025.1524134/full> | 3. The method / System Pipeline | A | có nguồn | M2 |
| KD-42 | Đánh giá phát hiện bằng Precision, Recall (IoU ≥ 0.5, mAP50 trong plan); đánh giá đếm bằng sai số so với đếm tay, tách đủ sáng / thiếu sáng | Precision ≥ 0.80, Recall ≥ 0.80 | Report 3 NFR-09 (a), VISION-FR-016; plan §7.7 | | | | Chưa tìm | M2 |
| KD-43 | Ngưỡng sai số đếm theo từng chiều, trên 20 clip 5 phút (10 ban ngày, 10 thiếu sáng) | ≤ 10 % (Report 3 NFR-09 (b); plan §7.7 còn ghi "đề xuất nội bộ, phiếu không cam kết" và 6 clip) | Report 3 NFR-09 (b); `docs/bird-counting-plan.md` §7.7 | | | | Chưa tìm | M2 |
| KD-44 | Không có bộ dữ liệu công khai quay chim yến bay qua lỗ ra vào | tra cứu 10/2026 | `docs/bird-counting-plan.md` §7.8 | | | | Chưa tìm | M2 |
| KD-45 | Dữ liệu ngoài (FBD-SV-2024, SOD4SB, Roboflow…) — giấy phép cho phép dùng | — | `docs/bird-counting-plan.md` §7.8 | | | | Chưa tìm | M2 |
| KD-46 | Nút AI xử lý kịp luồng camera | ≥ tốc độ khung hình camera: 25 fps (VIGI C320I luồng chính; Report 3 và plan cùng ghi 25 fps) | Report 3 NFR-04; `docs/bird-counting-plan.md` §6.1, §19.3 | | | | Chưa tìm | M2 |

### 5.6. Kinh tế & bối cảnh

| Mã | Khẳng định | Giá trị | Dùng ở đâu | Nguồn | Trích đoạn & vị trí | Mức | Trạng thái | Phụ trách |
| --- | --- | --- | --- | --- | --- | :---: | --- | --- |
| KD-50 | Giá tổ yến | 20–60 triệu đồng/kg | `SwiftletCare_SRS.md` §2.1 | TL-491, TL-492 | - **TL-491** (Đoạn 2 trong bài): "Giá tổ yến thô chưa qua sơ chế đạt 17 triệu đồng/kg; tổ yến thô đã qua sơ chế có giá 25 triệu đồng/kg; còn đối với tổ yến tinh chế có giá từ 35 triệu đến 42 triệu đồng/kg."<br>- **TL-492** (Đoạn 3 trong bài): *"...tổ yến của gia đình chủ yếu bán lẻ với giá thành hơn 30 triệu đồng/kg (khi được làm sạch)..."*<br>*(Ghi chú: Giá yến sơ chế và tinh chế 25–42 triệu đồng/kg nằm trong khoảng 20–60 triệu đồng/kg của SRS).* | C | Có nguồn | M4 (Tuấn) |
| KD-51 | Nuôi yến là ngành có giá trị kinh tế cao ở Việt Nam | — | `SwiftletCare_SRS.md` §2.1 | TL-491, TL-492 | - **TL-492** (Mục "*Cần tạo chuỗi liên kết*", đoạn 4): "Theo ông Phạm Duy Khiêm, tính sơ bộ hiện nay, cả nước có trên 43 tỉnh, thành, với khoảng 24.000 nhà yến, tổng sản lượng thu hoạch khoảng 120 - 150 tấn tổ yến mỗi năm, giá trị từ 500-600 triệu USD."<br>- **TL-491** (Mục "Loay hoay tìm thị trường", đoạn 4): *"Cả nước hiện có khoảng 23.800 nhà yến với sản lượng từ 150 - 200 tấn mỗi năm. Thời gian qua, tổ yến Việt Nam được xuất khẩu bằng đường tiểu ngạch sang Trung Quốc thu về mỗi năm khoảng 200 - 300 triệu USD."* | C | Có nguồn | M4 (Tuấn) |
| KD-52 | Phần lớn người nuôi dùng cảm biến rời, kiểm tra thủ công nhiều lần/ngày | — | `SwiftletCare_SRS.md` §2.1 | TL-481, TL-482 | - **TL-481** (Section 1. Introduction, trang 4456): "Traditional agricultural operations mostly depend on physical labor and basic strategies for collecting nests, maintaining habitats, and managing birds." (Hoạt động nuôi truyền thống chủ yếu phụ thuộc vào lao động thủ công và các phương pháp cơ bản để duy trì môi trường sống và quản lý đàn chim).<br>- **TL-482** (Introduction, trang 30–31): *"However, traditional methods of managing these parameters are labor-intensive, inconsistent, and prone to human error [1-3]... Existing systems often lack integration, require significant manual oversight, or are financially prohibitive for small-scale farmers [7-9]."* (Các phương pháp truyền thống tốn nhiều công sức, thiếu nhất quán, dễ sai sót; các hệ thống hiện có thường rời rạc, thiếu tích hợp và đòi hỏi giám sát thủ công lớn). | A | Có nguồn | M4 (Tuấn) |
| KD-53 | Sự cố thiết bị (hỏng loa, bơm cạn, cảm biến sai, mất điện) thường phát hiện muộn | — | `SwiftletCare_SRS.md` §2.1 | TL-481, TL-482 | - **TL-481** (Section 1. Introduction, trang 4457 & Section 3): "*Traditional farmers frequently face challenges in monitoring environmental conditions inside swiftlet habitats, resulting in poor nest production and possible health risks for the birds*." và "*Huynh et al. highlight the significant losses incurred by about 23,665 swiftlet houses in 63 Vietnamese districts as a result of insufficiently effective environmental parameter monitoring and control.*"<br>- **TL-482** (Critical Analysis, trang 34): *"Firstly, the system's dependency on Wi-Fi connectivity introduces a vulnerability in regions with unreliable internet infrastructure. Secondly, external environmental factors such as seasonal shifts or sudden power outages may still disrupt the automated controls."*<br>*(Ghi chú phạm vi: Nguồn chứng minh việc giám sát thủ công / thiếu tích hợp gây phát hiện muộn biến động môi trường và rủi ro gián đoạn do mất điện, mất Wi-Fi; các lỗi phần cứng cụ thể như hỏng loa, bơm cạn được xác nhận bổ sung từ thực tế người nuôi yến tại Mục 7).* | A | Có Nguồn | M4 (Tuấn) |
| KD-54 | Điều kiện pháp lý khi xây và vận hành nhà yến (vị trí, loa phóng thanh…) | Loa ≤ 70 dBA; giờ phát: 5h00–11h30 và 13h30–19h00; cách khu dân cư ≥ 300 m (nếu dùng loa) | Report 3 BR-07, REF-10 | TL-421 | Điều 25, Khoản 1 (điểm a, b) và Khoản 2 (điểm c, d, đ):<br>- Điểm d Khoản 2: *"Thiết bị phát âm thanh để dẫn dụ chim yến có cường độ âm thanh đo tại miệng loa không vượt quá 70 dBA (đề xi ben A); thời gian phát loa phóng để dẫn dụ chim yến từ 5 giờ đến 11 giờ 30 và từ 13 giờ 30 đến 19 giờ mỗi ngày, trừ trường hợp quy định tại điểm đ khoản này;"*<br>- Điểm đ Khoản 2: *"...nhà yến nằm trong khu dân cư, nhà yến cách khu dân cư dưới 300 m thì không được sử dụng loa phóng phát âm thanh;"* | A | Có Nguồn | M4 (Tuấn) |

### 5.7. Giả định kỹ thuật đã biết là chưa có nguồn (Report 3 §4.5)

Những mốc này Report 3 §4.5 đã ghi là do người viết code chọn. Không cần tìm tài liệu nuôi yến cho chúng; cần **số đo thực tế** (mục 6) hoặc xác nhận của nhóm/Domain Expert. Khi có, điền mã `MC-xxx` và cập nhật Report 3 §4.5 bằng PR riêng.

| Mã | Mốc | Giá trị | Ở đâu | Minh chứng (`MC-xxx`) | Kết luận | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| KD-60 | Tự thử phun lại sau khi chốt bơm khô | 30 phút | firmware `PUMP_DRY_RETRY_MIN` (`Config.h`); Report 3 BR-11 | | | Không có nguồn |
| KD-61 | Độ ẩm còn tính là hợp lệ | tới 101 % | firmware `HUMIDITY_SATURATION_MAX` (`pid/FuzzyControl.h`), backend `utils/fuzzyModel.util.ts`; Report 3 §4.5, THREAT-FR-013 | | | Không có nguồn |
| KD-62 | Gửi lại cảnh báo theo đợt | 15 phút | firmware `EPISODE_ALERT_RESEND_MS` (`Config.h`); Report 3 BR-16 | | | Không có nguồn |
| KD-63 | Tự đóng cảnh báo theo đợt | 60 phút | backend `EPISODE_CLEAR_MS` (`services/alert.service.ts`); Report 3 BR-16 | | | Không có nguồn |
| KD-64 | Số đo nhiệt-ẩm hợp lệ gần nhất còn dùng được | 2 chu kỳ (20 s) | firmware `CONTROL_INPUT_MAX_AGE_CYCLES` (`Config.h`); Report 3 BR-18 | | | Không có nguồn |
| KD-65 | Bỏ qua bản tin AUTO sau khi vừa bật tay | 30 s | backend `DEVICE_CONFIRM_GRACE_MS` (`services/relayOverrideLog.service.ts`); Report 3 §4.5 | | | Không có nguồn |
| KD-66 | Thời hạn của 1 lần can thiệp tay | bơm BẬT 1–30 phút; các trường hợp còn lại 1 phút – 24 giờ (Report 3 BR-08). Code hiện chỉ giới hạn 1 phút – 24 giờ cho mọi relay, chưa có mức 30 phút của bơm (gap G-06) | backend `MAX_OVERRIDE_MS`, `MIN_OVERRIDE_MS` (`services/device.service.ts`); Report 3 BR-08, §4.5 | | | Không có nguồn |

---

## 6. Minh chứng do nhóm tạo (`MC-xxx`)

Ảnh lắp đặt, số đo, log, video, kết quả test. Đây là bằng chứng mạnh nhất cho phần "hệ thống chạy thật" (Report 3 §7.1, mục 3.2 b của phiếu).

| Mã | Loại | Mô tả (cái gì, đo ở đâu, điều kiện) | Thời gian | Người tạo | Nơi lưu (link thư mục chung / file trong `docs/test-reports/`) | Chứng minh cho (`KD-xx` / FR) |
| --- | --- | --- | --- | --- | --- | --- |
| MC-xxx | | | | | | |

Gợi ý những minh chứng còn thiếu (theo Report 3 §7.1, mục 3.2 b của phiếu):

- Ảnh/video bộ điều khiển đã lắp (hộp, dây, nhãn) và tại nhà yến.
- Số đo nhiệt độ, độ ẩm, ánh sáng, NH3, CO2, tiếng ồn ở nhà yến thật (xuất từ hệ thống, ghi rõ khoảng thời gian).
- Tỷ lệ thời gian tự động và tỷ lệ thời gian trong ngưỡng (ANALYTICS-FR-008, ANALYTICS-FR-011).
- Bảng độ chính xác đếm chim: Precision, Recall, sai số đếm, tách đủ sáng / thiếu sáng (NFR-09, VISION-FR-016).
- Sai số dự báo MAE60 so với dự báo "giữ giá trị cuối" (NFR-11, ANALYTICS-FR-009).
- Kết quả các kịch bản mất mạng / lỗi thiết bị (Report 3 §7.1, mục 3.2 b của phiếu).
- Độ khớp giữa trạng thái sức khoẻ ngày của hệ thống và đánh giá của người nuôi / chuyên gia (NFR-14, ANALYTICS-FR-014).
- Kết quả `pio test -e native` và test backend dùng chung case cho bộ mờ.

---

## 7. Biên bản xác nhận của người nuôi yến / Domain Expert

Report 3 A-3 chấp nhận "xác nhận của người nuôi yến" là nguồn cho ngưỡng mặc định, và A-6 cùng phiếu đăng ký (Task 5) yêu cầu biên bản ý kiến của một người nuôi yến có kinh nghiệm được đưa vào báo cáo. Để xác nhận đó dùng được làm minh chứng, mỗi lần phỏng vấn/xác nhận lập một biên bản theo mẫu dưới, lưu bản có chữ ký (ảnh/scan) ở thư mục chung và ghi vào bảng.

### 7.1. Danh sách biên bản

| Mã | Người xác nhận | Kinh nghiệm (số năm, số nhà yến) | Ngày | Hình thức (gặp trực tiếp / gọi / văn bản) | Xác nhận cho (`KD-xx`) | Nơi lưu bản ký |
| --- | --- | --- | --- | --- | --- | --- |
| MC-5xx | | | | | | |

### 7.2. Mẫu biên bản

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
| BR-28 | Môi trường trong ngưỡng: lệch nhẹ / lệch rõ | < 90 % / < 75 % thời gian của ngày |          |         |
| BR-28 | NH3/CO2 vượt ngưỡng: lệch nhẹ / lệch rõ | từ 1 giờ / từ 4 giờ trong ngày |                 |         |
| BR-28 | Tỷ lệ chim về giảm so với 7 ngày trước: lệch nhẹ / lệch rõ | từ 10 % / từ 20 % |                |         |
| BR-28 | Ồn bất thường: lệch nhẹ / lệch rõ | từ 1 / từ 3 đợt trong ngày |                         |         |
| BR-29 | "Cần xử lý" khi chim về giảm rõ VÀ có thêm 1 nguồn khác lệch cùng ngày | (luật kết hợp) |              |         |
| BR-30 | Ngày mưa trong giờ đếm thì chim về ít không tính là "cần xử lý" | mưa ≥ 1 mm/giờ |              |         |
| ...   |                         |                            |                                      |         |

Ý kiến khác: ______________________________________________________

Người xác nhận (ký, ghi rõ họ tên)        Người phỏng vấn (ký, ghi rõ họ tên)
```

---

## 8. Khoảng trống & việc cần làm

Tổng hợp những gì chưa có minh chứng sau mỗi đợt rà soát; sắp theo mức quan trọng với hội đồng.

| # | Khẳng định chưa có minh chứng | Ảnh hưởng nếu không có | Hướng xử lý | Người nhận | Hạn |
| --- | --- | --- | --- | --- | --- |
| 1 | KD-01, KD-02, KD-03: nguồn ghi 27–31 °C, 70–85 %RH, < 0,4 lux, hệ thống dùng 26–31 °C, 75–95 %RH, < 0,2 lux. KD-01 vẫn để "có nguồn" dù chênh ở cận dưới (26 so với 27); theo 3.3 là Lệch nguồn | BR-01 không có căn cứ khớp số; các nghiên cứu ở 4.0 còn đặt sàn ẩm gần 80 % | Nhóm quyết: giữ số hiện tại và xin xác nhận ở biên bản (mục 7), hoặc đổi theo nguồn bằng PR sửa Report 3 BR-01 và code |  |  |
| 2 | KD-06: trích đoạn chỉ nói nhà nóng, chim stress bỏ đi; không nêu ngưỡng 75 %RH / 31 °C. Cột nguồn dùng link thay cho mã TL, trạng thái vẫn "Chưa tìm" | Khẳng định mạnh hơn nguồn (quy tắc 3, mục 2.1) | Cấp mã TL cho tài liệu, tìm đoạn có số, hoặc giữ "Chưa tìm" |  |  |
| 3 | KD-10: nguồn ghi giờ mở âm thanh ngoài trời 5h30–11h30 và 13h30–19h; khung 5–7 h và 17–19 h của hệ thống chỉ nằm trong khung đó, nguồn chưa chứng minh riêng khung này | BR-07 mới có căn cứ về giới hạn pháp lý (TL-421), chưa có về lý do chọn 5–7 h / 17–19 h | Hỏi người nuôi yến ở biên bản (mục 7) |  |  |
| 4 | KD-40: nguồn là bài blog của Roboflow về YOLOv8, xếp mức A trong khi bảng 3.2 xếp tài liệu không bình duyệt vào C; chưa có nguồn cho YOLO11n. `docs/bird-counting-plan.md` §6.1 và `ai-pipeline/config/config.yaml` vẫn ghi mặc định YOLO26n, khác với bản nhóm dùng | Nguồn không chứng minh đúng model đang dùng; plan và config lệch với lựa chọn của nhóm | Chốt model sau khi so ở plan §7.9, rồi sửa plan/config cho khớp; dùng số đo FPS và sai số trên máy thật (MC) thay cho bài blog; xem lại mức nguồn | | |
| 5 | Dòng đầu bảng 4.2 (thuvienphapluat.vn) không có mã TL và trùng nội dung với TL-421 | Trùng nguồn, vi phạm 2.3 quy tắc 1 | Người thêm quyết định gộp vào TL-421 hoặc đổi trạng thái thành Loại (không xoá dòng) |  |  |
| 6 | KD-50: nguồn ghi giá 17–42 triệu đồng/kg và > 30 triệu đồng/kg; con số 60 triệu của khoảng 20–60 chưa có nguồn | Khoảng 20–60 vượt nguồn | Sửa khoảng trong bối cảnh bài theo nguồn (17–42), hoặc tìm thêm nguồn |  |  |
| 7 | KD-66 / Report 3 BR-08: bơm BẬT tối đa 30 phút, code backend chưa giới hạn riêng (gap G-06) | Số trong Report 3 khác code | Đóng G-06 | Trần Minh Kiệt | It. 2 |

## 9. Lịch sử thay đổi

| Phiên bản | Ngày | Người sửa | Nội dung |
| --- | --- | --- | --- |
| 0.3 | 30/10/2026 | | Đưa phần nhóm đã điền trên Google Docs vào file; đối chiếu với Report 3 3.1.0, `Config.h`, `thresholds.util.ts`, `fuzzyTuning.util.ts`, `detectionTuning.util.ts`, `bird-counting-plan.md`: sửa mã FR/BR, vị trí file, tên hằng, mã TL bị đảo ở KD-50…53, 25 fps, tham số tỷ lệ chim về theo House; thêm mục 8 |
| 0.2 | 18/10/2026 | | Bỏ bảng thiết bị; thêm phân công theo vai trò M1–M5 và quy tắc chống trùng (mục 2.2, 2.3); bỏ icon ở trạng thái |
| 0.1 | 18/10/2026 | | Tạo khung: quy ước, danh mục tài liệu trống, bảng truy vết các khẳng định đang có trong SRS/code, mẫu biên bản xác nhận |
