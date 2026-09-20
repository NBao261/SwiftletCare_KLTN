# 📁 SwiftletCare — Chuẩn Cấu Trúc Thư Mục

> **Phiên bản:** 1.0  
> **Cập nhật:** 2026-09-18  
> **Áp dụng cho:** Toàn bộ contributors của dự án  

Tài liệu này là **nguồn sự thật duy nhất** về vị trí của mỗi loại file trong dự án.  
Trước khi tạo file mới, hãy đọc phần tương ứng để đặt đúng chỗ.

---

## 🗺 Tổng quan Monorepo

```
SwiftletCare_KLTN/
├── frontend/          # Web Dashboard (React + Vite + TypeScript)
├── backend/           # REST API + Realtime Server (Node.js + Express)
├── mobile/            # Mobile App (Expo + React Native)
├── firmware/          # IoT Firmware (PlatformIO / C++)
├── ai-pipeline/       # AI Inference & Bird Counting (Python)
├── docs/              # Tài liệu dự án (SRS, design, guide...)
└── docker-compose.yml # Orchestration toàn bộ services
```

> **Nguyên tắc vàng:** Mỗi workspace là một project độc lập với `package.json` / `requirements.txt` / `platformio.ini` riêng. **Không cross-import** giữa các workspace.

---

---

# 1. FRONTEND — `frontend/`

> **Stack:** React 18 + Vite + TypeScript + Tailwind CSS + Zustand + React Query

## Cây thư mục

