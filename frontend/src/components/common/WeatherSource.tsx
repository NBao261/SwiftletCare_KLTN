import { t } from '@/i18n'

// Giấy phép CC BY 4.0 của Open-Meteo: màn nào hiện thời tiết cũng ghi nguồn (Report 4 §3.1)
export default function WeatherSource({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-warmGray ${className}`}>
      {t('Dữ liệu thời tiết:')}{' '}
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline hover:text-charcoal">Open-Meteo.com</a>
    </p>
  )
}
