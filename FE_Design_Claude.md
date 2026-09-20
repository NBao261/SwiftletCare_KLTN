# FE_Design_Claude.md
### Hệ thống thiết kế Frontend — SwiftletCare Ops Console

> Nguồn sự thật duy nhất (single source of truth) về thiết kế FE của SwiftletCare. Mọi trang, component, màu sắc khi code (kể cả qua Claude Code) phải bám theo file này. Nếu thiếu quy định cho 1 tình huống mới — bổ sung vào đây trước, không tự sáng tạo lệch chuẩn.

**Phiên bản:** 2.2.0 · **Cập nhật:** 20/09/2026 · **Thay thế:** v2.1.0

---

## 0. Changelog

### v2.1.0 → v2.2.0
| # | Thay đổi |
|---|---|
| 1 | **Bỏ hoàn toàn 2 khối blur trang trí (lime + cam)** khỏi nền cố định. `.content-canvas` giờ là **1 màu phẳng duy nhất `#EAEAEA`**, không còn pseudo-element `::before/::after`. Cấu trúc 2 lớp "nền cố định / nội dung cuộn riêng" (mục 4.2) vẫn giữ nguyên — chỉ bỏ phần trang trí bên trong lớp nền, không bỏ cơ chế fixed-canvas + scroll riêng. |

### v2.0.0 → v2.1.0
| # | Thay đổi |
|---|---|
| 1 | **Xoá bỏ hoàn toàn màu "Ink" `#111728`** — đã xác minh bằng số: màu này có **hue 224° (xanh dương/navy), saturation 40%**, hoàn toàn lệch tông so với phần còn lại của hệ thống (mọi màu khác đều là warm-neutral hue ~26–30° hoặc các hue lime/cam/đỏ đã định nghĩa). Đây chính xác là điều người dùng phát hiện: *"Web không hề có màu #111728 ám xanh dương"*. |
| 2 | **Gộp "Ink" vào chung 1 thang "Gray" ấm (warm neutral)** duy nhất, neo bằng 4 mã màu mới: `WHITE #FFFFFF`, `WARM GRAY #878380`, `GRAPHITE #4E4A46`, `CHARCOAL #27231F`, `BLACK #000000` — tất cả cùng hue ~28°, không còn 2 hệ màu tối song song (Ink vs Gray) như v2.0.0, giảm rủi ro lệch tông về sau. |
| 3 | `LIME MIST #ECFFA9` xác nhận lại giá trị chính xác cho vai trò "xanh nền bề mặt" (trước là `#F0FEB3`, chênh lệch không đáng kể — cập nhật về đúng mã mới). |
| 4 | Mọi nơi từng dùng `--ink-850` (button Primary, text-primary, modal overlay, shadow tint, sidebar/topbar qua token) nay trỏ về `--gray-900` (= Charcoal). `--gray-950` (= Black) dành riêng cho nhu cầu tương phản tuyệt đối (nếu có). |

### v1.0.0 → v2.0.0
Xem tóm tắt ở Phụ lục C.

---

## 1. Tổng quan & Nguyên tắc thiết kế

SwiftletCare Ops Console là phần mềm vận hành kỹ thuật (giám sát cảm biến, điều khiển PLC, AI vision, cảnh báo, ticket, nhân sự) — ưu tiên **đọc số liệu nhanh, chính xác, đáng tin cậy** hơn trang trí.

1. **Nền xám là sân khấu, nền trắng là diễn viên.** `#EAEAEA` (canvas) không bao giờ là nơi đặt nội dung trực tiếp — mọi text/số liệu/control đều nằm trong 1 khung trắng nổi lên trên.
2. **Không pha màu ngoài hệ thống — tuyệt đối.** Kể cả các sắc xám/đen cũng phải nằm trong đúng 1 hue ấm (~28°) đã chốt ở mục 2 — không dùng lại bất kỳ mã xám/đen "mặc định của framework" (VD `#000`, `#333`, Tailwind `slate/zinc` mặc định) vì các mã đó thường có tông lạnh khác hue hệ thống.
3. **Sidebar/Topbar là vùng đóng băng.** Layout, kích thước giữ nguyên 100% theo code hiện tại. Chỉ 2 việc được phép chạm: (a) logo ảnh (mục 3), (b) token màu ngữ nghĩa đổi giá trị hex — sidebar/topbar tự ăn theo token mới, không cần và không được sửa CSS/kích thước của chính nó.
4. **Không có gì "giả" mà không được gắn nhãn.** Số liệu chưa có API thật phải tự khai báo (mục 7).
5. **Một ngôn ngữ chữ, một hệ bo góc, một hệ shadow, một hệ xám** — dùng xuyên suốt, không phát sinh biến thể lẻ tẻ giữa các trang/role (mục 9).

