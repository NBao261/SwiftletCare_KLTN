# SwiftletCare Mobile — Setup & UI Guide

> **Phạm vi sau Review 1 (Report 3).** Hội đồng đánh giá theo phiếu đăng ký bản sửa; yêu cầu là Report 3 ([`docs/reports/report3-srs.md`](../docs/reports/report3-srs.md)), thiết kế là Report 4 ([`docs/reports/report4-sdd.md`](../docs/reports/report4-sdd.md) §5.4). Việc phải làm ở mobile:
>
> - Đồng bộ enum với backend: đã xong `Role` (`DOMAIN_EXPERT`), `NOISE_ANOMALY`, `MAINTENANCE_DUE`, kênh `telegram` và các tên của SRS 3.1.0 (G-01): `MISTING_INEFFECTIVE`, `UNEXPECTED_RESTART`, `ACTUATOR_FAULT`, `CONFIG_MISMATCH`, `DISMISSED`; đã gỡ `PREDATOR_DETECTED`, Zalo/SMS, relay sưởi, trạng thái thiết bị `ERROR`/`DEGRADED`.
> - Thiết lập thiết bị (MF-10): quét nhãn QR của bộ điều khiển và mã QR tầng bằng `expo-camera`, hướng dẫn cài Wi-Fi qua AP-mode, hiện tiến trình setup (đã đăng ký → online → đã áp cấu hình).
> - Đăng ký FCM token sau khi đăng nhập, huỷ khi đăng xuất, nhận push (ALERT-FR-002) — **chỉ Farm Owner**: Domain Expert không nhận thông báo ngoài app (Report 3 §2.4), chỉ có thông báo trong app. Live stream HLS bằng `expo-video` theo camera của nhà yến (VISION-FR-013); Farm Owner đọc kết luận và lịch sử quyết định của chuyên gia (EXPERT-FR-009).
> - Domain Expert dùng **cùng màn hình** với Farm Owner, chỉ đọc vận hành; trên mobile có kiểm chứng cảnh báo suy luận, sửa ngưỡng/hệ số/tham số phát hiện, trạng thái sức khỏe ngày của **nhà yến** và chấm điểm, báo cáo và kết luận (Report 4 §5.4). Vẽ vòng đếm chỉ làm trên web (VISION-FR-018). Cây luồng: mục 2.1.
> - Ticket, SLA, khu vực Technician đã ra ngoài phạm vi (Report 3 §8) và đã gỡ khỏi app.

App Expo Router (React Native) cho **Farm Owner và Domain Expert** (Report 4 §5.4) — Technician làm việc trên web console; dùng chung backend với web. Report 4 §3.2 khai báo app React Native này (web vẫn là PWA riêng trong `frontend/`). Luật review PR mobile nằm ở `mobile/CLAUDE.md`; việc mobile còn thiếu ở `docs/reports/project-tracking.md` §6 (G-16).

**Phiên bản:** Expo SDK 58 · React Native 0.88 · React 19.3 · Expo Router 58 · Reanimated 4.7 · TypeScript 6 · New Architecture bắt buộc (không còn tuỳ chọn `newArchEnabled`). Đối chiếu docs đúng phiên bản: https://docs.expo.dev/versions/v58.0.0/

**Trạng thái màn hình:** luồng xác thực đã chạy với backend thật (đăng nhập, quên mật khẩu bằng mã 6 số, đổi mật khẩu tạm, tab theo role). Các màn còn lại là stub (`AppHeader` + `TODO`) — implement theo Report 3, luồng chính trước: thiết lập thiết bị bằng QR (MF-10), cảnh báo + push, dashboard, live stream. Route `livestream/[zoneId]` phải đổi theo camera của nhà yến (VISION-FR-013, Report 3 §2.8).

---

Skill thiết kế UI/UX mobile cho Claude Code:https://github.com/ceorkm/mobile-app-ui-design.git

## 1. Setup

### Yêu cầu

- Node.js + npm.
- JDK 17 trở lên — dùng luôn JDK đi kèm Android Studio (`jbr`, JDK 21).
- Android Studio: Android SDK + emulator (vd. Pixel 6). Lần build đầu Gradle tự tải platform, build-tools và NDK mà React Native 0.88 cần (có thể lâu, cần mạng).
- Backend chạy local: `docker compose up -d mongodb emqx` rồi `cd backend && npm run dev` (API ở `:3000`).
- **Không chạy được trên Expo Go**: app có module native (mmkv, skia, maps) và chưa cài `expo-dev-client` — phải dùng bản build `npm run android`.

### Biến môi trường máy (Windows)

| Biến           | Giá trị                                       |
| -------------- | --------------------------------------------- |
| `JAVA_HOME`    | `C:\Program Files\Android\Android Studio\jbr` |
| `ANDROID_HOME` | `C:\Users\<user>\AppData\Local\Android\Sdk`   |

Đặt xong phải **đóng hẳn VS Code rồi mở lại** (terminal trong VS Code giữ biến cũ). Chạy tạm trong 1 terminal: `export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"`.

### Cài & chạy

```bash
cd mobile
npm ci                     # cài đúng theo package-lock.json
npm run android            # lần đầu / khi thêm-bớt thư viện native: build + cài app + chạy Metro
npx expo start             # các lần sau: chỉ chạy Metro, rồi bấm icon SwiftletCare trên emulator
npx expo start --clear     # Metro báo không tìm thấy module sau khi cài/gỡ gói
```

- Thêm thư viện: `npx expo install <gói>` để đúng phiên bản SDK 58; kiểm tra lệch phiên bản: `npx expo install --check`.
- Đừng bấm phím `a` ở Metro (mở Expo Go). Bấm `s` để chuyển sang development build trước, hoặc mở app bằng icon.
- Không chạy `npm audit fix --force` — kéo thư viện lệch khỏi bộ phiên bản của Expo SDK 58. Kiểm tra sức khoẻ dự án: `npx expo-doctor@latest`.
- Kiểm tra trước khi đẩy code: `npm run lint` · `npm run typecheck` · `npx jest --passWithNoTests`.

### Nâng cấp Expo SDK

Đã nâng 53 → 58 (React Native 0.79 → 0.88). Lần sau nâng tiếp, làm theo thứ tự:

1. Sửa phiên bản trong `package.json` theo `bundledNativeModules.json` của gói `expo` mới (hoặc `npx expo install expo@~<SDK>` rồi `npx expo install --fix`).
2. **Xoá `node_modules` và `package-lock.json` rồi `npm install` lại sạch.** Cài đè lên lock cũ làm npm đặt `expo-modules-core`, `babel-preset-expo`, `expo-asset`… lồng trong `node_modules/expo/` → autolinking không thấy module native ("Cannot find native module") và Metro không thấy babel preset.
3. `npx expo install --check` và `npx expo-doctor@latest` phải sạch.
4. Xoá `android/` và tạo lại: `npx expo prebuild --platform android --clean`, rồi `npm run android`. Khởi động lại Metro bằng `npx expo start --clear`.

Ghi chú các gói ngoài danh sách SDK 58:

| Gói                             | Phiên bản                             | Lý do                                                                                              |
| ------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `react-dom`                     | trùng `react` (19.3.0)                | `burnt` → `sonner` cần `react-dom`; không khai báo thì npm kéo bản mới hơn `react` và báo xung đột |
| `victory-native`                | ~42.0.1                               | bản 43 cần Skia ≥ 2.15, SDK 58 đi kèm Skia 2.14                                                    |
| `react-native-mmkv`             | ^4.3.2 + `react-native-nitro-modules` | mmkv 4 chạy trên Nitro Modules                                                                     |
| `@testing-library/react-native` | ~14.1.0 + `test-renderer`             | `expo-router` 58 cần bản ≥ 14; bản 14 thay `react-test-renderer` bằng `test-renderer`              |
| `jest` / `typescript`           | ~30.5.2 / ~6.0.3                      | theo `expo install --check` của SDK 58                                                             |
| `expo-av`                       | đã gỡ                                 | không còn trong SDK — phát video/âm thanh dùng `expo-video` / `expo-audio`                         |

Thay đổi code đi kèm: `runOnJS` → `scheduleOnRN` (`react-native-worklets`); bỏ `newArchEnabled` và khoá `splash` khỏi `app.json` (splash vào plugin `expo-splash-screen`); bỏ `baseUrl` khỏi `tsconfig.json`; `AndroidImportance` import thẳng từ `expo-notifications` (truy cập qua `Notifications.AndroidImportance` bị lint báo nhầm).

### Biến môi trường app (`.env`, mẫu ở `.env.example`)

| Biến                  | Mặc định                | Ghi chú                                                                                                                             |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` | Route không có tiền tố (`/auth/login`, `/farms`…). Emulator Android: `http://10.0.2.2:3000`; máy thật: IP LAN của máy chạy backend. |
| `EXPO_PUBLIC_WS_URL`  | `ws://localhost:3000`   | Socket.io, đổi host giống dòng trên.                                                                                                |

Mọi biến `EXPO_PUBLIC_*` bị đóng vào app — không đặt secret ở đây.

### Cấu hình chính

- `app.json`: `typedRoutes` bật; chỉ portrait; `userInterfaceStyle: light` (app chỉ có giao diện sáng, máy bật chế độ tối cũng không đổi; Android cần gói `expo-system-ui` để giữ đúng giao diện sáng); plugin `expo-router`, `expo-splash-screen`, `expo-secure-store`, `expo-notifications`, `expo-camera`, `expo-asset`, `expo-font`. Từ SDK 57 splash khai báo trong plugin `expo-splash-screen` (không còn khoá `splash` ở gốc): ảnh `splash-blank.png`, nền `#FFFFFF`; adaptive icon nền `#172008` trùng nền logo.
- `tsconfig.json`: `strict`; không dùng `baseUrl` (TypeScript 6 đã bỏ); alias `@/assets/*` → `./assets/*` (ảnh, font ở gốc `mobile/`) và `@/*` → `./src/*` (toàn bộ code). expo-router tự nhận route trong `src/app/`.
- `babel.config.js`: chỉ `babel-preset-expo` (tự đọc alias của tsconfig và tự thêm plugin Reanimated).
- `package.json` → `expo.install.exclude`: `@shopify/react-native-skia` (lý do ở Known debt của `mobile/CLAUDE.md`).

**Cấu hình còn thiếu so với Report 3/4** (làm cùng PR của tính năng cần nó):

| Thiếu                                                                                                                                                                                 | Cần cho                                                                    | Việc                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `expo-video` chưa cài                                                                                                                                                                 | live stream HLS (VISION-FR-013, Report 4 §5.4)                             | `npx expo install expo-video`                                                                                                           |
| `expo-location` chưa cài, dù `app.json` đã xin `ACCESS_FINE_LOCATION`                                                                                                                 | toạ độ trang trại lấy tại nhà yến (FARM-FR-001)                            | cài, sửa câu `NSLocationWhenInUseUsageDescription` thành "Lấy toạ độ trang trại khi đứng tại nhà yến" (Report 4 §5.4 không dùng bản đồ) |
| `react-native-maps` có trong `package.json`                                                                                                                                           | — Report 4 §5.4 nói không thêm thư viện bản đồ                             | gỡ khi làm màn trang trại                                                                                                               |
| FCM: chưa có `google-services.json` (`android.googleServicesFile`), backend chưa có endpoint nhận token trong `api-spec.yaml`                                                         | push (ALERT-FR-002)                                                        | chờ backend (G-10); không tự đặt endpoint                                                                                               |
| Endpoint MF-11 (trạng thái ngày, chấm điểm, bỏ qua) chưa có trong `api-spec.yaml`                                                                                                     | màn sức khỏe ngày (BR-31)                                                  | chờ backend (G-11)                                                                                                                      |
| `ENDPOINTS` chưa có: `/notifications`, `/alerts/{id}/verdict`, `/health-reports`, `/harvests`, `/devices/camera-nodes/{id}/stream-token`, `/devices/sensor-nodes/{id}/relay-override` | thông báo trong app, kiểm chứng, báo cáo, harvest, live stream, chế độ tay | thêm khi làm màn, đúng `api-spec.yaml`                                                                                                  |
| Socket chưa có `JOIN_HOUSE`, `NOTIFICATION_NEW`                                                                                                                                       | đếm chim, cảnh báo nhà yến, thông báo                                      | thêm trước màn đầu tiên đăng ký sự kiện                                                                                                 |
| `.env.example` còn ghi "SRS §9.1"                                                                                                                                                     | —                                                                          | đổi thành `docs/api/api-spec.yaml`                                                                                                      |

- Enum và kiểu dữ liệu giữ tay trong `src/types/<module>.types.ts`, phải khớp `backend/src/types/domain.types.ts` (không có package dùng chung).

---

## 2. Cấu trúc thư mục

Toàn bộ code nằm trong `src/`; mỗi lớp (hooks, services, types, utils…) chia thư mục/file theo nghiệp vụ (`auth`, `farm`, `alert`, `telemetry`, `bird-count`…), mỗi file làm một việc. Không có file barrel `index.ts` — import thẳng file cần dùng; ngoại lệ duy nhất là `src/types/index.ts`.

