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
- **Không chạy được trên Expo Go**: app có module native (mmkv, maps) và chưa cài `expo-dev-client` — phải dùng bản build `npm run android`.

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
| `react-native-mmkv`             | ^4.3.2 + `react-native-nitro-modules` | mmkv 4 chạy trên Nitro Modules — chưa dùng: cần bản build có Nitro, Expo Go không có, nên lựa chọn trên máy lưu bằng `expo-file-system` |
| `@testing-library/react-native` | ~14.1.0 + `test-renderer`             | `expo-router` 58 cần bản ≥ 14; bản 14 thay `react-test-renderer` bằng `test-renderer`              |
| `jest` / `typescript`           | ~30.5.2 / ~6.0.3                      | theo `expo install --check` của SDK 58                                                             |
| `expo-av`                       | đã gỡ                                 | không còn trong SDK — phát video/âm thanh dùng `expo-video` / `expo-audio`                         |

Thay đổi code đi kèm: `runOnJS` → `scheduleOnRN` (`react-native-worklets`); bỏ `newArchEnabled` và khoá `splash` khỏi `app.json` (splash vào plugin `expo-splash-screen`); bỏ `baseUrl` khỏi `tsconfig.json`; `AndroidImportance` import thẳng từ `expo-notifications` (truy cập qua `Notifications.AndroidImportance` bị lint báo nhầm).

### Biến môi trường app (`.env`, mẫu ở `.env.example`)

| Biến                  | Mặc định                | Ghi chú                                                                                                                             |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` | Route không có tiền tố (`/auth/login`, `/farms`…). Emulator Android: `http://10.0.2.2:3000`; máy thật: IP LAN của máy chạy backend. |
| `EXPO_PUBLIC_WS_URL`  | `ws://localhost:3000`   | Socket.io, đổi host giống dòng trên.                                                                                                |
| `EXPO_PUBLIC_STREAM_URL` | `http://localhost:8888` | Gốc HLS của MediaMTX cho live stream camera AI (`expo-video`, token 60 giây — VISION-FR-013). MediaMTX phải bật HLS; đổi host giống dòng trên. |

App khoá chiều dọc (`app/_layout.tsx`, `expo-screen-orientation`); riêng trình phát camera (`components/home/LiveCameraPlayer.tsx`) mở khoá xoay khi đang phóng to, và nút toàn màn của camera ở tab Trang trại (`components/farm/CameraFullscreenModal.tsx`) khoá ngang rồi trả lại dọc khi đóng. `expo-network` cho biết đang dùng Wi-Fi hay dữ liệu di động để quyết camera có tự phát không. Thêm `expo-video`, `expo-screen-orientation`, `expo-network` là gói native: sau khi kéo code phải `npm ci` rồi `npm run android` để build lại app.

Mọi biến `EXPO_PUBLIC_*` bị đóng vào app — không đặt secret ở đây.

### Cấu hình chính

- `app.json`: `typedRoutes` bật; `orientation: default` (app tự khoá dọc trong `app/_layout.tsx`, chỉ trình phát camera xoay ngang); `userInterfaceStyle: light` (app chỉ có giao diện sáng, máy bật chế độ tối cũng không đổi; Android cần gói `expo-system-ui` để giữ đúng giao diện sáng); plugin `expo-router`, `expo-splash-screen`, `expo-secure-store`, `expo-notifications`, `expo-camera`, `expo-asset`, `expo-font`. Từ SDK 57 splash khai báo trong plugin `expo-splash-screen` (không còn khoá `splash` ở gốc): ảnh `splash-blank.png`, nền `#FFFFFF`; adaptive icon nền `#172008` trùng nền logo.
- `tsconfig.json`: `strict`; không dùng `baseUrl` (TypeScript 6 đã bỏ); alias `@/assets/*` → `./assets/*` (ảnh, font ở gốc `mobile/`) và `@/*` → `./src/*` (toàn bộ code). expo-router tự nhận route trong `src/app/`.
- `babel.config.js`: chỉ `babel-preset-expo` (tự đọc alias của tsconfig và tự thêm plugin Reanimated).
- Biểu đồ: `react-native-gifted-charts` (chạy trên `react-native-svg` và `expo-linear-gradient` đã có), chỉ import trong `src/components/charts/`. Đã gỡ `victory-native` và Skia (2026-11-01).
- `expo-location` (toạ độ farm, FARM-FR-001): chỉ xin quyền vị trí khi người dùng bấm "Lấy vị trí hiện tại"; câu xin quyền ở plugin `expo-location` và `ios.infoPlist` của `app.json` ("lấy vị trí để điền toạ độ trang trại", không dùng bản đồ — Report 4 §5.4). `expo-camera` quét nhãn QR khi thêm thiết bị (MF-10). Cả hai cần build lại app (`npm run android`) sau khi cài.

**Cấu hình còn thiếu so với Report 3/4** (làm cùng PR của tính năng cần nó):

