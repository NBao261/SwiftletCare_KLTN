import { Navigate } from 'react-router-dom';

import AuthBackLink from '@/components/auth/AuthBackLink';
import PrivacyPolicy from '@/components/common/PrivacyPolicy';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';
import { useLanguageStore, type Lang } from '@/stores/languageStore';

// Chính sách quyền riêng tư công khai (trang đăng nhập, URL chính sách khi đưa app mobile lên store).
// Đã đăng nhập thì chuyển sang bản trong khung app (/settings/privacy).
export default function PrivacyPage(): JSX.Element | null {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const hasHydrated = useAuthStore(s => s.hasHydrated);
  const lang = useLanguageStore(s => s.lang);
  const setLang = useLanguageStore(s => s.setLang);

  if (!hasHydrated) return null;
  if (isAuthenticated) return <Navigate to="/settings/privacy" replace />;

  return (
    <div className="min-h-screen bg-[url('/Background_auth.png')] bg-cover bg-fixed bg-center p-4 sm:p-8">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white px-6 py-6 shadow-popover sm:px-10 sm:py-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/Logo_SCare_Icon.png" alt="" className="h-10 w-10 shrink-0 rounded-[10px] object-cover" />
            <img src="/Logo_SCare_Text.png" alt="SwiftletCare" className="h-8 w-auto shrink-0" />
          </div>
          <div className="flex items-center gap-2">
            {/* Trang công khai không có header nên tự đặt nút đổi ngôn ngữ */}
            <div className="flex rounded-full border border-warmGray/20 p-0.5">
              {(['vi', 'en'] as Lang[]).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLang(option)}
                  aria-pressed={lang === option}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-bold transition-colors',
                    lang === option ? 'bg-charcoal text-white' : 'text-warmGray hover:text-charcoal',
                  )}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
            <AuthBackLink label={lang === 'en' ? 'Back to sign in' : undefined} />
          </div>
        </div>
        <PrivacyPolicy />
      </article>
    </div>
  );
}