---

## 2. Bảng màu hệ thống (Design Tokens — Màu)

### 2.1. Các màu neo (anchor)

| Vai trò | Hex | Ghi chú |
|---|---|---|
| Nền chính toàn app | `#EAEAEA` | Canvas cố định phía sau mọi trang nội dung |
| Cam cảnh báo/quá nhiệt | `#ED8F50` | Mức MEDIUM/HIGH |
| Đỏ cảnh báo/nguy hiểm | `#D53F35` | CRITICAL, badge thông báo |
| Xanh chanh (brand/success) | `#D5E688` | Online, thành công, điểm nhấn |
| Xanh nền bề mặt — **LIME MIST** | `#ECFFA9` | Nền icon-box, chip, highlight nhẹ *(cập nhật chính xác từ `#F0FEB3`)* |
| Trắng — **WHITE** | `#FFFFFF` | Sidebar, khung nổi |
| Xám ấm trung — **WARM GRAY** | `#878380` | Text phụ, icon mờ |
| Xám ấm đậm — **GRAPHITE** | `#4E4A46` | Text đậm phụ, icon neutral đậm |
| Đen ấm — **CHARCOAL** | `#27231F` | **Text chính, bề mặt tối chính** — thay thế hoàn toàn `#111728` |
| Đen tuyệt đối — **BLACK** | `#000000` | Dự phòng cho nhu cầu tương phản tối đa |

**Bằng chứng loại bỏ `#111728`:**

| Màu | Hue | Saturation | Kết luận |
|---|---|---|---|
| `#111728` (cũ) | **224°** (xanh dương) | 40% | Lệch hoàn toàn khỏi hệ thống — đây là lỗi cần sửa |
| `#27231F` Charcoal | 30° (ấm) | 11% | |
| `#4E4A46` Graphite | 30° (ấm) | 5% | Cùng 1 họ hue ấm — nhất quán |
| `#878380` Warm Gray | 26° (ấm) | 3% | |

### 2.2. Thang màu đầy đủ

