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

---

## 7. QUY TẮC KỸ THUẬT FRONTEND (Component dùng chung, State, Hiệu năng)

Phần này bắt buộc áp dụng cho code trong `frontend/src` — không chỉ màu/bo góc mà cả cách tổ
chức code, để nhiều người cùng sửa không bị lệch pattern hay copy-paste lại logic đã có sẵn.

### 7.1. LUÔN kiểm tra `components/ui/` và `components/common/` trước khi viết UI mới

- `components/ui/` — primitive dùng ở mọi nơi: `Button`, `Input`, `Select`, `Textarea`,
  `Modal`, `Card`, `Badge`, `Toggle`. **Không** viết `<button className="...">` tay hay style
  lại `<input>` thô — luôn import từ đây.
- `components/common/` — widget dùng chung nhiều trang, ví dụ:
  - `FilterChip` — chip lọc dạng pill (dùng ở AlertsPage, TicketsPage).
  - `NoteActionModal` — modal 1 field Textarea + submit (Acknowledge alert, Cancel ticket...).
    Chỉ hợp với modal 1-field dạng ghi chú; modal nhiều field (VD mời thành viên) thì viết
    riêng, không ép vào đây.
  - `Pagination`, `ZonePicker`, `EmptyState`, `LoadingSkeleton`, `ConfirmModal`, `StarRating`,
    `AlertBadge`, `Toast`.
  - Trước khi thêm 1 chip/modal/empty-state/skeleton mới, **grep tên tương tự trong
    `components/common/` trước** — nếu đã có component gần giống, mở rộng props của nó thay vì
    viết file mới.

### 7.2. Hooks & data fetching (TanStack React Query)

- 1 file `hooks/use<Resource>.ts` / resource (VD `useTickets.ts`, `useAlerts.ts`), bọc
  `useQuery`/`useMutation` từ `services/api/<resource>.ts` — component/page **không** gọi
  `services/api` trực tiếp.
- Danh sách có phân trang: dùng `usePaginatedListQuery()` (`hooks/usePaginatedListQuery.ts`) để
  unwrap envelope `{data, meta:{total,page,limit}}` — không tự viết lại logic này ở hook mới.
- **Mutation nào làm thay đổi dữ liệu mà 1 query KHÁC đang hiển thị cũng phải
  `invalidateQueries` đúng key đó trong `onSuccess`**, không chỉ invalidate key của chính nó.
  Ví dụ thật: đổi trạng thái tin đăng (`useUpdateListing`) phải invalidate cả
  `['harvests', farmId]` **và** `['listing-stats', id]` vì `ListingPanel` đọc từ key thứ 2.
  Quên bước này là nguồn bug "thao tác thành công nhưng UI không cập nhật" phổ biến nhất.
- `Modal` không unmount giữa các lần mở (chỉ toggle prop `open`) — nếu form seed dữ liệu từ
  props/store, **phải** `useEffect(() => { if (open) setForm(...) }, [open, ...])` để resync
  mỗi lần mở lại, không seed 1 lần duy nhất trong `useState(() => ...)` (dữ liệu sẽ bị stale ở
  lần mở thứ 2).

### 7.3. Tách file khi 1 page quá lớn

Khi 1 page vượt quá ~150-200 dòng hoặc có ≥2 modal/tab, tách theo cấu trúc (xem
`pages/Harvest/`, `pages/Analytics/` làm mẫu):

```
pages/<Feature>/
  <Feature>Page.tsx     # chỉ page shell + orchestration, không chứa logic con
  constants.ts          # label/tone maps, hằng số riêng của feature này
  components/           # sub-component hiển thị (card, panel, stat block...)
  modals/                # modal tạo/sửa/xoá
  tabs/                  # nếu page có tab, 1 file / tab
```

Label/tone map dùng ở ≥2 file (VD `TICKET_TYPE_LABEL`, `STATUS_TONE`) chuyển vào
`constants/<resource>.ts` ở cấp `src/constants/` (không phải `pages/<Feature>/constants.ts`)
nếu dùng xuyên page — ví dụ `constants/tickets.ts` dùng chung giữa `TicketsPage` và
`TicketDetailPage`.