```
mobile/
├─ app.json, eas.json, babel.config.js, metro.config.js, tsconfig.json, .env.example
├─ assets/                       # ở gốc vì app.json trỏ tới — import bằng @/assets/...
│  ├─ images/                    # icon, splash-icon, adaptive-icon, favicon;
│  │                             #   mobile-scare-icon (nhà yến, nền tối), mobile-scare-text (chữ, nền trong suốt, cắt sát chữ)
│  └─ fonts/                     # Plus Jakarta Sans .ttf 400/500/600/700 + OFL.txt
└─ src/
   ├─ app/                       # expo-router: file = route, chỉ đọc params + gọi hook + render
   │  ├─ _layout.tsx             # Root Stack: nạp font, đọc phiên đăng nhập, QueryClientProvider, splash
   │  ├─ index.tsx               # chuyển hướng: chưa đăng nhập → (auth)/login; mật khẩu tạm → reset-password; còn lại → tab đầu của role
   │  ├─ (auth)/                 # _layout · login · forgot-password · verify-code · reset-password (cả đổi mật khẩu tạm)
   │  │                          #   không có đăng ký công khai (Report 3 §1.2)
   │  ├─ (tabs)/                 # _layout (tab theo role từ constants/roleTabs.ts) · dashboard/ · farms/ · alerts/ ·
   │  │                          #   analytics/ · profile/ (Tài khoản, mọi role) · menu-1/ · menu-2/ (menu tạm của Domain Expert)
   │  ├─ farm/[farmId].tsx       # chi tiết trang trại
   │  ├─ zone/[zoneId].tsx       # chi tiết Zone
   │  ├─ device/[deviceId].tsx   # chi tiết thiết bị
   │  ├─ alert/[alertId].tsx     # chi tiết cảnh báo
   │  └─ livestream/[zoneId].tsx # live stream (sẽ đổi theo camera nhà yến — VISION-FR-013)
   ├─ components/
   │  ├─ ui/                     # text · button · pressable-scale · text-field · code-input · form-message
   │  ├─ auth/                   # AuthScreenLayout.tsx (khung chung các màn xác thực, không cuộn; form nhích lên vừa đủ khi bàn phím mở) ·
   │  │                          #   CollapsesWithKeyboard.tsx (logo, mô tả, chân trang thu lại cùng nhịp bàn phím) ·
   │  │                          #   LogoutButton.tsx (đăng xuất có hỏi xác nhận — tab Tài khoản, màn mật khẩu tạm)
   │  └─ layout/                 # AnimatedSplash.tsx · TextLogo.tsx (logo chữ của splash và màn đăng nhập) · BottomTabBar.tsx (thanh tab, nút nổi) · AppHeader.tsx (header dùng chung, tự chừa vùng an toàn) ·
   │                             #   PlaceholderScreen.tsx (màn tạm của menu chưa gán)
   ├─ config/                    # queryClient.ts
   ├─ constants/                 # theme.ts (Colors, Radius, BorderWidth, Spacing, FontFamily, Typography)
   │                             # apiEndpoints.ts (API_BASE_URL, WEBSOCKET_BASE_URL, ENDPOINTS)
   │                             # roleTabs.ts (tab của từng role, isMobileRole) · authTiming.ts (độ dài và hạn của mã đặt lại mật khẩu)
   ├─ hooks/                     # một hook một file, chia theo nghiệp vụ
   │  ├─ auth/                   # useLogin · useLogout · useForgotPassword · useResetPassword · useChangePassword
   │  ├─ farm/                   # useFarms · useFarmDetail
   │  ├─ alert/                  # useAlerts · useAcknowledgeAlert
   │  ├─ telemetry/              # useLatestTelemetry · useLiveTelemetry · useTelemetryHistory
   │  ├─ bird-count/             # useBirdCountDaily · useBirdCountTrends
   │  └─ theme/                  # usePalette
   ├─ services/
   │  ├─ api/                    # apiClient.ts (axios + làm mới token) · <resource>.api.ts:
   │  │                          #   auth · farm · device · telemetry · alert · analytics
   │  ├─ socket/                 # socketClient.ts (Socket.io realtime)
   │  ├─ notification/           # pushNotification.ts (quyền + push token)
   │  └─ session/                # localSession.ts: startRealtimeIfReady (mở realtime khi có phiên) · clearLocalSession (đăng xuất / hết phiên: ngắt socket, xoá cache, badge, token)
   ├─ stores/                    # authStore.ts · alertStore.ts (zustand)
   ├─ types/                     # <module>.types.ts: api · auth · farm · device · telemetry · alert ·
   │                             #   birdCount · socket · navigation — index.ts gom lại
   └─ utils/                     # date.utils · number.utils · label.utils · validation.utils · apiError.utils
```

**Menu theo role:** sửa duy nhất `src/constants/roleTabs.ts` (`ROLE_TABS`): mỗi mục gồm `name` (thư mục route trong `(tabs)/`), `title`, `icon` (Phosphor). Farm Owner giữ 5 tab; Domain Expert có 2 menu tạm `menu-1..2` (đổi tên và trỏ `name` sang route thật khi làm màn) và tab `profile` dùng chung. Role không có trong `ROLE_TABS` thì không vào được app (Technician, Admin dùng web). Route không thuộc role nào bị ẩn khỏi thanh tab (`hidden`).

### 2.1 Luồng theo role trên mobile

Nguồn: Report 3 §2.2 (luồng MF), §2.4 (quyền), Report 4 §5.4 (phạm vi mobile). Chỉ **Farm Owner** và **Domain Expert** vào app. Technician và Administrator đăng nhập đúng vẫn bị đăng xuất, kèm câu "Tài khoản này chỉ dùng được trên bản web".

```
Splash
└─ (auth) — dùng chung mọi role, một bộ màn
   login ─► forgot-password ─► verify-code ─► reset-password (mode=reset) ─► login
     ├─ must_change_password ─► reset-password (mode=temporary) ─► tab đầu của role
     ├─ role không có trong ROLE_TABS ─► đăng xuất, báo dùng bản web
     └─ đăng nhập xong ─► (tabs) theo ROLE_TABS; Farm Owner đăng ký FCM token

Farm Owner — (tabs)
├─ Tổng quan   dashboard   trạng thái ngày từng nhà, số đo realtime, cảnh báo đang mở
├─ Trang trại  farms ─► farm/[farmId] ─► house/[houseId] ─► zone/[zoneId] ─► device/[deviceId]
│                house: camera, live stream, đếm chim, trạng thái ngày + chấm điểm (BR-31), báo cáo
│                zone : số đo, relay chế độ tay (MF-09), sửa ngưỡng và hệ số; đọc tham số phát hiện
│                device-setup/ (MF-10): quét nhãn ─► quét mã tầng ─► Wi-Fi AP-mode ─► tiến trình setup
│                harvests (ghi, sửa — SF-04)
├─ Cảnh báo    alerts ─► alert/[alertId]: xác nhận đã xử lý; kiểm chứng khi farm chưa có chuyên gia (BR-22)
├─ Phân tích   analytics   đếm chim, tỷ lệ về, dự báo, lịch sử chế độ tay, báo cáo ngày/tuần/tháng,
│                          kết luận và quyết định của chuyên gia (EXPERT-FR-009)
└─ Tài khoản   profile     hồ sơ, đổi mật khẩu, kênh thông báo (push, Telegram), thông báo trong app, đăng xuất

Domain Expert — (tabs)   (hiện là menu-1..2 tạm + profile; đích như dưới, đổi trong ROLE_TABS)
├─ Tổng quan   dashboard   như Farm Owner, chỉ đọc
├─ Trang trại  farms ─► cùng cây màn của Farm Owner, KHÔNG có relay, device-setup, ghi harvest
│                zone : sửa ngưỡng, hệ số, 5 tham số phát hiện (EXPERT-FR-008)
│                house: mức tỷ lệ về giảm, lịch đếm; vẽ vòng đếm làm trên web
├─ Cảnh báo    alerts ─► alert/[alertId]: kiểm chứng Đúng/Sai cảnh báo suy luận; KHÔNG xác nhận đã xử lý
├─ Báo cáo     analytics   báo cáo + viết kết luận, duyệt thay đổi của Farm Owner, áp dụng gợi ý hệ số
└─ Tài khoản   profile     hồ sơ, đổi mật khẩu, thông báo trong app, đăng xuất (không có push, Telegram)
```

**Thao tác theo role trên mobile** (rút từ Report 3 §2.4; bảng đầy đủ ở đó):