```
frontend/
├── public/                  # Static assets (favicon, og-image, không bị hash)
├── src/
│   ├── main.tsx             # Entry point — mount App + wrap Providers
│   ├── App.tsx              # Root router — khai báo routes cấp cao
│   ├── index.css            # Global styles, Tailwind directives
│   ├── vite-env.d.ts        # Vite type declarations
│   │
│   ├── components/          # Toàn bộ UI components
│   │   ├── ui/              # Primitive / headless components
│   │   ├── common/          # Shared reusable components (multi-feature)
│   │   ├── layout/          # Layout wrappers theo role
│   │   └── auth/            # Components chỉ dùng cho trang auth
│   │
│   ├── pages/               # Route-level page components (1 file = 1 route)
│   │   ├── Public/          # Trang không cần đăng nhập (Landing, Login...)
│   │   ├── FarmOwner/       # Dashboard chủ trại
│   │   ├── Admin/           # Dashboard quản trị hệ thống
│   │   ├── SalesStaff/      # Dashboard nhân viên sales
│   │   └── Shared/          # Pages dùng chung nhiều role (Alerts, Tickets...)
│   │
│   ├── services/            # Tầng gọi API và kết nối realtime
│   │   ├── api/             # Hàm gọi HTTP (axios) theo từng domain
│   │   │   ├── client.ts    # Axios instance + interceptors
│   │   │   ├── auth.ts
│   │   │   ├── farms.ts
│   │   │   └── ...
│   │   ├── socket.ts        # Socket.IO client setup
│   │   └── queryClient.ts   # React Query client config
│   │
│   ├── hooks/               # Custom React hooks (wrap React Query + services)
│   │   ├── useAuth.ts
│   │   ├── useFarms.ts
│   │   └── ...
│   │
│   ├── store/               # Global client-side state (Zustand)
│   │   ├── authStore.ts
│   │   ├── zoneStore.ts
│   │   ├── alertStore.ts
│   │   └── toastStore.ts
│   │
│   ├── types/               # TypeScript interfaces & types
│   │   └── index.ts         # Export tập trung tất cả types
│   │
│   ├── constants/           # Dữ liệu tĩnh, enums, config UI
│   │   ├── navigation.ts    # Route paths & nav config
│   │   ├── roles.ts         # Role enums & permissions
│   │   └── tickets.ts       # Ticket status constants
│   │
│   └── utils/               # Pure utility functions (không dùng React hooks)
│       ├── cn.ts            # Class name utility
│       ├── helpers.ts       # Format date, number...
│       ├── navigation.ts    # Navigation helpers
│       └── chartTheme.ts    # Chart color config
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Chi tiết từng folder

### `components/ui/`
**Mục đích:** Primitive headless components — atom-level, không chứa business logic.  
**Gồm:** `Button`, `Input`, `Card`, `Modal`, `Select`, `Badge`, `Toggle`, `Textarea`, `icons`  
**Quy tắc:** Chỉ nhận props và render. Không gọi hook, không gọi store, không gọi API.

### `components/common/`
**Mục đích:** Shared components dùng ở nhiều feature và nhiều role.  
**Gồm:** `SideBar`, `Pagination`, `LoadingSkeleton`, `EmptyState`, `ConfirmModal`, `Toast`, `SensorCard`, `StatusDot`, `ZonePicker`, `FilterChip`...  
**Quy tắc:** Không hardcode data. Không gắn với 1 role cụ thể. Nhận data qua props.

### `components/layout/`
**Mục đích:** Skeleton cấu trúc trang — header, sidebar, content area.  
**Gồm:** `MainLayout.tsx`  
**Quy tắc:** Layout không fetch data. Chỉ compose structure và truyền `children`.

### `components/auth/`
**Mục đích:** Components chỉ dùng trong flow đăng nhập / phân quyền.  
**Gồm:** `RequireRole.tsx` (route guard theo role)  
**Quy tắc:** Không dùng ở ngoài context auth.

### `pages/`
**Mục đích:** Mỗi file = một route. Orchestrate layout + feature components.  
**Chia theo role:**

| Folder | Dành cho | Ví dụ |
|---|---|---|
| `Public/` | Guest, chưa đăng nhập | Landing, Login, Register |
| `FarmOwner/` | Chủ trại | Dashboard, Analytics |
| `Admin/` | Admin hệ thống | AdminNodeStatus |
| `SalesStaff/` | Nhân viên sales | (tương lai) |
| `Shared/` | Nhiều role dùng chung | Alerts, Devices, Farms, Harvest, Tickets, Settings, LiveStream |

**Quy tắc:** Pages chỉ compose. Không viết inline UI logic phức tạp. Kéo data qua hooks.

### `services/api/`
**Mục đích:** Tập trung tất cả hàm gọi HTTP. Mỗi file = 1 domain.  
**Quy tắc:** Chỉ gọi axios, return raw response. Không transform, không business logic.  
**File đặc biệt:** `client.ts` — axios instance với baseURL, interceptor attach token, handle 401.

### `hooks/`
**Mục đích:** Wrap `useQuery` / `useMutation` + gọi `services/api/` thành reusable hook.  
**Quy tắc đặt tên:** `use[Feature].ts` — ví dụ: `useFarms.ts`, `useAlerts.ts`  
**Quy tắc:** Không render JSX. Trả về `{ data, isLoading, error, mutate }`.

### `store/`
**Mục đích:** Global client-side state không phải server data.  
**Quy tắc đặt tên:** `[feature]Store.ts`

| Store | Chứa gì |
|---|---|
| `authStore.ts` | User session, token, isAuthenticated |
| `zoneStore.ts` | Zone đang được chọn hiện tại |
| `alertStore.ts` | Alerts chưa đọc, realtime state |
| `toastStore.ts` | Toast notification queue |

**Phân biệt Store vs React Query:**

| | Zustand (`store/`) | React Query (`hooks/`) |
|---|---|---|
| Server data | ❌ | ✅ |
| Client-only state | ✅ | ❌ |
| Auth / session | ✅ | ❌ |
| Realtime UI state | ✅ | ❌ |

### `types/`
**Mục đích:** TypeScript interfaces & types tập trung.  
**Quy tắc:** Export tất cả từ `index.ts`. Không import từ component hay hooks.

### `constants/`
**Mục đích:** Dữ liệu tĩnh, enums, config — không thay đổi runtime.  
**Quy tắc:** Không gọi API. Không import React. Export pure values.

### `utils/`
**Mục đích:** Pure utility functions — không phụ thuộc React, không gọi API.  
**Quy tắc:** Input → Output thuần túy. Dễ unit test.

---

---

# 2. BACKEND — `backend/`

> **Stack:** Node.js + Express + TypeScript + MongoDB (Mongoose) + Socket.IO + MQTT

## Cây thư mục

```
backend/
├── src/
│   ├── index.ts             # Entry point — khởi tạo Express app, kết nối DB
│   │
│   ├── config/              # Cấu hình kết nối và app settings
│   │   ├── app.config.ts    # Express middleware setup, CORS, env
│   │   └── db.config.ts     # MongoDB connection
│   │
│   ├── routes/              # Khai báo HTTP endpoints, gán middleware & controller
│   │   ├── auth.route.ts
│   │   ├── farms.route.ts
│   │   └── ...
│   │
│   ├── controllers/         # Nhận request → gọi service → trả response
│   │   ├── auth.controller.ts
│   │   ├── farms.controller.ts
│   │   └── ...
│   │
│   ├── services/            # Business logic — xử lý nghiệp vụ, tương tác DB
│   │   ├── auth.service.ts
│   │   ├── farm.service.ts
│   │   └── ...
│   │
│   ├── models/              # Mongoose schemas & models
│   │   ├── user.model.ts
│   │   ├── farm.model.ts
│   │   └── ...
│   │
│   ├── middlewares/         # Express middleware functions
│   │   ├── auth.middleware.ts         # JWT verify, attach user to req
│   │   ├── validate.middleware.ts     # Request body validation
│   │   ├── rateLimiter.middleware.ts  # Rate limiting
│   │   └── errorHandler.middleware.ts # Global error handler
│   │
│   ├── mqtt/                # MQTT broker client + message handlers
│   │   ├── mqtt.client.ts   # MQTT connection setup, subscribe topics
│   │   └── handlers/        # Xử lý từng loại message MQTT
│   │
│   ├── socket/              # Socket.IO server setup + event handlers
│   │   └── index.ts         # Khởi tạo io, khai báo events, emit realtime
│   │
│   ├── jobs/                # Scheduled background jobs (cron)
│   │   ├── alertEscalation.job.ts
│   │   ├── deviceOffline.job.ts
│   │   ├── invitationExpiry.job.ts
│   │   └── overrideExpiry.job.ts
│   │
│   ├── types/               # TypeScript interfaces cho backend
│   ├── utils/               # Pure utility functions
│   └── scripts/             # One-off scripts (seed DB, migration...)
│
├── tests/                   # Unit & integration tests
├── .env
├── .env.example
├── tsconfig.json
└── package.json
```

## Chi tiết từng folder

### Luồng xử lý HTTP Request

```
Client Request
    ↓
