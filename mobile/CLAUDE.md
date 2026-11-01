# mobile/CLAUDE.md

Rules and map for `mobile/` (Expo SDK 58 + Expo Router 58 + React Native 0.88 + React 19.3, New Architecture only). This file wins over the root `CLAUDE.md` for mobile code; `/review-pr` judges mobile changes by it together with `mobile/MOBILE_GUIDE.md`. Rule tags: **[Bắt buộc]** = blocking (review requests changes), **[Nên]** = advisory. Only lines a PR adds or changes are judged; "Known debt" lists what is already out of line.

## Where mobile stands

- **Requirements:** Report 3 (`docs/reports/report3-srs.md`) and Report 4 (`docs/reports/report4-sdd.md` §5.4) win over `SwiftletCare_SRS.md`; what mobile still lacks is listed in `docs/reports/project-tracking.md` §6 (G-16).
- **Who it is for:** Farm Owner and Domain Expert (Report 4 §5.4), with the full scope of the registration form (3.2 b): monitoring, count analytics and the HLS live stream, alerts with push, manual override, device setup by QR code, daily status and rating, reports, harvests, expert validation and tuning (Project Tracking G-16). The Technician works from the web console. Two main-flow pieces live on mobile: **device setup** (MF-10 — scan the device label and the floor QR code with `expo-camera`, guide Wi-Fi provisioning in AP mode, show the setup progress, FARM-FR-003…012) and **FCM push** (ALERT-FR-002 — register the token after sign-in, remove it at sign-out; Farm Owner only, since the Domain Expert receives no out-of-app notifications, Report 3 §2.4). The daily health status of each house and the daily rating (MF-11: ask the user's own status first, then show the system's — BR-31; the API itself hides the status until the user rates or skips) are on mobile too, since the Farm Owner rates from the house.
- **State:** a scaffold. The auth flow is built against the real backend (sign-in, forgot password with the 6-digit code, temporary-password change, tabs per role); most other screens under `src/app/` are stubs with `TODO` comments; the plumbing (axios client, auth store, React Query hooks, socket client, push registration) exists. Enums follow the backend and the ticket module is gone; what is still out of line is in Known debt.
- **Backend contract:** the same backend as the web, unprefixed routes, `docs/api/api-spec.yaml` is the source of truth. The backend already follows the Review 1 scope (roles `ADMIN | FARM_OWNER | DOMAIN_EXPERT | TECHNICIAN`, `NOISE_ANOMALY`, Telegram and FCM push as the out-of-app channels, no Marketplace, no heating).

## Commands

```bash
npm ci                      # install from the committed package-lock.json
npx expo start              # or: npm start / npm run android / npm run ios
npm run lint                # eslint . (flat config: eslint.config.js, eslint-config-expo)
npm run typecheck           # tsc --noEmit
npm test                    # jest (jest-expo preset); CI runs `npx jest --passWithNoTests`
npx expo install <pkg>      # add or upgrade a package at the version matching the Expo SDK
npx expo install --check    # list packages whose version does not match the SDK
npx expo-doctor@latest      # project health: app.json schema, SDK versions, duplicate native modules
npm run build:dev|build:preview|build:prod   # EAS profiles in eas.json
```

SDK upgrades (steps and the packages kept outside the SDK list, with reasons): `MOBILE_GUIDE.md` §1 "Nâng cấp Expo SDK". After an upgrade, delete `node_modules` + `package-lock.json` and reinstall clean — installing over the old lock nests `expo-modules-core`/`babel-preset-expo` under `node_modules/expo/` and breaks autolinking.

Configure `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL` in `.env` (template `.env.example`); defaults point at `localhost:3000`. `EXPO_PUBLIC_STREAM_URL` is the HLS root of MediaMTX (default `http://localhost:8888`); the live stream plays HLS with `expo-video` and a 60 s token from `GET /devices/camera-nodes/{id}/stream-token` (VISION-FR-013) — MediaMTX must have HLS enabled. The app is locked to portrait (`app/_layout.tsx`); only `LiveCameraPlayer` unlocks rotation while expanded (`expo-screen-orientation`). CI (`.github/workflows/ci.yml`, job Mobile) runs `npm ci`, `lint`, `typecheck` and `jest --passWithNoTests` on every PR that touches `mobile/`.