| Thiếu                                                                                                                                                                                 | Cần cho                                                                    | Việc                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native-maps` có trong `package.json`                                                                                                                                           | — Report 4 §5.4 nói không thêm thư viện bản đồ                             | gỡ khi làm màn trang trại                                                                                                               |
| FCM: chưa có `google-services.json` (`android.googleServicesFile`), backend chưa có endpoint nhận token trong `api-spec.yaml`                                                         | push (ALERT-FR-002)                                                        | chờ backend (G-10); không tự đặt endpoint                                                                                               |
| Endpoint MF-11 (trạng thái ngày, chấm điểm, bỏ qua) chưa có trong `api-spec.yaml`                                                                                                     | màn sức khỏe ngày (BR-31)                                                  | chờ backend (G-11)                                                                                                                      |
| `ENDPOINTS` chưa có: `/notifications`, `/alerts/{id}/verdict`, `/health-reports`, `/harvests`, `/devices/camera-nodes/{id}/stream-token`, `/devices/sensor-nodes/{id}/relay-override` | thông báo trong app, kiểm chứng, báo cáo, harvest, live stream, chế độ tay | thêm khi làm màn, đúng `api-spec.yaml`                                                                                                  |
| Socket chưa có `NOTIFICATION_NEW` (phòng nhà, tầng đã đếm số màn dùng chung)                                                                                                                                       | đếm chim, cảnh báo nhà yến, thông báo                                      | thêm trước màn đầu tiên đăng ký sự kiện                                                                                                 |
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
   │  ├─ (tabs)/                 # _layout (tab theo role từ constants/roleTabs.ts) · home/ (Trang chủ — hiện chỉ tab của Farm Owner mở; Domain Expert chưa có tab này trong ROLE_TABS) ·
   │  │                          #   farms/ (Stack lồng trong tab: _layout · index = Màn A danh sách nhà của farm · [houseId]/index = Màn B một nhà ·
   │  │                          #   [houseId]/settings = Cài đặt nhà · farm-settings = Cài đặt farm · farm-create = Tạo farm) · alerts/ ·
   │  │                          #   analytics/ · profile/ (Tài khoản, mọi role) · menu-1/ (không role nào dùng) · menu-2/ (menu tạm của Domain Expert)
   │  ├─ farm/[farmId].tsx       # chuyển tiếp sang Màn A của farm đó (giữ cho link cũ)
   │  ├─ zone/[zoneId].tsx       # chuyển tiếp sang Màn B của nhà chứa zone, đúng tab tầng (giữ cho link cũ)
   │  ├─ device/[deviceId].tsx   # chi tiết thiết bị
   │  ├─ alert/[alertId].tsx     # chi tiết cảnh báo dạng trang (Trang chủ, sau này push) — cùng AlertDetailContent với sheet của tab Cảnh báo
   │  └─ livestream/[zoneId].tsx # live stream (sẽ đổi theo camera nhà yến — VISION-FR-013)
   ├─ components/
   │  ├─ ui/                     # text · button · pressable-scale · text-field · code-input · form-message · card · icon-button · bottom-sheet · split-badge · skeleton · empty-state · loading-overlay · toast
   │  ├─ auth/                   # AuthScreenLayout.tsx (khung chung các màn xác thực, không cuộn; form nhích lên vừa đủ khi bàn phím mở) ·
   │  │                          #   CollapsesWithKeyboard.tsx (logo, mô tả, chân trang thu lại cùng nhịp bàn phím) ·
   │  │                          #   LogoutButton.tsx (đăng xuất có hỏi xác nhận — tab Tài khoản, màn mật khẩu tạm)
   │  ├─ layout/                 # AnimatedSplash.tsx · TextLogo.tsx (logo chữ của splash và màn đăng nhập) · BottomTabBar.tsx (thanh tab, nút nổi) · AppHeader.tsx (header dùng chung, tự chừa vùng an toàn) ·
   │  │                          #   PlaceholderScreen.tsx (màn tạm của menu chưa gán) · StatusBarGlass.tsx (kính mờ vùng giờ/pin khi cuộn)
   │  ├─ charts/                 # bọc react-native-gifted-charts, chỉ ở đây import thư viện: ChartFrame (cao 220, 4 trạng thái, chú thích, câu cho trình đọc màn hình) ·
   │  │                          #   MetricLineChart (đường theo thời gian, vạch ngưỡng, điểm ngoài ngưỡng cam, chạm giữ xem giá trị, nhiều chuỗi, nét đứt dự báo) ·
   │  │                          #   BirdBarChart (cột đôi Ra/Về + đường tỉ lệ về tổ) · ControlChart (độ ẩm + vùng phun sương, quạt, mốc đổi hệ số) · HarvestStackedChart (sản lượng xếp chồng theo loại tổ, như web) · ChartFullscreenModal (xoay ngang)
   │  ├─ analytics/              # màn Phân tích: AnalyticsFilterBar (chip tầng, đầu màn) · AnalyticsRangeChips (chip thời gian, dưới hàng tab, dính khi cuộn) · ChoiceChips · KpiGrid/KpiTile · AnalyticsTabs (dính khi cuộn, cùng kiểu chip tầng) · StatRow ·
   │  │                          #   BirdTab (BucketSheet, CorrelationCard) · EnvironmentTab · ControlTab (OverrideHistoryCard, SuggestionCard) · HarvestTab · ReportTab (ReportMetrics)
   │  ├─ alert/                  # tab Cảnh báo: SeveritySummary (dải mức = lọc nhanh) · SeverityLabel · AlertFilterChips (Tầng · Loại · Phán quyết) ·
   │  │                          #   AlertRow (vuốt trái để xác nhận) · AcknowledgeSheet (chip ghi chú nhanh) · AlertDetailSheet (toàn màn, kéo xuống để đóng) ·
   │  │                          #   AlertDetailContent · AlertEvidence (bằng chứng ghép ±30 phút) · VerdictSheet · NotificationSettingsSheet (⚙)
   │  ├─ common/                 # ComingSoonAction (thao tác backend chưa có API, nhãn "Sắp có") · RelayIcon (icon theo loại relay — Trang chủ và tab Trang trại) · ZoomableView (zoom và chạm hiện/ẩn thanh điều khiển trên khung camera)
   │  ├─ farm/                   # tab Trang trại — Màn A: HeaderPicker · OptionSheet (chọn farm/nhà) · FarmSummaryStrip; thẻ nhà dùng lại home/HouseStatusCard (onPress mở Màn B, nút ghim ★ như web);
   │  │                          #   Màn B: HouseCameraPanel (ghim đầu, thu gọn 48 px) · CameraFullscreenModal · CameraControlColumn (cột nút dọc mép phải, nút 40 icon 24 nét rỗng — khung nhỏ và toàn màn dùng chung) · CellularPlaybackPrompt · BirdCountStrip · ZoneTabs ·
   │  │                          #   HouseYieldRow (ô ngang sản lượng tháng của nhà, dưới dải chim ra/về) · ZoneAlertRow · SensorTileGrid · CollapsibleSection · ActuatorSection · RelayControlSheet · DeviceSection · DeviceDetailSheet ·
   │  │                          #   ZoneSettingsSection (Cài đặt zone xem nhanh, ⋮ mỗi nhóm mở đúng mục trong Cài đặt nhà) · ActionMenuSheet (bảng thao tác của nút ⋮)
   │  │                          #   settings/ (trang Cài đặt nhà, Cài đặt farm, Tạo farm — khung theo ảnh mẫu dạng hoá đơn, xem 3.10): SettingsSection (khung một mục) · SettingsMetaGrid ·
   │  │                          #   SettingsTable · SettingsInput · SettingsActionBar (thanh đen) · SettingsEditActions (Cập nhật/Huỷ) · SettingsTileButton · ComingSoonAction ·
   │  │                          #   ThresholdSection · NumberTuningSection (dùng cho FuzzyTuningSection · DetectionTuningSection · BirdCountTuningSection) · HouseInfoSection ·
   │  │                          #   ZoneInfoSection · DeviceListSection · ZoneSettingsTabs · AddDeviceSheet + QrScanner · CreateItemSheet · FarmInfoSection · FarmLocationSection ·
   │  │                          #   FarmHousesSection · LocateRow
   │  └─ home/                   # các khối của màn Trang chủ (viết chung cho hai role, hiện chỉ Farm Owner vào được) — khối chỉ một role thấy thì quyết ở màn bằng canPerform:
   │                             #   HomeHeader · HomeSection · FarmCarousel/FarmBannerCard · OverviewStats + StatTile, 3 ô, StatDetailSheet, ReturnRateBar ·
   │                             #   UrgentAlertBanner · PendingTasksCard · RelayOverrideStrip · NewReportCard · HouseCarousel/HouseStatusCard ·
   │                             #   CameraCarousel/CameraCard · LiveCameraPlayer (trình phát kiểu YouTube mở tại chỗ: phóng to, xoay ngang toàn màn, vuốt xuống thành thanh CameraMiniPlayer) · CameraVideoSurface · PlayerControlButton
   ├─ config/                    # queryClient.ts
   ├─ constants/                 # theme.ts (Colors, Radius, BorderWidth, Spacing, FontFamily, Typography)
   │                             # apiEndpoints.ts (API_BASE_URL, WEBSOCKET_BASE_URL, ENDPOINTS)
   │                             # roleTabs.ts (tab của từng role, isMobileRole) · authTiming.ts (độ dài và hạn của mã đặt lại mật khẩu)
   │                             # relayOverride.ts (thời lượng điều khiển tay BR-08, cảnh báo phải xác nhận trước khi bật bơm ENV-FR-016) · homeSkeleton.ts · i18n.en.ts
   ├─ hooks/                     # một hook một file, chia theo nghiệp vụ
   │  ├─ auth/                   # useLogin · useLogout · useForgotPassword · useResetPassword · useChangePassword
   │  ├─ farm/                   # useFarms · useFarmDetail · useHouses · useAllHouses · useZonesOfHouses · useZoneDirectory · useHouseStatuses ·
   │  │                          #   useFarmPrefs · useCurrentFarm · useOrderedHouses · useFarmHouseCards · useFarmSummary · useAutoOpenLastHouse · useHouseZones · useHouseDetail ·
   │  │                          #   useCreateFarm · useUpdateFarm · useDeleteFarm · useCreateHouse · useCreateZone · useUpdateThresholds · useResetThresholds ·
   │  │                          #   useUpdateFuzzyTuning · useUpdateDetectionTuning · useUpdateBirdCountTuning · useCurrentLocation (expo-location) ·
   │  │                          #   useSingleSectionEdit (trang cài đặt sửa từng mục, hỏi trước khi bỏ thay đổi chưa lưu)
   │  ├─ alert/                  # useAlerts · useAcknowledgeAlert · useActiveAlertCount · useActiveAlertSummary · useAllActiveAlerts · useMostUrgentAlert · usePendingVerdictAlertCount ·
   │  │                          #   useActiveAlertsOfScopes (cảnh báo theo nhà/zone) · useActiveAlertCountsBySeverity · useRefreshAlertsOnNew ·
   │  │                          #   useAlertsScope (farm, nhà, tầng, mức, loại, phán quyết; nhớ khi tắt app) · useActiveAlertList · useResolvedAlertList ·
   │  │                          #   useAlertDetail · useSetAlertVerdict · useAlertEvidence · useAlertLocations · useAlertRooms · useNewAlertIds · useSyncAlertBadge
   │  ├─ telemetry/              # useLatestTelemetryOfZones · useZoneTelemetryStream · useLiveTelemetry · useTelemetryHistory · useSocketConnection
   │  ├─ bird-count/             # useBirdCountDaily · useBirdCountTrends · useTodayBirdCounts · useLiveHouseBirdCount
   │  ├─ device/                 # useSensorNodes · useCameraNodes · useActiveRelayOverrides · useClearRelayOverride · useCameraCards · useCameraStreamUrl ·
   │  │                          #   useControlRelay · useDeviceStream (RELAY_UPDATE, DEVICE_STATUS_CHANGE) · useCameraAutoplay (Wi-Fi / dữ liệu di động, app chạy nền) ·
   │  │                          #   useVideoZoom (chụm hai ngón zoom 1–4 lần, kéo khi đang phóng to, chạm đúp bật/tắt, nút +/-) ·
   │  │                          #   useAutoHideControls (thanh điều khiển trên video kiểu YouTube: chạm video hiện/ẩn, tự ẩn 3 giây khi đang phát) ·
   │  │                          #   useRegisterSensorNode · useRegisterCameraNode (đăng ký bằng mã trên nhãn; gcTime 0 để không giữ mã kích hoạt)
   │  ├─ analytics/              # useAnalyticsScope (nhà, tầng, khoảng, tab, chỉ số: tham số route → đã nhớ → mặc định) · useAnalyticsKpis ·
   │  │                          #   useBirdDaily · useBirdBuckets · useCorrelations · useEnvSummaries · useForecast · useControlPerformances · useAutonomies ·
   │  │                          #   useControlSuggestion · useZoneRelayOverrides · useHealthReports · useHealthReportPreview · useUpdateConclusion
   │  ├─ harvest/                # useFarmHarvests (đợt thu của farm)
   │  ├─ health/                 # usePendingHealthDays (chưa có API — G-11) · useUnreadHealthReports
   │  ├─ notification/           # useUnreadNotificationCount
   │  ├─ time/                   # useNow (mốc thời gian tự cập nhật cho chữ đếm ngược)
   │  ├─ ui/                     # useToastMessage (câu toast tự ẩn sau 3 giây)
   │  └─ theme/                  # usePalette
   ├─ services/
   │  ├─ api/                    # apiClient.ts (axios + làm mới token) · <resource>.api.ts:
   │  │                          #   auth · farm · device · telemetry · alert · analytics · notification · healthReport · harvest
   │  ├─ socket/                 # socketClient.ts (Socket.io realtime)
   │  ├─ notification/           # pushNotification.ts (quyền + push token)
   │  ├─ storage/                # preferenceStorage.ts: lựa chọn trên máy (không bí mật) lưu file JSON bằng expo-file-system, làm storage của Zustand persist
   │  └─ session/                # localSession.ts: startRealtimeIfReady (mở realtime khi có phiên) · clearLocalSession (đăng xuất / hết phiên: ngắt socket, xoá cache, badge, token)
   ├─ stores/                    # authStore.ts · alertStore.ts · languageStore.ts · farmPrefsStore.ts (zustand; farmPrefs lưu file trên máy theo tài khoản:
   │                             #   farm/nhà/tầng xem gần nhất, nhà đã ghim, thu gọn camera, tự phát khi dùng dữ liệu di động)
   ├─ types/                     # <module>.types.ts: api · auth · farm · device · telemetry · alert ·
   │                             #   birdCount · socket · navigation · notification · healthReport · harvest — index.ts gom lại
   └─ utils/                     # <chủ đề>.utils.ts: date · number · label · validation · apiError · name · permission (canPerform) ·
                                 #   threshold · device · returnRate · alert · severity · relay · healthDay · houseStatus · camera ·
                                 #   pagination · harvest (sản lượng tháng của nhà, gộp theo tháng / quý / năm và loại tổ — cách tính như web) · houseOrder (nhà ghim lên đầu) · sort (farm, zone tạo trước đứng đầu theo _id, như web) · sensorTile · farm ·
                                 #   alertList (sắp xếp, lọc, đếm theo mức, nhắc lại) · alertDetail (tự đóng, nội dung riêng theo loại) · qrCode (nhãn thiết bị, mã tầng) · settingsSection (khoá mục cài đặt, quyền sửa từng mục) · settingsValidation (khoảng hợp lệ của ngưỡng, hệ số, tham số phát hiện, toạ độ — lấy từ api-spec và backend)
```