### 7.4. State toàn cục (Zustand)

- Store dùng chung nhiều trang (VD `zoneStore` — farm/zone đang chọn) đặt ở `store/`.
- Khi **đổi shape** của 1 store có `persist()`, **bắt buộc** bump `version` và viết `migrate()`
  trong config `persist` — không được để user có `localStorage` cũ rehydrate vào state mới với
  field thiếu/`null` một cách âm thầm (xem `store/zoneStore.ts` làm mẫu).

### 7.5. Hiệu năng

- Object truyền cho thư viện ngoài re-render theo identity (Chart.js `data`/`options`, v.v.)
  **phải** bọc `useMemo` với dependency đúng — object literal viết trực tiếp trong JSX sẽ tạo
  identity mới mỗi render, buộc thư viện diff/update lại dù dữ liệu không đổi.
- Query có dữ liệu ít đổi (VD cấu trúc House/Zone của 1 Farm) nên đặt `staleTime` dài hơn mặc
  định thay vì để refetch theo nhịp 30s toàn cục, đặc biệt nếu query đó là pattern N+1 (gọi
  nhiều request con) — xem `useFarmZones` (`hooks/useFarms.ts`).
- Route nặng (dùng thêm thư viện lớn như Chart.js) phải `React.lazy(() => import(...))` — xem
  `App.tsx`. **Đặt `<Suspense>` sát nơi thật sự suspend** (trong `MainLayout` quanh `<Outlet/>`),
  **không bọc cả `<Routes>`** — bọc ở cấp cao làm Sidebar/TopBar bị unmount/nháy toàn màn hình
  mỗi lần vào 1 route lazy lần đầu.
- Kết nối realtime dùng chung (Socket.io) là 1 instance singleton cho cả app — hook nào gọi
  connect/disconnect phải dùng **reference counting** (xem `hooks/useSocket.ts`), không tự
  `disconnect()` khi unmount vì có thể giết kết nối mà 1 hook khác (VD listener cảnh báo toàn
  cục ở `MainLayout`) vẫn đang cần.

### 7.6. Quy tắc đặt tên file

Nhất quán 1 file / 1 resource, giống quy tắc backend (`<resource>.<layer>.ts`):

| Loại | Quy tắc | Ví dụ |
|---|---|---|
| API client | `services/api/<resource>.ts` | `tickets.ts`, `harvests.ts` |
| Hook | `hooks/use<Resource>.ts` | `useTickets.ts`, `useHarvests.ts` |
| Page | `pages/<Feature>/<Feature>Page.tsx` | `pages/Tickets/TicketsPage.tsx` |
| Store | `store/<name>Store.ts` | `store/zoneStore.ts` |
| Constants dùng chung | `constants/<resource>.ts` | `constants/tickets.ts` |

### 7.7. Màu sắc/bo góc — không có ngoại lệ ngoài `chartTheme.ts`

- **Không hardcode mã hex** trong component — luôn dùng class Tailwind theo token đã định nghĩa
  ở Mục 5 (`text-climateOrange`, `fill-warmGray`, `border-warmGray/15`...). Token đổi giá trị ở
  1 nơi (`tailwind.config.ts`) phải tự động phản ánh ra toàn bộ UI.
- Ngoại lệ **duy nhất**: `utils/chartTheme.ts` — Chart.js nhận string màu literal, không nhận
  class Tailwind, nên phải khai báo hex trực tiếp. Vẫn phải khai báo **1 lần** ở đây
  (`CHART_COLORS`/`CHART_PALETTE`) rồi import ra dùng, không lặp lại hex ở từng chart.
- Bo góc chỉ dùng đúng 4 giá trị đã định nghĩa (`rounded-xl/2xl/3xl/full`) — không dùng
  `rounded-lg`/`rounded-md` tùy hứng, dù Tailwind mặc định vẫn cho phép.