## Structure

All code lives in `src/`; `assets/` (images, fonts) stays at the `mobile/` root because `app.json` points at it. Every layer is split by business domain, one job per file. Full map and naming table: `mobile/MOBILE_GUIDE.md` §2 and §3.8.

```
src/
  app/            Expo Router routes — the folder tree IS the navigation
    _layout.tsx     root Stack: fonts, stored auth, QueryClientProvider, AnimatedSplash on top until ready
    (auth)/         login, forgot-password, verify-code, reset-password (also the first-sign-in temporary password) — no public sign-up
    (tabs)/         home (Home; only the Farm Owner's tabs open it for now — the Domain Expert has alerts, menu-2 + profile in ROLE_TABS, and the expert-only branches inside Home wait for that tab), farms, alerts, analytics, profile (both roles), menu-1..2 (each <tab>/index.tsx); which tabs a role sees comes from constants/roleTabs.ts
    (tabs)/farms/ is a nested Stack: index (screen A, houses of the current farm) · [houseId] (screen B, one house: pinned camera, zone tabs, sensors, relays, devices)
    farm/[farmId] · zone/[zoneId] (redirects to the farms tab, kept for old links) · device/[deviceId] · alert/[alertId] · livestream/[zoneId]
  components/
    ui/           primitives: text, button (variant primary|secondary|inverse|link, size sm|md|lg, trailingIcon), pressable-scale, text-field, code-input, form-message, card (tone, pressable with onPress), icon-button, bottom-sheet, split-badge, skeleton, empty-state, loading-overlay (full-screen wait that blocks taps), toast (short floating notice)
    auth/         AuthScreenLayout.tsx (shared frame of the auth screens, no scrolling; the form moves up only as far as the keyboard needs — `react-native-keyboard-controller`) · CollapsesWithKeyboard.tsx (logo, description, footer shrink and fade frame by frame with the keyboard) · LogoutButton.tsx (sign-out with confirmation: profile tab, temporary-password screen)
    layout/       AnimatedSplash.tsx · TextLogo.tsx (text logo of splash and login) · AppHeader.tsx (shared header, adds the top safe-area inset; no router header is used) · PlaceholderScreen.tsx (menus not wired to a real screen yet) · StatusBarGlass.tsx (blurred glass over the status bar while the page scrolls)
    home/         blocks of the Home screen, shared by every role — a block shown to one role only is gated in the screen with canPerform, never by a per-role folder:
                  HomeHeader · HomeSection · FarmCarousel/FarmBannerCard · OverviewStats + StatTile, DeviceStatTile, AlertStatTile, ZoneThresholdStatTile, StatDetailSheet, ReturnRateBar ·
                  UrgentAlertBanner · PendingTasksCard · RelayOverrideStrip · NewReportCard · HouseCarousel/HouseStatusCard ·
                  CameraCarousel/CameraCard · LiveCameraPlayer (YouTube-style live player opened in place: expanded modal, landscape full screen, swipe down to the floating CameraMiniPlayer bar) · CameraVideoSurface · PlayerControlButton
  config/         queryClient.ts
  constants/      apiEndpoints.ts (API_BASE_URL, WEBSOCKET_BASE_URL, ENDPOINTS) · theme.ts (Colors, Radius, Spacing, Typography…) · roleTabs.ts (tabs per role, isMobileRole) · authTiming.ts
  hooks/<domain>/ one hook per file: auth/ (useLogin, useLogout, useForgotPassword, useResetPassword, useChangePassword) · farm/ · alert/ · telemetry/ · bird-count/ · device/ · health/ · notification/ · time/ (useNow) · theme/ (usePalette — light palette only)
  services/
    api/          apiClient.ts (axios instance) + one <resource>.api.ts per resource (auth, farm, device, telemetry, alert, analytics, notification, healthReport)
    socket/       socketClient.ts — connect/disconnect, joinZone/leaveZone, on*/off* subscribers; a connection the backend rejects (expired token after reopening the app) refreshes the token once through apiClient and reconnects
    notification/ pushNotification.ts — permission + Expo push token + Android "alerts" channel
    session/      localSession.ts — startRealtimeIfReady (after sign-in or a restored session) · clearLocalSession (sign-out and expired session: socket, React Query cache, alert badge, tokens)
  stores/         Zustand: authStore (SecureStore-backed), alertStore, languageStore (vi/en, saved per account in SecureStore), farmPrefsStore (farms tab choices per account, persisted as a JSON file through services/storage/preferenceStorage.ts — expo-file-system, which Expo Go also has, unlike MMKV)
  types/          <module>.types.ts per domain + index.ts (the only barrel)
  utils/          date · number · label · validation · apiError · name · permission (canPerform) · threshold · device · returnRate · alert · severity · relay · healthDay · houseStatus (each <topic>.utils.ts)
```