**Menu theo role:** sửa duy nhất `src/constants/roleTabs.ts` (`ROLE_TABS`): mỗi mục gồm `name` (thư mục route trong `(tabs)/`), `title`, `icon` (Phosphor). Farm Owner giữ 5 tab; Domain Expert có tab `alerts` (dùng chung màn, không badge), menu tạm `menu-2` (đổi tên và trỏ `name` sang route thật khi làm màn) và tab `profile` dùng chung. Role không có trong `ROLE_TABS` thì không vào được app (Technician, Admin dùng web). Route không thuộc role nào bị ẩn khỏi thanh tab (`hidden`).

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
├─ Trang chủ   home        trạng thái ngày từng nhà, số đo realtime, cảnh báo đang mở
├─ Trang trại  farms (Màn A: nhà của farm, đổi farm, ghim ★ nhà lên đầu, ⚙ cài đặt farm, + tạo farm) ─► farms/[houseId] (Màn B: một nhà)
│                vào tab thì mở thẳng nhà xem gần nhất (farm 1 nhà thì nhà đó); zone là tab, thiết bị là sheet — không có màn thứ 3
│                Màn B: camera ghim đầu (live stream, số chim), đàn chim hôm nay, tab tầng, 6 ô cảm biến,
│                       relay chế độ tay (MF-09), thiết bị (chỉ xem), Cài đặt zone xem nhanh (⋮ "Chỉnh sửa" ─► đúng mục, mở sẵn chế độ sửa),
│                       ⚙ ─► [houseId]/settings
│                Cài đặt nhà: thông tin nhà, camera AI (+ thêm), mức giảm tỷ lệ về tổ; theo tầng: thông tin tầng, ngưỡng (+ đặt lại mặc định),
│                       hệ số mờ, tham số phát hiện, controller (+ thêm), + thêm tầng — mỗi mục "Sửa" / "Lưu" riêng
│                Cài đặt farm (farm-settings): thông tin, toạ độ (lấy vị trí hiện tại), nhà yến (+ thêm nhà), xoá farm (chủ chính); farm-create: tạo farm
│                thêm thiết bị (MF-10): quét nhãn QR hoặc nhập tay ─► đăng ký vào nhà / tầng; còn thiếu: Wi-Fi AP-mode, tiến trình setup (FARM-FR-012)
│                còn thiếu: trạng thái ngày + chấm điểm (BR-31), báo cáo; sửa tên, xoá nhà và tầng (backend chưa có API)
│                harvests (ghi, sửa — SF-04)
├─ Cảnh báo    alerts: nhà ▾ (có "Tất cả nhà", đổi farm), ⚙ cài đặt thông báo; dải mức = lọc nhanh; Đang hiệu lực · Đã đóng;
│                Tầng · Loại · Phán quyết; vuốt trái để xác nhận (chip ghi chú nhanh); chạm hàng ─► sheet chi tiết toàn màn
│                (bằng chứng ±30 phút cho cảnh báo suy luận, Đi tới tầng, Điều khiển tay); nhắc lại sau 15 phút / 1 giờ (ALERT-FR-015)
│                còn thiếu: phán quyết khi farm chưa có chuyên gia (BR-22), nhóm "Bị bác bỏ", mở từ push — "Sắp có"
├─ Phân tích   analytics   một màn: chọn nhà ▾, chip tầng ("Tất cả tầng"); 4 ô KPI (tỉ lệ về tổ, trong ngưỡng, tự động,
│                          cảnh báo); tab nội bộ Đàn chim · Môi trường · Điều khiển · Sản lượng · Báo cáo, ngay dưới là chip khoảng thời gian (cùng dính khi cuộn, ẩn ở Sản lượng, Báo cáo); nhớ lựa chọn khi tắt app;
│                          cùng giao diện các màn khác: nền Paper, card trắng, chip kiểu tab tầng, header chọn nhà ▾
│                          lối vào: ô cảm biến / dải chim ở Màn B, thẻ Báo cáo mới và tỉ lệ về tổ ở Trang chủ (tham số houseId, zoneId, tab, metric, reportId)
│                          còn thiếu: quyết định của chuyên gia (EXPERT-FR-009), gửi gợi ý chờ duyệt, phiên thiếu (VISION-FR-020) — "Sắp có"
└─ Tài khoản   profile     hồ sơ, đổi mật khẩu, kênh thông báo (push, Telegram), thông báo trong app, đăng xuất

