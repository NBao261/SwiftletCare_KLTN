# mobile/CLAUDE.md

Rules and map for `mobile/` (Expo SDK 53 + Expo Router + React Native). This file wins over the root `CLAUDE.md` for mobile code; `/review-pr` judges mobile changes by it together with `mobile/README.md`. Rule tags: **[Bắt buộc]** = blocking (review requests changes), **[Nên]** = advisory. Only lines a PR adds or changes are judged; "Known debt" lists what is already out of line.

## Where mobile stands

- **Who it is for (SRS v2.0.0 §0.3, §0.5 Mobile):** Farm Owner, Domain Expert and Technician. The expert needs at least the dashboard and the zone health report on mobile; verification and tuning screens are web-first.
- **State:** a scaffold. Most screens under `app/` are stubs with `TODO` comments; the plumbing (axios client, auth store, React Query hooks, socket client, push registration) exists. The code still follows the SRS v1.24.0 scope — see Known debt.
- **Backend contract:** the same backend as the web, unprefixed routes, `docs/api/api-spec.yaml` is the source of truth. The backend already follows SRS v2 (roles `ADMIN | FARM_OWNER | DOMAIN_EXPERT | TECHNICIAN`, `NOISE_ANOMALY`, Telegram as the out-of-app channel, no Marketplace, no heating).

## Commands

```bash
npm install                 # no package-lock.json is committed yet
npx expo start              # or: npm start / npm run android / npm run ios
npm run lint                # eslint . --ext .ts,.tsx (no ESLint config committed yet — see Known debt)
npm test                    # jest (jest-expo preset) — no tests yet
npm run typecheck           # tsc --noEmit
npm run build:dev|build:preview|build:prod   # EAS profiles in eas.json
```

Configure `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL` in `.env` (template `.env.example`); defaults point at `localhost:3000`. Mobile has no CI job yet (CI needs a lockfile).

## Structure

```
app/            Expo Router routes — the folder tree IS the navigation
  _layout.tsx     root Stack: QueryClientProvider, GestureHandlerRootView, splash until stored auth loads
  (auth)/         login, register
  (tabs)/         dashboard, alerts, analytics, farms, tickets, settings (each <tab>/index.tsx)
  farm/[farmId] · zone/[zoneId] · device/[deviceId] · alert/[alertId] · ticket/[ticketId] · livestream/[zoneId]
config/         queryClient.ts
constants/      api.ts (API_BASE_URL, WS_BASE_URL, ENDPOINTS) · theme.ts · index.ts
hooks/          React Query hooks, one per resource: useAuth, useFarms, useTelemetry, useAlerts, useBirdCount, useTickets
services/
  api/          client.ts (axios instance) + one file per resource (auth, farms, devices, telemetry, alerts, analytics, tickets)
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
- **[Bắt buộc]** Socket event names and payloads match the backend (`TELEMETRY_UPDATE`, `RELAY_UPDATE`, `ALERT_NEW`, `DEVICE_STATUS_CHANGE`, `BIRD_COUNT_UPDATE`).
- **[Bắt buộc]** Push registration (FCM via `expo-notifications`) only asks for permission at a point the user understands, and sends the token to the backend through an endpoint in `api-spec.yaml` — do not invent one; if the endpoint does not exist yet, say so in the PR and leave it unsent.

### Roles and scope
- **[Bắt buộc]** Role-dependent UI follows SRS §4.4: Domain Expert only reads operations (no relay control, no tickets, no harvest writes, no alert acknowledgement) but can see verdict/health-report screens; Technician and Farm Owner per the matrix. Hiding a button is not security — the backend enforces it — but the app must not offer an action the backend will refuse.
- **[Bắt buộc]** Enums in `types/index.ts` (`Role`, `AlertType`, `DeviceStatus`, `TicketType/Priority/Status`…) match `backend/src/types/domain.types.ts`. A PR that touches an enum brings it fully in line, or says which follow-up PR does.
- **[Bắt buộc]** Nothing new for what SRS §0.2 removed: Marketplace/Buyer, Farm Operator/zone scope, predator detection, heating relay, Zalo/SMS, NH3/CO2 driving the fan. NH3/CO2 are shown as alert thresholds set by the Domain Expert.
- **[Bắt buộc]** No threshold, limit or behaviour invented without a source (SRS, Domain Expert, cited reference).

### Screens and quality
- **[Bắt buộc]** Every screen with async data has loading, empty and error states; errors shown to the user are short Vietnamese messages, not raw error text. Destructive actions (relay off, delete, logout) ask for confirmation, and their button is disabled while the request runs.
- **[Bắt buộc]** Data with no real backend yet (bird counts while `ai-pipeline` is not deployed, anything else missing an endpoint) is either an explicit empty/"Sắp có" state or mock data labelled as fake — never fake numbers presented as real (same policy as the web, FE_Design §5.4/§7).
- **[Bắt buộc]** TypeScript strict: no `any`, `as any`, `@ts-ignore`/`@ts-expect-error`; unknown data is `unknown` and narrowed. No `console.log` left in committed code (`console.warn`/`error` only for real fault paths).
- **[Bắt buộc]** Touchable elements have an `accessibilityLabel` when they show only an icon.
- **[Nên]** Pure logic (formatters, validators, mappers) gets a jest test next to it.
- **[Nên]** User-facing text is Vietnamese with the same terms as the web ("Zone", "Farm", "Ticket" kept in English).

## Known debt — not held against PRs that don't touch it

| Where | Out of line | How to pay it |
|---|---|---|
| `types/index.ts` | `Role` still has `OPERATOR`/`SALES_STAFF` and no `DOMAIN_EXPERT`; `AlertType` has `BIRD_PANIC`, `PREDATOR_DETECTED` and lacks `NOISE_ANOMALY`; `FarmMember.role: 'OPERATOR'`; `NotificationPreferences` has `zalo`/`sms` | Align with `backend/src/types/domain.types.ts` in one PR (SRS §0.5 Mobile) |
| `services/socket/index.ts` | `on*` helpers have no matching `off*`, so screens cannot clean up | Add `off*` helpers before the first screen subscribes |
| `services/notification/index.ts` | Gets an Expo push token but never sends it to the backend; uses `console.warn` | Wire it once the backend exposes a token endpoint (FCM, ALERT-FR-013) |
| Tooling | No ESLint config for ESLint 9, no tests, no `package-lock.json`, so no CI job | Add `eslint.config.js` (eslint-config-expo), commit the lockfile, then add a CI job |
| `app/**` screens | Stubs with `TODO` comments | Implement per SRS §0.5 Mobile |

A PR that touches a file in this table **should** pay the debt; it **must** when it makes the debt worse (e.g. using `BIRD_PANIC` or `SALES_STAFF` in new code).

## Before opening a PR

- **[Bắt buộc]** `npm run typecheck` passes; `npm run lint` and `npm test` pass once their configs exist.
- **[Bắt buộc]** Tested on at least one real device or emulator; PR shows screenshots of changed screens (Android and/or iOS).
- **[Bắt buộc]** Endpoint or enum changes checked against `docs/api/api-spec.yaml` and `backend/src/types/domain.types.ts`.
- **[Bắt buộc]** PR fills `.github/pull_request_template.md`; commits follow `.commitlintrc.json` (there is no `mobile` scope; use the closest feature scope such as `alert`, `farm`, `auth`, `analytics`).