`components/farm/` holds the farms tab pieces and `components/common/` the ones Home and the farms tab share (`RelayIcon`); create other `components/<domain>/` folders when a second screen needs the same piece.

**Tabs per role:** `src/constants/roleTabs.ts` (`ROLE_TABS`) is the only place to change a role's menu — title, icon and the `(tabs)` route it opens. A role with no entry cannot use the app (`isMobileRole`): Technician and Administrator are signed out with "use the web console". The Farm Owner keeps the five tabs; the Domain Expert has two placeholder menus (`menu-1..2`) until its screens exist, plus the shared `profile` tab. Every mobile role must have `profile` (checked by `roleTabs.test.ts`); sign-out always goes through `components/auth/LogoutButton.tsx`.

**Plumbing as written:**
- `src/services/api/apiClient.ts` — axios with `X-Client: mobile` (the backend then returns the refresh token in the JSON body instead of only a cookie), `Authorization` from the in-memory token in `authStore` (SecureStore only keeps it across app launches — reading the Keystore on every request is slow), and a 401 interceptor that queues concurrent requests behind one `POST /auth/refresh`, then retries; a 401 on a request sent with an older token than the current one is retried at once without another refresh. Auth routes (login, forgot/reset password, OTP) never trigger a refresh; logout does, since the backend puts `/auth/logout` behind `authenticate`. The refresh call uses its own axios instance without interceptors but with the same base URL, `X-Client` and 15 s timeout. A refresh the backend rejects (401) clears the session and opens `(auth)/login`; a network failure keeps it. A 403 `PASSWORD_CHANGE_REQUIRED` opens `reset-password` in `temporary` mode (AUTH-FR-005c).
- `src/stores/authStore.ts` — `accessToken`, `refreshToken` and `user` in `expo-secure-store`; `loadStoredAuth()` runs before the splash screen hides and drops a stored session whose role cannot use the app.
- Auth error messages: `src/utils/apiError.utils.ts` maps the backend's `error.code` and status to one Vietnamese sentence per action; a wrong email or password is always the same sentence, and a 429 shows the backend's `retryAfterSec`. Auth mutations never retry, since every failure counts toward the backend's 10-per-15-minutes limit.
- `src/services/socket/socketClient.ts` — singleton, `auth` callback re-reads the token on every (re)connect, infinite reconnection with back-off; `JOIN_ZONE`/`LEAVE_ZONE` rooms like the web.

## Rules

