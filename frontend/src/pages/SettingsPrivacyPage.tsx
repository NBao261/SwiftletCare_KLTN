import PrivacyPolicy from '@/components/common/PrivacyPolicy';
import { usePageBack, usePageBreadcrumb } from '@/hooks/common/useBreadcrumb';
import { t } from '@/i18n';
import { useLanguageStore } from '@/stores/languageStore';

// Chính sách quyền riêng tư trong khung app (mở từ Cài đặt hoặc menu tài khoản): mọi role đã đăng nhập
export default function SettingsPrivacyPage(): JSX.Element {
  // Đọc lang để nhãn đổi theo VI/EN ngay khi bấm nút ngôn ngữ
  useLanguageStore(state => state.lang);

  // Quay lại luôn về nhóm Quyền riêng tư của Cài đặt, kể cả khi mở thẳng bằng URL (không lùi theo lịch sử)
  usePageBack('/settings?tab=privacy', t('Cài đặt'));
  usePageBreadcrumb([{ label: t('Chính sách quyền riêng tư') }]);

  return (
    <article className="w-full max-w-3xl rounded-2xl border border-warmGray/15 bg-white p-6 shadow-card sm:p-8">
      <PrivacyPolicy headingLevel="h2" />
    </article>
  );
}