Domain Expert — (tabs)   (hiện là alerts + menu-2 tạm + profile; đích như dưới, đổi trong ROLE_TABS)
├─ Trang chủ   home        cùng màn với Farm Owner, chỉ đọc; khối riêng mỗi role quyết bằng canPerform
├─ Trang trại  farms ─► cùng cây màn của Farm Owner, KHÔNG có relay, device-setup, ghi harvest
│                zone : sửa ngưỡng, hệ số, 5 tham số phát hiện (EXPERT-FR-008) — trong Cài đặt nhà, cùng màn với Farm Owner
│                house: mức tỷ lệ về giảm (Cài đặt nhà), lịch đếm; vẽ vòng đếm làm trên web
├─ Cảnh báo    alerts (mặc định lọc "Chờ phán quyết"): kiểm chứng Xác nhận đúng / Bác bỏ (bắt buộc lý do) cảnh báo suy luận;
│                KHÔNG xác nhận đã xử lý, không vuốt, không ⚙
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
| Mảnh của một luồng                                                                            | `components/<nghiệp vụ>/`                                               | `home/`, `device-setup/`, `alert/`, `zone/`, `vision/`, `health/`, `harvest/`, `report/` — chia theo nghiệp vụ, **không** theo role (không có `farmowner/`, `expert/`); khối chỉ một role thấy thì màn quyết bằng `canPerform` |
| Trang hồ sơ / tài khoản                                                                       | `src/app/(tabs)/profile/` (`index`, `change-password`, `notifications`) | Một màn cho mọi role; mục push, Telegram chỉ hiện với Farm Owner                                      |
| Form đổi mật khẩu                                                                             | `components/auth/ChangePasswordForm.tsx`                                | Tách từ `(auth)/reset-password` khi `profile/change-password` cần; hai nơi dùng chung một form        |
| Menu theo role                                                                                | `constants/roleTabs.ts`                                                 | Chỗ duy nhất đổi tên, icon, thứ tự tab                                                                |
| Quyền thao tác                                                                                | `utils/permission.utils.ts`                                             | Chỗ duy nhất quyết định nút nào hiện                                                                  |
| Nhãn tiếng Việt của enum                                                                      | `utils/label.utils.ts`                                                  | Không viết lại nhãn trong màn                                                                         |
| Màu, chữ, bo góc, khoảng cách                                                                 | `constants/theme.ts`                                                    | Xem 3.2 — cấm thêm màu                                                                                |

