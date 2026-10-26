# frontend/CLAUDE.md

Map of `frontend/` (React 18 + Vite + TailwindCSS dashboard/PWA) **as the code is today**. The rules — design tokens, components, i18n, mock data, folder placement, file naming, code rules tagged **[Bắt buộc]**/**[Nên]**, known debt and the PR checklist — live in **`frontend/FE_Design_Claude.md`**, which is the first rule source for this module and describes the **target** structure. What the product must do is Report 3 (`docs/reports/report3-srs.md`; roles and permissions §2.4) and Report 4 (`docs/reports/report4-sdd.md` §5.4); they win over `SwiftletCare_SRS.md`. When this file and FE_Design disagree, FE_Design wins for rules and target; this file wins for "what exists now".

## Scope gap — read this first

The frontend still follows the SRS v1.24.0 scope while the backend already follows the Review 1 scope and Report 3:

- Roles in the code are `ADMIN | FARM_OWNER | TECHNICIAN | DOMAIN_EXPERT` (`types/common.types.ts`), same as the backend; the legacy `SALES_STAFF` role and its screens were removed in PR #106. **Domain Expert screens exist since PR #91**: `/expert/dashboard|audit-logs|tuning|analytics|reports` (`routes/expert.routes.tsx`, `EXPERT_ROLES`, `ExpertPageShell`), pages in `pages/expert/`, components in `components/features/expert/`, hooks in `hooks/expert/`, API calls in `services/expert/` with a mock fallback (`expertFallback.service.ts`, `data/mocks/`, `data/expertMock.data.ts`). They differ from FE_Design §12 (bucket `domain-expert/`, `DomainExpertLayout`, `apis/`, `data/<name>.data.ts`) and still name SRS v2.1.4 — known debt, `docs/reports/project-tracking.md` §6 G-15.
- The `heating` field of `RelayStates` (`types/device.types.ts`; the screens already show three relays) is still in the code, although the backend no longer serves it. The marketplace screens were removed in PR #93.
- This is FE_Design §13.14 known debt: **only remove or replace it**, never extend them (Report 3 §8 puts them out of scope).
- Report 3 also moves device setup to the Farm Owner (MF-10: scan the device label and the floor QR code, setup progress; Admin prints labels, the zone screen prints floor codes — FE_Design §12.0 c rows 5b and 10) and removes threshold and coefficient editing from Technician screens (row 9). Report 3 §8 (BM03 row 9) also takes tickets, ticket chat, SLA, Technician regions, maintenance schedules and Admin farm management out of scope: their screens were removed (PR 6 of `docs/reports/todo-remove-platform.md`) — never bring them back. The Technician sees the devices and device alerts of every farm, with no relay or acknowledge buttons; a farm has a location (coordinates, FARM-FR-001) instead of a region. Open gaps are in `docs/reports/project-tracking.md` §6. New role work follows FE_Design §12 (bucket `domain-expert/`, `DomainExpertLayout`, role groups in §12.8); the existing `expert/` code is moved there when it is next touched.

## Commands

```bash
npm run dev      # http://localhost:5173 — Vite proxies /api -> backend :3000 (prefix stripped) and /socket.io (ws: true)
npm run build    # tsc && vite build
npm run lint     # eslint src --ext ts,tsx
npm test         # vitest (CI runs `npx vitest run`)
npx tsc --noEmit
```

CI (`.github/workflows/ci.yml`, job Frontend) runs `npm ci`, `lint`, `tsc --noEmit`, `vitest run` and `build` on every PR that touches `frontend/`.

## Structure today

```
src/
  apis/        admin/ auth/ farm-owner/ shared/ — one <resource>.api.ts per resource, no barrel
               (farm-owner/farmMock.api.ts returns EMPTY data for parts the backend has no endpoint for)
  components/  auth/ (RequireRole) · common/ · features/<role>/<area>/ · layouts/ · ui/ (design system)
  constants/   roles (role groups, ROLE_HOME, MENU_ACCESS, getRoleHomePath/canAccessPath) · thresholds · severity · auditActions · *.i18n.ts dictionaries
  data/        <name>.data.ts — the ONLY place fake data may live (FE_Design §7): deviceComponents.data.ts, expertMock.data.ts; mocks/ (expert*.mock.ts, PR #91 — known debt)
  hooks/       admin/ auth/ common/ expert/ farm-owner/ shared/ — React Query wrappers over apis/ (expert/ wraps services/expert/)
  i18n/        index.ts (t · tr · trChildren · translated · intlLocale · setLang) · en.ts — i18next, keys are the Vietnamese sentences
  lib/         axios · queryClient · socket · cn · helpers · i18n · navigation · navigationState (intent passed through router state) · chartTheme · apiError
  pages/       admin/ auth/ expert/ farm-owner/ technician/ + 2 root pages (SettingsPage, ForbiddenPage) — ONLY *Page.tsx
  providers/   AppProviders.tsx
  routes/      admin · expert · farm-owner · technician · public (.routes.tsx)
  services/    expert/ (expertApi.service.ts, expertFallback.service.ts) + expert.service.ts — API calls of the Domain Expert screens outside apis/ (known debt, FE_Design §12)
  stores/      Zustand: authStore · alertStore · toastStore · zoneStore · breadcrumbStore · languageStore · pinnedHouseStore
  types/       <module>.types.ts (split by backend module, not by role) + index.ts barrel
  validations/ admin/ · common/ · farm-owner/ · technician/ — pure form validators (+ *.test.ts)
```

- **Buckets by role.** Every concern folder splits into `admin/`, `farm-owner/`, `technician/`, `auth/`, `shared/` and `common/` (role-agnostic infrastructure). A file is in `shared/` only when two or more roles really reach it; `apis/shared/` + `hooks/shared/` hold farms, alerts, devices and audio tracks (`audioTracks` is Technician-only — known debt). There is no `components/features/shared/`.
- **Pages** sit in the folder of the role that owns that business and carry the role in their name (`TechnicianDevicesPage`, `FarmOwnerHarvestPage`, `AdminUsersPage`); the exported component name matches the filename. A page's folder is **not** an access list: `allow={...}` in `routes/<role>.routes.tsx` is.
- **Routes**: one `routes/<role>.routes.tsx` per `pages/<role>/` folder, each exporting a `<Route>` fragment (`publicRoutes`, `adminRoutes`, `expertRoutes` under `/expert/*`, `farmOwnerRoutes`, `technicianRoutes`), lazy-loading its pages and wrapping them in `<RequireRole allow={...}>`. `App.tsx` assembles them plus the index redirect and `/settings`; `RoleLayout` picks the layout from `user.role` at runtime because URLs carry no role prefix.
- **Role groups** (`constants/roles.ts`): `OPS_ROLES` (Farm Owner, Technician, Admin), `FARM_OWNER_ONLY` (dashboard, analytics, vision, harvests), `HARVEST_ROLES` (Farm Owner, Admin), `ADMIN_ONLY`, `EXPERT_ROLES` (Domain Expert). `MENU_ACCESS` (path → roles) mirrors the layout menus and backs `canAccessPath`; it is kept apart from the layouts on purpose (`useAuth` → `canAccessPath`, layouts → `AppHeader` → `useAuth` would be an import cycle). `hooks/common/usePermission.ts` does the UI-level hide/disable check.
- **Layouts** (`components/layouts/`): one per role — `AdminLayout`, `FarmOwnerLayout`, `TechnicianLayout`, `ExpertLayout` (target name `DomainExpertLayout`) — each writing its whole menu literally at the top, plus `AppShell` (sidebar + header + `Outlet` + `Toast`, mounts the global `useAlertNotifications` listener), `AppSidebar` (same menu as desktop rail and mobile dock), `AppHeader`. Adding a menu item = edit that role's layout **and** add a `MENU_ACCESS` row.
- **Component tiers**: no domain knowledge → `components/ui/` (self-contained design system, only imports `@/lib/cn` and `@/i18n`; `ui/index.ts` is the only barrel in `src/`, `icons.tsx` left out; nothing inside `ui/` imports the barrel). Knows the domain, one feature → `components/features/<role>/<area>/`. Knows the domain, two or more features → `components/common/` (kept small: `ScopeFilter` (farm → house → zone filter of the Farm Owner pages), `SeverityBadge`, `TableEmptyState`, `NotificationPopover`, `ProfilePopover`, `LogoutConfirmModal`, `Toast`, `StatusDot`).
- **Imports** always use the `@/` alias (`@/*` → `src/*`), never `../`.

## Rules to apply on every change

**Before writing any component, colour, label, formatter or hook, check FE_Design Appendix D (Phụ lục D) — the full list of shared items with paths.** Full text in FE_Design (top section "Quy tắc viết code TypeScript/TSX", 1.1, 2.4, 7, 12.0, 13.12–13.13). In short:

- **Farm Owner UI is the template** for Admin, Technician, Domain Expert and any later role (frames, radius, `DataTable`, buttons, badges — FE_Design 1.1). Only the Landing Page and `mobile/` are designed separately.
- **Backend enum labels** (alert type/status, device status, role) are declared once in `constants/enumLabels.i18n.ts`; screen dictionaries reuse them with `...prefixLabels('status.', alertStatusDict.vi)` — never retype a label (FE_Design 6.3).
- **Dates**: `formatStandardDate` / `formatHourMinute` / `formatDateTime` in `lib/i18n.ts` (DD/MM/YYYY, HH:mm, Vietnam time).
- **Alert severity is shown in 3 levels** (`SeverityLevel` P1–P3, FE_Design 2.4). Use the shared files (`constants/severity.ts`, `severity.i18n.ts`, `common/SeverityBadge`); never redeclare level colours or labels.
- **No invented data.** No API or no data yet → empty frame. Fake data only when the prompt asks for it, in `src/data/<name>.data.ts`, imported — never inline. Empty values show `_` (`NO_VALUE`, `constants/display.ts`) and empty charts keep their frame (`ui/ChartEmptyFrame`) — FE_Design 6.1, 8.
- One-line comments only (`// <name or feature>`); full names, no abbreviations; ≤ O(n) per render (build `Map`s once); junior-readable logic.
- **Never show internal data**: no `_id`, id-derived codes or raw enums in UI/URL (detail pages take ids via history state); API errors shown as one grouped sentence per group (session/permission · not found · invalid · system/network), never the HTTP code or raw backend message — call `useApiErrorMessage()` (`hooks/common/useApiErrorMessage.ts`) instead of `getApiErrorMessage` (FE_Design 13.16).
- Icons: Phosphor, Lucide or `ui/icons.tsx`, but only the size scale in FE_Design 2.9 and token colours; one library per group. Breakpoints, z-index layers, motion durations, date/number formats, glossary and i18n keys: FE_Design 4.4–4.6, 6.1–6.3. Branch names `<type>/<module>-<role>-<feature>` (13.13).
- **After every prompt that changes code**, re-read the whole flow of the touched role (route `allow` → page → hook → api → backend) against the role map in FE_Design 12.0, then run lint · tsc · vitest and report the real result.

## Plumbing

- `lib/axios.ts` — instance with `withCredentials: true`, `Authorization` from `authStore`; on a 401 with `error.code === 'TOKEN_EXPIRED'` it runs a **single-flight** `POST /auth/refresh` shared by concurrent 401s and retries once, else clears auth and redirects to `/login` (`lib/navigation.ts#redirectToLogin`).
- `lib/socket.ts` — lazy singleton (`autoConnect: false`, lifecycle owned by `hooks/common/useSocket.ts`); `auth` is a callback re-read on every (re)connect; exposes `joinZone`/`leaveZone` and `on*Update`/`onAlertNew` mirroring the backend `emit*()` events.
- `lib/queryClient.ts` — singleton React Query client (`staleTime: 30s`, `retry: 1`) outside the React tree so the axios interceptor can clear it on logout/failed refresh.
- **Two i18n systems run side by side** (FE_Design §6), both following `stores/languageStore.ts` so one VI/EN button switches both:
  - `src/i18n/` — i18next; the key is the Vietnamese sentence (`t('Danh sách trang trại')`), English in `i18n/en.ts`, a missing key falls back to Vietnamese. `t` works outside components because `AppShell` remounts the content on language change; never compute labels with `t` at module top level (frozen at load) — use `translated(...)`, a getter, or build them inside the component. Used by Admin screens and `components/ui/`.
  - `lib/i18n.ts` + `hooks/common/useTranslation.ts` + `constants/*.i18n.ts` — per-module typed dictionaries, used by Farm Owner screens, the Technician farms screen and the app shell.
  - Keep the system a file already uses; a new screen follows its role (Admin → `src/i18n/`, Farm Owner/Technician → dictionaries). Screens with neither stay Vietnamese.
- Dev proxy in `vite.config.ts`; `vite-plugin-pwa` (`registerType: 'autoUpdate'`) caches static assets and does `NetworkFirst` for the `api.swiftletcare.vn` host.
- `types/index.ts` and `backend/src/types/domain.types.ts` keep their **enums** in sync but are not a generated mirror — renaming a field on one side does not change the other.