```css
/* GRAY — 1 thang xám ấm DUY NHẤT, thay cho cặp Gray+Ink cũ. Hue ~28° xuyên suốt. */
--gray-0:   #FFFFFF;   /* = WHITE */
--gray-50:  #F9F9F9;
--gray-100: #F0F0F0;
--gray-200: #EAEAEA;   /* = neo "nền chính toàn app" — giữ nguyên giá trị đã chốt, không nội suy */
--gray-300: #C5C4C3;   /* border trên nền trắng */
--gray-400: #A5A3A1;   /* icon/text disabled */
--gray-500: #878380;   /* = WARM GRAY — text phụ (secondary) */
--gray-600: #6D6865;
--gray-700: #4E4A46;   /* = GRAPHITE — icon neutral đậm, text đậm phụ */
--gray-800: #393430;
--gray-900: #27231F;   /* = CHARCOAL — TEXT CHÍNH, bề mặt tối chính (thay #111728) */
--gray-950: #000000;   /* = BLACK — dự phòng tương phản tối đa */

/* LIME — bề mặt nhạt, neo tại #ECFFA9 (LIME MIST) */
--lime-50:  #FDFFF3; --lime-100: #FAFFE6; --lime-200: #F5FFD0;
--lime-300: #ECFFA9;  /* = LIME MIST — "xanh nền bề mặt" */
--lime-400: #DFFD73; --lime-500: #D2F93A; --lime-600: #BEEC08;
--lime-700: #8FAF08; --lime-800: #677E09; --lime-900: #445407;

/* ACCENT — xanh chanh thương hiệu (online/success/active), neo tại #D5E688 */
--accent-50:  #F9FBEE; --accent-100: #F0F6D5; --accent-200: #E6F0B7;
--accent-300: #D5E688;  /* = màu neo — 42926A cũ */
--accent-400: #CCE170; --accent-500: #C6DD5D; --accent-600: #B5D32C;
--accent-700: #89A022; --accent-800: #627218; --accent-900: #414C10;

/* ORANGE — cảnh báo mức vừa/quá nhiệt, neo tại #ED8F50 */
--orange-50: #FDF3ED; --orange-100: #FAE1D1; --orange-200: #F6CAAC;
--orange-300: #F3B287; --orange-400: #EF9A62;
--orange-500: #ED8F50;  /* = màu neo — "mức độ quá nhiệt" */
--orange-600: #E87121; --orange-700: #B95613; --orange-800: #8B400E; --orange-900: #612D0A;

/* RED — cảnh báo/nguy hiểm, neo tại #D53F35 */
--red-50: #FBEFEE; --red-100: #F6D7D5; --red-200: #EFB7B3;
--red-300: #E68F89; --red-400: #DC5E56;
--red-500: #D53F35;  /* = màu neo — "thông báo hoặc cảnh báo" */
--red-600: #B12E25; --red-700: #87231C; --red-800: #611914; --red-900: #44110E;
```

### 2.3. Token ngữ nghĩa

```css
--bg-canvas:          var(--gray-200);  /* #EAEAEA */
--bg-surface:          #FFFFFF;
--bg-surface-sunken:   var(--gray-50);

--text-primary:   var(--gray-900);   /* = Charcoal #27231F — KHÔNG còn dùng #111728 */
--text-secondary: var(--gray-500);   /* = Warm Gray #878380 */
--text-disabled:  var(--gray-400);
--text-on-dark:   #FFFFFF;

--border-default: var(--gray-300);
--border-subtle:  var(--gray-200);

--success:  var(--accent-600);
--brand:    var(--accent-300);
--warning:  var(--orange-500);
--danger:   var(--red-500);
--badge-default: var(--red-500);

--focus-ring: rgba(213, 230, 136, 0.55);  /* accent-300 mờ */
```

> **Không tạo token `--ink-*` mới.** Bất kỳ chỗ nào cần "màu đậm/quyền lực" (nút Primary, avatar, logo box, nav active...) đều dùng `--gray-900` (Charcoal) — kể cả bên trong sidebar/topbar, thông qua token, không hardcode lại `#111728`.

### 2.4. Mức độ cảnh báo (Alert Severity)

| Mức | Hex chữ/icon | Hex nền tint |
|---|---|---|
| `CRITICAL` | `--red-500` `#D53F35` | `--red-50` |
| `HIGH` | `--orange-600` `#E87121` | `--orange-100` |
| `MEDIUM` | `--orange-500` `#ED8F50` | `--orange-50` |
| `LOW` | `--gray-600` `#6D6865` | `--gray-100` |

### 2.5. Trạng thái an toàn / thiết bị

| Trạng thái | Hex |
|---|---|
| An toàn / ONLINE | `--accent-600` `#B5D32C` |
| Cảnh báo nhẹ / PENDING | `--orange-500` `#ED8F50` |
| Vượt ngưỡng / ERROR | `--red-500` `#D53F35` |
| OFFLINE | `--gray-400` `#A5A3A1` |

### 2.6. Nguyên tắc màu dữ liệu cảm biến (không đổi so với v2.0.0)

Màu **không** gắn với loại cảm biến — gắn với **trạng thái an toàn hiện tại**: an toàn → `accent-600`, gần ngưỡng → `orange-500`, vượt ngưỡng → `red-500`. Loại cảm biến nhận diện bằng icon + label: Nhiệt độ `Thermometer`, Độ ẩm `Droplets`, Ánh sáng `Sun`, CO2 `Wind`, NH3 `FlaskConical`, Âm thanh `Volume2`. Series so sánh/ngữ cảnh trong chart đa-đường dùng thang `gray-300 → gray-700` (giờ đã là xám ấm, không còn ám xanh).