**Sẽ thêm khi làm màn hình** (tạo khi màn thứ hai cần dùng chung, không tạo sẵn):

- `components/ui/` — primitive không biết nghiệp vụ: `text`, `button`, `input`, `chip`, `badge`, `icon`, `pressable-scale`, `skeleton`, `empty-state` (mục 3.5).
- `components/common/` — biết nghiệp vụ, ≥ 2 màn dùng: `StatusDot`, `SeverityBadge`, `AlertStatusBadge`, `MetricTile`, `card/` (`FarmCard`, `HouseCard`, `ZoneCard`).
- `components/<nghiệp vụ>/` — component riêng một luồng: `device-setup/` (quét QR, AP-mode — MF-10), `home/`, `zone/`, `alert/`, `vision/`, `analytics/`, `harvest/`, `report/`.
- Route theo Report 3: thiết lập thiết bị bằng QR (MF-10), live stream theo camera nhà yến (Màn B đã phát tại chỗ), `reports/`, `harvests/`, `notifications`; tab theo role (Report 3 §2.4 — chỉ Farm Owner và Domain Expert), `settings` đã đổi tên `profile`.
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
- **Route params**: id đi qua route động của expo-router (`(tabs)/farms/[houseId]` kèm `?zoneId`, `(tabs)/farms/[houseId]/settings` kèm `?section&zoneId&edit`, `(tabs)/farms/farm-settings?farmId`, `(tabs)/farms?farmId`, `device/[deviceId]`, `alert/[alertId]`), đọc bằng `useLocalSearchParams`; không hiện id lên giao diện.
- **Thứ tự danh sách giống web**: farm và zone tạo trước đứng đầu (so `_id`, `utils/sort.utils.ts` — như `FarmOwnerFarmsPage`, `deviceInventory` của web); nhà yến giữ thứ tự backend trả (mới nhất trước), nhà đã ghim ★ lên đầu (`sortPinnedFirst`, lưu trên máy theo tài khoản như `pinnedHouseStore` của web); carousel nhà ở Trang chủ xếp theo trạng thái nặng nhất rồi theo tên như dashboard web. Web đổi cách sắp thì mobile đổi theo.
- **Hook điều hướng** (`useIsFocused`, `useFocusEffect`, `useNavigation`…) import từ `expo-router`, không từ `@react-navigation/native`: expo-router 58 mang bản React Navigation riêng, import từ gói ngoài thì báo "Couldn't find a navigation object". Stack lồng trong tab dùng `unstable_settings.anchor` (không còn `initialRouteName`).

---

## 3. Style UI

Phong cách: **tối giản, phẳng** theo ảnh mẫu — nền Paper `#F3F3EE`, card và ô nhập trắng, chữ Ink `#0B0B0C`, thanh tab trắng, khối tối (card nổi bật) nền Ink, một màu nhấn duy nhất là Lime `#C3FD47`; cam `#FF7426` chỉ dành cho cảnh báo. Card và khối bo góc lớn (`Radius.lg`), ô nhỏ bo vừa, nút/ô nhập/badge bo tròn hết cỡ — không còn khung vuông góc; không đổ bóng.