### Structure and naming
- **[Bắt buộc]** Route files live under `src/app/` only and stay thin: a screen reads params, calls hooks and renders. Data fetching, mapping and business logic go in `src/hooks/` and `src/services/`; reusable UI goes in `src/components/` (create a folder when a second screen needs the same piece — not "for later").
- **[Bắt buộc]** Imports use the `@/` alias (`@/*` → `src/`, `@/assets/*` → `assets/`), never `../`. No barrel `index.ts` except `src/types/index.ts` — import the file itself (`@/hooks/farm/useFarms`).
- **[Bắt buộc]** Names follow `MOBILE_GUIDE.md` §3.8: one hook per file in `src/hooks/<domain>/use<Action>.ts`; one `src/services/api/<resource>.api.ts` per resource exporting `<resource>Api`; `src/types/<module>.types.ts`; `src/stores/<name>Store.ts`; `src/utils/<topic>.utils.ts`; multi-word folders kebab-case. Screens are default exports named after the screen (`DashboardScreen`).
- **[Bắt buộc]** No abbreviations in variable, parameter or function names (`response`, `state`, `accessToken` — not `res`, `s`, `tk`); backend field names (`temp_min`) stay as the API sends them.
- **[Bắt buộc]** Before building a screen, read `MOBILE_GUIDE.md` §2.1 (role flow tree) and §2.2 (where shared pieces live) and reuse what exists in `components/ui/`, `components/layout/`, `components/common/`; a missing style is a new `variant`/`size` on that component. One screen and one component serve both roles — no per-role routes, components or styles; which actions show comes from `utils/permission.utils.ts`, never an inline `user.role === …` (menus aside: `constants/roleTabs.ts`).
- **[Bắt buộc]** No new colour, ever, unless the prompt asks for it with an explicit `#RRGGBB`: only tokens of `src/constants/theme.ts` through `usePalette()` (`Colors.raw` for fixed dark surfaces), no raw hex, no new alpha mixes, no library default colours, no per-role palette. The app has a light theme only (`app.json` `userInterfaceStyle: light`, no dark palette, no `useColorScheme()`). A requested colour is added as a token in `Colors.light` plus the table of `MOBILE_GUIDE.md` §3.2, and the reply ends with a note naming the colour added outside the system palette.
- **[Bắt buộc]** The palette and the tab bar are frozen (user, 2026-10-30): never change a value in `Colors` or the colour, shape or layout of `components/layout/BottomTabBar.tsx` unless the prompt explicitly asks for that change — not to "polish", not as a side effect of other work. `MOBILE_GUIDE.md` §3.2 and §3.5.
- **[Nên]** Styles via `StyleSheet.create` with spacing, radius and type from `src/constants/theme.ts`.

### API, data and state
- **[Bắt buộc]** Every endpoint is a constant or builder in `src/constants/apiEndpoints.ts` `ENDPOINTS`, matching `docs/api/api-spec.yaml` (path, method, params, body, response fields). No hard-coded URLs in screens or hooks.
- **[Bắt buộc]** Screens never call axios or `services/api` directly — they go through a React Query hook. Server data lives in the React Query cache, not copied into Zustand or `useState` (form drafts aside).
- **[Bắt buộc]** `queryKey` arrays start with the resource name (`['alerts', params]`); mutations invalidate the keys they change in their own `onSuccess`.
- **[Bắt buộc]** List endpoints return `{ data, meta: { page, limit, total } }`; screens paginate through `meta`, never load everything and slice on the device.
- **[Bắt buộc]** Zustand stores hold client-only state used across screens (auth, live alerts). A new store says why React Query cannot hold that state.

### Auth, security and storage
- **[Bắt buộc]** Tokens and anything secret live only in `expo-secure-store`, never in MMKV, AsyncStorage, logs or Zustand persistence. MMKV is for non-secret preferences and caches.
- **[Bắt buộc]** All requests go through `src/services/api/apiClient.ts` so the token refresh, `X-Client` header and timeout apply; on a failed refresh the app clears auth and returns to `(auth)/login`.
- **[Bắt buộc]** No secrets, API keys or production URLs in the repo; config comes from `EXPO_PUBLIC_*` env vars (anything `EXPO_PUBLIC_` is bundled into the app, so never put a secret there).

### Realtime and push
- **[Bắt buộc]** Every socket subscription (`on*`, `joinZone`) made in an effect is undone in its cleanup (`off`, `leaveZone`); a screen that joins a zone leaves it when it unmounts or the zone changes. Add `off*` helpers to `src/services/socket/socketClient.ts` when wiring the first screen.
- **[Bắt buộc]** Socket rooms, event names and payloads match the backend and Report 4 §7.3: rooms `zone:<id>` (`JOIN_ZONE`), `house:<id>` (`JOIN_HOUSE` — bird counts, camera status and house alerts), `user:<id>`; events `TELEMETRY_UPDATE`, `RELAY_UPDATE`, `ALERT_NEW`, `DEVICE_STATUS_CHANGE`, `BIRD_COUNT_UPDATE`, `NOTIFICATION_NEW`.
- **[Bắt buộc]** QR codes are read in the formats of Report 4 §5.4 (`swiftletcare://claim?d=<device ID>&k=<activation key>`, `swiftletcare://zone?z=<zone ID>`); the activation key is sent once to the registration endpoint and never stored, logged or cached on the phone.
- **[Bắt buộc]** Push registration (FCM via `expo-notifications`) only asks for permission at a point the user understands, and sends the token to the backend through an endpoint in `api-spec.yaml` — do not invent one; if the endpoint does not exist yet, say so in the PR and leave it unsent.

