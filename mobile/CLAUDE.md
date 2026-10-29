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

Configure `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL` in `.env` (template `.env.example`); defaults point at `localhost:3000`. CI (`.github/workflows/ci.yml`, job Mobile) runs `npm ci`, `lint`, `typecheck` and `jest --passWithNoTests` on every PR that touches `mobile/`.

## Structure

All code lives in `src/`; `assets/` (images, fonts) stays at the `mobile/` root because `app.json` points at it. Every layer is split by business domain, one job per file. Full map and naming table: `mobile/MOBILE_GUIDE.md` §2 and §3.8.

```
src/
  app/            Expo Router routes — the folder tree IS the navigation
    _layout.tsx     root Stack: fonts, stored auth, QueryClientProvider, AnimatedSplash on top until ready
    (auth)/         login, forgot-password, verify-code, reset-password (also the first-sign-in temporary password) — no public sign-up
    (tabs)/         dashboard, farms, alerts, analytics, profile (both roles), menu-1..2 (each <tab>/index.tsx); which tabs a role sees comes from constants/roleTabs.ts
    farm/[farmId] · zone/[zoneId] · device/[deviceId] · alert/[alertId] · livestream/[zoneId]
  components/
    ui/           primitives: text, button, pressable-scale, text-field, code-input, form-message
    auth/         AuthScreenLayout.tsx (shared frame of the auth screens, no scrolling; the form moves up only as far as the keyboard needs — `react-native-keyboard-controller`) · CollapsesWithKeyboard.tsx (logo, description, footer shrink and fade frame by frame with the keyboard) · LogoutButton.tsx (sign-out with confirmation: profile tab, temporary-password screen)
    layout/       AnimatedSplash.tsx · TextLogo.tsx (text logo of splash and login) · AppHeader.tsx (shared header, adds the top safe-area inset; no router header is used) · PlaceholderScreen.tsx (menus not wired to a real screen yet)
  config/         queryClient.ts
  constants/      apiEndpoints.ts (API_BASE_URL, WEBSOCKET_BASE_URL, ENDPOINTS) · theme.ts (Colors, Radius, Spacing, Typography…) · roleTabs.ts (tabs per role, isMobileRole) · authTiming.ts
  hooks/<domain>/ one hook per file: auth/ (useLogin, useLogout, useForgotPassword, useResetPassword, useChangePassword) · farm/ · alert/ · telemetry/ · bird-count/ · theme/ (usePalette — light palette only)
  services/
    api/          apiClient.ts (axios instance) + one <resource>.api.ts per resource (auth, farm, device, telemetry, alert, analytics)
    socket/       socketClient.ts — connect/disconnect, joinZone/leaveZone, on*/off* subscribers; a connection the backend rejects (expired token after reopening the app) refreshes the token once through apiClient and reconnects
    notification/ pushNotification.ts — permission + Expo push token + Android "alerts" channel
    session/      localSession.ts — startRealtimeIfReady (after sign-in or a restored session) · clearLocalSession (sign-out and expired session: socket, React Query cache, alert badge, tokens)
  stores/         Zustand: authStore (SecureStore-backed), alertStore
  types/          <module>.types.ts per domain + index.ts (the only barrel)
  utils/          date.utils · number.utils · label.utils · validation.utils · apiError.utils
```

`components/common/` and the other `components/<domain>/` folders do not exist yet — create them when a second screen needs the same piece.

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
- **[Nên]** User-facing text is Vietnamese with the same terms as the web ("Zone", "Farm" kept in English).

## Known debt — not held against PRs that don't touch it

| Where | Out of line | How to pay it |
|---|---|---|
| `src/services/socket/socketClient.ts` | No `JOIN_HOUSE` / `NOTIFICATION_NEW` yet | Add the house room and the notification event (with `off*`) before the first screen subscribes |
| `src/services/notification/pushNotification.ts` | Gets an Expo push token but never sends it to the backend; uses `console.warn` | Wire it once the backend exposes a token endpoint (FCM, ALERT-FR-002) |
| `package.json`, `app.json` | No `expo-video` (HLS stream) or `expo-location` (farm coordinates); `react-native-maps` is installed although Report 4 §5.4 adds no map library; location permission text speaks of a map | MOBILE_GUIDE §1 "Cấu hình còn thiếu" |
| `package.json` | Libraries declared for planned screens but not imported yet (`expo-camera` — needed for MF-10 QR setup, `expo-linear-gradient`, `react-native-maps`, `victory-native` + Skia, `react-native-mmkv` + `react-native-nitro-modules`, `burnt`). `victory-native` stays on 42.x because 43 needs Skia ≥ 2.15 and SDK 58 ships 2.14 | Drop what the screens end up not using |
| `src/app/livestream/[zoneId]` | Keyed by zone, but cameras, bird counts and the stream belong to the house's camera (Report 3 §2.8, VISION-FR-013) | Key the route by camera (house) when the screen is built |
| `src/app/**` screens other than `(auth)` | Stubs with `TODO` comments (profile shows name, email and sign-out only); the Domain Expert's first two tabs are placeholders `menu-1..2` | Implement per Report 3 (main flows first: MF-10 setup, alerts, dashboard, live stream) |

A PR that touches a file in this table **should** pay the debt; it **must** when it makes the debt worse (e.g. using `PREDATOR_DETECTED` or a Zalo/SMS option in new code).

## Before opening a PR

- **[Bắt buộc]** `npm run lint`, `npm run typecheck` and `npx jest --passWithNoTests` pass (CI job Mobile runs them). Add or upgrade packages with `npx expo install`, so versions stay on the Expo SDK, and commit the updated `package-lock.json`.
- **[Bắt buộc]** Tested on at least one real device or emulator; PR shows screenshots of changed screens (Android and/or iOS).
- **[Bắt buộc]** Endpoint or enum changes checked against `docs/api/api-spec.yaml` and `backend/src/types/domain.types.ts`.
- **[Bắt buộc]** PR fills `.github/pull_request_template.md`; commits follow `.commitlintrc.json` (there is no `mobile` scope; use the closest feature scope such as `alert`, `farm`, `auth`, `analytics`).
