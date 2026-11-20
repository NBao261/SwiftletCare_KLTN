# frontend/CLAUDE.md

Map of `frontend/` (React 18 + Vite + TailwindCSS dashboard/PWA) **as the code is today**. The rules — design tokens, components, i18n, mock data, folder placement, file naming, code rules tagged **[Bắt buộc]**/**[Nên]**, known debt and the PR checklist — live in **`frontend/FE_Design_Claude.md`**, which is the first rule source for this module and describes the **target** structure. What the product must do is Report 3 (`docs/reports/report3-srs.md`; roles and permissions §2.4) and Report 4 (`docs/reports/report4-sdd.md` §5.4). When this file and FE_Design disagree, FE_Design wins for rules and target; this file wins for "what exists now".

## Scope today — read this first

The web follows Report 3 (final scope) for all four roles; open gaps are rows of `docs/reports/project-tracking.md` §6, the last audits `docs/reports/todo-audit-1118.md` (G-28) and `todo-audit-1119.md` (G-29).

- Roles are `ADMIN | FARM_OWNER | FARM_TECHNICIAN | DOMAIN_EXPERT` (`types/common.types.ts`), same as the backend. The Farm Technician acts on its assigned houses only; on the web it lands on their alerts (`/alerts`) and has the devices of those houses with restart and a read-only lullaby track list (`TechnicianDevicesPage`, technician only), their alerts with acknowledgement and on-site cause, the houses with its own shifts, the inbox and settings (Report 4 §5.4) — the rest of its work is on mobile.
- **Domain Expert** decision pages live under `/domain-expert/*` (`routes/domain-expert.routes.tsx`, `DomainExpertLayout`, pages in `pages/domain-expert/`, components in `components/features/domain-expert/`, hooks in `hooks/domain-expert/`, calls in `apis/domain-expert/` plus the older `services/expert/` — known debt, FE_Design §12). They open to a Farm Owner too (BR-22, Report 3 4.2.15, `hooks/domain-expert/expertDecisionRights.ts`): on a farm with an expert the Farm Owner changes parameters (the expert reviews them), sends weather rules, profile drafts and recommendation rules for approval, and reminds the expert of verdicts and conclusions; on a farm without one it decides, except approving profiles and writing conclusions. The work queue and Reports & conclusions stay the expert's; the Farm Owner reads reports on `/health`.
- Moving, replacing and removing a controller (FARM-FR-007b, 008) is the Farm Owner's, from "More actions" on the device card of `/devices/detail` (`canManageController`).
- Device setup (SF-01) is the Farm Owner's: `/devices/onboarding` takes the label's QR text pasted or the device ID and key typed, and shows the three setup steps (FARM-FR-012); QR scanning is mobile only. The Administrator's stock screen prints labels, the zone screen prints floor codes.
- Out of scope (Report 3 §8), **only remove, never extend**: marketplace, tickets, SLA, Technician regions, Admin farm pages, Zalo/SMS, heating relay.

## Commands

```bash
npm run dev      # http://localhost:5173 — Vite proxies /api -> backend :3000 (prefix stripped) and /socket.io (ws: true)
npm run build    # tsc && vite build
npm run lint     # eslint src e2e playwright.config.ts --ext ts,tsx
npm test         # vitest (CI runs `npx vitest run`)
npx tsc --noEmit
npx tsc -p tsconfig.e2e.json   # e2e/ and playwright.config.ts (outside src/)
npm run test:e2e # Playwright, e2e/*.spec.ts — needs the backend on :3000 with `npm run seed` and `npm run seed:demo` (e2e/ds-*.spec.ts, one file per demo workflow); starts the dev server itself
```

CI (`.github/workflows/ci.yml`, job Frontend) runs `npm ci`, `lint`, `tsc --noEmit`, `tsc -p tsconfig.e2e.json`, `vitest run` and `build` on every PR that touches `frontend/`; job E2E runs `npx playwright test` against a seeded backend when `frontend/` or `backend/` changes and keeps `e2e-junit.xml` for Report 5.

## Structure today

```
src/
  apis/        admin/ auth/ domain-expert/ farm-owner/ shared/ — one <resource>.api.ts per resource, no barrel (no mock API: a part with no endpoint is not shown)
  components/  auth/ (RequireRole) · common/ · features/<role>/<area>/ · layouts/ · ui/ (design system)
  constants/   roles (role groups, ROLE_HOME, MENU_ACCESS, getRoleHomePath/canAccessPath) · thresholds · severity · auditActions · *.i18n.ts dictionaries
  data/        does not exist today; <name>.data.ts there is the ONLY place fake data may live (FE_Design §7)
  hooks/       admin/ auth/ common/ domain-expert/ farm-owner/ shared/ — React Query wrappers over apis/ (some domain-expert/ hooks wrap services/expert/)
  i18n/        index.ts (t · tr · trChildren · translated · intlLocale · setLang) · en.ts · en.expert.ts (expert screens; en.ts wins on a shared key) — i18next, keys are the Vietnamese sentences
  lib/         axios · queryClient · socket · cn · helpers · i18n · navigation · navigationState (intent passed through router state) · chartTheme · apiError
  pages/       admin/ auth/ domain-expert/ farm-owner/ technician/ + root pages (SettingsPage, SettingsPrivacyPage, PrivacyPage, ForbiddenPage) — ONLY *Page.tsx
  providers/   AppProviders.tsx
  routes/      admin · domain-expert · farm-owner · technician · public (.routes.tsx)
  services/    expert/ (expertApi.service.ts, expertDomain.service.ts) + expert.service.ts — older API calls of the Domain Expert screens outside apis/ (known debt, FE_Design §12; no mock fallback)
  stores/      Zustand: authStore · toastStore · zoneStore · breadcrumbStore · headerSlotStore · languageStore · loginSplashStore · pinnedHouseStore
  types/       <module>.types.ts (split by backend module, not by role) + types/expert/ + index.ts barrel
  validations/ admin/ · common/ · farm-owner/ — pure form validators (+ *.test.ts)
```

- **Buckets by role.** Every concern folder splits into `admin/`, `domain-expert/`, `farm-owner/`, `technician/`, `auth/`, `shared/` and `common/` (role-agnostic infrastructure). A file is in `shared/` only when two or more roles really reach it; `apis/shared/` + `hooks/shared/` hold farms, alerts, devices and audio tracks (audio tracks: only the Farm Owner uploads, marks, deletes, selects and plays them in `farm-owner/devices/LullabyTracksModal`; the other roles read the list). There is no `components/features/shared/`.
- **Pages** sit in the folder of the role that owns that business and carry the role in their name (`TechnicianDevicesPage`, `FarmOwnerHarvestPage`, `AdminUsersPage`); the exported component name matches the filename. A page's folder is **not** an access list: `allow={...}` in `routes/<role>.routes.tsx` is.
- **Routes**: one `routes/<role>.routes.tsx` per `pages/<role>/` folder, each exporting a `<Route>` fragment (`publicRoutes`, `adminRoutes`, `domainExpertRoutes` under `/domain-expert/*`, `farmOwnerRoutes`, `technicianRoutes` — the shared `/devices` and `/alerts`, which pick a page per role), lazy-loading its pages and wrapping them in `<RequireRole allow={...}>`. `App.tsx` assembles them plus the index redirect and `/settings`; `RoleLayout` picks the layout from `user.role` at runtime because URLs carry no role prefix.
- **Role groups** (`constants/roles.ts`, one per permission of Report 3 §2.4): `FARM_SIDE_ROLES` (Farm Owner, Domain Expert: dashboard, analytics, vision, health, Work Orders, maintenance, recommendations, harvests), `FARM_OWNER_ONLY` (relay control), `FARM_STRUCTURE_ROLES` (+ Farm Technician: farms), `DEVICE_LIST_ROLES` (+ Admin: `/devices`), `ALERT_ROLES` (Admin, Farm Owner, Farm Technician), `DEVICE_SETUP_ROLES`, `EXPERT_ROLES`, `EXPERT_DECISION_ROLES`, `ADMIN_ONLY`. `MENU_ACCESS` (path → roles) mirrors the layout menus and backs `canAccessPath`, checked by `roles.test.ts`; it is kept apart from the layouts on purpose (`useAuth` → `canAccessPath`, layouts → `AppHeader` → `useAuth` would be an import cycle). `hooks/common/usePermission.ts` does the UI-level hide/disable check.
- **Layouts** (`components/layouts/`): one per role — `AdminLayout`, `FarmOwnerLayout`, `TechnicianLayout`, `DomainExpertLayout` — each writing its whole menu literally at the top, plus `AppShell` (sidebar + header + `Outlet` + `Toast`, mounts the global `useAlertNotifications` listener), `AppSidebar` (same menu as desktop rail and mobile dock: the first 4 items; a section with `collapsible` folds), `AppHeader` (page name as `h1`, the `HeaderActions` slot that wraps to its own row below `xl`, VI/EN, bell, avatar menu — the only place for Settings, Privacy and Log out). No "Khác" group: `/settings` opens from the avatar menu. A menu item with `tabs` groups several routes: the sidebar shows one entry, `common/SectionTabs` draws the tab row above the page (Admin: Người dùng = `/users` + `/account-requests`). Adding a menu item = edit that role's layout, add a `MENU_ACCESS` row **and** its label in `constants/navigation.i18n.ts` (a label missing there stays Vietnamese in English).
- **Component tiers**: no domain knowledge → `components/ui/` (self-contained design system, only imports `@/lib/cn` and `@/i18n`; `ui/index.ts` is the only barrel in `src/`, `icons.tsx` left out; nothing inside `ui/` imports the barrel). Knows the domain, one feature → `components/features/<role>/<area>/`. Knows the domain, two or more features → `components/common/` (kept small: `ScopeFilter` (farm → house → zone filter of the Farm Owner pages and the Technician devices page; its hook is `hooks/shared/useScopeFilter`, which picks a farm / house / zone itself on a page listed in `scopeLevelOf`, `constants/roles.ts`), `KpiTile` (KPI tile of every role), `LanguageToggle`, `SectionTabs`, `SeverityBadge`, `TableEmptyState`, `NotificationPopover`, `ProfilePopover`, `Toast`, `StatusDot`; the health pieces the Farm Owner `/health` page and the Domain Expert reports page both use: `HealthStatusBadge`, `HealthLevelsModal`, `HealthReportSection`, `HealthReportCreateModal`, `DisagreementsSection`, `DisagreementDayCard` with `healthDay.utils`, `healthReport.utils`, `healthReportPdf`).
- **Imports** always use the `@/` alias (`@/*` → `src/*`), never `../`.

## Rules to apply on every change

**Before writing any component, colour, label, formatter or hook, check FE_Design Appendix D (Phụ lục D) — the full list of shared items with paths.** Full text in FE_Design (top section "Quy tắc viết code TypeScript/TSX", 1.1, 2.4, 7, 12.0, 13.12–13.13). In short:

- **Thresholds and fuzzy coefficients are edited only on `/domain-expert/tuning`** (todo-audit-1119 §9, S-02): the zone, device and analytics pages open it on their zone with `useOpenZoneTuning()` (`hooks/shared/`).
- **Domain Expert screens (decided 27/10/2026, FE_Design §12.0 c rows 1–3):** the expert reads the Farm Owner's operational pages (`/dashboard`, `/analytics`, `/vision`, `/devices`, `/harvests`, …) in read-only mode through `FARM_SIDE_ROLES` — no expert copy of those pages; `/domain-expert/*` keeps only the expert's decisions (work queue home, alert verdicts, detection parameters with ring and schedule, thresholds and coefficients, reviews, weather rules, profiles, recommendation rules, reports and conclusions, decision history), and those decision pages also open to a Farm Owner, who edits parameters with an expert review, sends proposals and reminds the expert (BR-22, Report 3 §2.4).
- **Farm Owner UI is the template** for Admin, Technician, Domain Expert and any later role (frames, radius, `DataTable`, buttons, badges — FE_Design 1.1). Only the Landing Page and `mobile/` are designed separately.
- **Vietnamese on screen follows FE_Design §6.2 (glossary: Chủ nhà yến, Kỹ thuật viên, Zone, Bộ điều khiển, Camera đếm chim, Mất kết nối, Kiểm chứng cảnh báo…) and §6.4 (how to write: khoẻ/xoá/huỷ spelling, "tỷ lệ", short sentences, no " — " joins, no "Vui lòng", no technical names).** `src/i18n/wording.test.ts` fails CI on a banned variant; renaming a Hệ 1 sentence renames its `en.ts` key too.
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
- `lib/socket.ts` — lazy singleton (`autoConnect: false`, lifecycle owned by `hooks/common/useSocket.ts`); `auth` is a callback re-read on every (re)connect; exposes `joinZone`/`leaveZone`, `joinHouse`/`leaveHouse` (room `house:<id>`: camera status, bird counts and house alerts; both re-joined on reconnect) and `on*Update`/`onAlertNew` mirroring the backend `emit*()` events.
- `lib/queryClient.ts` — singleton React Query client (`staleTime: 30s`, `retry: 1`) outside the React tree so the axios interceptor can clear it on logout/failed refresh.
- **Two i18n systems run side by side** (FE_Design §6), both following `stores/languageStore.ts` so one VI/EN button switches both:
  - `src/i18n/` — i18next; the key is the Vietnamese sentence (`t('Danh sách trang trại')`), English in `i18n/en.ts`, a missing key falls back to Vietnamese. `t` works outside components because `AppShell` remounts the content on language change; never compute labels with `t` at module top level (frozen at load) — use `translated(...)`, a getter, or build them inside the component. Used by Admin screens, the Domain Expert screens (`/domain-expert/*`, English in `i18n/en.expert.ts`) and `components/ui/`.
  - `lib/i18n.ts` + `hooks/common/useTranslation.ts` + `constants/*.i18n.ts` — per-module typed dictionaries, used by Farm Owner screens, the Technician farms screen and the app shell.
  - Keep the system a file already uses; a new screen follows its role (Admin, Domain Expert → `src/i18n/`, Farm Owner/Technician → dictionaries). Screens with neither stay Vietnamese.
- Dev proxy in `vite.config.ts`; `vite-plugin-pwa` (`registerType: 'autoUpdate'`) caches static assets and does `NetworkFirst` for the `api.swiftletcare.vn` host.
- `types/index.ts` and `backend/src/types/domain.types.ts` keep their **enums** in sync but are not a generated mirror — renaming a field on one side does not change the other.
