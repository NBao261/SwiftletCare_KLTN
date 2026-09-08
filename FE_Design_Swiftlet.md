# 🦜 DESIGN SYSTEM — AI‑SWIFTLET SMART MONITORING SYSTEM
### Web App · Admin Dashboard · Landing Page · Mobile (React Native)

**Nguyên tắc bắt buộc:** 
1. Nền mặc định của toàn bộ thiết bị (Web, App Mobile, Tablet) là **`#FFFFFF` (White)**.
2. Tuyệt đối **chỉ dùng 8 mã màu chuẩn** dưới đây — KHÔNG phối thêm bất kỳ màu nào khác.
3. Chi tiết kích thước, bo góc (border-radius), button, card và layout được chuẩn hóa chính xác theo 6 ảnh mẫu (Homely Smart Home Case Study).

---

## 1. BẢNG 8 MÃ MÀU BẮT BUỘC (KHÔNG DÙNG MÀU NGOÀI)

| Tên Màu | Mã Hex | Vai trò & Quy tắc sử dụng chuẩn theo Ảnh mẫu |
|---|---|---|
| **White** | `#FFFFFF` | **Nền mặc định toàn bộ màn hình thiết bị** (Web/App/Tablet), nền Card sáng, nền button phụ, thumb toggle, icon mode inactive. |
| **Charcoal** | `#27231F` | Chữ tiêu đề & chữ chính trên nền sáng, nền nút Action chính (Save/Submit), track toggle ON, nút tròn icon floating dock, icon chính. |
| **Lime Mist** | `#ECFFA9` | **Màu nhấn duy nhất (Accent)** — Nền Card Active nổi bật ("Front Door Active"), nút Swipe Unlock thumb, Badge trạng thái hoạt động. |
| **Graphite** | `#4E4A46` | Nền Card tối phụ, track toggle OFF trên nền tối, nút tròn phụ trong floating dock. |
| **Warm Gray** | `#878380` | Chữ mô tả phụ, label caption (UPPERCASE), đường viền mờ (`#87838026` opacity 15%), track slider/progress inactive. |
| **Climate Orange**| `#F0813A` | **Cảnh báo vi khí hậu / Climate Active** (ảnh 1, 3) — Icon mode được chọn ("Air"), vòng gauge nhiệt độ (25°C), các thanh bar chart cảnh báo/khảo sát. |
| **Alert Red** | `#E13A3A` | **Cảnh báo khẩn cấp / Live** (ảnh 3, 5) — Badge "● Live", cảnh báo thiên địch xâm nhập, tình trạng báo động đỏ. |
| **Insight Peach** | `#F5C89E` | Series phụ trên biểu đồ phân tích (dùng hạn chế trong chart). |

---

## 2. QUY CHUẨN KÍCH THƯỚC, BO GÓC (BORDER-RADIUS) & BUTTON

Chuẩn hóa chi tiết bo góc và kích thước theo đúng Ảnh 1, 2, 4, 5:

### 2.1. Hệ thống Bo góc (Border Radius)
* **`rounded-full` (`999px`):** 
  * Nút bấm chính (Save/Submit/CTA), Nút tròn icon (`44x44px`, `56x56px`), Toggle switch, Floating Nav Dock, Swipe track.
* **`rounded-3xl` (`28px`):** 
  * Card lớn (Hero Card, Active Status Card như "Front Door", Modal Bottom Sheet, Lock Settings Card).
* **`rounded-2xl` (`20px`):** 
  * Card trung bình (Outside/Inside temp, Climate Control Card, Grid thiết bị, Fingerprint/Code Card).
* **`rounded-xl` (`14px - 16px`):** 
  * Khung chứa Segmented control (AM/PM), inner container nhỏ, input form fields.

---

### 2.2. Quy chuẩn Button & Interactive Controls

1. **Nút Action chính (Primary Pill Button - Ảnh 1 "Save"):**
   * **Kích thước:** Chiều cao `52px - 56px` (Mobile/Tablet), `48px - 52px` (Web).
   * **Bo góc:** `rounded-full` (hoặc `rounded-3xl`).
   * **Màu sắc:** Nền `#27231F` (Charcoal), chữ `#FFFFFF` (White) font Bold 16px.