### 2.7. Icon-box content area — 4 biến thể tông màu

| Biến thể | Nền | Icon | Border | Dùng khi |
|---|---|---|---|---|
| Neutral (mặc định) | `--gray-100` | `--gray-700` (Graphite) | `--gray-200` | Icon chức năng chung |
| Lime/Accent (tích cực) | `--lime-200` | `--accent-700` | `--accent-200` | An toàn, hoàn tất |
| Orange (cảnh báo vừa) | `--orange-100` | `--orange-600` | `--orange-200` | MEDIUM/HIGH |
| Red (nguy hiểm) | `--red-100` | `--red-600` | `--red-200` | CRITICAL, lỗi |

Vuông bo nhẹ `--radius-md` (12px), 40×40px chuẩn / 56×56px feature lớn. **Ngoại lệ:** icon trong sidebar giữ nguyên code hiện tại.

### 2.8. Typography

Font duy nhất: **Plus Jakarta Sans** (Google Fonts), weight 400–800.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
```

| Token | Size/Line-height | Weight | Dùng cho |
|---|---|---|---|
| `text-h1` | 26px/34px | 700 | Tiêu đề trang |
| `text-h2` | 20px/28px | 600 | Tiêu đề section/card |
| `text-h3` | 16px/24px | 600 | Tiêu đề nhỏ |
| `text-body` | 14px/22px | 400/500 | Nội dung mặc định |
| `text-small` | 13px/18px | 400 | Label phụ, timestamp |
| `text-caption` | 11px/16px | 600, spacing 0.04em | Nhãn nhóm nav (sidebar) |
| `text-metric` | 32px/38px | 700, tabular-nums | Số liệu lớn |
| `text-mock-notice` | 11px/16px | 500, italic | `--gray-500` — dòng "FAKE data" |

---

## 3. Logo

2 file ảnh, đầu sidebar: `[Logo_SCare_Icon.png]  [Logo_SCare_Text.png]`

- Container: `display:flex; align-items:center; gap:10px;` — giữ nguyên khối padding sidebar hiện có.
- Icon: 40×40px, `object-fit:contain`. Nếu file là icon phẳng chưa có nền → giữ khung lót `background: var(--gray-900)` (Charcoal, **không còn `#111728`**) bo góc `--radius-md` hiện có của sidebar; nếu ảnh đã tự có nền → đặt trực tiếp, bỏ khung lót.
- Text: `height:24px; object-fit:contain; width:auto`.
- Asset tại `/public/brand/`, dùng `<img alt="SwiftletCare">`, không dùng `background-image`.

---

## 4. Bố cục (Layout)

### 4.1. Sidebar & Topbar — đóng băng

Layout/kích thước giữ nguyên 100%. Chỉ đổi: (1) logo (mục 3), (2) giá trị hex của token màu mà sidebar/topbar đang tham chiếu (avatar, nav active pill, dot trạng thái... vốn đang dùng biến `--gray-900`/`--success`/`--danger` — nay các biến này tự mang giá trị mới, sidebar không cần sửa code).

### 4.2. Content Canvas System — nền cố định 1 màu phẳng

Không còn khối blur trang trí. Nền cố định là **1 màu phẳng duy nhất `#EAEAEA`**, không hoa văn, không blob màu. Vẫn giữ nguyên cơ chế 2 lớp (nền không cuộn / nội dung cuộn riêng) — chỉ đơn giản hoá phần thị giác của lớp nền:

```
.content-shell (position:relative; height:100vh; overflow:hidden)
 ├─ .content-canvas (position:absolute; inset:0; z-index:0; pointer-events:none)
 │    background: var(--bg-canvas);              ← #EAEAEA cố định, phẳng, KHÔNG cuộn
 └─ .content-scroll (position:relative; z-index:1; height:100%; overflow-y:auto; padding:32px)
      [Topbar sticky — không đổi]
      [Card trắng cuộn theo nội dung]
```