| Thao tác                                                                    |                        Farm Owner                        |    Domain Expert     |
| --------------------------------------------------------------------------- | :------------------------------------------------------: | :------------------: |
| Xem dashboard, phân tích, đếm chim, live stream, báo cáo, trạng thái ngày   |                            ✓                             |      ✓ chỉ đọc       |
| Chấm điểm trạng thái ngày của nhà (BR-31)                                   |                            ✓                             |          ✓           |
| Xác nhận đã xử lý cảnh báo                                                  |                            ✓                             |          –           |
| Nhận push, cài kênh Telegram                                                |                            ✓                             |          –           |
| Kiểm chứng cảnh báo suy luận, sửa tham số phát hiện, lịch đếm, mức sức khỏe | chỉ khi farm chưa có chuyên gia (BR-22), còn lại chỉ đọc |          ✓           |
| Viết kết luận, duyệt thay đổi của Farm Owner                                |                           đọc                            |          ✓           |
| Sửa ngưỡng, hệ số fuzzy của Zone                                            |                            ✓                             |          ✓           |
| Relay chế độ tay, lịch loa                                                  |                            ✓                             |          –           |
| Thiết lập / chuyển / gỡ thiết bị bằng QR (MF-10)                            |                            ✓                             | – (chỉ xem thiết bị) |
| Ghi, sửa harvest                                                            |                            ✓                             |         đọc          |

**Quy tắc luồng:**

- **Một màn cho mọi role.** Hai role đi chung route, chung component, chung style; role chỉ quyết định nút thao tác nào hiện. Cấm tạo route hay component riêng theo role (`expert/zone/…`, `ZoneCardExpert`, `OwnerAlertDetail`).
- **Quyền lấy từ một chỗ:** `src/utils/permission.utils.ts` (tạo khi màn đầu tiên cần), hàm `canPerform(user, action, { farmHasExpert })` theo bảng trên, có test. Màn hình không tự so `user.role === '…'`. Ngoại lệ duy nhất: menu trong `constants/roleTabs.ts`.
- Ẩn nút không phải bảo mật (backend chặn), nhưng app không đưa ra thao tác mà backend sẽ từ chối.
- **Role nào cũng phải có tab Tài khoản** (`profile`) để đăng xuất và đổi mật khẩu — `roleTabs.test.ts` kiểm tra điều này. Nút đăng xuất là `components/auth/LogoutButton.tsx`: hỏi xác nhận, khoá nút khi request chạy; không viết lại ở màn khác.

### 2.2 Đồ dùng chung đặt ở đâu

**Trước khi làm màn mới:** đọc file này và `mobile/CLAUDE.md`, tìm trong `components/ui/`, `components/layout/`, `components/common/` trước. Có rồi thì dùng; thiếu kiểu thì thêm `variant`/`size` vào chính component đó; chỉ tạo mới khi chưa có loại đó, và đặt đúng chỗ theo bảng dưới. Cấm mỗi role, mỗi màn tự viết một kiểu nút, ô nhập, header, thẻ hay badge.

| Thứ dùng chung                                                                                | Đặt ở                                                                   | Quy định                                                                                              |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Nút, chữ, ô nhập, ô mã, dòng báo lỗi, badge, toggle, chip, hộp xác nhận, skeleton, khung rỗng | `components/ui/` (kebab-case)                                           | Một component cho một loại; khác nhau bằng `variant`/`size`, không bằng role                          |
| Header, khung màn auth, màn tạm, nút đăng xuất                                                | `components/layout/` · `components/auth/`                               | Mọi màn bắt đầu bằng `AppHeader`; màn auth dùng `AuthScreenLayout`; đăng xuất luôn qua `LogoutButton` |
| Mảnh nghiệp vụ ≥ 2 màn dùng                                                                   | `components/common/`                                                    | `StatusDot`, `SeverityBadge`, `AlertStatusBadge`, `MetricTile`, `card/`                               |
| Mảnh của một luồng                                                                            | `components/<nghiệp vụ>/`                                               | `device-setup/`, `alert/`, `zone/`, `vision/`, `health/`, `harvest/`, `report/`                       |
| Trang hồ sơ / tài khoản                                                                       | `src/app/(tabs)/profile/` (`index`, `change-password`, `notifications`) | Một màn cho mọi role; mục push, Telegram chỉ hiện với Farm Owner                                      |
| Form đổi mật khẩu                                                                             | `components/auth/ChangePasswordForm.tsx`                                | Tách từ `(auth)/reset-password` khi `profile/change-password` cần; hai nơi dùng chung một form        |
| Menu theo role                                                                                | `constants/roleTabs.ts`                                                 | Chỗ duy nhất đổi tên, icon, thứ tự tab                                                                |
| Quyền thao tác                                                                                | `utils/permission.utils.ts`                                             | Chỗ duy nhất quyết định nút nào hiện                                                                  |
| Nhãn tiếng Việt của enum                                                                      | `utils/label.utils.ts`                                                  | Không viết lại nhãn trong màn                                                                         |
| Màu, chữ, bo góc, khoảng cách                                                                 | `constants/theme.ts`                                                    | Xem 3.2 — cấm thêm màu                                                                                |

**Sẽ thêm khi làm màn hình** (tạo khi màn thứ hai cần dùng chung, không tạo sẵn):

- `components/ui/` — primitive không biết nghiệp vụ: `text`, `button`, `input`, `chip`, `badge`, `icon`, `pressable-scale`, `skeleton`, `empty-state` (mục 3.5).
- `components/common/` — biết nghiệp vụ, ≥ 2 màn dùng: `StatusDot`, `SeverityBadge`, `AlertStatusBadge`, `MetricTile`, `card/` (`FarmCard`, `HouseCard`, `ZoneCard`).
- `components/<nghiệp vụ>/` — component riêng một luồng: `device-setup/` (quét QR, AP-mode — MF-10), `dashboard/`, `zone/`, `alert/`, `vision/`, `analytics/`, `harvest/`, `report/`.
- Route theo Report 3: thiết lập thiết bị bằng QR (MF-10), `house/[houseId]`, live stream theo camera nhà yến, `reports/`, `harvests/`, `notifications`; tab theo role (Report 3 §2.4 — chỉ Farm Owner và Domain Expert), `settings` đã đổi tên `profile`.
- `hooks/` và `services/api/` cho thiết lập thiết bị, harvest, health report, notification, FCM token theo `docs/api/api-spec.yaml`.

### Luồng dữ liệu

Màn hình (`src/app/`) → hook (`src/hooks/<nghiệp vụ>/`) → API (`src/services/api/<resource>.api.ts`) → `apiClient.ts` → backend. Màn hình không gọi axios hay `services/api` trực tiếp.

- **HTTP**: `services/api/apiClient.ts` — axios instance `apiClient`, `baseURL` = `EXPO_PUBLIC_API_URL` (route không có tiền tố, theo `docs/api/api-spec.yaml`), header `X-Client: mobile` (backend trả `refreshToken` trong body thay vì chỉ cookie), timeout 15s.
  - Interceptor gắn `Bearer accessToken` đọc từ bộ nhớ (`authStore.accessToken`), không đọc SecureStore mỗi request vì giải mã Keystore/Keychain chậm — SecureStore chỉ giữ token qua lần mở app sau; gặp 401 thì gọi `POST /auth/refresh` 1 lần (các request đồng thời xếp hàng chờ chung 1 lần refresh) rồi gửi lại; request mang token cũ hơn token hiện tại (lần làm mới khác vừa xong) thì gửi lại ngay, không làm mới thêm. Lời gọi refresh dùng axios instance riêng không interceptor, cùng `baseURL`, `X-Client` và timeout 15s — refresh treo thì hết giờ, không giữ các request chờ mãi.
  - Route xác thực (đăng nhập, quên/đặt lại mật khẩu, OTP) không làm mới token: 401 ở đó là sai thông tin. Đăng xuất **có** làm mới: backend đòi access token còn hạn cho `/auth/logout`, không làm mới thì refresh token không bị thu hồi (AUTH-FR-006).
  - Backend từ chối refresh (401) thì xoá phiên (`authStore.clearAuth`) và về `(auth)/login`; mất mạng thì giữ phiên.
  - Gặp 403 `PASSWORD_CHANGE_REQUIRED` thì mở `(auth)/reset-password` chế độ `temporary` (AUTH-FR-005c).
