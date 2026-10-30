import { ArrowLeftIcon } from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router-dom';

import PrivacyPolicy from '@/components/common/PrivacyPolicy';
import { getRoleHomePath } from '@/constants/roles';
import { useAuthStore } from '@/stores/authStore';
import { useLanguageStore } from '@/stores/languageStore';

// Chính sách quyền riêng tư trong khung app (mở từ menu tài khoản) — mọi role đã đăng nhập
export default function SettingsPrivacyPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useAuthStore(s => s.user?.role);
  const lang = useLanguageStore(s => s.lang);

  // Mở thẳng bằng URL thì không có trang trước để lùi — về trang chính của role
  function goBack(): void {
    if (location.key === 'default') navigate(getRoleHomePath(role));
    else navigate(-1);
  }

  return (
    <article className="rounded-2xl border border-warmGray/15 bg-white p-6 shadow-card sm:p-8">
      <button
        type="button"
        onClick={goBack}
        className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-warmGray/20 px-3 py-1.5 text-xs font-semibold text-warmGray transition-colors hover:border-warmGray/40 hover:text-charcoal"
      >
        <ArrowLeftIcon size={14} weight="bold" />
        {lang === 'en' ? 'Back' : 'Quay lại'}
      </button>
      <PrivacyPolicy />
    </article>
  );
}
