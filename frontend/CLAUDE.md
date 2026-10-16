# frontend/CLAUDE.md

Map of `frontend/` (React 18 + Vite + TailwindCSS dashboard/PWA) **as the code is today**. The rules — design tokens, components, i18n, mock data, folder placement, file naming, code rules tagged **[Bắt buộc]**/**[Nên]**, known debt and the PR checklist — live in **`frontend/FE_Design_Claude.md`**, which is the first rule source for this module and describes the **target** structure under SRS v2.0.0. When this file and FE_Design disagree, FE_Design wins for rules and target; this file wins for "what exists now".

## Scope gap — read this first

The frontend still follows the SRS v1.24.0 scope while the backend already follows v2.0.0:

- Roles in the code are `ADMIN | FARM_OWNER | TECHNICIAN | SALES_STAFF` (`types/common.types.ts`). There is **no** Farm Operator and **no** `DOMAIN_EXPERT` code yet; the backend role is `DOMAIN_EXPERT`.
- `sales-staff/` code (`pages/sales-staff/SalesStaffHomePage.tsx`, `routes/sales-staff.routes.tsx`, `SalesStaffLayout`), the marketplace screens (`MarketplacePage`, `ListingDetailPage`, `useMarketplace`, `marketplace.api`, listing panels under `features/farm-owner/harvest/`), the heating relay toggle and `BIRD_PANIC` labels are still in the code, although the backend no longer serves them.
- These are FE_Design §13.14 known debt: **only remove or replace them** (SRS §0.5 Web), never extend them. New role work follows FE_Design §12 (bucket `domain-expert/`, `DomainExpertLayout`, role groups in §12.8).

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
  constants/   roles (role groups, ROLE_HOME, MENU_ACCESS, getRoleHomePath/canAccessPath) · thresholds · tickets · sla · auditActions · *.i18n.ts dictionaries
  hooks/       admin/ auth/ common/ farm-owner/ shared/ — React Query wrappers over apis/
  i18n/        index.ts (t · tr · trChildren · translated · intlLocale · setLang) · en.ts — i18next, keys are the Vietnamese sentences
  lib/         axios · queryClient · socket · cn · helpers · i18n · navigation · chartTheme
  pages/       admin/ auth/ farm-owner/ sales-staff/ technician/ + 4 root pages (SettingsPage, MarketplacePage, ListingDetailPage, ForbiddenPage) — ONLY *Page.tsx
  providers/   AppProviders.tsx
  routes/      admin · farm-owner · technician · sales-staff · public (.routes.tsx)
  stores/      Zustand: authStore · alertStore · toastStore · zoneStore · breadcrumbStore · languageStore · pinnedHouseStore
  types/       <module>.types.ts (split by backend module, not by role) + index.ts barrel
  validations/ admin/ · common/ · technician/ — pure form validators (+ *.test.ts)
```

- **Buckets by role.** Every concern folder splits into `admin/`, `farm-owner/`, `technician/`, `sales-staff/` (legacy), `auth/`, `shared/` and `common/` (role-agnostic infrastructure). A file is in `shared/` only when two or more roles really reach it; `apis/shared/` + `hooks/shared/` hold farms, alerts, devices, tickets, maintenance schedules and audio tracks (`audioTracks` is Technician-only — known debt). There is no `components/features/shared/`.
- **Pages** sit in the folder of the role that owns that business and carry the role in their name (`TechnicianDevicesPage`, `FarmOwnerHarvestPage`, `AdminUsersPage`); the exported component name matches the filename. A page's folder is **not** an access list: `allow={...}` in `routes/<role>.routes.tsx` is.
- **Routes**: one `routes/<role>.routes.tsx` per `pages/<role>/` folder, each exporting a `<Route>` fragment (`publicRoutes`, `adminRoutes`, `farmOwnerRoutes`, `technicianRoutes`, `salesStaffRoutes`), lazy-loading its pages and wrapping them in `<RequireRole allow={...}>`. `App.tsx` assembles them plus the index redirect and `/settings`; `RoleLayout` picks the layout from `user.role` at runtime because URLs carry no role prefix.
- **Role groups** (`constants/roles.ts`): `OPS_ROLES` (Farm Owner, Technician, Admin), `FARM_OWNER_ONLY` (dashboard, analytics, vision, harvests), `HARVEST_ROLES` (Farm Owner, Admin), `ADMIN_ONLY`. `MENU_ACCESS` (path → roles) mirrors the layout menus and backs `canAccessPath`; it is kept apart from the layouts on purpose (`useAuth` → `canAccessPath`, layouts → `AppHeader` → `useAuth` would be an import cycle). `hooks/common/usePermission.ts` does the UI-level hide/disable check.
- **Layouts** (`components/layouts/`): one per role — `AdminLayout`, `FarmOwnerLayout`, `TechnicianLayout`, `SalesStaffLayout` (legacy) — each writing its whole menu literally at the top, plus `AppShell` (sidebar + header + `Outlet` + `Toast`, mounts the global `useAlertNotifications` listener), `AppSidebar` (same menu as desktop rail and mobile dock), `AppHeader`. Adding a menu item = edit that role's layout **and** add a `MENU_ACCESS` row.
- **Component tiers**: no domain knowledge → `components/ui/` (self-contained design system, only imports `@/lib/cn` and `@/i18n`; `ui/index.ts` is the only barrel in `src/`, `icons.tsx` left out; nothing inside `ui/` imports the barrel). Knows the domain, one feature → `components/features/<role>/<area>/`. Knows the domain, two or more features → `components/common/` (kept small: `ZoneSwitcher`, `ZonePicker`, `NotificationPopover`, `Toast`, `StatusDot`, `DateTimePicker`).
- **Placement exception**: `components/features/admin/tickets/AdminOverrideModals.tsx` is imported by a Technician page but stays under `admin/` — it is Admin-only UI gated by `usePermission('ADMIN')`.
- **Imports** always use the `@/` alias (`@/*` → `src/*`), never `../`.

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