- **Token**: `accessToken`, `refreshToken`, `user` luôn lưu trong SecureStore (Keychain/Keystore) qua `authStore.setAuth`; không lưu vào MMKV, AsyncStorage hay log.
- **API**: mỗi resource 1 file `services/api/<resource>.api.ts` (`farm.api.ts`, `alert.api.ts`…), export object `<resource>Api` (`farmApi.list`, `farmApi.getDetail`…); đường dẫn lấy từ `ENDPOINTS` (`constants/apiEndpoints.ts`), kiểu `ApiResponse<Data>` từ `@/types`.
- **Server state**: TanStack Query, cấu hình chung ở `config/queryClient.ts` (`staleTime` 5 phút, `gcTime` 10 phút, query retry 2, mutation retry 1).
  - Mỗi hook 1 file trong thư mục nghiệp vụ (`hooks/farm/useFarms.ts`, `hooks/alert/useAcknowledgeAlert.ts`) bọc `useQuery` / `useMutation`; `queryKey` bắt đầu bằng tên resource (`['alerts', params]`); mutation tự `invalidateQueries` key mà nó thay đổi.
  - Danh sách trả `{ data, meta: { page, limit, total } }`, màn hình phân trang theo `meta`.
  - Dữ liệu server chỉ nằm trong cache React Query, không chép sang zustand hay `useState`.
- **Realtime**: `services/socket/socketClient.ts` — `connectSocket()` sau khi đăng nhập (`useLogin`), mỗi lần kết nối lại đọc lại token, tự kết nối lại 1–5s; vào/ra phòng `JOIN_ZONE` / `LEAVE_ZONE`; sự kiện `TELEMETRY_UPDATE`, `RELAY_UPDATE`, `ALERT_NEW`, `BIRD_COUNT_UPDATE`.
  - Màn hình đăng ký sự kiện trong effect phải huỷ trong cleanup bằng `off*` cùng handler (`offTelemetryUpdate`, `offAlertNew`, `offBirdCountUpdate`, `offRelayUpdate`); mẫu: `hooks/telemetry/useLiveTelemetry.ts`.
- **Client state**: zustand trong `stores/` — `authStore.ts` (`user`, `accessToken`, `isAuthenticated`, `isLoading`; `setAuth` / `clearAuth` / `loadStoredAuth`), `alertStore.ts` (`unreadCount`, `latestAlert` cho badge tab Cảnh báo).
- **Push**: `services/notification/pushNotification.ts` xin quyền, lấy push token, tạo kênh Android `alerts`. **Chưa làm:** gửi token lên backend (chờ endpoint trong `api-spec.yaml`, ALERT-FR-002).
- **Lỗi**: hiện 1 câu tiếng Việt ngắn theo nhóm (phiên đăng nhập/quyền, không tìm thấy, dữ liệu không hợp lệ, lỗi hệ thống, mất mạng); câu đầy đủ, có hướng dẫn "Vui lòng …" khi người dùng làm được gì đó; không hiện mã HTTP hay nguyên văn thông báo backend. Mất mạng (`NETWORK_ERROR_MESSAGE`) và lỗi máy chủ 5xx (`SERVER_ERROR_MESSAGE`) là hai câu khác nhau.
  - Xác thực: `utils/apiError.utils.ts` (`getAuthErrorMessage`) đổi `error.code` + status thành câu theo từng thao tác; sai email hay sai mật khẩu chung một câu; 429 lấy `retryAfterSec` của backend. Nút "Gửi lại mã" không có thời gian chờ đặt ở máy (không có nguồn) — giới hạn là của backend. Mutation xác thực đặt `retry: false` vì mỗi lần sai đều bị backend tính vào giới hạn 10 lần / 15 phút.
- **Route params**: id đi qua route động của expo-router (`farm/[farmId]`, `house/[houseId]`, `zone/[zoneId]`, `device/[deviceId]`, `alert/[alertId]`), đọc bằng `useLocalSearchParams`; không hiện id lên giao diện.

---

## 3. Style UI

Phong cách: **tối giản, phẳng** theo ảnh mẫu — nền Paper `#F3F3EE`, card và ô nhập trắng, chữ Ink `#0B0B0C`, thanh tab trắng, khối tối (card nổi bật) nền Ink, một màu nhấn duy nhất là Lime `#C3FD47`; cam `#FF7426` chỉ dành cho cảnh báo. Card và khối bo góc lớn (`Radius.lg`), ô nhỏ bo vừa, nút/ô nhập/badge bo tròn hết cỡ — không còn khung vuông góc; không đổ bóng.

### 3.1 Nguyên tắc

- Chỉ dùng `StyleSheet.create` + token trong `@/constants/theme`. **Không** hard-code màu/font/radius/khoảng cách trong màn hình.
- Không dùng thư viện UI ngoài (không Tailwind/NativeWind, không UI kit). Ghép từ primitive trong `components/ui`.
- Chữ luôn đi qua `<Text variant=…>`; icon luôn qua `<Icon …>`; nút bấm có hiệu ứng dùng `<PressableScale>` / `<Button>`.
- **Chỉ có giao diện sáng** — không làm chế độ tối, không đọc `useColorScheme()`. Lấy màu qua `const palette = usePalette()` (`hooks/theme/usePalette.ts`), không dùng thẳng `Colors.light`, để mọi màn lấy màu từ một chỗ.
- Toàn bộ chữ trên giao diện bằng tiếng Việt; giữ "Zone", "Farm" giống web.

### 3.2 Màu (`Colors`)

Nguồn: `constants/theme.ts`. Lấy bộ màu bằng `usePalette()`; `Colors.raw` là mã hex gốc cho chỗ cần màu cố định ngoài bảng (khung video nền tối, màu đèn kênh thông báo). Không viết hex trực tiếp trong màn hình.

**Bảng màu đã chốt (2026-10-30) — không tự ý sửa.** Mọi giá trị trong `Colors` (`constants/theme.ts`) và hai bảng dưới giữ nguyên; chỉ đổi khi người dùng yêu cầu rõ token nào, mã màu nào. Không "chỉnh cho đẹp", không đổi màu khi làm màn hình mới, không đổi kèm theo khi sửa việc khác.

**Cấm tuyệt đối tự phối màu mới.** Chỉ dùng token có trong hai bảng dưới. Không viết mã hex, không pha độ trong suốt mới (`palette.primary + '33'`), không lấy màu mặc định của thư viện, không làm bảng màu riêng cho một role hay một màn. Chỉ được thêm màu khi prompt yêu cầu **và ghi rõ mã `#RRGGBB`**. Khi đó:

1. thêm token vào `Colors.light` trong `theme.ts`, comment ghi "thêm theo yêu cầu";
2. thêm dòng vào bảng ở mục này;
3. cuối câu trả lời ghi rõ: "Đã thêm mã màu ngoài bảng màu hệ thống: `<token>` = `#…`".

