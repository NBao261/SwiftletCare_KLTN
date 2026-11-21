import { useLanguageStore } from '@/stores/languageStore'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/hooks/common/useTranslation'
import { shellDict } from '@/constants/shell.i18n'

// Công tắc VI/EN, dưới sm nằm trong menu avatar (SH-05)
export default function LanguageToggle() {
  const { t } = useTranslation(shellDict)
  const lang = useLanguageStore(s => s.lang === 'vi' ? 'VI' : 'EN')
  const setStoreLang = useLanguageStore(s => s.setLang)
  const setLang = (language: 'VI' | 'EN') => setStoreLang(language === 'VI' ? 'vi' : 'en')

  return (
    // Bấm vào bất kỳ đâu trên khung để đổi, nút đen trượt sang ngôn ngữ đang chọn; cao 36px như ô phạm vi (SH-06)
    <button
      type="button"
      role="switch"
      aria-checked={lang === 'EN'}
      aria-label={t('lang.switch')}
      onClick={() => setLang(lang === 'VI' ? 'EN' : 'VI')}
      className="relative flex h-9 w-[76px] shrink-0 items-center rounded-full border border-warmGray/20 bg-white p-1 shadow-icon"
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-charcoal transition-transform duration-300 ease-out',
          lang === 'EN' && 'translate-x-full',
        )}
      />
      {(['VI', 'EN'] as const).map(language => (
        <span
          key={language}
          className={cn('relative flex-1 text-center text-small font-bold transition-colors duration-300', lang === language ? 'text-white' : 'text-warmGray')}
        >
          {language}
        </span>
      ))}
    </button>
  )
}
