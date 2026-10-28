# mobile/CLAUDE.md

Rules and map for `mobile/` (Expo SDK 53 + Expo Router 5 + React Native 0.79 + React 19). This file wins over the root `CLAUDE.md` for mobile code; `/review-pr` judges mobile changes by it together with `mobile/README.md`. Rule tags: **[Bắt buộc]** = blocking (review requests changes), **[Nên]** = advisory. Only lines a PR adds or changes are judged; "Known debt" lists what is already out of line.

## Where mobile stands

- **Requirements:** Report 3 (`docs/reports/report3-srs.md`) and Report 4 (`docs/reports/report4-sdd.md` §5.4) win over `SwiftletCare_SRS.md`; what mobile still lacks is listed in `docs/reports/project-tracking.md` §6 (G-16).
- **Who it is for:** Farm Owner and Domain Expert (Report 4 §5.4), with the full scope of the registration form (3.2 b): monitoring, count analytics and the HLS live stream, alerts with push, manual override, device setup by QR code, daily status and rating, reports, harvests, expert validation and tuning (Project Tracking G-16). The Technician works from the web console. Two main-flow pieces live on mobile: **device setup** (MF-10 — scan the device label and the floor QR code with `expo-camera`, guide Wi-Fi provisioning in AP mode, show the setup progress, FARM-FR-003…012) and **FCM push** (ALERT-FR-002 — register the token after sign-in, remove it at sign-out). The daily health status of each house and the daily rating (MF-11: ask the user's own status first, then show the system's — BR-31; the API itself hides the status until the user rates or skips) are on mobile too, since the Farm Owner rates from the house.
- **State:** a scaffold. Most screens under `app/` are stubs with `TODO` comments; the plumbing (axios client, auth store, React Query hooks, socket client, push registration) exists. The code still follows the SRS v1.24.0 scope — see Known debt.
- **Backend contract:** the same backend as the web, unprefixed routes, `docs/api/api-spec.yaml` is the source of truth. The backend already follows the Review 1 scope (roles `ADMIN | FARM_OWNER | DOMAIN_EXPERT | TECHNICIAN`, `NOISE_ANOMALY`, Telegram and FCM push as the out-of-app channels, no Marketplace, no heating).

## Commands

```bash
npm ci                      # install from the committed package-lock.json
npx expo start              # or: npm start / npm run android / npm run ios
npm run lint                # eslint . (flat config: eslint.config.js, eslint-config-expo)
npm run typecheck           # tsc --noEmit
npm test                    # jest (jest-expo preset) — no tests yet; CI runs `npx jest --passWithNoTests`
npx expo install <pkg>      # add or upgrade a package at the version matching the Expo SDK
npx expo install --check    # list packages whose version does not match the SDK
npm run build:dev|build:preview|build:prod   # EAS profiles in eas.json
```

Configure `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL` in `.env` (template `.env.example`); defaults point at `localhost:3000`. CI (`.github/workflows/ci.yml`, job Mobile) runs `npm ci`, `lint`, `typecheck` and `jest --passWithNoTests` on every PR that touches `mobile/`.

## Structure

```
app/            Expo Router routes — the folder tree IS the navigation
  _layout.tsx     root Stack: QueryClientProvider, GestureHandlerRootView, splash until stored auth loads
  (auth)/         login, register
  (tabs)/         dashboard, alerts, analytics, farms, settings (each <tab>/index.tsx)
  farm/[farmId] · zone/[zoneId] · device/[deviceId] · alert/[alertId] · livestream/[zoneId]
config/         queryClient.ts
constants/      api.ts (API_BASE_URL, WS_BASE_URL, ENDPOINTS) · theme.ts · index.ts
hooks/          React Query hooks, one per resource: useAuth, useFarms, useTelemetry, useAlerts, useBirdCount
services/
  api/          client.ts (axios instance) + one file per resource (auth, farms, devices, telemetry, alerts, analytics)
  socket/       socket.io client: connect/disconnect, joinZone/leaveZone, on* subscribers
  notification/ expo-notifications: permission + Expo push token + Android "alerts" channel
store/          Zustand: authStore (SecureStore-backed), alertStore
types/          index.ts — domain enums + entity/socket payload types
utils/          date/number formatting, label helpers, simple validators
```