2. **Nút Action phụ / Secondary Button (Ảnh 2 "More settings"):**
   * **Kích thước:** Chiều cao `48px - 52px`.
   * **Bo góc:** `rounded-full` / `rounded-2xl`.
   * **Màu sắc:** Nền `#FFFFFF` (White) hoặc Warm Gray 15% (`#87838026`), chữ `#27231F` (Charcoal) font Medium/SemiBold.

3. **Nút tròn Icon / Circular Action Buttons (Ảnh 1, 2, 5 - Back `<`, More `...`, Add `+`, Bell):**
   * **Kích thước:** `44px × 44px` hoặc `48px × 48px`.
   * **Bo góc:** `rounded-full`.
   * **Màu sắc:** Nền `#FFFFFF` (White), Icon `#27231F` (Charcoal). Shadow nhẹ `rgba(39,35,31,0.06)`.

4. **Nút Mode Selector / Climate Circles (Ảnh 1 "Air", "Heat", "Cold", "Humid"):**
   * **Kích thước:** `56px × 56px` (tròn).
   * **Trạng thái Active ("Air"):** Nền `#F0813A` (Climate Orange), icon `#FFFFFF` (White). Label bên dưới màu `#27231F` Bold.
   * **Trạng thái Inactive ("Heat",...):** Nền `#FFFFFF` (White), icon `#27231F` / `#878380`. Label bên dưới màu `#878380` (Warm Gray).

5. **Segmented Control / Tab Chuyển đổi (Ảnh 1 "AM / PM"):**
   * **Khung chứa:** Bo góc `rounded-2xl` (`16px`), nền Warm Gray 15% (`#87838026`), padding `4px`.
   * **Tab Active ("AM"):** Nền `#FFFFFF` (White), bo góc `rounded-xl` (`12px`), chữ `#27231F` (Charcoal) Bold, shadow nhẹ.
   * **Tab Inactive ("PM"):** Chữ `#878380` (Warm Gray).

6. **Toggle Switch (Ảnh 1, 4, 5 "Schedule", "Wi-Fi"):**
   * **Kích thước:** Khung `48px × 28px` hoặc `52px × 30px`, bo góc `rounded-full`.
   * **Track ON:** `#27231F` (Charcoal).
   * **Track OFF:** `#878380` opacity 30% hoặc `#4E4A46` (Graphite).
   * **Thumb:** `#FFFFFF` (White) hình tròn, di chuyển mượt sang phải khi ON.

7. **Swipe to Unlock Slider (Ảnh 2 "Locked"):**
   * **Khung Slider:** Bo góc `rounded-full`, chiều cao `60px`, nền Warm Gray 15% (`#87838026`).
   * **Nút gạt (Thumb):** Tròn `rounded-full`, nền `#ECFFA9` (Lime Mist), icon ổ khóa. Chữ "Swipe to unlock" màu `#878380` (Warm Gray).

8. **Card Active Nổi bật (Ảnh 5 "Front Door - Locked"):**
   * **Bo góc:** `rounded-3xl` (`24px - 28px`).
   * **Màu sắc:** Nền `#ECFFA9` (Lime Mist), chữ chính `#27231F` (Charcoal), icon đặt trong hình tròn nền Lime nhạt.

9. **Bottom Floating Dock / Thanh Điều hướng Nổi (Ảnh 5):**
   * **Khung Dock:** Bo góc `rounded-full`, nền `#FFFFFF` (White) hoặc glassmorphism mờ, shadow `0 12px 32px rgba(39,35,31,0.12)`.
   * **Icons bên trong:** Các nút tròn `rounded-full` (`40px × 40px`), nền `#4E4A46` (Graphite) hoặc `#27231F` (Charcoal), icon màu `#FFFFFF`.

---

### 2.3. Bảng Phân Loại Màu Nút Bấm Mặc Định (Button Color Matrix)

Tất cả các nút bấm trong hệ thống (Web, App Mobile, Tablet) **mặc định áp dụng quy tắc phân chia màu** dưới đây:

| Loại Nút (Button Variant) | Mã Nền (Background) | Mã Chữ / Icon (Text/Icon) | Viền (Border) | Trường hợp sử dụng chuẩn (Use Cases) |
|---|---|---|---|---|
| **Primary (Nút Chính)** | `#27231F` Charcoal | `#FFFFFF` White (Bold) | Không viền | Nút hành động chính duy nhất trên màn hình (Save, Submit, Đăng nhập, Tạo nhà yến). |
| **Accent (Nút Nhấn)** | `#ECFFA9` Lime Mist | `#27231F` Charcoal (Bold) | Không viền | Nút kích hoạt đặc biệt, Thumb nút gạt Swipe Unlock, Badge trạng thái nổi bật. |
| **Secondary (Nút Phụ)** | `#FFFFFF` White | `#27231F` Charcoal | Viền mờ `#87838026` | Nút hủy, Nút "More settings", Nút phụ bên cạnh nút Primary. |
| **Climate / Warning (Nút Cam)** | `#F0813A` Climate Orange | `#FFFFFF` White | Không viền | Nút chế độ vi khí hậu đang chọn ("Air"), Nút bật thiết bị sưởi/thông gió. |
| **Danger / Alert (Nút Đỏ)** | `#E13A3A` Alert Red | `#FFFFFF` White | Không viền | Nút khẩn cấp ("Kích hoạt còi đuổi thiên địch", Báo động đỏ, Xóa thiết bị). |
| **Icon Circle (Nút Tròn Icon)** | `#FFFFFF` White | `#27231F` Charcoal | Viền mờ `#8783801A` | Nút quay lại `<`, Nút menu `...`, Nút thêm `+`, Nút chuông thông báo 🔔. |
| **Disabled (Nút Vô hiệu)** | `#87838033` (Opacity 20%) | `#878380` Warm Gray | Không viền | Nút chưa đủ điều kiện nhấn (Form chưa nhập đủ, đang chờ xử lý). |

---

## 3. THIẾT LẬP CHUẨN CHO ĐA THIẾT BỊ (WEB, APP MOBILE, TABLET)

### Nền Mặc Định: `#FFFFFF` (White) trên mọi thiết bị

#### 📱 A. Mobile App (iOS / Android — 375px đến 430px)
* **Nền toàn màn hình:** `#FFFFFF` (White).
* **Layout:** 1 cột dọc (Single Column Stack), padding 2 bên `16px - 20px`.
* **Card & Spacing:** Bo góc `rounded-3xl` (`28px`) cho Card chính, khoảng cách giữa các Card `12px - 16px`.
* **Điều hướng:** Bottom Floating Dock `rounded-full` nổi ở đáy màn hình.

#### 📱 B. Tablet App (iPad / Android Tablet — 768px đến 1024px)
* **Nền toàn màn hình:** `#FFFFFF` (White).
* **Layout:** Grid 2 cột (`grid-cols-2`, `gap-5`).
* **Card & Spacing:** Bo góc `rounded-3xl` (`28px`), padding card `20px - 24px`.
* **Điều hướng:** Sidebar mỏng vút bên trái hoặc Floating Dock căn giữa đáy màn hình.

#### 💻 C. Web App / Admin Dashboard (Desktop — 1280px+)
* **Nền toàn màn hình:** `#FFFFFF` (White).
* **Sidebar / Header:** 
  * Nền Sidebar: `#27231F` (Charcoal) với chữ `#FFFFFF` & accent `#ECFFA9` (Lime Mist).
  * Hoặc Nền Sidebar `#FFFFFF` với border bên phải `#87838026`.
* **Khu vực Nội dung (Main Dashboard):** Nền `#FFFFFF`, Grid 3 đến 4 cột (`grid-cols-3` hoặc `grid-cols-4`, `gap-6`).
* **Card:** Bo góc `rounded-2xl` (`20px`) hoặc `rounded-3xl` (`28px`), nền `#FFFFFF`, viền mờ `#87838026` (opacity 15%), shadow `0 8px 24px rgba(39,35,31,0.06)`.

---