### Roles and scope
- **[Bắt buộc]** Role-dependent UI follows Report 3 §2.4: Domain Expert only reads operations (no relay control, no harvest writes, no alert acknowledgement); the Technician uses the web console only and sees structure, devices, diagnostics and device alerts — no environmental data, inferred-alert verdicts or health reports, no relay control or acknowledgement; the mobile app serves the Farm Owner and the Domain Expert. Hiding a button is not security — the backend enforces it — but the app must not offer an action the backend will refuse.
- **[Bắt buộc]** Enums in `src/types/*.types.ts` (`Role`, `AlertType`, `DeviceStatus`, `AlertSeverity/Status`…) match `backend/src/types/domain.types.ts`. A PR that touches an enum brings it fully in line, or says which follow-up PR does.
- **[Bắt buộc]** Nothing new for what Report 3 §8 puts out of scope: Marketplace/Buyer, Farm Operator/zone scope, predator detection, heating relay, Zalo/SMS, NH3/CO2 driving the fan, tickets/SLA/Technician regions. NH3/CO2 are shown as alert thresholds of the zone, not control limits.
- **[Bắt buộc]** No threshold, limit or behaviour invented without a source (Report 3, Domain Expert, cited reference).

### Screens and quality
- **[Bắt buộc]** Every screen with async data has loading, empty and error states; errors shown to the user are short Vietnamese messages, not raw error text. Destructive actions (relay off, delete, logout) ask for confirmation, and their button is disabled while the request runs.
- **[Bắt buộc]** Data with no real backend yet (bird counts while `ai-pipeline` is not deployed, anything else missing an endpoint) is either an explicit empty/"Sắp có" state or mock data labelled as fake — never fake numbers presented as real (same policy as the web, FE_Design §5.4/§7).
- **[Bắt buộc]** TypeScript strict: no `any`, `as any`, `@ts-ignore`/`@ts-expect-error`; unknown data is `unknown` and narrowed. No `console.log` left in committed code (`console.warn`/`error` only for real fault paths).
- **[Bắt buộc]** Touchable elements have an `accessibilityLabel` when they show only an icon.
- **[Nên]** Pure logic (formatters, validators, mappers) gets a jest test next to it.
- **[Nên]** User-facing text is written in Vietnamese with the same terms as the web ("Zone", "Farm" kept in English) and goes through `t('…')` (`utils/i18n.utils.ts`): the key is the Vietnamese sentence, variables are `{name}`, the English text is one line in `constants/i18n.en.ts` (a missing line shows the Vietnamese). The language is chosen in the Account tab, saved per account (`stores/languageStore.ts`, loaded by `hooks/i18n/useAccountLanguage`), and a screen re-mounts on change (`key={language}` on its root, `useLanguage()`), so `t` works in plain functions too.

## Known debt — not held against PRs that don't touch it

