# SwiftletCare — Hướng dẫn Linh kiện & Đấu nối Toàn diện (v3.11)

**Phiên bản:** v3.11 (thêm mục 11.5 — Bảng tổng hợp TOÀN BỘ 15 dây của cụm loa ru: DFPlayer→PAM8403→Loa kèm Relay, gộp từ mục 9-11 thành 1 bảng duy nhất tiện tra cứu khi lắp thực tế). Kế thừa v3.10: mục 9.4 xác định dây VCC/GND trên cáp Micro-USB bằng VOM; v3.9: bảng 16 chân DFPlayer Mini clone "V0.5.1 HW-247A"; v3.8: tên chân thật PAM8403; v3.7: mạch phun sương Micro-USB; v3.6: quạt 12V 5x5cm; v3.5: relay TONGLING JQC-3FF-S-Z; v3.4: loa 8Ω/10W) | Thay thế v3.10. Chốt theo datasheet EPCB (cảm biến) + IC Đây Rồi (điều khiển/âm thanh) + ảnh/thông số thực tế.

---

## MỤC LỤC

**Phần I — Cụm cảm biến RS485** (giữ nguyên từ v3.2)
1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Danh sách linh kiện (BOM) đầy đủ](#2-danh-sách-linh-kiện-bom-đầy-đủ)
3. [Thống nhất Baudrate](#3-thống-nhất-baudrate-trước-khi-lắp-bus)
4. [Bảng màu dây cảm biến](#4-bảng-màu-dây-cảm-biến)
5. [Module UART-RS485 V2 & Bảng thanh ghi](#5-module-uart-rs485-v2--bảng-thanh-ghi-modbus)

**Phần II — Nguồn & Đế ESP32** (cập nhật linh kiện thật)
6. [Nguồn điện & phân phối (2 mạch Buck)](#6-nguồn-điện--phân-phối)
7. [Đế mở rộng ESP32 38 chân](#7-đế-mở-rộng-esp32-38-chân)

**Phần III — Relay điều khiển** (cập nhật)
8. [Module Relay 4 kênh kích H/L (Jumper)](#8-module-relay-4-kênh-kích-hl-jumper)
9. [Ánh xạ & đấu nối Relay](#9-ánh-xạ--đấu-nối-relay) (gồm 9.3 lắp cơ khí phun sương, 9.4 xác định dây VCC/GND bằng VOM)

**Phần IV — Hệ thống Loa ru** (cập nhật)
10. [DFPlayer Mini](#10-dfplayer-mini-đã-mua)
11. [Amply PAM8403 6W có volume](#11-amply-pam8403-6w-có-volume-đã-mua)
12. [Chuỗi hoạt động loa ru](#12-chuỗi-hoạt-động-loa-ru)

**Phần V — Tổng hợp**
13. [Ngân sách nguồn (tính lại cho PAM8403 6W)](#13-ngân-sách-nguồn-tính-lại)
14. [Checklist lắp ráp](#14-checklist-lắp-ráp)

---

# PHẦN I — CỤM CẢM BIẾN RS485

## 1. Tổng quan hệ thống

```
AC Adapter 12V/2A ──> Domino TB1504 (12V) ──┬──> Buck LM2596 #1 (12V→5V) ──> ESP32 (qua đế mở rộng) + Module RS485
                                             │         └─(qua Relay K1)──> Mạch phun sương 5V
                                             ├──> Buck LM2596 #2 (12V→5V/1.2A+) ──> PAM8403 + DFPlayer + cuộn Relay
                                             ├──> Rail 12V ──> 5 cảm biến (VCC/GND)
                                             └──> Rail 12V ──(qua Relay K3)──> Quạt tản nhiệt 12V (KHÔNG qua Buck)

BUS RS485 (A/B): Noise(ID1) ─ CO2(ID2) ─ NH3(ID3) ─ Light(ID4) ─ ES35-SW(ID5, cuối bus)
Relay 4 kênh (kích chọn Jumper): IN1→mạch phun sương (5V) │ IN2→nguồn amply loa ru (5V) │ IN3→quạt tản nhiệt (12V) │ IN4→dự phòng
Loa ru: ESP32 ──UART──> DFPlayer ──> PAM8403 (volume) ──> Loa 8Ω/10W
ESP32 ── Wi-Fi ──> Router 4G ──> Cloud (MQTT)
```

## 2. Danh sách linh kiện (BOM) đầy đủ

### 2.1. Cảm biến & điều khiển chính

| STT | Thiết bị | Model thực tế | Slave ID | Ghi chú |
|---|---|---|:---:|---|
| 1 | Vi điều khiển | **ESP32 NodeMCU 38 chân Type-C (CP2102, ESP32-WROOM-32)** | — | Đã mua |
| 2 | **Đế mở rộng ESP32 38 chân** | Domino 3.81mm, FR4, có lỗ bắt vít | — | Đấu dây không cần hàn, cố định chắc |
| 3 | Module chuyển RS485 | UART TTL to RS485 V2 (auto) | — | Đấu thẳng |
| 4 | Cảm biến tiếng ồn | ES-NOISE-01 | 1 | 4800bps |
| 5 | Cảm biến CO2 | ES-CO2-01 | 2 | 4800bps |
| 6 | Cảm biến NH3 | ES-NH3-01 (0-500ppm) | 3 | 4800bps |
| 7 | Cảm biến ánh sáng | ES-ALS-02 (0-200k Lux) | 4 | 4800bps |
| 8 | Cảm biến nhiệt-ẩm | ES35-SW (SHT35) | 5 | Đổi 9600→4800; cuối bus, DIP Pin5 ON |

### 2.2. Nguồn & phân phối

| STT | Thiết bị | Model thực tế | Ghi chú |
|---|---|---|---|
| 9 | Nguồn | AC Adapter 12V/2A (jack DC) | Đã có |
| 10 | Mạch hạ áp #1 | **Buck LM2596 3A** (in 3-30V, out 1.5-30V, 92%) | 12V→5V cho ESP32 + module RS485 + mạch phun sương (tải nhỏ). Quạt tản nhiệt KHÔNG qua Buck này (quạt dùng 12V) |
| 11 | Mạch hạ áp #2 | **Buck LM2596 3A** (thứ 2) | 12V→5V RIÊNG cho PAM8403 + DFPlayer + cuộn relay (tách khỏi Buck#1 để tránh nhiễu/sụt áp) |
| 12 | Domino phân phối | **TB1504 (4 mối, 15A/600V)** | Chia nguồn 12V |
| 13 | Dây điện nhiều lõi (mỏng) | — | Đấu nối |

### 2.3. Relay & Actuator

| STT | Thiết bị | Model thực tế | Kênh/GPIO | Ghi chú |
|---|---|---|---|---|
| 14 | **Module 4 Relay 5V opto cách ly kích H/L** | Relay **TONGLING JQC-3FF-S-Z**, cuộn dây 5VDC, tiếp điểm **10A/250VAC** (15A/125VAC), chọn mức kích High/Low bằng jumper, ~200mA/relay | — | Đã mua — đúng board trong ảnh thực tế |
| 15 | **Mạch phun sương siêu âm 108-110KHz** | 5V qua cổng **Micro-USB**, ~300mA (<2W), kèm 1 đĩa siêu âm Ø20/Ø12mm (jack cắm sẵn, không hàn) + 1 bông tạo ẩm 10cm + 2 khung giá đỡ bông | IN1 · GPIO25 | Tăng ẩm — nguồn 5V lấy từ **Buck#1**, cấp vào board qua dây cắt từ cáp Micro-USB |
| 16 | **Quạt tản nhiệt 12V 5x5cm** | 12V-0.09A (~1.08W), tốc độ 4000±10% RPM, độ ồn 18dB, lưu lượng 18.17-25.97 CFM, 2 dây (Đỏ=12V+/Đen=GND, không có dây tín hiệu) | IN3 · GPIO27 | Giảm nhiệt/xả khí — nguồn **12V lấy trực tiếp từ Domino/Adapter**, KHÔNG qua Buck (quy mô demo KLTN) |
| 17 | (dự phòng: sưởi/đèn/tải lớn hơn) | — | IN4 · GPIO14 | Mở rộng — có thể dùng tới 10A/250VAC nếu cần |

### 2.4. Hệ thống âm thanh Loa ru

| STT | Thiết bị | Model thực tế | Ghi chú |
|---|---|---|---|
| 18 | **DFPlayer Mini** | MP3/WAV/WMA từ microSD (FAT16/32, ≤32GB), ampli tích hợp, điều khiển UART/IO | Thư mục ≤100, mỗi mục ≤255 bài; 6 mức âm lượng |
| 19 | **Amply PAM8403 6W Hifi 2.0 (có volume)** | Class-D, thực tế ~2×3W, nguồn 5V-1.2A, loa 4Ω/8Ω, có núm chỉnh volume + lọc nhiễu | Cần nguồn đủ 1.2A |
| 20 | Thẻ microSD | ≤32GB FAT32 | Chứa file âm thanh |
| 21 | **Loa 8Ω/10W** | 50×90mm, dày 38.5mm | Nguồn amply đóng/ngắt qua Relay IN2. PAM8403 chỉ ra ~2×3W nên loa chạy "non tải", an toàn tuyệt đối |
| 22 | Điện trở 1kΩ | — | Bảo vệ chân RX DFPlayer |

### 2.5. Camera (tách nhánh Vision — xem guide camera riêng)

| STT | Thiết bị | Ghi chú |
|---|---|---|
| 23 | Camera nhà yến IP 2MP **IR 940nm** (không phát sáng), 2.8mm góc rộng, IP66+, RTSP | Xem `Camera_Guide_NhaYen_Full.md` |

---

## 3. Thống nhất Baudrate trước khi lắp bus

⚠️ 4 cảm biến EPCB mặc định **4800bps**, ES35-SW mặc định **9600bps** → phải đổi ES35-SW về 4800. Dùng **ESP32 chạy sketch cấu hình** (không cần USB-RS485 — xem Sensor Config Guide). Ghi giá trị `2` vào thanh ghi `101 (0x65)` của ES35-SW.

---

## 4. Bảng màu dây cảm biến

**4 cảm biến EPCB (Noise/CO2/NH3/Light):** Nâu=VCC, Đen=GND, Vàng=A, Xanh dương=B.
**ES35-SW (KHÁC):** Đỏ=VCC, Đen=GND, Vàng=A+, **Xanh lá=B-**. ⚠️

---

## 5. Module UART-RS485 V2 & Bảng thanh ghi Modbus

Đấu thẳng: ESP32 GPIO17→TXD, GPIO16→RXD, VCC 5V, GND. Khối vít A/B → bus.

**Register map (Function 0x03, 4800bps):**
- Noise (ID1) reg 0x0000: **÷10 = dB**
- CO2 (ID2) reg 0x0000: **= ppm**
- NH3 (ID3) reg 0x0000: **= ppm**
- Light (ID4) reg 0x0002 (2 reg): **×100 = Lux** (bản 200k)
- ES35-SW (ID5) reg 0+1: **÷10 = °C và %RH**

---

# PHẦN II — NGUỒN & ĐẾ ESP32

## 6. Nguồn điện & phân phối

⚠️ **Thay đổi quan trọng: dùng 2 mạch Buck LM2596** vì PAM8403 6W ngốn tới 1.2A, nếu dùng chung 1 Buck với ESP32 dễ sụt áp gây treo.

```
AC Adapter 12V/2A ──> Domino TB1504 (4 mối, 15A) ──┬── Buck #1 (12V→5V) ──> ESP32 + Module RS485 (~0.5A)
                                                    │                    └─(qua Relay K1)─> Phun sương 5V (~0.3A)
                                                    ├── Buck #2 (12V→5V) ──> PAM8403 + DFPlayer + cuộn Relay (~2.1A)
                                                    ├── 12V trực tiếp ──> 5 cảm biến
                                                    └── 12V trực tiếp ──(qua Relay K3)─> Quạt tản nhiệt 12V (~0.09A)
```

- **Buck LM2596 3A** đủ dòng cho từng nhánh (mỗi con tối đa 3A).
- **Chỉnh mỗi Buck ra đúng 5V** bằng biến trở + đo VOM **trước khi cắm** ESP32/module (⚠️ nếu chưa chỉnh, ngõ ra có thể cao gây cháy).
- **Domino TB1504** (15A/600V) dư sức phân phối.
- ⚠️ Buck LM2596: cẩn thận **cấp ngược chân +/- IN** (theo cảnh báo nhà sản xuất).

## 7. Đế mở rộng ESP32 38 chân

Bạn đã mua **đế mở rộng ESP32 38 chân** (domino 3.81mm) — đây là lợi thế lớn:
- Cắm ESP32 NodeMCU 38 chân vào đế, mọi GPIO ra domino vít → **đấu dây không cần hàn**, không lo lỏng dây.
- Có lỗ bắt vít → cố định chắc vào hộp.
- ⚠️ Chỉ tương thích ESP32 **38 chân** (đúng loại NodeMCU bạn mua).

> Tất cả dây tín hiệu (RS485, relay IN, DFPlayer UART) và nguồn 5V đều đấu vào domino của đế này — rất tiện, sạch sẽ.

---

# PHẦN III — RELAY ĐIỀU KHIỂN

## 8. Module Relay 4 kênh kích H/L (Jumper)

Bạn đã mua **module 4 relay 5V opto cách ly, kích H/L chọn bằng Jumper** — silkscreen board ghi **"4 Relay Module High/Low Level"**, dùng relay **TONGLING JQC-3FF-S-Z** (nhãn trên từng relay xanh) — tốt hơn loại cố định mức kích:
- **Chọn mức kích bằng Jumper** (khối jumper vàng S1-S2-S3-S4, nhãn H/L cạnh bên): có thể để **kích mức cao (High=5V=bật)** hoặc **mức thấp (Low=0V=bật)**.
- **Khuyến nghị SwiftletCare:** đặt Jumper ở **kích mức CAO (High)** cho trực quan — `digitalWrite(pin, HIGH)` = bật thiết bị, `LOW` = tắt (dễ hiểu, khớp logic thông thường). Ghi rõ trong firmware.
- Opto cách ly → an toàn cho ESP32.
- Relay JQC-3FF-S-Z: cuộn dây **5VDC**, tiếp điểm chịu **10A/250VAC** (15A/125VAC, chuẩn CQC 10A/250VAC) → dư sức đóng cả tải 220VAC nếu cần sau này.
- Dòng tiêu thụ ~200mA/relay khi đóng (cuộn dây).
- Khối vít bên trái board (theo ảnh thực tế): **DC+, DC-, IN1, IN2, IN3, IN4** — DC+/DC- là nguồn nuôi board, IN1-4 là 4 chân tín hiệu điều khiển.

## 9. Ánh xạ & đấu nối Relay

### 9.1. Phía điều khiển (qua đế mở rộng ESP32)

| Chân Relay (silkscreen) | Nối vào (domino đế ESP32) |
|---|---|
| DC+ (VCC) | 5V (từ Buck #2) |
| DC- (GND) | GND chung |
| IN1 | GPIO25 — phun sương |
| IN2 | GPIO26 — nguồn amply loa ru |
| IN3 | GPIO27 — quạt |
| IN4 | GPIO14 — dự phòng |

> Đặt Jumper mỗi relay ở **High-level trigger**. Firmware: `digitalWrite(IN, HIGH)` = bật.

### 9.2. Phía tải (NO/COM)

```
Nguồn tải (+) ──► COM ──[relay đóng]──► NO ──► dây (+) thiết bị
Nguồn tải (-) ─────────────────────────────► dây (-) thiết bị
```
- IN1→**mạch phun sương siêu âm** (5V lấy từ **Buck#1**, qua NO-COM kênh 1). Board này chỉ có cổng Micro-USB để cấp nguồn — cách đấu không cần hàn: mua 1 sợi cáp Micro-USB rẻ tiền, **cắt bỏ đầu USB-A**, lột ra 2 dây ĐỎ (5V+) và ĐEN (GND) (bỏ 2 dây data trắng/xanh lá), đầu Micro-USB còn lại cắm thẳng vào board. Dây ĐỎ → NO (kênh 1), dây ĐEN nối thẳng GND chung (không qua relay). Đĩa loa siêu âm đã có jack cắm sẵn vào board, không cần đấu gì thêm — chỉ cắm vào đúng chân trên board.
- IN3→**quạt tản nhiệt 12V** (12V lấy **TRỰC TIẾP từ Domino/Adapter**, KHÔNG qua Buck, qua NO-COM kênh 3). Dây (-) của quạt nối thẳng GND, không qua relay.
- IN2→**nguồn cấp PAM8403** (5V từ **Buck#2**, qua NO-COM) → relay đóng thì amply mới có điện.
- ⚠️ **Lưu ý điện áp khác nhau:** phun sương/amply dùng 5V, quạt dùng 12V — mỗi tải phải lấy dây (+) vào COM đúng nguồn của nó, KHÔNG cắm nhầm 12V vào tải 5V (sẽ cháy) hoặc ngược lại (quạt không đủ áp để quay).
- ℹ️ Cả 3 tải đều dòng nhỏ, an toàn khi đấu. Relay JQC-3FF-S-Z vẫn còn dư sức (chịu tối đa 10A/250VAC) nếu sau này nâng cấp tải lớn hơn/220VAC — khi đó cần thợ điện có chuyên môn. Kênh IN4/K4 để trống, dự phòng.

### 9.3. Lắp cơ khí mạch phun sương (bộ kit 4 món)

Bộ kit gồm: board driver (Micro-USB) + đĩa siêu âm (đã nối dây vào jack) + que bông tạo ẩm + 2 khung giá đỡ.

1. Cắm jack của đĩa siêu âm vào board (jack có ngàm, chỉ cắm được 1 chiều — không cần hàn).
2. Đặt đĩa siêu âm vào 1 khung giá đỡ, thả vào cốc/hộp chứa nước.
3. Đổ nước sao cho **mặt DƯỚI** của đĩa (mặt hút nước, không có vết hàn) ngập nước khoảng 3-5mm. **Mặt TRÊN** (có vết hàn) hướng lên không khí — đây là mặt phun sương ra ngoài.
4. Cắm que bông vào khung giá đỡ còn lại, đặt đứng ngay phía trên/cạnh đĩa siêu âm — que bông hút nước lên giúp lan sương đều hơn (không bắt buộc nhưng nên dùng vì có sẵn trong kit).
5. Đặt board driver ở chỗ khô ráo BÊN NGOÀI cốc nước (chỉ đĩa siêu âm mới được nhúng nước, board và jack cắm phải khô tuyệt đối).
6. Cấp nguồn 5V cho board qua dây cắt từ cáp Micro-USB (xem 9.2) — khi relay K1 đóng, board có điện sẽ tự dao động và tạo sương ngay, không cần lập trình gì thêm cho phần siêu âm.

### 9.4. Xác định đúng dây VCC/GND trên cáp Micro-USB đã cắt (khi cáp không có màu chuẩn đỏ/đen)

Nhiều cáp giá rẻ không tô màu dây theo chuẩn (4 dây bên trong đều trắng/bạc giống nhau) — dùng VOM để xác định chắc chắn, không đoán:

1. Chỉnh VOM sang thang đo **thông mạch/continuity** (icon loa 🔊 hoặc diode).
2. **Mẹo vỏ kim loại:** đầu Micro-USB còn nguyên (đầu cắm vào board) có vỏ kim loại bao quanh — vỏ này trên MỌI cáp USB đều nối **GND**. Que đo 1 chạm vào vỏ kim loại đó, que đo 2 chạm lần lượt vào từng dây trong 4 dây đã cắt — dây nào kêu bíp/thông mạch với vỏ chính là **GND**.
3. Trong 4 dây, tách sẵn 2 dây **to hơn** (thường là cặp nguồn VCC/GND) và 2 dây **nhỏ hơn** đi chung (cặp data D+/D-, không dùng). Sau khi tìm được GND ở bước 2 (luôn nằm trong 2 dây to), dây to **còn lại** chính là **VCC (+)**.
4. (Tuỳ chọn) Đo thêm continuity giữa 2 dây nhỏ (data) với vỏ kim loại — phải **KHÔNG** kêu bíp, xác nhận đã loại đúng cặp data.
5. Đánh dấu ngay dây VCC (băng keo màu) để không nhầm khi lắp cố định. 2 dây data còn lại: cắt ngắn, quấn băng keo cách điện đầu dây, bỏ không dùng.

---

# PHẦN IV — HỆ THỐNG LOA RU

## 10. DFPlayer Mini (đã mua)

- Đọc MP3/WAV/WMA từ microSD (FAT16/32, ≤32GB).
- Có **ampli tích hợp** (loa nhỏ đấu thẳng SPK_1/SPK_2 được), hoặc xuất DAC ra PAM8403 (dùng cách này vì amply riêng cho âm to/rõ hơn).
- Điều khiển qua **UART** (hoặc chân IO).
- File tổ chức theo thư mục (≤100 mục, mỗi mục ≤255 bài) — tiện quản lý nhiều tiếng loa ru khác nhau.
- 6 mức âm lượng (điều khiển bằng lệnh).
- ✅ Xác nhận đúng board bạn có: clone **"DFPlayer Mini V0.5.1 HW-247A"** — board đã có sẵn **chân header lồi** (cắm dây jumper trực tiếp, không cần hàn). Bản này rất phổ biến, pinout chuẩn cộng đồng đã xác nhận như sau:

**Cách xác định chân:** cầm board với khe thẻ SD hướng về phía bạn, chữ "DFPlayer Mini" đọc xuôi bình thường. 2 hàng chân chạy dọc 2 cạnh trái/phải:

| Cạnh TRÁI (trên→dưới) | Cạnh PHẢI (trên→dưới) |
|---|---|
| 1. VCC | 9. GND |
| 2. RX | 10. SPK_2 |
| 3. TX | 11. IO1 (busy) |
| 4. DAC_R | 12. ADKEY_2 |
| 5. DAC_L | 13. ADKEY_1 |
| 6. SPK_1 | 14. USB− |
| 7. GND | 15. USB+ |
| 8. IO2 | 16. (bỏ trống) |

**Đấu nối (chỉ cần 6 chân, đều ở cạnh TRÁI):**
| Chân DFPlayer | Nối vào |
|---|---|
| VCC (chân 1) | 5V (Buck #2) — cấp trực tiếp, KHÔNG qua relay (để ESP32 gửi lệnh được bất cứ lúc nào) |
| GND (chân 7) | GND chung |
| RX (chân 2) | GPIO33 ESP32 **qua trở 1kΩ** |
| TX (chân 3) | GPIO32 ESP32 (tuỳ chọn) |
| DAC_L (chân 5) | Chân **"L"** của khối Input trên PAM8403 |
| DAC_R (chân 4) | Chân **"R"** của khối Input trên PAM8403 (tuỳ chọn, nên nối) |

**Lệnh (thư viện DFRobotDFPlayerMini):** `volume(0-30)`, `play(1)`, `loop(1)`, `stop()`.

## 11. Amply PAM8403 6W có volume (đã mua)

- Class-D, tên gọi thương mại "6W" nhưng thực tế cho ra ~2×3W, nguồn **5V-1.2A** (cần đủ dòng — lý do dùng Buck #2 riêng).
- Loa 4Ω/8Ω.
- **Có núm chỉnh volume vật lý** + lọc nhiễu → âm thanh tốt hơn.
- ⚠️ Điện áp **không vượt 5.5V, không đấu ngược** (theo nhà sản xuất) → chỉnh Buck #2 đúng 5V.
- **3 cụm chân thật trên board (theo ảnh thực tế):**
  1. **Khối vít nguồn** (2 chân, cạnh tụ nguồn, gần núm volume) — in **"+"/"−"** (hoặc "power+/power−"): đây là ngõ vào 5V.
  2. **Khối vít Input** (3 chân, in rõ **"L G R"**): "L" = audio kênh trái, "G" = GND chung (audio ground), "R" = audio kênh phải.
  3. **4 lỗ hàn Output** (không phải khối vít — là 4 lỗ trần ở cạnh board, thường in gần đó **"OUT-", "OUT+", "OUT-", "OUT+"**): 2 lỗ đầu = ngõ ra kênh trái (L+/L-), 2 lỗ sau = ngõ ra kênh phải (R+/R-). Đây LÀ chỗ duy nhất trên cả 3 board cần **hàn** (vì không có vít).

**Đấu nối:**
| Chân PAM8403 (tên in trên board) | Nối vào |
|---|---|
| Khối nguồn "+" | 5V từ Buck #2, qua Relay kênh 2 (K2) — đây chính là "nguồn amply" đã nói ở phần trước |
| Khối nguồn "−" | GND chung (Buck #2 OUT-), nối thẳng KHÔNG qua relay |
| Input "L" | DAC_L của DFPlayer |
| Input "G" | GND chung (cùng GND với DFPlayer) |
| Input "R" | DAC_R của DFPlayer (tuỳ chọn, xem ghi chú dưới) |
| Output (chọn 1 cặp: L+/L- **hoặc** R+/R-) | 2 dây ra Loa ru — hàn trực tiếp vào 2 lỗ đó |

> **Vì chỉ có 1 loa ru (không phải cặp loa trái/phải):** chỉ cần dùng **1 trong 2 cặp output** (ví dụ L+/L-) để nối ra loa; cặp còn lại (R+/R-) bỏ trống không dùng. Ở đầu vào, nên nối **cả DAC_L và DAC_R** của DFPlayer vào cả "L" và "R" của PAM8403 (hầu hết file MP3 mono sẽ ra cùng tín hiệu ở cả 2 kênh) — như vậy dù bạn hàn ra cặp output nào, loa vẫn có tiếng.
> Núm volume vật lý trên PAM8403 chỉnh mức tối đa; DFPlayer chỉnh mức mềm qua lệnh. Kết hợp cả 2.
> Loa 8Ω/10W đang dùng có công suất định mức lớn hơn công suất thực của PAM8403 (~3W/kênh) → loa chạy "non tải", hoàn toàn an toàn, chỉ chưa phát hết công suất tối đa của loa.
> **Đấu loa:** phía sau loa là 2 lưỡi kim loại kiểu giắc cắm nhanh (quick-connect tab, thường cỡ 4.8mm). Cách không hàn: mua 2 đầu cốt cái (female spade terminal) cỡ tương ứng, bấm/kẹp vào đầu dây rồi cắm vào 2 lưỡi đó. Nếu không có đầu cốt, hàn trực tiếp dây vào 2 lưỡi kim loại cũng được (mối hàn nhỏ, ít rủi ro vì đây không phải mạch điện tử nhạy cảm). Không phân cực bắt buộc (tín hiệu xoay chiều) nhưng nên giữ nhất quán +/- nếu sau này lắp thêm loa thứ 2.

## 11.5. Bảng tổng hợp TOÀN BỘ dây cụm loa ru (DFPlayer → PAM8403 → Loa, kèm Relay)

Gộp lại từ mục 9-11 thành 1 bảng duy nhất, tránh phải lật nhiều mục khi lắp thực tế. Thứ tự khuyến nghị: đấu nhóm A→B→D→E trước (test ESP32 giao tiếp DFPlayer, relay đóng/ngắt đúng), rồi mới đấu C→F (audio) sau cùng.

**A. Nguồn DFPlayer (luôn bật, KHÔNG qua relay)**
| # | Từ | Đến | Ghi chú |
|---|---|---|---|
| 1 | Buck#2 OUT+ | DFPlayer **VCC** (chân 1, cạnh trái trên cùng) | Có header, không hàn |
| 2 | Buck#2 OUT− | DFPlayer **GND** (chân 7, cạnh trái) | Vào GND chung |

**B. Tín hiệu điều khiển (ESP32 → DFPlayer)**
| # | Từ | Đến | Ghi chú |
|---|---|---|---|
| 3 | ESP32 GPIO33 | DFPlayer **RX** (chân 2) | ⚠️ Qua điện trở 1kΩ |
| 4 | ESP32 GPIO32 | DFPlayer **TX** (chân 3) | Tuỳ chọn |

**C. Audio: DFPlayer → PAM8403**
| # | Từ | Đến | Ghi chú |
|---|---|---|---|
| 5 | DFPlayer **DAC_L** (chân 5) | PAM8403 Input **"L"** | |
| 6 | DFPlayer **DAC_R** (chân 4) | PAM8403 Input **"R"** | Nên nối cả 2 dù chỉ 1 loa |
| 7 | GND chung | PAM8403 Input **"G"** (giữa) | |

**D. Relay — nguồn & điều khiển cho chính relay**
| # | Từ | Đến | Ghi chú |
|---|---|---|---|
| 8 | ESP32 GPIO26 | Relay **IN2** | Jumper relay đặt ở High |
| 9 | Buck#2 OUT+ | Relay **DC+** | Nuôi board relay, luôn có |
| 10 | Buck#2 OUT− | Relay **DC−** | |

**E. Nguồn PAM8403 — đi QUA relay ("nguồn amply")**
| # | Từ | Đến | Ghi chú |
|---|---|---|---|
| 11 | Buck#2 OUT+ | Relay **COM** (kênh 2) | Dây RIÊNG, khác dây #9 |
| 12 | Relay **NO** (kênh 2) | PAM8403 nguồn **"+"** | Relay đóng mới có điện |
| 13 | GND chung | PAM8403 nguồn **"−"** | Thẳng, không qua relay |

**F. PAM8403 → Loa ru (chỗ DUY NHẤT phải hàn)**
| # | Từ | Đến | Ghi chú |
|---|---|---|---|
| 14 | PAM8403 lỗ hàn **"L+"** | Loa — lưỡi kim loại 1 | Hàn hoặc đầu cốt cái |
| 15 | PAM8403 lỗ hàn **"L−"** | Loa — lưỡi kim loại 2 | Cặp R+/R− bỏ trống |

**Tổng: 15 dây.**

---

## 12. Chuỗi hoạt động loa ru

```
Đến giờ (5:00): ESP32 bật Relay IN2 (GPIO26=HIGH) → PAM8403 có điện
→ ESP32 lệnh UART: volume(20); loop(1); → DFPlayer đọc 0001.mp3 từ SD
→ DAC → PAM8403 khuếch đại (qua volume) → Loa ru kêu
→ ES-NOISE-01 đọc dB tăng → xác nhận OK; nếu không tăng → cảnh báo SPEAKER_FAILURE
Hết giờ (7:00): stop() → ngắt Relay IN2 (GPIO26=LOW) → cắt điện amply
```

---

# PHẦN V — TỔNG HỢP

## 13. Ngân sách nguồn (tính lại)

| Nhánh | Thiết bị | Dòng |
|---|---|---|
| **Buck #1 (5V)** | ESP32 + module RS485 (~0.5A) + mạch phun sương (~0.3A, qua relay K1) | ~0.8A |
| **Buck #2 (5V)** | PAM8403 (1.2A) + DFPlayer (~0.3A) + cuộn relay (3×0.2A=0.6A) | ~2.1A |
| **12V trực tiếp** | 5 cảm biến (~0.2-0.4A) + quạt tản nhiệt 12V (0.09A, qua relay K3) | ~0.3-0.5A |

✅ **Cập nhật:** mạch phun sương là tải 5V dòng nhỏ → nằm ở **Buck#1** (vốn chỉ nuôi ESP32, còn rất dư dòng: ~0.8A/3A). **Quạt tản nhiệt dùng 12V** (không phải 5V như bản trước ghi nhầm) nên lấy **trực tiếp từ Domino/rail 12V**, không qua Buck nào cả — đơn giản hơn và không tốn dòng của Buck. Buck#2 giữ nguyên ~2.1A/3A (không đổi), vẫn tách biệt khỏi đường nguồn âm thanh.
- Buck LM2596 3A còn margin an toàn lớn ở cả 2 nhánh (27% và 70% tải).
- Nếu sau này nâng cấp phun sương/quạt lên loại công suất lớn hơn (thực tế nhà yến), nên tính lại dòng và cân nhắc cấp nguồn 220VAC riêng qua relay.

## 14. Checklist lắp ráp

- [ ] Cấu hình 5 cảm biến (ID 1-5, cùng 4800bps) bằng ESP32 sketch — đổi baud ES35-SW
- [ ] Cắm ESP32 38 chân vào đế mở rộng, bắt vít vào hộp
- [ ] Đấu AC Adapter 12V → Domino TB1504
- [ ] Chỉnh Buck #1 ra 5V (đo VOM) → cấp ESP32 + module RS485
- [ ] Chỉnh Buck #2 ra 5V (đo VOM) → cấp PAM8403 + DFPlayer + relay
- [ ] Đấu bus RS485: module → 5 cảm biến (ES35-SW cuối bus, DIP Pin5 ON, màu dây riêng)
- [ ] Đặt Jumper 4 relay ở kích mức CAO (High)
- [ ] Đấu relay IN1/IN2/IN3/IN4 → GPIO25/26/27/14
- [ ] Đấu tải: IN1→mạch phun sương (nguồn 5V từ Buck#1), IN3→quạt tản nhiệt (nguồn 12V TRỰC TIẾP từ Domino, không qua Buck), IN2→nguồn PAM8403 (5V từ Buck#2)
- [ ] Chép file MP3 (0001.mp3...) vào thẻ SD, cắm DFPlayer
- [ ] Đấu DFPlayer: RX←GPIO33 (trở 1kΩ), TX→GPIO32, DAC_L/DAC_R→PAM8403 "L"/"R"
- [ ] Đấu PAM8403: khối nguồn "+/−"→Relay K2/GND, Output (hàn 1 cặp L+/L- hoặc R+/R-)→loa (qua đầu cốt hoặc hàn trực tiếp)
- [ ] Nạp firmware, test: đọc 5 cảm biến, bật/tắt 3 relay, phát loa ru
- [ ] Kiểm tra dB tăng khi loa kêu (verify SPEAKER_FAILURE logic)

---

*Guide v3.11 cập nhật theo linh kiện thật đã mua (IC Đây Rồi + EPCB). Điểm mới quan trọng: mục 11.5 — bảng tổng hợp toàn bộ 15 dây cụm loa ru (DFPlayer→PAM8403→Loa+Relay) gộp làm 1 để tiện tra cứu khi lắp; mục 9.4 dùng VOM + "mẹo vỏ kim loại" xác định dây VCC/GND trên cáp Micro-USB đã cắt; bảng 16 chân DFPlayer Mini clone "V0.5.1 HW-247A"; tên chân thật trên PAM8403 (nguồn +/−, Input L G R, Output 4 lỗ hàn) và cách đấu loa ru qua đầu cốt/hàn; mạch phun sương cấp nguồn qua cổng Micro-USB (không phải Type-C); quạt tản nhiệt là loại 12V 5x5cm (lấy nguồn trực tiếp từ Domino, không qua Buck); relay xác nhận đúng model TONGLING JQC-3FF-S-Z; 2 mạch Buck (tách nguồn cho PAM8403 6W); đế mở rộng ESP32 (không cần hàn); relay kích H/L chọn Jumper. Đi kèm SRS v1.11.0. Camera xem guide riêng.*