Quy tắc màu: **lime `primary` là điểm nhấn duy nhất** và **chỉ làm nền** (nút chính, nút tròn giữa, badge số) hoặc làm chữ/icon **trên nền Ink** (tab đang chọn) — lime trên nền sáng không đọc được, chữ/viền nhấn trên nền sáng dùng `text`; **cam `alert` chỉ dùng cho cảnh báo, lỗi, khẩn cấp**, không dùng cho nút; số liệu tĩnh để xám/trắng.

| Nhóm     | Token              | Hex         | Dùng cho                                          |
| -------- | ------------------ | ----------- | ------------------------------------------------- |
| Nền      | `background`       | `#F3F3EE`   | nền màn hình — Paper (Stack/Tabs `contentStyle`)  |
|          | `surface`          | `#FFFFFF`   | nền card, ô nhập, nút phụ, nút quay lại           |
|          | `surfaceStrong`    | `#F3F3EE`   | khối nền bên trong card trắng                     |
|          | `border`           | `#0B0B0C1A` | viền mảnh (Ink 10%)                               |
|          | `divider`          | `#0B0B0C14` | đường kẻ mảnh chia dòng, chia khối (Ink 8%)       |
| Khối tối | `inverse`          | `#0B0B0C`   | card nổi bật (Ink)                                |
|          | `onInverse`        | `#FFFFFF`   | chữ trên khối tối                                 |
|          | `onInverseSecondary` | `#FFFFFF8C` | chữ phụ trên khối tối (trắng 55%)                 |
| Chữ      | `text`             | `#0B0B0C`   | chữ chính (Ink), viền ô đang nhập                 |
|          | `textSecondary`    | `#0B0B0C8C` | chữ giải thích, label nhỏ (Ink 55%)               |
|          | `secondary`        | `#0B0B0C8C` | icon/phần tử trung tính                           |
| Primary  | `primary` / `tint` | `#C3FD47`   | nền nút chính, nút tròn giữa, badge (Lime)        |
|          | `onPrimary`        | `#0B0B0C`   | chữ/icon trên nền `primary`                       |
| Tab bar  | `tabIconSelected`  | `#0B0B0C`   | icon và chữ tab đang chọn (Ink)                   |
|          | `tabIconDefault`   | `#0B0B0C8C` | tab chưa chọn (Ink 55%)                           |
|          | `tabActiveBackground` | `#C3FD47` | vòng tròn lime sau icon tab đang chọn             |
| Cảnh báo | `alert`            | `#FF7426`   | cảnh báo, lỗi thiết bị, khẩn cấp                  |

Màu trạng thái — **chép đúng từ web** (`frontend/tailwind.config.ts`):

| Nhóm                     | Token                                  | Hex                               | Dùng cho                       |
| ------------------------ | -------------------------------------- | --------------------------------- | ------------------------------ |
| Mức độ (nền / chữ badge) | `severityP1` / `severityP1Text`        | `#FF7426` / `#FFFFFF`             | P1 Khẩn cấp                    |
|                          | `severityP2` / `severityP2Text`        | `#FAE1D1` / `#8B400E`             | P2 Cao                         |
|                          | `severityP3` / `severityP3Text`        | `#87838026` / `#878380`           | P3 Thường, việc đã kết thúc    |
| Trạng thái xử lý         | `statusNew`                            | `#4A89EB`                         | Mới                            |
|                          | `statusInProgress`                     | `#B5D32C`                         | Đang xử lý                     |
|                          | `statusResolved`                       | `#878380`                         | Đã xử lý / đã đóng             |
|                          | `statusWait`                           | `#FFE033`                         | Chờ kết nối PLC (chữ charcoal) |
| Thiết bị (chấm màu)      | `deviceOnline`                         | `#B5D32C`                         | Online                         |
|                          | `deviceOffline`                        | `#A5A3A1`                         | Offline                        |
|                          | `deviceError`                          | `#D53F35`                         | Lỗi                            |
|                          | `deviceDegraded`                       | `#ED8F50`                         | Suy giảm                       |
|                          | `devicePending`                        | `#F3B287`                         | Chờ kết nối                    |
| Loại yến                 | `nestWhite` / `nestPink` / `nestBlood` | `#B5D32C` / `#89A022` / `#414C10` | Yến trắng / hồng / huyết       |

`Colors.raw`: `lime #C3FD47`, `ink #0B0B0C`, `paper #F3F3EE`, `pureWhite #FFFFFF`, `safetyOrange #FF7426`, `successLime #B5D32C`, `alertRed #D53F35`.

### 3.3 Typography

Font **Plus Jakarta Sans** (cùng web), file `.ttf` tĩnh trong `assets/fonts/` (kèm `OFL.txt`), nạp bằng `useFonts` ở `app/_layout.tsx` — splash giữ tới khi font nạp xong; nạp lỗi thì app vẫn mở bằng font hệ thống.

`FontFamily`: `regular` 400 · `medium` 500 · `semiBold` 600 · `bold` 700. Chọn nét bằng `fontFamily`, không dùng `fontWeight` — Android không tự chọn file theo độ đậm.

`Typography` (`constants/theme.ts`) — tiêu đề nét vừa, giãn chữ -2% theo ảnh mẫu:

| Variant           | Size / line-height | Nét     | Giãn chữ | Dùng cho                             |
| ----------------- | ------------------ | ------- | -------- | ------------------------------------ |
| `display`         | 48 / 52            | medium  | -0.96    | tiêu đề rất lớn đầu màn              |
| `title`           | 28 / 34            | medium  | -0.56    | tiêu đề màn, số lớn                  |
| `heading`         | 20 / 26            | medium  | -0.4     | tên mục, tên khối                    |
| `body` (mặc định) | 14 / 20            | regular | —        | nội dung                             |
| `small`           | 12 / 16            | regular | —        | mô tả, giá trị phụ (`textSecondary`) |
| `label`           | 12 / 16            | medium  | —        | nhãn nhỏ (`text`; lime chỉ trên Ink) |
| `button`          | 14 / 20            | bold    | —        | chữ trên nút                         |

Không in hoa nhãn nhỏ: dấu tiếng Việt (Ế, Ữ, Ặ) chồng nhau ở cỡ 12 (cùng quy tắc web).

`<Text variant>` (`components/ui/text.tsx`) — props thêm: `weight` (ghi đè `FontFamily`), `color`, `center`.

```tsx
<Text variant="label">Thông số Zone</Text>
<Text variant="title">Zone A1</Text>
<Text variant="small" color={palette.textSecondary}>Cập nhật 2 phút trước</Text>
```

### 3.4 Bo góc, viền & khoảng cách

- Giao diện phẳng: không dùng đổ bóng; tách khối bằng nền `surface` và đường kẻ `divider`. Ngoại lệ duy nhất: thanh tab (`components/layout/BottomTabBar.tsx`) bo 2 góc trên `Radius.lg`, mép có bóng đổ nhoè (bộ lọc `FeGaussianBlur` của `react-native-svg`, màu token `divider`), viền mép trùng nền thanh (`BORDER_COLOR_TOKEN`).
- `Radius` (theo ảnh mẫu, không còn `none`): `sm 8` (khối nhỏ bên trong card như dòng tiêu đề bảng, checkbox) · `md 16` (ô hành động nhanh, dòng danh sách, khối nhấn trong card, ô mã số) · `lg 24` (card, card tối nổi bật, sheet, hộp thoại, khối logo icon, góc thanh tab) · `full` (nút bấm, ô nhập, nút tròn icon, avatar, badge, chip).
- `BorderWidth`: `hairline 0.5` (đường kẻ chia dòng) · `regular 1` (ô nhập) · `strong 1.5` (nút outline).
- `Spacing`: `xs 4` · `sm 8` · `md 12` · `lg 16` (lề màn hình) · `xl 24` · `xxl 32`.