routes/          → Khai báo path, method, middleware chain
    ↓
middlewares/     → Auth verify, validate body, rate limit
    ↓
controllers/     → Parse req, gọi service, format res
    ↓
services/        → Business logic, validation nghiệp vụ, tương tác DB
    ↓
models/          → Mongoose query (CRUD)
    ↓
Response
```

### `routes/`
**Mục đích:** Định nghĩa endpoint, gắn middleware và controller handler.  
**Quy tắc đặt tên:** `[resource].route.ts`  
**Quy tắc:** Không chứa logic. Chỉ `router.get(path, ...middlewares, controller)`.

### `controllers/`
**Mục đích:** Nhận `req`, gọi service, trả `res`. Là lớp mỏng giữa HTTP và business.  
**Quy tắc đặt tên:** `[resource].controller.ts`  
**Quy tắc:** Không chứa query DB trực tiếp. Không chứa business rules. Delegate cho service.

### `services/`
**Mục đích:** Business logic — kiểm tra điều kiện, transform data, gọi model.  
**Quy tắc đặt tên:** `[resource].service.ts`  
**Quy tắc:** Không biết về `req`/`res`. Có thể gọi service khác. Dễ unit test độc lập.

### `models/`
**Mục đích:** Mongoose schema + model definition.  
**Quy tắc đặt tên:** `[resource].model.ts`  
**Quy tắc:** Chỉ định nghĩa schema, virtual fields, index. Không chứa business logic.

### `middlewares/`
**Mục đích:** Hàm xử lý trung gian trước khi request đến controller.  
**Quy tắc đặt tên:** `[function].middleware.ts`

| File | Chức năng |
|---|---|
| `auth.middleware.ts` | Verify JWT, gán `req.user` |
| `validate.middleware.ts` | Validate req body với schema |
| `rateLimiter.middleware.ts` | Giới hạn số request / IP |
| `errorHandler.middleware.ts` | Bắt tất cả lỗi, format error response |

### `mqtt/`
**Mục đích:** Kết nối MQTT broker, subscribe topics, dispatch message đến handlers.  
**Quy tắc:** `mqtt.client.ts` chỉ setup connection. Logic xử lý message nằm trong `handlers/`.

### `socket/`
**Mục đích:** Socket.IO server — emit realtime events đến FE/Mobile.  
**Quy tắc:** Không chứa business logic. Chỉ `io.to(room).emit(event, data)`.

### `jobs/`
**Mục đích:** Cron jobs chạy định kỳ.  
**Quy tắc đặt tên:** `[function].job.ts`  
**Quy tắc:** Mỗi file = 1 job với schedule rõ ràng. Gọi service, không trực tiếp gọi model.

---

---

# 3. MOBILE — `mobile/`

> **Stack:** Expo + React Native + TypeScript + Expo Router

## Cây thư mục

```
mobile/
├── app/                     # File-based routing (Expo Router)
│   ├── _layout.tsx          # Root layout — font, theme, navigation container
│   ├── index.tsx            # Redirect entry point
│   │
│   ├── (auth)/              # Auth flow group (không có tab bar)
│   │
│   ├── (tabs)/              # Tab navigation group (có bottom tab bar)
│   │   ├── _layout.tsx      # Tab bar config
│   │   ├── dashboard/
│   │   ├── farms/
│   │   ├── alerts/
│   │   ├── analytics/
│   │   ├── tickets/
│   │   └── settings/
│   │
│   ├── alert/               # Stack screens: Chi tiết alert
│   ├── device/              # Stack screens: Chi tiết thiết bị
│   ├── farm/                # Stack screens: Chi tiết trại
│   ├── zone/                # Stack screens: Chi tiết khu vực
│   ├── livestream/          # Stack screens: Xem camera live
│   └── ticket/              # Stack screens: Chi tiết ticket
│
├── hooks/                   # Custom hooks (React Query + API calls)
│   ├── index.ts
│   ├── useAuth.ts
│   ├── useFarms.ts
│   ├── useAlerts.ts
│   ├── useTelemetry.ts
│   └── useTickets.ts
│
├── services/                # Tầng gọi API, realtime, notification
│   ├── api/                 # HTTP calls
│   ├── socket/              # Socket.IO mobile client
│   └── notification/        # Push notification handler
│
├── store/                   # Global state
├── types/                   # TypeScript interfaces
├── constants/               # App-wide constants
├── utils/                   # Pure utility functions
└── config/                  # App configuration
```

## Quy tắc routing (Expo Router)

| Thư mục | Ý nghĩa |
|---|---|
| `(auth)/` | Group layout, không hiện trong URL path |
| `(tabs)/` | Tab navigator group |
| `_layout.tsx` | Layout file cho folder đó |
| `[id].tsx` | Dynamic route parameter |

**Quy tắc:** Tất cả màn hình của 1 feature đặt trong folder của feature đó. Không tạo màn hình lẻ ở root `app/`.

---

---

# 4. FIRMWARE — `firmware/`

> **Stack:** PlatformIO + C++ + ESP32

## Cây thư mục

```
firmware/
├── src/
│   ├── main.cpp             # Entry point — setup(), loop()
│   ├── config/              # Cấu hình WiFi, MQTT, pin mapping
│   ├── wifi/                # WiFi connection management
│   ├── mqtt/                # MQTT publish/subscribe logic
│   ├── sensors/             # Driver đọc cảm biến
│   ├── audio/               # Xử lý âm thanh
│   ├── pid/                 # PID controller logic
│   └── storage/             # Flash storage (NVS, SPIFFS)
│
├── platformio.ini
├── wokwi.toml
└── diagram.json
```

**Quy tắc:** Mỗi module = cặp `.h` + `.cpp` độc lập. `main.cpp` chỉ orchestrate, không chứa implementation logic.

---

---

# 5. AI PIPELINE — `ai-pipeline/`

> **Stack:** Python + OpenCV + MQTT

## Cây thư mục

```
ai-pipeline/
├── src/
│   ├── stream.py            # Đọc RTSP stream từ camera
│   ├── inference.py         # Load model, run inference trên frame
│   ├── tracker.py           # Object tracking giữa các frame
│   ├── counting.py          # Logic đếm chim (bird counting)
│   └── alert_publisher.py   # Publish kết quả/alert qua MQTT
│
├── config/
│   └── config.yaml          # Config model path, MQTT broker, thresholds
│
├── requirements.txt
└── README.md
```

**Luồng xử lý:**
```
stream.py → inference.py → tracker.py → counting.py → alert_publisher.py → MQTT → backend
```

---

---

# 📋 Bảng câu hỏi kiểm tra nhanh

## Frontend — Đặt file vào đâu?

| Tôi đang tạo... | Đặt vào |
|---|---|
| Component atom-level, không có logic | `components/ui/` |
| Component dùng ở nhiều feature, nhiều role | `components/common/` |
| Component chỉ dùng trong auth flow | `components/auth/` |
| Skeleton layout bao ngoài trang | `components/layout/` |
| Một trang (= 1 route) của FarmOwner | `pages/FarmOwner/` |
| Một trang dùng chung nhiều role | `pages/Shared/` |
| Hàm gọi HTTP cho domain "farms" | `services/api/farms.ts` |
| Custom hook wrap React Query | `hooks/use[Feature].ts` |
| Global state client-side | `store/[feature]Store.ts` |
| TypeScript interface | `types/index.ts` |
| Route path constant | `constants/navigation.ts` |
| Hàm format ngày, số | `utils/helpers.ts` |

## Backend — Đặt file vào đâu?

| Tôi đang tạo... | Đặt vào |
|---|---|
| Endpoint mới | `routes/[resource].route.ts` |
| Handler nhận req/res | `controllers/[resource].controller.ts` |
| Business logic, DB query | `services/[resource].service.ts` |
| Mongoose schema | `models/[resource].model.ts` |
| Middleware (auth, validate...) | `middlewares/[function].middleware.ts` |
| Cron job chạy định kỳ | `jobs/[function].job.ts` |
| Xử lý message MQTT | `mqtt/handlers/` |
| TypeScript interface backend | `types/` |
| Script seed data 1 lần | `scripts/` |

---

# 🚫 Những điều KHÔNG được làm

| ❌ Sai | ✅ Đúng |
|---|---|
| Gọi axios trực tiếp trong component | Dùng hook → service → axios |
| Viết business logic trong controller | Delegate sang service |
| Gọi model trực tiếp trong controller | Qua service |
| Tạo file component trong `pages/` | Tạo trong `components/`, import vào page |
| Import giữa các workspace | Giao tiếp qua HTTP / WebSocket |
| Hardcode secret trong code | Dùng `.env` + `.env.example` |
| Đặt trang của 1 role vào folder của role khác | Dùng đúng folder role |
| Viết UI logic trong custom hook | Hook trả data, component quyết định render |