There is no `components/` folder yet; `tsconfig.json` already maps `@components/*` for when one is added.

**Plumbing as written:**
- `services/api/client.ts` — axios with `X-Client: mobile` (the backend then returns the refresh token in the JSON body instead of only a cookie), `Authorization` from SecureStore, and a 401 interceptor that queues concurrent requests behind one `POST /auth/refresh`, then retries.
- `store/authStore.ts` — `accessToken`, `refreshToken` and `user` in `expo-secure-store`; `loadStoredAuth()` runs before the splash screen hides.
- `services/socket/index.ts` — singleton, `auth` callback re-reads the token on every (re)connect, infinite reconnection with back-off; `JOIN_ZONE`/`LEAVE_ZONE` rooms like the web.

## Rules

### Structure and naming
- **[Bắt buộc]** Route files live under `app/` only and stay thin: a screen reads params, calls hooks and renders. Data fetching, mapping and business logic go in `hooks/` and `services/`; reusable UI goes in `components/` once it exists (create it when a second screen needs the same piece — not "for later").
- **[Bắt buộc]** Imports use the `@/` alias (`@/*` → mobile root), never `../`.
- **[Bắt buộc]** One file per resource in `services/api/<resource>.ts` and `hooks/use<Resource>.ts`; hooks start with `use`. Screens are default exports named after the screen (`DashboardScreen`).
- **[Nên]** Styles via `StyleSheet.create` with colours and spacing from `constants/theme.ts`, not raw hex in screens.

### API, data and state
- **[Bắt buộc]** Every endpoint is a constant or builder in `constants/api.ts` `ENDPOINTS`, matching `docs/api/api-spec.yaml` (path, method, params, body, response fields). No hard-coded URLs in screens or hooks.
- **[Bắt buộc]** Screens never call axios or `services/api` directly — they go through a React Query hook. Server data lives in the React Query cache, not copied into Zustand or `useState` (form drafts aside).
- **[Bắt buộc]** `queryKey` arrays start with the resource name (`['alerts', params]`); mutations invalidate the keys they change in their own `onSuccess`.
- **[Bắt buộc]** List endpoints return `{ data, meta: { page, limit, total } }`; screens paginate through `meta`, never load everything and slice on the device.
- **[Bắt buộc]** Zustand stores hold client-only state used across screens (auth, live alerts). A new store says why React Query cannot hold that state.

### Auth, security and storage
- **[Bắt buộc]** Tokens and anything secret live only in `expo-secure-store`, never in MMKV, AsyncStorage, logs or Zustand persistence. MMKV is for non-secret preferences and caches.
- **[Bắt buộc]** All requests go through `services/api/client.ts` so the token refresh, `X-Client` header and timeout apply; on a failed refresh the app clears auth and returns to `(auth)/login`.
- **[Bắt buộc]** No secrets, API keys or production URLs in the repo; config comes from `EXPO_PUBLIC_*` env vars (anything `EXPO_PUBLIC_` is bundled into the app, so never put a secret there).

### Realtime and push
- **[Bắt buộc]** Every socket subscription (`on*`, `joinZone`) made in an effect is undone in its cleanup (`off`, `leaveZone`); a screen that joins a zone leaves it when it unmounts or the zone changes. Add `off*` helpers to `services/socket` when wiring the first screen.
- **[Bắt buộc]** Socket rooms, event names and payloads match the backend and Report 4 §7.3: rooms `zone:<id>` (`JOIN_ZONE`), `house:<id>` (`JOIN_HOUSE` — bird counts, camera status and house alerts), `user:<id>`; events `TELEMETRY_UPDATE`, `RELAY_UPDATE`, `ALERT_NEW`, `DEVICE_STATUS_CHANGE`, `BIRD_COUNT_UPDATE`, `NOTIFICATION_NEW`.
- **[Bắt buộc]** QR codes are read in the formats of Report 4 §5.4 (`swiftletcare://claim?d=<device ID>&k=<activation key>`, `swiftletcare://zone?z=<zone ID>`); the activation key is sent once to the registration endpoint and never stored, logged or cached on the phone.
- **[Bắt buộc]** Push registration (FCM via `expo-notifications`) only asks for permission at a point the user understands, and sends the token to the backend through an endpoint in `api-spec.yaml` — do not invent one; if the endpoint does not exist yet, say so in the PR and leave it unsent.

