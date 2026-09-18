# SwiftletCare — Hướng dẫn Linh kiện & Đấu nối Toàn diện (v3.5)

**Phiên bản:** v3.5 (sửa lại quạt tản nhiệt: **12V 5x5cm** thay cho 5V 4x4x1cm ghi nhầm ở v3.4) | Thay thế v3.4. Chốt theo datasheet EPCB (cảm biến) + IC Đây Rồi (điều khiển/âm thanh).

> ⚠️ **Lưu ý phạm vi:** quạt tản nhiệt 12V 5x5cm là quạt cho **mô hình/hộp demo** (mô phỏng lưu thông khí/tản nhiệt quy mô prototype), **không phải** quạt thông gió công suất lớn cho chuồng yến thật. Nếu triển khai thực tế cho chuồng lớn, cần thay bằng quạt thông gió 12V/220V công suất cao hơn (dòng lớn hơn nhiều so với 0.09A của quạt này).

---

## MỤC LỤC

**Phần I — Cụm cảm biến RS485** (giữ nguyên từ v3.2)

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Danh sách linh kiện (BOM) đầy đủ](#2-danh-sách-linh-kiện-bom-đầy-đủ)
3. [Thống nhất Baudrate](#3-thống-nhất-baudrate-trước-khi-lắp-bus)
4. [Bảng màu dây cảm biến](#4-bảng-màu-dây-cảm-biến)
5. [Module UART-RS485 V2 & Bảng thanh ghi](#5-module-uart-rs485-v2--bảng-thanh-ghi-modbus)

**Phần II — Nguồn & Đế ESP32** (cập nhật linh kiện thật) 6. [Nguồn điện & phân phối (2 mạch Buck)](#6-nguồn-điện--phân-phối) 7. [Đế mở rộng ESP32 38 chân](#7-đế-mở-rộng-esp32-38-chân)

**Phần III — Relay điều khiển** (cập nhật) 8. [Module Relay 4 kênh kích H/L (Jumper)](#8-module-relay-4-kênh-kích-hl-jumper) 9. [Ánh xạ & đấu nối Relay](#9-ánh-xạ--đấu-nối-relay)

**Phần IV — Hệ thống Loa ru** (cập nhật) 10. [DFPlayer Mini](#10-dfplayer-mini-đã-mua) 11. [Amply PAM8403 6W có volume](#11-amply-pam8403-6w-có-volume-đã-mua) 12. [Chuỗi hoạt động loa ru](#12-chuỗi-hoạt-động-loa-ru)

**Phần V — Tổng hợp** 13. [Ngân sách nguồn (tính lại cho PAM8403 6W)](#13-ngân-sách-nguồn-tính-lại) 14. [Checklist lắp ráp](#14-checklist-lắp-ráp)

---

# PHẦN I — CỤM CẢM BIẾN RS485

## 1. Tổng quan hệ thống

```
AC Adapter 12V/2A ──> Domino TB1504 (12V) ──┬──> Buck LM2596 #1 (12V→5V) ──> ESP32 (qua đế mở rộng) + Module RS485
                                             │                              └─[qua Relay IN1]─> Mạch phun sương 108KHz (5V)
                                             ├──> Buck LM2596 #2 (12V→5V/1.2A+) ──> PAM8403 + DFPlayer + Relay (logic)
                                             │                                    └─[qua Relay IN2]─> Nguồn PAM8403
                                             └──> Rail 12V ──┬─> 5 cảm biến (VCC/GND)
                                                              └─[qua Relay IN3]─> Quạt tản nhiệt 12V 5x5cm (demo)

BUS RS485 (A/B): Noise(ID1) ─ CO2(ID2) ─ NH3(ID3) ─ Light(ID4) ─ ES35-SW(ID5, cuối bus)
Relay 4 kênh (kích chọn Jumper): IN1→mạch phun sương (5V) │ IN2→nguồn amply loa ru │ IN3→quạt tản nhiệt (12V, demo) │ IN4→dự phòng
Loa ru: ESP32 ──UART──> DFPlayer ──> PAM8403 (volume) ──> Loa 8Ω 10W
ESP32 ── Wi-Fi ──> Router 4G ──> Cloud (MQTT)
```

## 2. Danh sách linh kiện (BOM) đầy đủ

### 2.1. Cảm biến & điều khiển chính

| STT | Thiết bị                     | Model thực tế                                             | Slave ID | Ghi chú                              |
| --- | ---------------------------- | --------------------------------------------------------- | :------: | ------------------------------------ |
| 1   | Vi điều khiển                | **ESP32 NodeMCU 38 chân Type-C (CP2102, ESP32-WROOM-32)** |    —     | Đã mua                               |
| 2   | **Đế mở rộng ESP32 38 chân** | Domino 3.81mm, FR4, có lỗ bắt vít                         |    —     | Đấu dây không cần hàn, cố định chắc  |
| 3   | Module chuyển RS485          | UART TTL to RS485 V2 (auto)                               |    —     | Đấu thẳng                            |
| 4   | Cảm biến tiếng ồn            | ES-NOISE-01                                               |    1     | 4800bps                              |
| 5   | Cảm biến CO2                 | ES-CO2-01                                                 |    2     | 4800bps                              |
| 6   | Cảm biến NH3                 | ES-NH3-01 (0-500ppm)                                      |    3     | 4800bps                              |
| 7   | Cảm biến ánh sáng            | ES-ALS-02 (0-200k Lux)                                    |    4     | 4800bps                              |
| 8   | Cảm biến nhiệt-ẩm            | ES35-SW (SHT35)                                           |    5     | Đổi 9600→4800; cuối bus, DIP Pin5 ON |

### 2.2. Nguồn & phân phối

| STT | Thiết bị                  | Model thực tế                                   | Ghi chú                                              |
| --- | ------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| 9   | Nguồn                     | AC Adapter 12V/2A (jack DC)                     | Đã có                                                |
| 10  | Mạch hạ áp #1             | **Buck LM2596 3A** (in 3-30V, out 1.5-30V, 92%) | 12V→5V cho ESP32 + module RS485                      |
| 11  | Mạch hạ áp #2             | **Buck LM2596 3A** (thứ 2)                      | 12V→5V cho PAM8403 + DFPlayer + relay (tải nặng hơn) |
| 12  | Domino phân phối          | **TB1504 (4 mối, 15A/600V)**                    | Chia nguồn 12V                                       |
| 13  | Dây điện nhiều lõi (mỏng) | —                                               | Đấu nối                                              |

### 2.3. Relay & Actuator

| STT | Thiết bị                                    | Model thực tế                                                                       | Kênh/GPIO    | Ghi chú                                                                                                          |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| 14  | **Module 4 Relay 5V opto cách ly kích H/L** | Chọn mức kích bằng Jumper, 250VAC-10A/30VDC-10A, ~200mA/relay                       | —            | Đã mua                                                                                                           |
| 15  | Mạch phun sương siêu âm 108KHz              | 5V Type-C, ~300mA (<2W), board 45×19mm, loa siêu âm Ø20/12mm, kèm bông 10cm + gá đỡ | IN1 · GPIO25 | Tăng ẩm. **Tải 5V thật** (không phải 12V/220V) — COM relay lấy nguồn từ Buck #1                                  |
| 16  | Quạt tản nhiệt 12V 5x5cm                    | 12V/0.09A (~1.08W), 4000±10%rpm, 18dB, 18.17-25.97 CFM, 2 dây JST-PH                | IN3 · GPIO27 | ⚠️ Quạt cho mô hình demo (không đủ công suất thông gió chuồng thật). **Tải 12V** — COM relay lấy trực tiếp từ rail 12V (Domino TB1504), không qua Buck |
| 17  | (dự phòng: sưởi/đèn)                        | —                                                                                   | IN4 · GPIO14 | Mở rộng                                                                                                          |

### 2.4. Hệ thống âm thanh Loa ru

| STT | Thiết bị                                  | Model thực tế                                                                | Ghi chú                                                                                                               |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 18  | **DFPlayer Mini**                         | MP3/WAV/WMA từ microSD (FAT16/32, ≤32GB), ampli tích hợp, điều khiển UART/IO | Thư mục ≤100, mỗi mục ≤255 bài; 6 mức âm lượng                                                                        |
| 19  | **Amply PAM8403 6W Hifi 2.0 (có volume)** | Class-D, 2×3W, nguồn 5V-1.2A, loa 4Ω/8Ω, có núm chỉnh volume + lọc nhiễu     | Cần nguồn đủ 1.2A                                                                                                     |
| 20  | Thẻ microSD                               | ≤32GB FAT32                                                                  | Chứa file âm thanh                                                                                                    |
| 21  | Loa ru                                    | **Loa 8Ω 10W**, 50×90mm, dày 38.5mm                                          | Nguồn amply đóng/ngắt qua Relay IN2; PAM8403 6W ra ~2-3W thực tế trên 8Ω (dưới ngưỡng chịu tải 10W của loa — an toàn) |
| 22  | Điện trở 1kΩ                              | —                                                                            | Bảo vệ chân RX DFPlayer                                                                                               |

### 2.5. Camera (tách nhánh Vision — xem guide camera riêng)

| STT | Thiết bị                                                                          | Ghi chú                           |
| --- | --------------------------------------------------------------------------------- | --------------------------------- |
| 23  | Camera nhà yến IP 2MP **IR 940nm** (không phát sáng), 2.8mm góc rộng, IP66+, RTSP | Xem `Camera_Guide_NhaYen_Full.md` |

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
                                                    │                    └─[qua Relay IN1]─> Mạch phun sương 108KHz (~0.3A)
                                                    ├── Buck #2 (12V→5V) ──> PAM8403 + DFPlayer + Relay logic (~2.1A)
                                                    │                    └─[qua Relay IN2]─> Nguồn PAM8403
                                                    └── 12V trực tiếp ──┬─> 5 cảm biến (~0.5A)
                                                                         └─[qua Relay IN3]─> Quạt tản nhiệt 12V (~0.09A)
```

⚠️ **Cập nhật v3.5:** quạt tản nhiệt thực tế là **12V 5x5cm** (0.09A) — COM của Relay IN3 lấy trực tiếp từ **rail 12V** (Domino TB1504), không qua Buck nào cả. Mạch phun sương vẫn là tải **5V** (không đổi từ v3.4) → COM của Relay IN1 lấy nguồn từ **Buck #1** (còn dư tải), KHÔNG lấy từ Buck #2 (đã sát ngưỡng 2.1A). Xem [9.2](#92-phía-tải-nocom).

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

Bạn đã mua **module "4 Relay Module High/Low Level"** (relay Tongling JQC-3FF-S-Z 5VDC, 10A/250VAC), opto cách ly, kích H/L chọn bằng Jumper — đã xác nhận thực tế trên board:

- **Domino điều khiển** (góc dưới trái board, in nhãn rõ): **DC+ / DC- / IN1 / IN2 / IN3 / IN4** — DC+ = VCC 5V, DC- = GND. Đấu 6 dây vít vào đây, không phải header rời.
- **Domino tải**: mỗi relay có 3 domino riêng (NC-COM-NO) nằm cạnh relay tương ứng, tổng 12 domino cho 4 kênh.
- **Jumper H/L: khối jumper màu VÀNG ở góc trên trái board**, nhãn dọc bên cạnh ghi **"S1 S2 S3 S4"** (ứng với IN1-IN4) và **"H"/"L"** đánh dấu 2 hàng chân — **mỗi kênh có 1 jumper riêng** (4 jumper độc lập, không phải 1 jumper chung cho cả board).
- ⚠️ **Đây là thao tác VẬT LÝ, không phải code:** tắt nguồn → rút từng nắp jumper vàng → cắm lại vào hàng chân gần chữ **"H"** (hàng phía trên, gần các relay) cho cả 4 kênh S1-S4. Việc này quyết định phần cứng cần mức điện áp nào ở chân IN để đóng relay, độc lập với firmware.
- **Khuyến nghị SwiftletCare:** đặt cả 4 jumper vật lý ở **"H" (High)** cho trực quan — firmware dùng `digitalWrite(pin, HIGH)` = bật thiết bị, `LOW` = tắt. Jumper và code **phải khớp nhau**; nếu để jumper "L" mà code vẫn `HIGH`=bật thì relay sẽ hoạt động ngược.
- Opto + transistor cách ly → an toàn cho ESP32.
- Tiếp điểm relay Tongling JQC-3FF-S-Z: **10A/250VAC, 15A/125VAC** → đóng được cả tải 220VAC.
- Dòng tiêu thụ ~200mA/relay khi đóng.

## 9. Ánh xạ & đấu nối Relay

### 9.1. Phía điều khiển (domino DC+/DC-/IN1-4 trên board relay)

| Chân domino relay | Nối vào (domino đế ESP32)       |
| ------------------ | ------------------------------- |
| DC+                 | 5V (từ Buck #2)                 |
| DC-                 | GND chung                       |
| IN1                 | GPIO25 — mạch phun sương 108KHz |
| IN2                 | GPIO26 — nguồn amply loa ru     |
| IN3                 | GPIO27 — quạt tản nhiệt 12V demo |
| IN4                 | GPIO14 — dự phòng               |

> Đặt cả 4 jumper vàng (S1-S4) ở hàng **"H"**. Firmware: `digitalWrite(IN, HIGH)` = bật.

### 9.2. Phía tải (NO/COM)

```
Nguồn tải (+) ──► COM ──[relay đóng]──► NO ──► dây (+) thiết bị
Nguồn tải (-) ─────────────────────────────► dây (-) thiết bị
```

- **IN1→mạch phun sương 108KHz**: COM lấy **5V từ Buck #1**, NO→dây (+) mạch phun sương, GND chung → NO-COM. Mặt loa siêu âm có vết hàn hướng lên (mặt phun sương); mặt còn lại tiếp nước qua bông 10cm.
- **IN3→quạt tản nhiệt 12V 5x5cm**: COM lấy **12V trực tiếp từ Domino TB1504** (không qua Buck), NO→dây đỏ (+) quạt, GND/dây đen (-) quạt → GND chung. Quạt 2 dây JST-PH, không có dây PWM/tacho — chỉ bật/tắt qua relay, không đọc được tốc độ.
- **IN2→nguồn cấp PAM8403** (5V từ Buck #2, qua NO-COM) → relay đóng thì amply mới có điện.
- ⚠️ Nếu sau này đổi quạt/phun sương sang bản 220V thật (ngoài phạm vi demo), COM phải đổi sang rail 220VAC (cần người có chuyên môn điện); relay chịu tối đa 250VAC-10A / 30VDC-10A.

---

# PHẦN IV — HỆ THỐNG LOA RU

## 10. DFPlayer Mini (đã mua)

- Đọc MP3/WAV/WMA từ microSD (FAT16/32, ≤32GB).
- Có **ampli tích hợp** (loa nhỏ đấu thẳng SPK1/SPK2 được), hoặc xuất DAC ra PAM8403.
- Điều khiển qua **UART** (hoặc chân IO).
- File tổ chức theo thư mục (≤100 mục, mỗi mục ≤255 bài) — tiện quản lý nhiều tiếng loa ru khác nhau.
- 6 mức âm lượng (điều khiển bằng lệnh).

**Đấu nối:**
| Chân DFPlayer | Nối vào |
|---|---|
| VCC | 5V (Buck #2) |
| GND | GND chung |
| RX | GPIO33 ESP32 **qua trở 1kΩ** |
| TX | GPIO32 ESP32 (tuỳ chọn) |
| DAC_R / DAC_L / GND | → input PAM8403 |

**Lệnh (thư viện DFRobotDFPlayerMini):** `volume(0-30)`, `play(1)`, `loop(1)`, `stop()`.

## 11. Amply PAM8403 6W có volume (đã mua)

- Class-D 2×3W (tổng 6W), nguồn **5V-1.2A** (cần đủ dòng — lý do dùng Buck #2 riêng).
- Loa 4Ω/8Ω.
- **Có núm chỉnh volume vật lý** + lọc nhiễu → âm thanh tốt hơn.
- ⚠️ Điện áp **không vượt 5.5V, không đấu ngược** (theo nhà sản xuất) → chỉnh Buck #2 đúng 5V.

**Đấu nối:**
| Chân PAM8403 | Nối vào |
|---|---|
| VCC (5V) | 5V từ Buck #2 (qua Relay IN2 để đóng/ngắt) |
| GND | GND chung |
| L / R input | DAC_L / DAC_R của DFPlayer |
| L+/L- output | Loa ru |

> Núm volume vật lý trên PAM8403 chỉnh mức tối đa; DFPlayer chỉnh mức mềm qua lệnh. Kết hợp cả 2.

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

| Nhánh             | Thiết bị                                                                     | Dòng     |
| ----------------- | ------------------------------------------------------------------------------ | -------- |
| **Buck #1 (5V)**  | ESP32 + module RS485 (~0.5A) + mạch phun sương (~0.3A, qua IN1)                | ~0.8A    |
| **Buck #2 (5V)**  | PAM8403 (1.2A) + DFPlayer (~0.3A) + relay (4×0.2A=0.8A)                        | ~2.3A ⚠️ |
| **12V trực tiếp** | 5 cảm biến (~0.5A) + quạt tản nhiệt 12V (~0.09A, qua IN3)                      | ~0.59A   |

⚠️ **Cảnh báo:** nhánh Buck #2 có thể chạm/vượt 2.1-2.3A khi loa phát hết công suất + cả 4 relay đóng cùng lúc (dòng cuộn hút relay tính cả IN1/IN3 dù tải thực đã chuyển sang Buck #1/rail 12V). Buck LM2596 3A **vừa đủ** nhưng sát ngưỡng.

- Quạt tản nhiệt (12V, 0.09A) gần như không đáng kể trong ngân sách — đi thẳng từ rail 12V (dư ~11.4A so với Adapter 2A) qua relay IN3, không ảnh hưởng Buck nào.
- Mạch phun sương chuyển sang **Buck #1** (thay vì gộp vào Buck #2 như thiết kế cũ với tải 12V/220V), nên Buck #2 **không bị nặng thêm** so với v3.3 — vẫn chỉ gánh PAM8403+DFPlayer+relay.

- **Khuyến nghị:** nếu loa ru công suất lớn, **cấp nguồn 220VAC riêng cho amply/loa** (relay IN2 đóng/ngắt 220V), giảm tải cho Buck #2 → an toàn hơn nhiều.
- Tổng từ Adapter 12V/2A: nếu tất cả tải 12V+5V cộng lại vượt 2A (24W) → cân nhắc nâng adapter lên **12V/3A hoặc 5A**, hoặc tách nguồn 220V cho loa/bơm/quạt.

## 14. Checklist lắp ráp

- [ ] Cấu hình 5 cảm biến (ID 1-5, cùng 4800bps) bằng ESP32 sketch — đổi baud ES35-SW
- [ ] Cắm ESP32 38 chân vào đế mở rộng, bắt vít vào hộp
- [ ] Đấu AC Adapter 12V → Domino TB1504
- [ ] Chỉnh Buck #1 ra 5V (đo VOM) → cấp ESP32 + module RS485 + tải phun sương (qua relay IN1)
- [ ] Chỉnh Buck #2 ra 5V (đo VOM) → cấp PAM8403 + DFPlayer + relay (logic)
- [ ] Đấu bus RS485: module → 5 cảm biến (ES35-SW cuối bus, DIP Pin5 ON, màu dây riêng)
- [ ] Đặt jumper vàng cả 4 kênh (S1-S4) ở hàng "H" (High level)
- [ ] Đấu relay IN1/IN2/IN3/IN4 → GPIO25/26/27/14
- [ ] Đấu tải: IN1→mạch phun sương (COM từ Buck #1, 5V), IN3→quạt tản nhiệt 12V (COM từ rail 12V trực tiếp), IN2→nguồn PAM8403 (COM từ Buck #2)
- [ ] Lắp bông 10cm vào gá đỡ trên loa siêu âm (mặt có vết hàn hướng lên), đổ nước đúng mức trước khi cấp điện mạch phun sương
- [ ] Chép file MP3 (0001.mp3...) vào thẻ SD, cắm DFPlayer
- [ ] Đấu DFPlayer: RX←GPIO33 (trở 1kΩ), TX→GPIO32, DAC→PAM8403→loa 8Ω 10W
- [ ] Nạp firmware, test: đọc 5 cảm biến, bật/tắt 4 relay (kể cả phun sương/quạt), phát loa ru
- [ ] Kiểm tra dB tăng khi loa kêu (verify SPEAKER_FAILURE logic)

---

_Guide v3.5 sửa lại thông số quạt tản nhiệt theo linh kiện THẬT: **12V 5x5cm (0.09A)**, không phải 5V 4x4x1cm như v3.4 ghi nhầm. Do đó COM relay IN3 chuyển về lấy **trực tiếp từ rail 12V** (không qua Buck #1 nữa) — chỉ mạch phun sương 108KHz (5V) mới lấy nguồn từ Buck #1. Quạt tản nhiệt vẫn chỉ phù hợp mô hình demo, không thay thế quạt thông gió công suất lớn cho chuồng thật. Kế thừa v3.4: mạch phun sương siêu âm 108KHz, loa 8Ω 10W, board relay Tongling JQC-3FF-S-Z với domino DC+/DC-/IN1-4 và jumper vàng S1-S4 riêng từng kênh. Kế thừa v3.3: 2 mạch Buck (tách nguồn cho PAM8403 6W), đế mở rộng ESP32 (không cần hàn). Đi kèm SRS v1.11.0. Camera xem guide riêng._
