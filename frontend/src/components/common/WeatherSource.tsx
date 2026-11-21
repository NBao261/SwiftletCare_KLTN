import { t } from '@/i18n';
import { cn } from '@/lib/cn';

interface WeatherSourceProps {
  className?: string;
}

// Giấy phép CC BY 4.0 của Open-Meteo: màn nào hiện thời tiết cũng ghi nguồn (Report 4 §3.1)
export default function WeatherSource({ className }: WeatherSourceProps): JSX.Element {
  return (
    <p className={cn('text-xs text-warmGray', className)}>
      {t('Dữ liệu thời tiết:')}{' '}
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline hover:text-charcoal">
        Open-Meteo.com
      </a>
    </p>
  );
}