### 3.1 Nguyên tắc

- Chỉ dùng `StyleSheet.create` + token trong `@/constants/theme`. **Không** hard-code màu/font/radius/khoảng cách trong màn hình.
- Không dùng thư viện UI ngoài (không Tailwind/NativeWind, không UI kit). Ghép từ primitive trong `components/ui`.
- Chữ luôn đi qua `<Text variant=…>`; icon luôn qua `<Icon …>`; nút bấm có hiệu ứng dùng `<PressableScale>` / `<Button>`.
- **Chỉ có giao diện sáng** — không làm chế độ tối, không đọc `useColorScheme()`. Lấy màu qua `const palette = usePalette()` (`hooks/theme/usePalette.ts`), không dùng thẳng `Colors.light`, để mọi màn lấy màu từ một chỗ.
- Chữ trên giao diện viết bằng tiếng Việt (giữ "Zone", "Farm" giống web) và luôn qua `t('…')` (`utils/i18n.utils.ts`): khoá là chính câu tiếng Việt, biến viết `{name}`, bản tiếng Anh là một dòng trong `constants/i18n.en.ts` (thiếu thì hiện tiếng Việt). Bảng nhãn (`label.utils`…) giữ câu tiếng Việt và dịch lúc trả về. Ngôn ngữ chọn ở tab Tài khoản, lưu theo từng tài khoản (`stores/languageStore.ts`); gốc mỗi màn đặt `key={language}` (`useLanguage()`) để dựng lại khi đổi ngôn ngữ.
- Không hiện thanh cuộn: mọi `ScrollView`/`FlatList` dọc đặt `showsVerticalScrollIndicator={false}`, danh sách ngang đặt `showsHorizontalScrollIndicator={false}` (người dùng yêu cầu 2026-10-31).

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
| Cảnh báo | `alert`            | `#FF7426`   | cảnh báo, lỗi thiết bị, khẩn cấp                  |
|          | `onAlertTint`      | `#FFFFFF33` | nền vòng icon, nhãn trên khung cảnh báo khẩn (trắng 20%) |

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
| Nhà yến (thẻ Trang chủ)  | `houseHealthy`                         | `#446401`                         | Nhà ổn (thêm theo yêu cầu)     |
| Trang chủ (thêm theo yêu cầu 2026-10-31) | `farmRingOuter` / `farmRingInner` | `#414C1073` / `#414C10CC` | Vòng trang trí trên card Farm (olive 45% / 80%) |
|                          | `houseRingOuter` / `houseRingInner`    | `#0B0B0C14` / `#0B0B0C29`         | Vòng trang trí trên thẻ nhà yến (Ink 8% / 16%) |
|                          | `reportLabel`                          | `#414C10`                         | Icon và nhãn "BÁO CÁO MỚI"     |
|                          | `notificationBadge`                    | `#D53F35`                         | Badge số trên chuông thông báo |
|                          | `urgentAlertGradientEnd`               | `#D53F35`                         | Cuối dải loang khung cảnh báo khẩn (đầu dải là `alert`) |
|                          | `videoControlBackdrop`                 | `#0B0B0C8C`                       | Nền nút tròn trên video (Ink 55%) |
|                          | `videoFlashBackdrop` / `videoInfoBackdrop` | `#0B0B0C99` / `#0B0B0CCC`     | Nền chữ chạm đúp / bảng thông tin trên video (Ink 60% / 80%) |
|                          | `videoDim`                             | `#0B0B0C59`                       | Lớp tối phủ video khi hiện điều khiển (Ink 35%) |
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

- Giao diện phẳng: không dùng đổ bóng; tách khối bằng nền `surface` và đường kẻ `divider`. Ngoại lệ duy nhất: thanh tab (`components/layout/BottomTabBar.tsx`) bo 2 góc trên `Radius.lg`, mép có bóng đổ nhoè (bộ lọc `FeGaussianBlur` của `react-native-svg`, màu token `divider`), viền mép trùng nền thanh (`BORDER_COLOR_TOKEN`). Ngoại lệ thứ hai: chữ đè trên video live (số "Chim ra / Chim vào", nhãn LIVE trong `components/home/LiveCameraPlayer.tsx`) có bóng chữ `textShadow` màu `inverse` để đọc được trên mọi khung hình — chỉ cho chữ nằm trên video, không cho card hay nút.
- `Radius` (theo ảnh mẫu, không còn `none`): `sm 8` (khối nhỏ bên trong card như dòng tiêu đề bảng, checkbox) · `md 16` (ô hành động nhanh, dòng danh sách, khối nhấn trong card, ô mã số) · `lg 24` (card, card tối nổi bật, sheet, hộp thoại, khối logo icon, góc thanh tab) · `full` (nút bấm, ô nhập, nút tròn icon, avatar, badge, chip).
- `BorderWidth`: `hairline 0.5` (đường kẻ chia dòng) · `regular 1` (ô nhập) · `strong 1.5` (nút outline).
- `Spacing`: `xs 4` · `sm 8` · `md 12` · `lg 16` (lề màn hình) · `xl 24` · `xxl 32`.

```tsx
tile:   { backgroundColor: palette.surface, borderRadius: Radius.lg },
button: { backgroundColor: palette.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.xl },
row:    { borderBottomWidth: BorderWidth.hairline, borderBottomColor: palette.divider },
```

### 3.5 Component primitive (`components/ui`)