```tsx
tile:   { backgroundColor: palette.surface, borderRadius: Radius.lg },
button: { backgroundColor: palette.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.xl },
row:    { borderBottomWidth: BorderWidth.hairline, borderBottomColor: palette.divider },
```

### 3.5 Component primitive (`components/ui`)

Đã có: `text`, `button` (`primary`, `secondary`, `link`), `pressable-scale`, `text-field` (nền `surface` bo `Radius.full`, icon trái, chữ gợi ý thay nhãn, không viền — viền `text` khi đang nhập, `alert` khi lỗi; lỗi/gợi ý dưới ô, nút mắt cho mật khẩu), `code-input` (ô mã số nền `surface` bo `Radius.md`, dán và tự điền mã, rung khi mã bị từ chối), `form-message` (dòng lỗi màu `alert` / dòng thành công màu `primary`). Còn lại trong bảng là quy ước khi viết. Giá trị animated (reanimated) đọc/ghi bằng `.get()` / `.set()`, không gán `.value` trong handler (luật React Compiler của eslint).

| Component                   | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                    | Bo tròn hết cỡ (`Radius.full`). `variant`: `primary` (nền `primary`, chữ `onPrimary`) · `secondary` (nền `surface` trắng, không viền, chữ `text`) · `danger` (thao tác phá huỷ: tắt relay, xoá, đăng xuất) · `icon` (nút tròn chỉ có icon, nền `primary`) · `link` (chữ `textSecondary` gạch chân); `size`: `sm` 36 / `md` 44 / `lg` 52; `loading` → khoá nút; `disabled` → opacity 0.5. |
| `Text`                      | Xem 3.3.                                                                                                                                                                                                                                                                                                                                                                                                |
| `Icon`                      | Chỉ dùng **`phosphor-react-native`** (cùng bộ Phosphor với web Farm Owner, chạy trên `react-native-svg`). Cỡ theo thang 12 / 14 / 16 / 20 / 24 / 32, mặc định 20; `weight` mặc định `regular`, tab đang chọn `fill`; màu theo `Colors` (`text`, `textSecondary`, `primary`, `alert`), không truyền mã hex.                                                                                              |
| `PressableScale`            | Pressable co lại (`scaleTo` mặc định 0.96) và bật về bằng spring (reanimated); tắt khi bật "Giảm chuyển động".                                                                                                                                                                                                                                                                                          |
| `Input`, `Checkbox`, `Chip` | Form & bộ lọc.                                                                                                                                                                                                                                                                                                                                                                                          |
| `Toggle`                    | Công tắc bật/tắt (relay, cài đặt thông báo).                                                                                                                                                                                                                                                                                                                                                            |
| `Badge`                     | Nhãn mức độ / trạng thái, màu `severity*` · `status*` · `device*` từ `theme.ts`, luôn có chữ.                                                                                                                                                                                                                                                                                                           |
| `Skeleton`                  | Placeholder khi chờ dữ liệu; ẩn khỏi screen reader.                                                                                                                                                                                                                                                                                                                                                     |
| `EmptyState`                | Khung rỗng khi chưa có dữ liệu; giá trị thiếu hiện `_`.                                                                                                                                                                                                                                                                                                                                                 |
| `ConfirmDialog`             | Xác nhận trước thao tác phá huỷ; nút xác nhận khoá trong lúc request chạy.                                                                                                                                                                                                                                                                                                                              |

**Vùng an toàn (tai thỏ, Dynamic Island, thanh Home):** không viết `paddingTop`/`marginTop` cứng và không dùng header gốc của router (Stack và Tabs đều `headerShown: false`). Mọi màn bắt đầu bằng `AppHeader` (`components/layout/AppHeader.tsx`): tự cộng `useSafeAreaInsets().top`, thanh cao 52 dưới vùng an toàn, lề ngang 16; `title` căn trái ở tab, có `onBack` thì nút tròn trắng (`surface`) bên trái (`accessibilityLabel="Quay lại"`) và tiêu đề căn giữa; `right` cho nút thao tác; màn nền tối truyền `backgroundColor`/`foregroundColor`. Màn chi tiết cộng `insets.bottom` vào nội dung cuối; thanh tab cao 60 + `insets.bottom`.

Layout: `AppHeader` (đã có), `BottomTabBar` (đã có, `components/layout/BottomTabBar.tsx`) — thanh tab tự vẽ dùng chung mọi role, truyền vào `Tabs` qua `tabBar`.

**Thanh tab đã chốt (2026-10-30) — không tự ý sửa.** Không đổi màu, hình dạng hay bố cục thanh tab: nền trắng dính đáy, có bướu quanh nút tròn giữa lime, tab chọn icon Ink trong vòng lime, bấm chuyển ngay không hiệu ứng, cùng các số trong "bảng chỉnh" đầu file. Chỉ sửa khi người dùng yêu cầu rõ thay đổi thanh tab. Thanh tab hiện tại:

- Tab dựng từ `ROLE_TABS`; route không thuộc role bị ẩn bằng `hidden`.
- Nền trắng (`surface`) vẽ bằng `react-native-svg`: bo 2 góc trên, bóng đổ nhoè (`SHADOW_BLUR`, `SHADOW_OFFSET_Y`, màu `divider`), viền mép `BORDER_COLOR_TOKEN`, có bướu nhô quanh nút nổi.
- Tab có `isFeatured: true` (mỗi role tối đa một) thành nút tròn 60 nổi lên, nền `primary` (lime), icon `onPrimary` 32; nhãn thẳng hàng các tab khác. Role không có tab nổi thì mép thẳng.
- Tab đang chọn: icon `fill` + màu `tabIconSelected` trong vòng tròn nền `tabActiveBackground`; tab chưa chọn màu `tabIconDefault` (riêng nút nổi luôn icon `fill`, không đổi khi chọn); badge số nền `primary` viền `surface`.
- Tab dùng `Pressable` thường, **không** `PressableScale`: bấm là chuyển ngay, không có hiệu ứng nhấn.
- Thanh kéo lên đè đáy màn một khoảng `TAB_BAR_OVERLAP` (đủ chứa nút nổi, bướu và phần nhoè của bóng): màn tab có nội dung cuộn phải chừa thêm `TAB_BAR_OVERLAP` ở đáy.
- Màn con như `profile/notifications` nằm trong thư mục của tab cha nên tab cha vẫn sáng.

### 3.6 Animation & tương tác