### Roles and scope
- **[Bắt buộc]** Role-dependent UI follows Report 3 §2.4: Domain Expert only reads operations (no relay control, no harvest writes, no alert acknowledgement); the Technician uses the web console only and sees structure, devices, diagnostics and device alerts — no environmental data, inferred-alert verdicts or health reports, no relay control or acknowledgement; the mobile app serves the Farm Owner and the Domain Expert. Hiding a button is not security — the backend enforces it — but the app must not offer an action the backend will refuse.
- **[Bắt buộc]** Enums in `types/index.ts` (`Role`, `AlertType`, `DeviceStatus`, `AlertSeverity/Status`…) match `backend/src/types/domain.types.ts`. A PR that touches an enum brings it fully in line, or says which follow-up PR does.
- **[Bắt buộc]** Nothing new for what Report 3 §8 puts out of scope: Marketplace/Buyer, Farm Operator/zone scope, predator detection, heating relay, Zalo/SMS, NH3/CO2 driving the fan. NH3/CO2 are shown as alert thresholds of the zone, not control limits.
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
| `services/socket/index.ts` | `on*` helpers have no matching `off*`, so screens cannot clean up | Add `off*` helpers before the first screen subscribes |
| `services/notification/index.ts` | Gets an Expo push token but never sends it to the backend; uses `console.warn` | Wire it once the backend exposes a token endpoint (FCM, ALERT-FR-002) |
| Tooling | No tests yet; `npm run lint` passes with ~44 warnings (UTF-8 BOM at the top of files, `Array<T>` instead of `T[]`) | Write tests with the features; `npx eslint . --fix` clears most warnings |
| `package.json` | Libraries declared for planned screens but not imported yet (`expo-camera`, `expo-av`, `react-native-maps`, `victory-native` + Skia, `react-native-mmkv`, `burnt`); `@shopify/react-native-skia` is pinned to `~2.0.7` and excluded from `expo install --check` because the SDK's `v2.0.0-next.4` prerelease does not satisfy `victory-native`'s peer range | Drop what the screens end up not using |
| `app/livestream/[zoneId]` | Keyed by zone, but cameras, bird counts and the stream belong to the house's camera (Report 3 §2.8, VISION-FR-013) | Key the route by camera (house) when the screen is built |
| `app/**` screens | Stubs with `TODO` comments | Implement per Report 3 (main flows first: MF-10 setup, alerts, dashboard, live stream) |

A PR that touches a file in this table **should** pay the debt; it **must** when it makes the debt worse (e.g. using `PREDATOR_DETECTED` or a Zalo/SMS option in new code).

## Before opening a PR

- **[Bắt buộc]** `npm run lint`, `npm run typecheck` and `npx jest --passWithNoTests` pass (CI job Mobile runs them). Add or upgrade packages with `npx expo install`, so versions stay on the Expo SDK, and commit the updated `package-lock.json`.
- **[Bắt buộc]** Tested on at least one real device or emulator; PR shows screenshots of changed screens (Android and/or iOS).
- **[Bắt buộc]** Endpoint or enum changes checked against `docs/api/api-spec.yaml` and `backend/src/types/domain.types.ts`.
- **[Bắt buộc]** PR fills `.github/pull_request_template.md`; commits follow `.commitlintrc.json` (there is no `mobile` scope; use the closest feature scope such as `alert`, `farm`, `auth`, `analytics`).