```css
.content-shell { position: relative; height: 100vh; overflow: hidden; }
.content-canvas { position: absolute; inset: 0; z-index: 0; background: var(--bg-canvas); pointer-events: none; }
.content-scroll { position: relative; z-index: 1; height: 100%; overflow-y: auto; padding: 32px; max-width: 1440px; margin: 0 auto; }
```

> Đã bỏ `.content-canvas::before/::after` (2 khối blur lime/cam) so với v2.1.0 — không dùng `filter:blur()` hay pseudo-element màu trong lớp nền nữa. Card trắng vẫn nổi rõ nhờ shadow (mục 4.3), không cần thêm khối màu phía sau để tạo chiều sâu.

### 4.3. Card trắng — bo góc & shadow

```css
--radius-sm:8px; --radius-md:12px; --radius-lg:16px; --radius-xl:20px; --radius-2xl:28px; --radius-full:9999px;

/* Shadow tint theo đúng Charcoal (39,35,31) — không còn dùng rgb của #111728 (17,23,40) */
--shadow-card:       0 1px 2px rgba(39,35,31,.04), 0 8px 24px rgba(39,35,31,.06);
--shadow-card-hover: 0 2px 4px rgba(39,35,31,.05), 0 12px 32px rgba(39,35,31,.09);
--shadow-modal:      0 24px 64px rgba(39,35,31,.18);
```

Card mặc định: `background:#FFFFFF; border-radius:var(--radius-xl); box-shadow:var(--shadow-card); padding:24px;` (không cần border — shadow đã đủ tách khỏi canvas xám). Card lớn bọc nhiều card con: `padding:28–32px`, `radius-2xl`.

---

## 5. Thư viện Component

### 5.1. Button

| Variant | Nền | Chữ |
|---|---|---|
| Primary | `--gray-900` (Charcoal) | trắng |
| Success | `--accent-600` | `--gray-900` |
| Secondary | `#FFFFFF`, border `--gray-300` | `--gray-900` |
| Danger | `--red-500` | trắng |
| Ghost | trong suốt | `--gray-700` |

Radius `--radius-md`, height 40px.

### 5.2. Popup xác nhận (CRUD & Đăng xuất) — nền mờ, không nền đen

```css
.modal-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(39, 35, 31, 0.14);   /* Charcoal rất nhạt — KHÔNG dùng rgba(0,0,0,x) */
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.modal-panel {
  background:#FFFFFF; border-radius:var(--radius-xl);
  box-shadow: var(--shadow-modal); padding:28px; max-width:420px;
}
```
Icon-box cảnh báo trên cùng (biến thể Orange/Red mục 2.7) → tiêu đề → mô tả hậu quả → 2 nút: Secondary "Huỷ" / Danger hoặc Primary "Xác nhận". Đóng bằng `Esc`/click-outside, trừ hành động CRITICAL không thể hoàn tác bắt buộc bấm nút.

### 5.3–5.9. Card, Table, Tabs, Form, Alert, Gauge...

Hành vi giữ nguyên theo v2.0.0 — chỉ đổi giá trị màu: mọi chỗ trước đây ghi `--ink-850`/`#111728` nay đọc `--gray-900`. Vạch ngưỡng trên Gauge dùng `--gray-700` (Graphite, tự động cập nhật qua token).

### 5.4. `<MockDataNotice />`

```
Tiêu đề section
This data is FAKE and has not been MOCKAPI     ← text-mock-notice, --gray-500, italic
```

---

## 6. i18n — Đa ngôn ngữ (VI/EN)

*(Không đổi so với v2.0.0)* — `react-i18next`, namespace theo module (`common`, `sidebar`, `dashboard`, `alerts`, `tickets`, `farm`, `sensors`, `roles`), không hardcode chuỗi hiển thị, đơn vị đo (°C/%/ppm/lux/dB) không dịch.

---

## 7. Chính sách công khai dữ liệu giả (Mock Data Disclosure)

*(Không đổi so với v2.0.0)* Đối chiếu SRS (cột "Trạng thái Backend") + backend thật trước khi bỏ nhãn. Bảng chi tiết theo SRS v1.18.0:

