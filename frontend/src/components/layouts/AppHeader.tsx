import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useLanguageStore } from '@/stores/languageStore'
import { useBreadcrumbStore, type Crumb } from '@/stores/breadcrumbStore'
import { useHeaderSlotStore } from '@/stores/headerSlotStore'
import { useLogoutConfirmStore } from '@/stores/logoutConfirmStore'
import { usePermission } from '@/hooks/common/usePermission'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/hooks/common/useTranslation'
import { shellDict } from '@/constants/shell.i18n'
import { useNavigationLabel } from '@/hooks/common/useNavigationLabel'
import type { MenuSection } from '@/components/layouts/AppSidebar'
import NotificationPopover from '@/components/common/NotificationPopover'
import ProfilePopover from '@/components/common/ProfilePopover'
import { IconLogout } from '@/components/ui/icons'

/** Tên trang + base path theo route hiện tại, tra trong chính menu của role đang đăng nhập. */
function usePageTitle(menuSections: MenuSection[]): { label: string; to: string } {
  const { pathname } = useLocation()
  const navigationLabel = useNavigationLabel()
  const items = menuSections.flatMap(s => s.items)
  const match = items.find(i => pathname === i.path || pathname.startsWith(`${i.path}/`))
  return { label: match ? navigationLabel(match.label) : 'SwiftletCare', to: match?.path ?? pathname }
}

/** Toggle ngôn ngữ hiển thị — ghi vào languageStore; màn nào có từ điển (useTranslation) sẽ đổi theo, màn khác giữ tiếng Việt. */
function LanguageToggle() {
  const { t } = useTranslation(shellDict)
  const lang = useLanguageStore(s => s.lang === 'vi' ? 'VI' : 'EN')
  const setStoreLang = useLanguageStore(s => s.setLang)
  const setLang = (l: 'VI' | 'EN') => setStoreLang(l === 'VI' ? 'vi' : 'en')

  return (
    <div className="group/lang relative">
      {/* Công tắc gạt VI/EN — bấm vào bất kỳ đâu trên khung để đổi, nút đen trượt sang ngôn ngữ đang chọn */}
      <button
        type="button"
        role="switch"
        aria-checked={lang === 'EN'}
        aria-label={t('lang.switch')}
        onClick={() => setLang(lang === 'VI' ? 'EN' : 'VI')}
        className="relative flex h-10 w-[88px] shrink-0 items-center rounded-full border border-warmGray/20 bg-white p-1 shadow-icon"
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-charcoal transition-transform duration-300 ease-out',
            lang === 'EN' && 'translate-x-full',
          )}
        />
        {(['VI', 'EN'] as const).map(l => (
          <span
            key={l}
            className={cn('relative flex-1 text-center text-xs font-bold transition-colors duration-300', lang === l ? 'text-white' : 'text-warmGray')}
          >
            {l}
          </span>
        ))}
      </button>

      {/* Hover preview */}
      <div className="pointer-events-none absolute right-0 z-20 mt-2 w-48 origin-top-right scale-95 rounded-xl glass-panel p-3 opacity-0 transition-all duration-150 group-hover/lang:scale-100 group-hover/lang:opacity-100">
        <p className="label-caption">{t('lang.label')}</p>
        <p className="mt-1 truncate text-sm font-semibold text-charcoal">{t('lang.current')}</p>
      </div>
    </div>
  )
}