- `react-native-reanimated` 4 + `react-native-worklets` (đi kèm Expo SDK 58): gọi hàm JS từ worklet bằng `scheduleOnRN` (không dùng `runOnJS` đã bị bỏ); vào màn dùng `FadeInDown` / `FadeInUp`; nhấn dùng spring qua `PressableScale` (`components/ui/pressable-scale.tsx`).
- Stack chuyển màn `slide_from_right`; Tabs `shift`.
- Tôn trọng "Giảm chuyển động" của hệ điều hành: animation dùng `.reduceMotion(ReduceMotion.System)` hoặc kiểm tra `useReducedMotion()`.
- Số đo realtime (nhiệt độ, độ ẩm, NH3/CO2) cập nhật tại chỗ, không chạy animation mỗi lần có giá trị mới.
- Rung nhẹ (`expo-haptics`) chỉ cho hành động có hậu quả: bật/tắt relay, xác nhận cảnh báo.
- Ảnh dùng `expo-image`.
- **Splash** (`components/layout/AnimatedSplash.tsx`, gắn ở `app/_layout.tsx`): splash gốc chỉ là màn trắng (ảnh `splash-blank.png` trong suốt — Android 12+ luôn cắt icon splash gốc thành hình tròn nên không dùng icon ở đây) → splash JS: cụm icon khối vuông 120 (bo `Radius.lg` 24) + logo chữ rộng 200, cách nhau `Spacing.lg` 16, căn giữa tuyệt đối trên nền `#FFFFFF`, không có dòng chữ phụ → nạp xong font/phiên đăng nhập, giữ tối thiểu 0.8s rồi mờ dần 0.6s để lộ màn auth. Splash nền trắng như cả app; app dựng bên dưới ngay khi nạp xong; "Giảm chuyển động" bật thì bỏ qua hiệu ứng mờ.

### 3.7 Accessibility

- Nút icon-only phải có `accessibilityLabel` (tiếng Việt) và vùng chạm tối thiểu 44×44 pt / 48×48 dp (thêm `hitSlop` nếu icon nhỏ hơn).
- `Button` set `accessibilityRole="button"` + `accessibilityState={{ disabled, busy }}` (`busy` khi đang gửi request); tab bar tự viết dùng `accessibilityRole="tab"` + `selected`.
- Trạng thái không chỉ báo bằng màu: badge mức độ, chấm trạng thái thiết bị, trạng thái cảnh báo luôn kèm chữ.
- Số đo đọc kèm tên và đơn vị qua `accessibilityLabel` ("Nhiệt độ 28 độ C").
- Phần trang trí (skeleton, icon minh hoạ) ẩn khỏi screen reader bằng `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`; khối đang tải có `accessibilityLabel="Đang tải"`.
- Không tắt `allowFontScaling`; bố cục phải chịu được cỡ chữ hệ thống lớn.
- Tương phản chữ mục tiêu 4.5:1 (chữ ≥ 18pt hoặc đậm ≥ 14pt: 3:1). `textSecondary` là Ink mờ 55% (`#0B0B0C8C`), trên nền Paper trông như `#737372` (khoảng 4.2:1), trên card trắng như `#797979` (khoảng 4.4:1) — chỉ dùng cho chữ phụ, không dùng cho nội dung chính.

### 3.8 Quy ước code

**Đặt tên file và thư mục** (cùng quy ước với web, `frontend/FE_Design_Claude.md` 12.9):

| Loại          | Đặt ở                                                 | Tên file                                           | Ví dụ                                                                  |
| ------------- | ----------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| Route         | `src/app/`                                            | theo URL, chữ thường; export default `<Tên>Screen` | `login.tsx` → `LoginScreen` · `zone/[zoneId].tsx` → `ZoneDetailScreen` |
| Component     | `src/components/<layout\|common\|nghiệp vụ>/`         | PascalCase, trùng tên hàm export                   | `ZoneCard.tsx` · `BottomTabBar.tsx` · `AnimatedSplash.tsx`             |
| Primitive     | `src/components/ui/`                                  | kebab-case                                         | `pressable-scale.tsx` · `status-badge.tsx`                             |
| Hook          | `src/hooks/<nghiệp vụ>/`                              | `use<Việc>.ts`, một hook một file                  | `hooks/farm/useFarmDetail.ts` · `hooks/auth/useLogin.ts`               |
| API           | `src/services/api/`                                   | `<resource>.api.ts`, export `<resource>Api`        | `farm.api.ts` → `farmApi`                                              |
| Socket / push | `src/services/socket/` · `src/services/notification/` | camelCase theo vai trò                             | `socketClient.ts` · `pushNotification.ts`                              |
| Store         | `src/stores/`                                         | `<tên>Store.ts`, export `use<Tên>Store`            | `authStore.ts` → `useAuthStore`                                        |
| Kiểu dữ liệu  | `src/types/`                                          | `<module>.types.ts`, gom ở `index.ts`              | `alert.types.ts` · `birdCount.types.ts`                                |
| Hằng số       | `src/constants/`                                      | camelCase theo nội dung                            | `theme.ts` · `apiEndpoints.ts`                                         |
| Hàm thuần     | `src/utils/`                                          | `<chủ đề>.utils.ts`                                | `date.utils.ts` · `validation.utils.ts`                                |
| Thư mục       | —                                                     | kebab-case khi nhiều từ                            | `bird-count/`                                                          |

- **Không viết tắt**: tên biến, tham số, hàm viết đủ (`response`, `state`, `alert`, `accessToken` — không `res`, `s`, `a`, `tk`). Tên trường trùng backend (`temp_min`, `full_name`) giữ nguyên vì là hợp đồng API.
- Không tạo barrel `index.ts` (trừ `src/types/index.ts`) — import thẳng file: `@/hooks/farm/useFarms`, `@/stores/authStore`.
- Import qua alias `@/…` (code trong `src/`) và `@/assets/…` (ảnh, font), không dùng `../`.
- Màu lấy từ `Colors` trong `constants/theme.ts`, không viết mã hex trong màn hình.
- Comment ngắn, tiếng Việt, chỉ giải thích "tại sao".
- Đường tắt có giới hạn ghi `// shortcut: <giới hạn>, <khi nào nâng cấp>`.

### 3.9 Mẫu màn hình tối giản

Dùng hook có sẵn `useFarms`; `Text`, `Button` đã có, `Skeleton`, `EmptyState` sẽ viết theo 3.5.

```tsx
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useFarms } from "@/hooks/farm/useFarms";
import { usePalette } from "@/hooks/theme/usePalette";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { BorderWidth, Radius, Spacing } from "@/constants/theme";

export default function FarmsScreen() {
  const palette = usePalette();
  const { data, isLoading, isError, refetch } = useFarms();
  const farms = data?.data ?? [];

  if (isLoading) return <Skeleton height={64} />;
  if (isError)
    return (
      <EmptyState
        title="Không tải được danh sách trang trại"
        actionLabel="Thử lại"
        onAction={refetch}
      />
    );

  return (
    <FlatList
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
      data={farms}
      keyExtractor={(farm) => farm._id}
      ListHeaderComponent={<Text variant="title">Trang trại</Text>}
      ListEmptyComponent={<EmptyState title="Chưa có trang trại" />}
      renderItem={({ item: farm }) => (
        <Pressable
          style={[styles.row, { borderBottomColor: palette.divider }]}
          onPress={() => router.push(`/farm/${farm._id}`)}
        >
          <Text variant="heading">{farm.name}</Text>
          <Text variant="small" color={palette.textSecondary}>
            {farm.address}
          </Text>
        </Pressable>
      )}
      ListFooterComponent={
        <View style={[styles.footer, { backgroundColor: palette.surface }]}>
          <Button
            variant="primary"
            label="Xem cảnh báo"
            onPress={() => router.push("/alerts")}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
  row: {
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    borderBottomWidth: BorderWidth.hairline,
  },
  footer: { padding: Spacing.lg, borderRadius: Radius.lg },
});
```