| Màn hình | FR liên quan | Trạng thái | Cần nhãn? |
|---|---|---|---|
| AI Giám sát đàn — đếm chim, return rate | VISION-FR-006/008/009/010/011 | 🟡 chờ dữ liệu thật từ Edge AI | **Có** |
| Phân tích tương quan môi trường ↔ return rate | ANALYTICS-FR-002/003 | 🟡 chờ dữ liệu VISION thật | **Có** |
| Cảnh báo thiên địch từ camera | THREAT-FR-001/002/003 | 🟡/⬜ | **Có** |
| Chat trực tiếp trong Ticket | TICKET-FR-014→017 | ⬜ Chưa cài | **Có** |
| Reset ngưỡng Zone về mặc định | ENV-FR-020 | ✅ Đã code (v1.18.0) | Không |
| Audit Log toàn hệ thống (Admin) | SYSTEM-FR-001 | ⬜ Chưa cài | **Có** |
| Cấu hình ngưỡng mặc định hệ thống (Admin) | SYSTEM-FR-002 | ⬜ Chưa cài | **Có** |
| Tổng quan sức khỏe hệ thống (Admin) | SYSTEM-FR-003 | ⬜ Chưa cài | **Có** |
| Module SALES (sản phẩm/đơn hàng/tồn kho) | SALES-FR-* | ⬜ Stub, GĐ2 | **Có** |
| Đăng bán/Truy xuất nguồn gốc (Marketplace) | MARKET-FR-* | ✅ Đã code | Không |
| Push notification FCM/Zalo/SMS thật | ALERT-FR-002/003/004 | 🟡 chưa nối credential | Có (màn cấu hình kênh) |

*Giới hạn:* phiên làm việc này không có quyền đọc repo backend thật — bảng trên cần đối chiếu lại code sống trước khi go-live.

---

## 8. Biểu đồ — Ma trận chọn loại theo mục tiêu dữ liệu

| Nhóm biểu đồ | Loại dữ liệu | Áp dụng SwiftletCare |
|---|---|---|
| Line/Area | Chuỗi thời gian | Nhiệt độ/độ ẩm/khí/dB theo 1h–30d, return rate theo ngày |
| Bar/Column | So sánh danh mục | So sánh đa-Zone, ticket theo Technician, sản lượng theo đợt |
| Donut/Pie/Treemap | Tỷ trọng/cơ cấu | Tỷ lệ cảnh báo theo mức độ, tỷ lệ thiết bị Online/Offline, cơ cấu tài khoản theo role |
| Histogram/Box Plot | Phân phối/mật độ | Phân phối nhiệt độ 30 ngày (phát hiện outlier), phân phối thời gian xử lý ticket vs SLA |
| Gauge/Bullet | 1 giá trị realtime vs ngưỡng | NH3/CO2/nhiệt độ/độ ẩm hiện tại vs `zones.thresholds`, đếm ngược Manual Override |

Trước khi dựng chart: tự hỏi *"chuỗi thời gian, danh mục, tỷ trọng, phân phối, hay giá trị-so-ngưỡng?"* — câu trả lời quyết định nhóm chart.

---

## 9. Đồng bộ bố cục đa vai trò

| Loại màn hình | Component dùng chung | Áp dụng |
|---|---|---|
| Bảng dữ liệu | `<DataTable />` | Mọi role |
| Nhật ký/lịch sử | `<Timeline />` | Admin Audit Log, Ticket notes, threshold_history |
| Cấu hình ngưỡng cảm biến | `<ThresholdConfigCard />` | Farm Owner (Zone) + Admin (mặc định hệ thống) — cùng component, khác quyền ghi |
| Popup xác nhận | `<ConfirmModal />` | Toàn bộ 4 role |
| Stat card | `<StatCard />` | Dashboard mọi role |

Trước khi thêm màn hình riêng cho 1 role: kiểm tra role khác đã có màn tương tự chưa — tái dùng component, khác nhau ở **data/quyền**, không khác nhau ở **giao diện**.

---

## 10. Nên / Không nên

