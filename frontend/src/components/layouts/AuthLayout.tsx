import { Suspense, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import AuthBackLink from '@/components/auth/AuthBackLink';
import { IconHumidity, IconSound, IconTemp } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { AUTH_LOGO_ICON_ID, AUTH_LOGO_TEXT_ID } from '@/stores/loginSplashStore';

// Ảnh nền màn xác thực, dùng cho cả nền trang lẫn khung ảnh
const AUTH_BACKGROUND_CLASS = "bg-[url('/Background_auth.png')] bg-cover bg-center";
// Mỗi nửa khung trắng: rộng nửa khung trừ lề 12px hai bên và khe 12px ở giữa
const HALF_PANE_CLASS = 'lg:absolute lg:inset-y-3 lg:w-[calc(50%-1.125rem)]';
// Hiệu ứng trượt giữa 2 nửa khung (quãng trượt = rộng 1 nửa + khe 12px)
const SLIDE_TRANSITION_CLASS = 'transition-transform duration-300 ease-in-out motion-reduce:transition-none';

// Khung chung của Đăng nhập / Đăng ký / Quên mật khẩu: đăng nhập thì form trái, ảnh phải; trang khác thì ảnh trượt sang trái, form sang phải
export default function AuthLayout(): JSX.Element {
  const { pathname } = useLocation();
  const isLogin = pathname === '/login';

  return (
    <div className={cn('flex min-h-screen items-center justify-center p-4 sm:p-8 lg:p-12', AUTH_BACKGROUND_CLASS)}>
      <div className="relative w-full max-w-6xl rounded-3xl bg-white p-3 shadow-popover lg:h-[680px]">
        {/* Nửa form: logo + nội dung trang con */}
        <div
          className={cn(
            'flex flex-col overflow-y-auto px-4 pb-6 pt-4 sm:px-6 lg:left-3',
            HALF_PANE_CLASS,
            SLIDE_TRANSITION_CLASS,
            !isLogin && 'lg:translate-x-[calc(100%+0.75rem)]',
          )}
        >
          {/* Hàng đầu: logo bên trái (cùng ảnh, cỡ với sidebar), nút quay lại đăng nhập bên phải khi ở trang khác */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <img id={AUTH_LOGO_ICON_ID} src="/Logo_SCare_Icon.png" alt="" className="h-10 w-10 shrink-0 rounded-[10px] object-cover" />
              <img id={AUTH_LOGO_TEXT_ID} src="/Logo_SCare_Text.png" alt="SwiftletCare" className="h-8 w-auto shrink-0" />
            </div>
            {!isLogin && <AuthBackLink />}
          </div>

          <div key={pathname} className="mx-auto flex w-full max-w-sm flex-1 animate-fade-in flex-col justify-center py-4">
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </div>

        {/* Nửa ảnh — ẩn trên mobile để form chiếm trọn khung */}
        <div
          className={cn(
            'hidden overflow-hidden rounded-2xl lg:right-3 lg:flex',
            HALF_PANE_CLASS,
            AUTH_BACKGROUND_CLASS,
            SLIDE_TRANSITION_CLASS,
            !isLogin && 'lg:-translate-x-[calc(100%+0.75rem)]',
          )}
        >
          {/* Lớp tối dần từ trên xuống để chữ trắng đọc rõ trên nền trời sáng */}
          <span className="absolute inset-0 bg-gradient-to-b from-charcoal/70 via-charcoal/20 to-transparent" aria-hidden />

          <div className="relative flex w-full flex-col items-center justify-between px-10 py-12 text-center">
            <div className="max-w-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">Hệ thống giám sát nhà yến</p>
              <p className="mt-3 text-3xl font-bold leading-tight tracking-tight text-white">
                Vi khí hậu ổn định,
                <br />
                đàn yến ở lại.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                Theo dõi nhiệt độ, độ ẩm, khí NH3/CO2 và âm thanh theo thời gian thực; hệ thống tự điều khiển phun
                sương, thông gió và loa ru ngay cả khi mất kết nối Internet.
              </p>
            </div>

            {/* Thẻ kính mờ chứa 3 chỉ số */}
            <div className="glass-panel grid w-full max-w-md grid-cols-3 gap-3 rounded-2xl p-3 shadow-glass backdrop-blur-xl">
              <StatChip icon={<IconTemp width={16} height={16} />} label="Nhiệt độ" value="26–31" unit="°C" />
              <StatChip icon={<IconHumidity width={16} height={16} />} label="Độ ẩm" value="75–95" unit="%" />
              <StatChip icon={<IconSound width={16} height={16} />} label="Âm thanh" value="24/7" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatChipProps {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
}

// Ô chỉ số trong thẻ kính mờ: icon + tên chỉ số ở trên, giá trị kèm đơn vị cùng dòng ở dưới
function StatChip({ icon, label, value, unit }: StatChipProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-white/80 p-3 text-left">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-limeMist text-charcoal">
          {icon}
        </span>
        <span className="truncate text-xs font-medium text-graphite">{label}</span>
      </div>
      <p className="flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-xl font-extrabold leading-none tabular-nums text-charcoal">{value}</span>
        {unit && <span className="text-sm font-semibold text-warmGray">{unit}</span>}
      </p>
    </div>
  );
}