| Where | Out of line | How to pay it |
|---|---|---|
| `src/services/socket/socketClient.ts` | No `NOTIFICATION_NEW` yet (`JOIN_HOUSE`/`LEAVE_HOUSE` exist since the Home camera player) | Add the notification event (with `off*`) before the first screen subscribes |
| `src/components/farm/RelayControlSheet.tsx` | The backend accepts any manual override from 1 min to 24 h and has one expiry per controller: it neither caps pump ON at 30 min (BR-08) nor answers 409 for a pump ON while `SENSOR_FAULT` / `RS485_BUS_FAILURE` / `MISTING_INEFFECTIVE` is open (ENV-FR-016), and DELETE returns every relay of the controller to AUTO (BR-20 wants one expiry per relay). The app enforces BR-08 and the confirmation itself | Backend (Bảo, Kiệt): enforce both in `controlRelay`, then keep the app checks as a first line |
| `src/app/(tabs)/farms/` | No counting schedule (VISION-FR-019), incomplete-session flag (VISION-FR-020) or configuration sync state (ENV-FR-027) in the API, so screen B shows none of them | Add each when its backend lands |
| `src/components/farm/HouseYieldRow.tsx` | There is no screen to record or edit harvest batches on mobile; the row and the analytics "Sản lượng" tab only read `GET /harvests` (the backend already hides soft-deleted batches, the app also skips `is_deleted` to be safe) | Mobile: harvest record screen (Len, G-16 harvest step) |
| `src/app/(tabs)/farms/[houseId]/settings.tsx`, `farm-settings.tsx` | The backend has no route to rename or delete a house or a zone (FARM-FR-002 asks for both), so these actions show "Sắp có" | Backend (Kiệt, F-18): `PUT`/`DELETE /farms/houses/{id}` and `/farms/zones/{id}` in api-spec and routes; then unlock `ComingSoonAction` |
| `src/components/farm/settings/DetectionTuningSection.tsx`, `BirdCountTuningSection.tsx` | Only the Domain Expert edits detection parameters and the return-rate drop: the backend has no BR-22 fallback (Farm Owner decides on a farm without an expert), and a Farm Owner's threshold or coefficient change creates no review item for the expert (EXPERT-FR-010) | Backend (G-04); then pass `farmHasExpert` to `canPerform` and show the review state |
| `src/components/farm/ZoneSettingsSection.tsx`, `settings/BirdCountTuningSection.tsx` | No counting schedule per house in the API (VISION-FR-019), so "Lịch đếm chim" shows "Sắp có" | Backend (G-12 / VISION-FR-019); then add the section and drop the placeholder row |
| `src/components/farm/settings/AddDeviceSheet.tsx` | Device setup stops at registration: no Wi-Fi AP-mode guide or setup progress (FARM-FR-012), no floor-code scan step (the floor is picked from the settings tab) | G-09 / G-16 device-setup step (Len, delegated from Nhi) |
| `src/components/analytics/BirdTab.tsx` | No incomplete-session flag in the API (VISION-FR-020), so missing sessions come from `has_morning`/`has_evening`; `LOW_RETURN_RATE` is one alert per house with a counter, not one per day, so daily alert markers show "Sắp có"; no week/month endpoint, the app groups days itself | Backend (VISION-FR-020, per-day alert history); then draw the markers |
| `src/components/analytics/SuggestionCard.tsx` | No PROPOSED state or review queue (EXPERT-FR-011): a Farm Owner on a farm with an expert sees "Gửi chuyên gia duyệt — Sắp có" | Backend (G-04); then send the suggestion for review |
| `src/components/analytics/ReportTab.tsx` | `GET /health-reports/preview` is not saved, so a custom-range report is shown in a sheet only; no per-period verdict split for inferred alerts | Backend (Bảo, Kiệt): a save route for custom ranges, verdict counts in report metrics |
| `src/components/analytics/ControlTab.tsx` | Coefficient change markers have no author name (`tuning_changes` has none, `fuzzy_tuning_history` has only `changed_by_role`); `GET /farms/zones/{zoneId}` exists in code but not in api-spec; relay-override history has no zone-level route, so the app merges each controller's list | Backend + api-spec |
| `src/hooks/analytics/useAnalyticsKpis.ts`, `src/hooks/alert/useActiveAlertList.ts` | `/alerts?houseId=` returns house-level alerts only and `status` takes one value, so the Alerts tab loads ACTIVE and ACKNOWLEDGED of the whole farm (every page) and filters house, floor, severity, type and verdict in the app; "Đã đóng" pages RESOLVED of the farm and filters in the app | Backend: house filter incl. its zones, multi-status filter |
| `src/components/alert/AlertDetailContent.tsx` | A REJECTED verdict does not move the alert to `DISMISSED` (no code sets it), so "Đã đóng" has no "Bị bác bỏ" group and the detail shows "Sắp có"; the Farm Owner cannot record a verdict on a farm without an expert (BR-22 not in the backend, `PUT /alerts/{id}/verdict` is DOMAIN_EXPERT only); `expert_verdict` has no role and `acknowledged_by` / `by` are ids, so names come from the farm members | Backend (G-03, G-04) |
| `src/components/alert/AlertEvidence.tsx` | No evidence endpoint (ALERT-FR-014): the app builds it from `/telemetry/zones/{id}/history` and `/analytics/bird-count/buckets` ±30 min, open device alerts of the zone, and `/health-reports/preview` for the session day of `LOW_RETURN_RATE` | Backend evidence route; then read it instead |
| `src/app/(tabs)/alerts/index.tsx` | Socket sends only `ALERT_NEW` (new alerts, zone/house rooms): acknowledge, resolve, repeat and verdict changes arrive by the 30 s refetch; push cannot open an alert yet (no token endpoint, G-10) | Backend alert update event; mobile push response listener once FCM works |
| `src/components/alert/NotificationSettingsSheet.tsx` | No per-type channels (ALERT-FR-005), no on/off for quiet hours, no GET for the current user, so the Telegram link status refreshes only at the next sign-in | Backend: per-type channels, `GET /auth/me` |
| `src/services/notification/pushNotification.ts` | Gets an Expo push token but never sends it to the backend; uses `console.warn` | Wire it once the backend exposes a token endpoint (FCM, ALERT-FR-002) |
| `package.json` | `react-native-maps` is installed although Report 4 §5.4 adds no map library | MOBILE_GUIDE §1 "Cấu hình còn thiếu" |
| `package.json` | Libraries declared for planned screens but not imported yet (`react-native-maps`, `react-native-mmkv` + `react-native-nitro-modules` (needs a build with Nitro, not in Expo Go), `burnt`). Charts use `react-native-gifted-charts` (on `react-native-svg` + `expo-linear-gradient`), imported only in `src/components/charts/`; `victory-native` and Skia were removed | Drop what the screens end up not using |
| `src/app/(tabs)/home/` | No daily health status of each house (MF-11) because the backend has no route yet (G-11); the pending-day part of "Việc chờ bạn" has no API either; the house cards show a status the app derives from devices and alerts, not the MF-11 status | Add the MF-11 status and the rating entry when the G-11 routes are in `api-spec.yaml` |
| `src/components/home/LiveCameraPlayer.tsx` | Plays HLS from `EXPO_PUBLIC_STREAM_URL`, but MediaMTX ships with `hls: false` (`deploy/mediamtx.yml`) and HLS asks `/internal/stream-auth` on its repeated requests while the token lives 60 s | Infrastructure and backend (Bảo, Kiệt): enable HLS and check the token lifetime for HLS |
| `src/app/livestream/[zoneId]` | Keyed by zone, but cameras, bird counts and the stream belong to the house's camera (Report 3 §2.8, VISION-FR-013) | Key the route by camera (house) when the screen is built |
| `src/app/**` screens other than `(auth)` | Stubs with `TODO` comments (profile shows name, email and sign-out only); the Domain Expert's `menu-2` tab is a placeholder | Implement per Report 3 (main flows first: MF-10 setup, alerts, dashboard, live stream) |

A PR that touches a file in this table **should** pay the debt; it **must** when it makes the debt worse (e.g. using `PREDATOR_DETECTED` or a Zalo/SMS option in new code).

## Before opening a PR

- **[Bắt buộc]** `npm run lint`, `npm run typecheck` and `npx jest --passWithNoTests` pass (CI job Mobile runs them). Add or upgrade packages with `npx expo install`, so versions stay on the Expo SDK, and commit the updated `package-lock.json`.
- **[Bắt buộc]** Tested on at least one real device or emulator; PR shows screenshots of changed screens (Android and/or iOS).
- **[Bắt buộc]** Endpoint or enum changes checked against `docs/api/api-spec.yaml` and `backend/src/types/domain.types.ts`.
- **[Bắt buộc]** PR fills `.github/pull_request_template.md`; commits follow `.commitlintrc.json` (there is no `mobile` scope; use the closest feature scope such as `alert`, `farm`, `auth`, `analytics`).