**Nên:** icon-box đúng 4 biến thể (2.7) · kiểm bảng mục 7 trước khi hiển thị số liệu mới · tra bảng mục 8 trước khi chọn chart · dùng `t('...')` cho mọi chuỗi · dùng đúng 1 thang xám ấm (2.2) cho mọi nhu cầu "đậm/nhạt".

**Không nên:** không dùng màu ngoài mục 2 (kể cả xám mặc định của framework) · không đổi layout sidebar/topbar ngoài 2 ngoại lệ mục 4.1 · không dùng overlay đen `rgba(0,0,0,x)` cho modal — luôn `rgba(39,35,31,x)` + blur · không để card trắng chạm sát nhau không padding trên nền xám · không tạo bảng/form riêng cho từng role nếu bản chất giống nhau.

---

## 11. Implementation snippet

```css
:root {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;

  --gray-0:#FFFFFF; --gray-50:#F9F9F9; --gray-100:#F0F0F0; --gray-200:#EAEAEA;
  --gray-300:#C5C4C3; --gray-400:#A5A3A1; --gray-500:#878380; --gray-600:#6D6865;
  --gray-700:#4E4A46; --gray-800:#393430; --gray-900:#27231F; --gray-950:#000000;

  --lime-50:#FDFFF3; --lime-100:#FAFFE6; --lime-200:#F5FFD0; --lime-300:#ECFFA9;
  --lime-400:#DFFD73; --lime-500:#D2F93A; --lime-600:#BEEC08; --lime-700:#8FAF08;
  --lime-800:#677E09; --lime-900:#445407;

  --accent-50:#F9FBEE; --accent-100:#F0F6D5; --accent-200:#E6F0B7; --accent-300:#D5E688;
  --accent-400:#CCE170; --accent-500:#C6DD5D; --accent-600:#B5D32C; --accent-700:#89A022;
  --accent-800:#627218; --accent-900:#414C10;

  --orange-50:#FDF3ED; --orange-100:#FAE1D1; --orange-200:#F6CAAC; --orange-300:#F3B287;
  --orange-400:#EF9A62; --orange-500:#ED8F50; --orange-600:#E87121; --orange-700:#B95613;
  --orange-800:#8B400E; --orange-900:#612D0A;

  --red-50:#FBEFEE; --red-100:#F6D7D5; --red-200:#EFB7B3; --red-300:#E68F89;
  --red-400:#DC5E56; --red-500:#D53F35; --red-600:#B12E25; --red-700:#87231C;
  --red-800:#611914; --red-900:#44110E;

  --bg-canvas: var(--gray-200);
  --bg-surface: #FFFFFF;
  --bg-surface-sunken: var(--gray-50);
  --text-primary: var(--gray-900);
  --text-secondary: var(--gray-500);
  --text-disabled: var(--gray-400);
  --border-default: var(--gray-300);
  --success: var(--accent-600);
  --brand: var(--accent-300);
  --warning: var(--orange-500);
  --danger: var(--red-500);
  --badge-default: var(--red-500);
  --focus-ring: rgba(213,230,136,.55);

  --radius-sm:8px; --radius-md:12px; --radius-lg:16px; --radius-xl:20px; --radius-2xl:28px; --radius-full:9999px;

  --shadow-card: 0 1px 2px rgba(39,35,31,.04), 0 8px 24px rgba(39,35,31,.06);
  --shadow-card-hover: 0 2px 4px rgba(39,35,31,.05), 0 12px 32px rgba(39,35,31,.09);
  --shadow-modal: 0 24px 64px rgba(39,35,31,.18);

  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px;
  --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px; --space-16:64px;
}
```

### 11.1. Tailwind config extend