/** `elevated` = nội dung đang cuộn bên dưới header → hiện viền mờ để tách header khỏi nội dung */
// isOverHero: header nằm trên ảnh nền đầu trang, chưa cuộn → bỏ lớp kính để ảnh không bị nhòe
export default function AppHeader({ menuSections, elevated = false, isOverHero = false }: { menuSections: MenuSection[]; elevated?: boolean; isOverHero?: boolean }) {
  const user = useAuthStore(s => s.user)
  const askLogout = useLogoutConfirmStore(s => s.ask)
  const setHeaderSlot = useHeaderSlotStore(state => state.setSlot)
  const { t } = useTranslation(shellDict)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const page = usePageTitle(menuSections)
  const registeredTrail = useBreadcrumbStore(s => s.trail)
  const rootState = useBreadcrumbStore(s => s.rootState)
  // Khớp RequireRole của thông báo cảnh báo — cho phép cả Chuyên gia xem thông báo
  const canViewAlerts = usePermission('FARM_OWNER', 'TECHNICIAN', 'ADMIN', 'DOMAIN_EXPERT')

  // Chỉ trang tự đăng ký breadcrumb (VD Ticket/Farms drill-down) mới có cấp con —
  // header không còn ô chọn Zone nên không gắn tên Zone đang lưu vào đây nữa.
  const extraCrumbs: Crumb[] = registeredTrail

  const trail: Crumb[] = [
    { label: page.label, onClick: pathname !== page.to ? () => navigate(page.to, { state: rootState }) : undefined },
    ...extraCrumbs,
  ]

  return (
    // Header không mang backdrop-filter: phần tử có backdrop-filter khiến kính của popup con (thông báo, khung ngôn ngữ)
    // chỉ làm nhòe được nội dung bên trong header, phần popup thò xuống trang thì không nhòe. Kính header vẽ ở lớp nền -z-10.
    <header className="relative isolate flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
      {/* Kính trong (glassmorphism): chỉ phủ 10% trắng + blur, không làm tối nên nội dung cuộn bên dưới hiện thành mảng màu nhòe, không bị xám; khi cuộn thêm viền sáng */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 -z-10 border-b bg-white/10 backdrop-blur-lg backdrop-saturate-150 transition-[border-color,box-shadow,opacity] duration-300',
          elevated ? 'border-white/60 shadow-glass' : 'border-transparent',
          isOverHero && 'opacity-0',
        )}
      />

      {/* Trái: breadcrumb tên trang → thực thể đang xem (desktop) / thương hiệu (mobile, vì sidebar bị ẩn) */}
      <nav aria-label="breadcrumb" className="flex min-w-0 items-baseline gap-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-charcoal text-sm font-extrabold text-white lg:hidden">
          S
        </span>
        {trail.map((crumb, i) => {
          const isRoot = i === 0
          const isLast = i === trail.length - 1
          const clickable = !!crumb.onClick && !isLast
          const textClass = isRoot
            ? 'truncate text-2xl font-extrabold tracking-tight text-charcoal'
            : isLast
              ? 'truncate text-sm font-medium text-warmGray'
              : 'truncate text-sm font-semibold text-charcoal'
          return (
            <span key={i} className="flex min-w-0 items-baseline gap-1.5">
              {!isRoot && <span aria-hidden="true" className="shrink-0 text-lg font-medium text-warmGray/40">/</span>}
              {clickable ? (
                <button onClick={crumb.onClick} className={cn(textClass, 'transition-opacity hover:opacity-70')}>
                  {crumb.label}
                </button>
              ) : (
                <span className={textClass} aria-current={isLast ? 'page' : undefined}>
                  {crumb.label}
                </span>
              )}
            </span>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-3">
        {/* Chỗ trang đặt nút riêng (HeaderActions) — display: contents nên trống thì không chiếm chỗ */}
        <div ref={setHeaderSlot} className="contents" />
        <LanguageToggle />

        {canViewAlerts && <NotificationPopover />}

        {/* Avatar (desktop) — bấm mở popup hồ sơ */}
        <ProfilePopover />

        {/* Mobile: sidebar (chứa nút đăng xuất) bị ẩn nên đưa ra đây */}
        <button
          onClick={askLogout}
          aria-label={t('logout.action')}
          title={user?.full_name ? t('logout.actionUser', { name: user.full_name }) : t('logout.action')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-warmGray/10 disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
        >
          <IconLogout />
        </button>
      </div>
    </header>
  )
}
