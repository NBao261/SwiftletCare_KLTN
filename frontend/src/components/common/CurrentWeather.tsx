import { CloudFogIcon, CloudIcon, CloudLightningIcon, CloudMoonIcon, CloudRainIcon, CloudSlashIcon, CloudSunIcon, MoonIcon, SunIcon, type Icon } from '@phosphor-icons/react'
import { describeWeather, formatWeatherNumber, rainfallText, type WeatherIconName, type WeatherTone } from '@/components/common/currentWeather.utils'
import { LoadingSkeleton } from '@/components/ui'
import { useCurrentWeather } from '@/hooks/shared/useCurrentWeather'
import { cn } from '@/lib/cn'
import { formatHourMinute } from '@/lib/i18n'
import { t } from '@/i18n'

export const WEATHER_ICON: Record<WeatherIconName, Icon> = {
  sun: SunIcon, moon: MoonIcon, 'partly-cloudy': CloudSunIcon, cloud: CloudIcon, fog: CloudFogIcon, rain: CloudRainIcon,
  storm: CloudLightningIcon, unknown: CloudMoonIcon,
}

// Nắng nền vàng, mưa nền xanh dương, còn lại xám: nhìn màu là biết trời đang thế nào
export const WEATHER_TONE_CLASS: Record<WeatherTone, string> = {
  sunny: 'bg-statusYellow/25 text-charcoal',
  rainy: 'bg-infoBlue/10 text-charcoal',
  neutral: 'bg-warmGray/10 text-charcoal',
}

// Giờ cập nhật và nguồn dữ liệu trên một dòng: giấy phép CC BY 4.0 của Open-Meteo bắt ghi nguồn ở mọi màn hiện thời tiết
export function WeatherCredit({ observedAt, className }: { observedAt?: string; className?: string }): JSX.Element {
  return (
    <span className={cn('text-small text-warmGray', className)}>
      {observedAt && <>{t('Cập nhật {{time}}', { time: formatHourMinute(observedAt) })} · </>}
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline hover:text-charcoal">Open-Meteo.com</a>
    </span>
  )
}

// Icon của tình trạng trời
export function WeatherGlyph({ icon, size = 28 }: { icon: WeatherIconName; size?: number }): JSX.Element {
  const WeatherIcon = WEATHER_ICON[icon]
  return <WeatherIcon size={size} weight="duotone" aria-hidden className="shrink-0" />
}

interface CurrentWeatherProps {
  houseId?: string
  className?: string
  // Một dòng gọn cho nơi đã có biểu đồ hoặc số đo bên cạnh (Phân tích)
  compact?: boolean
}

// Trời đang nắng hay mưa ở ngoài nhà yến, theo toạ độ của farm. Chỉ để xem: không điều khiển thiết bị
export default function CurrentWeather({ houseId, className, compact = false }: CurrentWeatherProps): JSX.Element | null {
  const { data, isLoading, isError } = useCurrentWeather(houseId)
  if (!houseId) return null
  if (isLoading) return <LoadingSkeleton count={1} className={compact ? 'h-10 w-full rounded-2xl' : 'h-16 w-full rounded-2xl'} />

  const weather = data?.weather
  if (isError || !weather) {
    const message = data?.reason === 'NO_COORDINATES'
      ? t('Trang trại chưa có toạ độ nên chưa biết trời đang nắng hay mưa.')
      : t('Chưa lấy được thời tiết ngoài trời. Thử lại sau ít phút.')
    return (
      <div className={cn('flex items-center gap-2.5 rounded-2xl bg-warmGray/10 px-4 py-3 text-sm text-graphite', className)}>
        <CloudSlashIcon size={20} aria-hidden className="shrink-0 text-warmGray" />
        {message}
      </div>
    )
  }

  const { label, icon, tone } = describeWeather(weather)
  const rainfall = rainfallText(weather)

  if (compact) {
    return (
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-2xl px-4 py-2.5', WEATHER_TONE_CLASS[tone], className)}>
        <WeatherGlyph icon={icon} size={24} />
        <p className="text-body font-semibold">
          {t(label)}{rainfall && <span className="font-normal text-graphite"> · {rainfall}</span>}
        </p>
        <WeatherCredit observedAt={weather.observed_at} className="ml-auto" />
      </div>
    )
  }

  const details = [
    weather.temperature_c !== null && `${formatWeatherNumber(weather.temperature_c)} °C`,
    weather.humidity_pct !== null && `${t('Độ ẩm ngoài trời')} ${formatWeatherNumber(weather.humidity_pct, 0)} %`,
    rainfall,
  ].filter(Boolean)

  return (
    <div className={cn('flex flex-col gap-2 rounded-2xl px-4 py-3', WEATHER_TONE_CLASS[tone], className)}>
      <div className="flex items-center gap-3">
        <WeatherGlyph icon={icon} />
        <div className="min-w-0">
          <p className="text-body font-semibold">{t('Ngoài nhà yến')}: {t(label)}</p>
          {details.length > 0 && <p className="text-small text-graphite">{details.join(' · ')}</p>}
        </div>
      </div>
      <WeatherCredit observedAt={weather.observed_at} />
    </div>
  )
}