## 4. TYPOGRAPHY & PHÔNG CHỮ

### 4.1. Tên Font & Nguồn Google Fonts
* **Font chính thức trong ảnh mẫu:** **Inter** (hoặc **Plus Jakarta Sans**). Đây là dòng font Geometric / Neo-Grotesque Sans-Serif hiện đại, tối ưu tuyệt đối cho UI/UX Dashboard Smart Home.
* **Có trên Google Fonts không:** **CÓ (100% Miễn phí & có sẵn trên Google Fonts)**.
* **Hỗ trợ Tiếng Việt / Tiếng Anh:** **Hỗ trợ 100% Tiếng Việt (bộ Latin Extended)**. Khi gõ Tiếng Việt đầy đủ dấu thanh/dấu mũ (sắc, huyền, hỏi, ngã, nặng, ă, ân, ê, ô, ơ, ư, đ) hoặc chuyển đổi Anh - Việt **hoàn toàn KHÔNG bị lỗi font**, không nứt dấu, không bị lệch line-height.

### 4.2. Nhúng Google Fonts vào Project (CSS / HTML)
```css
/* Thêm vào đầu file index.css / App.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
```

### 4.3. Quy chuẩn Typography trong Giao diện
* **Font Family:** `'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif`.
* **Tiêu đề chính (H1):** `28px - 32px`, Bold (`700`), màu `#27231F` (Charcoal).
* **Số liệu Metric lớn (25°C, 36°C):** `36px - 40px`, ExtraBold (`800`), màu `#27231F` (Charcoal).
* **Label Caption:** `11px - 12px`, UPPERCASE, letter-spacing `0.08em`, màu `#878380` (Warm Gray).
* **Body text:** `14px`, Regular (`400`), màu `#878380` (Warm Gray) hoặc `#27231F` (Charcoal).

---

## 5. TAILWIND CONFIG CHÍNH THỨC

```js
module.exports = {
  theme: {
    extend: {
      fontFamily: { 
        sans: ['Inter', 'ui-sans-serif', 'system-ui'] 
      },
      colors: {
        white:         '#FFFFFF', // Nền mặc định màn hình & card / chữ trên nền tối
        charcoal:      '#27231F', // Chữ chính / Nút primary / Track ON
        limeMist:      '#ECFFA9', // Accent duy nhất — Active card / Badge / Swipe thumb
        graphite:      '#4E4A46', // Card xám đậm phụ / Track OFF
        warmGray:      '#878380', // Chữ phụ / Border opacity / Label caption
        climateOrange: '#F0813A', // Trạng thái cảnh báo vi khí hậu / Climate active
        alertRed:      '#E13A3A', // Trạng thái khẩn cấp critical / Live camera
        insightPeach:  '#F5C89E', // Series phụ biểu đồ
      },
      borderRadius: {
        'xl':   '16px',
        '2xl':  '20px',
        '3xl':  '28px',
        'full': '999px',
      },
    },
  },
};
```

---

## 6. CHECKLIST KIỂM TRA ĐỒNG NHẤT (ANTIGRAVITY STRICT RULES)

- [x] **Nền mặc định:** Tất cả màn hình Web, App Mobile, Tablet đều dùng `#FFFFFF` (White).
- [x] **Đúng 8 màu:** Không dùng thêm bất kỳ hex code nào nằm ngoài 8 màu trên.
- [x] **Sửa lỗi Hex Warm Gray:** `warmGray` chính xác là `#878380` (không nhầm thành `#4E4A46`).
- [x] **Chuẩn bo góc (Bo góc cong tròn mềm mại):** Card dùng `20px` - `28px` (`rounded-2xl` / `rounded-3xl`), Button & Control dùng `rounded-full` (`999px`).
- [x] **Cảnh báo màu Cam:** Dùng `#F0813A` (Climate Orange) cho các trạng thái vi khí hậu active & khảo sát/cảnh báo như Ảnh 1, 3.
- [x] **Cảnh báo màu Đỏ:** Dùng `#E13A3A` (Alert Red) cho các cảnh báo khẩn / Live camera như Ảnh 3, 5.