```js
module.exports = {
  theme: {
    extend: {
      fontFamily: { sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'] },
      colors: {
        gray:   { 0:'#FFFFFF',50:'#F9F9F9',100:'#F0F0F0',200:'#EAEAEA',300:'#C5C4C3',
                  400:'#A5A3A1',500:'#878380',600:'#6D6865',700:'#4E4A46',800:'#393430',
                  900:'#27231F',950:'#000000' },
        lime:   { 50:'#FDFFF3',100:'#FAFFE6',200:'#F5FFD0',300:'#ECFFA9',400:'#DFFD73',
                  500:'#D2F93A',600:'#BEEC08',700:'#8FAF08',800:'#677E09',900:'#445407' },
        accent: { 50:'#F9FBEE',100:'#F0F6D5',200:'#E6F0B7',300:'#D5E688',400:'#CCE170',
                  500:'#C6DD5D',600:'#B5D32C',700:'#89A022',800:'#627218',900:'#414C10' },
        orange: { 50:'#FDF3ED',100:'#FAE1D1',200:'#F6CAAC',300:'#F3B287',400:'#EF9A62',
                  500:'#ED8F50',600:'#E87121',700:'#B95613',800:'#8B400E',900:'#612D0A' },
        red:    { 50:'#FBEFEE',100:'#F6D7D5',200:'#EFB7B3',300:'#E68F89',400:'#DC5E56',
                  500:'#D53F35',600:'#B12E25',700:'#87231C',800:'#611914',900:'#44110E' },
      },
      borderRadius: { sm:'8px', md:'12px', lg:'16px', xl:'20px', '2xl':'28px' },
      boxShadow: {
        card:'0 1px 2px rgba(39,35,31,.04), 0 8px 24px rgba(39,35,31,.06)',
        cardHover:'0 2px 4px rgba(39,35,31,.05), 0 12px 32px rgba(39,35,31,.09)',
        modal:'0 24px 64px rgba(39,35,31,.18)',
      },
    },
  },
};
```

---

## Phụ lục A — Nguồn gốc màu v2.1 (thay `#111728`)

| Token | Hex | Nguồn |
|---|---|---|
| `--gray-900` (Charcoal) | `#27231F` | Chỉ định trực tiếp — thay `#111728` (H224°→H30°, loại bỏ ám xanh dương) |
| `--gray-700` (Graphite) | `#4E4A46` | Chỉ định trực tiếp |
| `--gray-500` (Warm Gray) | `#878380` | Chỉ định trực tiếp |
| `--gray-950` (Black) | `#000000` | Chỉ định trực tiếp — dự phòng |
| `--lime-300` (Lime Mist) | `#ECFFA9` | Chỉ định trực tiếp — cập nhật từ `#F0FEB3` |
| `--gray-200` | `#EAEAEA` | Giữ nguyên giá trị "nền chính" đã chốt trước đó, không nội suy lại |
| `--gray-0/50/100/300/400/600/800` | — | Nội suy HSL giữa các neo trên, cùng hue ~28° |

## Phụ lục B — Phụ lục màu v2.0 gốc (bối cảnh trước khi sửa Ink)

| Token | Hex | Nguồn |
|---|---|---|
| `--bg-canvas` | `#EAEAEA` | Chỉ định trực tiếp — "màu nền chính" |
| `--orange-500` | `#ED8F50` | Chỉ định trực tiếp — thay `#D0654C` |
| `--red-500` | `#D53F35` | Chỉ định trực tiếp |
| `--accent-300` | `#D5E688` | Chỉ định trực tiếp — thay `#42926A` |
| Bố cục nền cố định + blob blur, card trắng nổi khi cuộn | — | Tổng hợp phong cách từ ảnh tham khảo dashboard, tái tô hoàn toàn bằng bảng màu SwiftletCare |

## Phụ lục C — Tóm tắt v1.0.0 → v2.0.0

Đổi nền canvas trắng→xám; đổi 4 mã màu chính (D0654C→ED8F50, thêm D53F35, 42926A→D5E688, thêm F0FEB3/nay ECFFA9); logo chữ→logo ảnh; font Inter→Plus Jakarta Sans; thêm hệ nền cố định+blur; icon-box đổi kiểu nền nhạt/icon đậm; đóng băng sidebar/topbar; thêm i18n, popup xác nhận nền mờ, chính sách công khai dữ liệu giả, ma trận chọn chart, đồng bộ bố cục đa role.

---

*Hết tài liệu. Mọi thay đổi tiếp theo phải cập nhật mục Changelog (mục 0) kèm số phiên bản mới.*