Đã có: `text`, `button` (`variant` `primary` · `secondary` · `inverse` (nền Ink chữ trắng, dùng trên khối màu như khung cảnh báo khẩn) · `link`; `size` `sm` 36 · `md` 44 · `lg` 52 (mặc định); `trailingIcon` cho mũi tên sau chữ), `card` (`tone` `default`/`inverse`; truyền `onPress` thì cả card là nút co lại khi nhấn; `style` để đổi lề, hướng hàng), `skeleton` (khối trắng đúng hình nội dung, nhấp nháy nhẹ, đứng yên khi bật Giảm chuyển động), `empty-state` (`variant` `message`: card trắng một câu xám + nút chữ tuỳ chọn, cho trạng thái rỗng và lỗi · `create`: ô "Tạo …" viền nét đứt xám, dấu + trong vòng nền `surfaceStrong`, bấm cả ô — chỉ hiện khi `canPerform` cho phép tạo), `loading-overlay` (màn chờ phủ toàn màn hình, chặn thao tác: nền Paper, vòng tải và một câu ở giữa), `toast` (thông báo nổi ngắn ở đáy: nền Paper viền `border`, chữ Ink, dấu tích Ink trong vòng nền lime; màn tự bỏ render sau vài giây), `icon-button`, `bottom-sheet`, `split-badge`, `pressable-scale`, `text-field` (nền `surface` bo `Radius.full`, icon trái, chữ gợi ý thay nhãn, không viền — viền `text` khi đang nhập, `alert` khi lỗi; lỗi/gợi ý dưới ô, nút mắt cho mật khẩu), `code-input` (ô mã số nền `surface` bo `Radius.md`, dán và tự điền mã, rung khi mã bị từ chối), `form-message` (dòng lỗi màu `alert` / dòng thành công màu `text`). Còn lại trong bảng là quy ước khi viết. Giá trị animated (reanimated) đọc/ghi bằng `.get()` / `.set()`, không gán `.value` trong handler (luật React Compiler của eslint).

| Component                   | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                    | Bo tròn hết cỡ (`Radius.full`). `variant`: `primary` (nền `primary`, chữ `onPrimary`) · `secondary` (nền `surface` trắng, không viền, chữ `text`) · `danger` (thao tác phá huỷ: tắt relay, xoá, đăng xuất) · `icon` (nút tròn chỉ có icon, nền `primary`) · `link` (chữ `textSecondary` gạch chân); `size`: `sm` 36 / `md` 44 / `lg` 52; `loading` → khoá nút; `disabled` → opacity 0.5. |
| `Text`                      | Xem 3.3.                                                                                                                                                                                                                                                                                                                                                                                                |
| `Icon`                      | Chỉ dùng **`phosphor-react-native`** (cùng bộ Phosphor với web Farm Owner, chạy trên `react-native-svg`). Cỡ theo thang 12 / 14 / 16 / 20 / 24 / 32, mặc định 20; `weight` mặc định `regular`, tab đang chọn `fill`; màu theo `Colors` (`text`, `textSecondary`, `primary`, `alert`), không truyền mã hex. Nút quay lại trên mọi màn là **`CaretLeftIcon`** cỡ 20, `weight="bold"`, trong nút tròn 44 của `AppHeader` — không dùng `ArrowLeftIcon`; màn mới chỉ truyền `onBack`, không tự vẽ nút quay lại.                                                                                              |
| `PressableScale`            | Pressable co lại (`scaleTo` mặc định 0.96) và bật về bằng spring (reanimated); tắt khi bật "Giảm chuyển động".                                                                                                                                                                                                                                                                                          |
| `Input`, `Checkbox`, `Chip` | Form & bộ lọc.                                                                                                                                                                                                                                                                                                                                                                                          |
| `Toggle`                    | Công tắc bật/tắt (relay, cài đặt thông báo).                                                                                                                                                                                                                                                                                                                                                            |
| `Badge`                     | Nhãn mức độ / trạng thái, màu `severity*` · `status*` · `device*` từ `theme.ts`, luôn có chữ.                                                                                                                                                                                                                                                                                                           |
| `Skeleton`                  | Placeholder khi chờ dữ liệu; ẩn khỏi screen reader.                                                                                                                                                                                                                                                                                                                                                     |
| `EmptyState`                | Khung rỗng khi chưa có dữ liệu; giá trị thiếu hiện `_`.                                                                                                                                                                                                                                                                                                                                                 |
| `ConfirmDialog`             | Xác nhận trước thao tác phá huỷ; nút xác nhận khoá trong lúc request chạy.                                                                                                                                                                                                                                                                                                                              |

**Vùng an toàn (tai thỏ, Dynamic Island, thanh Home):** không viết `paddingTop`/`marginTop` cứng và không dùng header gốc của router (Stack và Tabs đều `headerShown: false`). Mọi màn bắt đầu bằng `AppHeader` (`components/layout/AppHeader.tsx`): tự cộng `useSafeAreaInsets().top`, thanh cao 52 dưới vùng an toàn, lề ngang 16; `title` căn trái ở tab, có `onBack` thì nút tròn trắng (`surface`) bên trái (`accessibilityLabel="Quay lại"`) và tiêu đề căn giữa; `right` cho nút thao tác; màn nền tối truyền `backgroundColor`/`foregroundColor`. Màn chi tiết cộng `insets.bottom` vào nội dung cuối; thanh tab cao 60 + `insets.bottom`.

Layout: `AppHeader` (đã có), `BottomTabBar` (đã có, `components/layout/BottomTabBar.tsx`) — thanh tab tự vẽ dùng chung mọi role, truyền vào `Tabs` qua `tabBar`.

**Thanh tab đã chốt (2026-10-30) — không tự ý sửa.** Không đổi màu, hình dạng hay bố cục thanh tab: nền trắng dính đáy, có bướu quanh nút tròn giữa lime, tab chọn chỉ icon đặc và chữ màu Ink (không vòng nền, đổi 2026-10-31), bấm chuyển ngay không hiệu ứng, cùng các số trong "bảng chỉnh" đầu file. Chỉ sửa khi người dùng yêu cầu rõ thay đổi thanh tab. Thanh tab hiện tại:

- Tab dựng từ `ROLE_TABS`; route không thuộc role bị ẩn bằng `hidden`.
- Nền trắng (`surface`) vẽ bằng `react-native-svg`: bo 2 góc trên, bóng đổ nhoè (`SHADOW_BLUR`, `SHADOW_OFFSET_Y`, màu `divider`), viền mép `BORDER_COLOR_TOKEN`, có bướu nhô quanh nút nổi.
- Tab có `isFeatured: true` (mỗi role tối đa một) thành nút tròn 60 nổi lên, nền `primary` (lime), icon `onPrimary` 32; nhãn thẳng hàng các tab khác. Role không có tab nổi thì mép thẳng.
- Tab đang chọn: icon `fill` + icon và chữ màu `tabIconSelected` (Ink), không có vòng nền (đổi 2026-10-31); tab chưa chọn màu `tabIconDefault` (riêng nút nổi luôn icon `fill`, không đổi khi chọn); badge số nền `primary` viền `surface`.
- Màn chi tiết mở bên trong một tab thì ẩn thanh tab để nội dung chiếm cả màn: hiện là chi tiết nhà yến `(tabs)/farms/[houseId]`, Cài đặt nhà, Cài đặt farm và Tạo farm (danh sách `ROUTES_WITHOUT_TAB_BAR` trong `BottomTabBar.tsx`, nhận ra bằng `useSegments()`; thêm màn mới vào danh sách đó). Màn đó chừa đáy bằng vùng an toàn (`insets.bottom`), không cộng `TAB_BAR_OVERLAP`; quay về danh sách thì thanh tab hiện lại (đổi theo yêu cầu 2026-11-01).
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
- **Splash** (`components/layout/AnimatedSplash.tsx`, gắn ở `app/_layout.tsx`): splash gốc chỉ là màn trắng (ảnh `splash-blank.png` trong suốt — Android 12+ luôn cắt icon splash gốc thành hình tròn nên không dùng icon ở đây) → splash JS: cụm icon khối vuông 88 (bo `Radius.lg` 24) + logo chữ rộng 200, cách nhau `Spacing.lg` 16, căn giữa tuyệt đối trên nền loang từ trên xuống (lime `primary` `#C3FD47` ở mép trên nhạt dần thành trắng `surface` `#FFFFFF` ở khoảng giữa màn, `expo-linear-gradient`), không có dòng chữ phụ → nạp xong font/phiên đăng nhập, giữ tối thiểu 0.5s rồi mờ dần 0.6s để lộ màn auth. Splash gốc vẫn trắng (Android/iOS không vẽ được nền loang ở splash gốc) nên lớp loang hiện khi splash JS lên; app dựng bên dưới ngay khi nạp xong; "Giảm chuyển động" bật thì bỏ qua hiệu ứng mờ.

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

### 3.10 Trang cài đặt: sửa từng mục, khung theo ảnh mẫu

Áp dụng cho Cài đặt nhà, Cài đặt farm và Tạo farm (Len chốt 2026-11-01, kèm ảnh mẫu dạng hoá đơn):

- **Sửa từng mục, không sửa hàng loạt.** Trang gồm các mục thu gọn; bấm mục thì sổ ra **chỉ để xem**. Nút **"Sửa"** ở góc trên phải của mục đang mở (chỉ hiện khi `canPerform` cho phép). Bấm "Sửa" thì riêng mục đó nhập được; ngay dưới là thanh đen **Cập nhật** (một chữ lime căn giữa; chỉ gửi đúng mục đó, một request) và nút chữ **Huỷ**. Nút khoá khi chưa đổi gì, đang gửi, hoặc có ô lỗi (lỗi hiện ngay dưới dòng).
- **Mỗi lúc chỉ một mục được sửa** (`hooks/farm/useSingleSectionEdit.ts`). Sửa dở mà bấm "Sửa" mục khác, thu mục, đổi tab tầng hay rời trang (`usePreventRemove`) thì hỏi "Bỏ thay đổi chưa lưu?". Lưu xong: mục về chế độ xem, toast "Đã lưu…".
- **Khung một mục** (`components/farm/settings/SettingsSection.tsx`), từ trên xuống: ô icon nền lime + tên mục và dòng phụ · nhãn phạm vi viết HOA giãn chữ ở góc phải (TẦNG 2, NHÀ, TRANG TRẠI) và nút "Sửa" dưới nhãn · đường kẻ · lưới thông tin 2 cột (`SettingsMetaGrid`) · bảng có dòng tiêu đề nền Paper, cột số căn phải (`SettingsTable`) · thanh đen nền Ink chữ lime (`SettingsActionBar`: chế độ xem là con số chính có thật của mục, chế độ sửa là nút "Cập nhật" chữ căn giữa) · chân card: câu ai sửa được bên trái, ô vuông icon 32 bên phải (`SettingsTileButton`: quét QR, lấy vị trí, đặt lại mặc định).
- **Chỉ trường có thật** trong api-spec; khoảng hợp lệ lấy từ schema api-spec và `THRESHOLD_LIMITS` của backend (`utils/settingsValidation.utils.ts`), không tự đặt. Thao tác chưa có API thì hiện `ComingSoonAction` ("Sắp có"), không giả lập.
- **Mở thẳng một mục:** khối "Cài đặt zone" ở chi tiết nhà chỉ để xem nhanh; nút ⋮ của từng nhóm mở `[houseId]/settings?section=<thresholds|fuzzy|detection|bird-count>&zoneId=…&edit=1`. Trang mở đúng tầng, sổ sẵn mục đó, cuộn tới mục; `edit=1` chỉ mở chế độ sửa khi `canPerform` cho phép, không có quyền thì nút ⋮ chỉ có "Xem trong Cài đặt nhà".
- **Không bịa:** mọi số ở khối xem nhanh và trang cài đặt lấy đúng từ backend (`formatStoredNumber` giữ phần lẻ); thứ backend chưa có (lịch đếm chim VISION-FR-019, sửa tên / xoá nhà và tầng) hiện "Sắp có".
- **Mã kích hoạt** trên nhãn thiết bị chỉ nằm trong ô nhập và đi một lần tới API: không lưu store, không ghi log; mutation đăng ký đặt `gcTime: 0`; sheet dựng lại (key mới) mỗi lần mở.
- Chỉ dùng token sẵn có (`surface`, `surfaceStrong`, `divider`, `inverse`, `onInverse`, `primary`, `text`, `textSecondary`, `alert`); nhãn HOA là `small` + `textTransform: 'uppercase'` + `letterSpacing` trong style của component, không thêm variant.
