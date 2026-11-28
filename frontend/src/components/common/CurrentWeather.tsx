import { CloudFogIcon, CloudIcon, CloudLightningIcon, CloudMoonIcon, CloudRainIcon, CloudSlashIcon, CloudSunIcon, MoonIcon, SunIcon, type Icon } from '@phosphor-icons/react'
import WeatherSource from '@/components/common/WeatherSource'
import { describeWeather, type WeatherIconName, type WeatherTone } from '@/components/common/currentWeather.utils'
import { LoadingSkeleton } from '@/components/ui'
import { useCurrentWeather } from '@/hooks/shared/useCurrentWeather'
import { cn } from '@/lib/cn'
import { formatHourMinute } from '@/lib/i18n'
import { intlLocale, t } from '@/i18n'

const ICON: Record<WeatherIconName, Icon> = {
  sun: SunIcon, moon: MoonIcon, 'partly-cloudy': CloudSunIcon, cloud: CloudIcon, fog: CloudFogIcon, rain: CloudRainIcon,
  storm: CloudLightningIcon, unknown: CloudMoonIcon,
}

// Nắng nền vàng, mưa nền xanh dương, còn lại xám: nhìn màu là biết trời đang thế nào
const TONE_CLASS: Record<WeatherTone, string> = {
  sunny: 'bg-statusYellow/25 text-charcoal',
  rainy: 'bg-infoBlue/10 text-charcoal',
  neutral: 'bg-warmGray/10 text-charcoal',
}

const number = (value: number, digits = 1) => value.toLocaleString(intlLocale(), { maximumFractionDigits: digits })

// Trời đang nắng hay mưa ở ngoài nhà yến, theo toạ độ của farm. Chỉ để xem: không điều khiển thiết bị
interface CurrentWeatherProps {
  houseId?: string
  className?: string
  // Một dòng gọn cho khung đã có số nhiệt độ, độ ẩm bên cạnh (Tổng quan, Phân tích)
  compact?: boolean
  // Bỏ chữ "Ngoài nhà yến" khi khung chứa nó đã ghi rõ là ngoài trời
  showPlace?: boolean
}

export default function CurrentWeather({ houseId, className, compact = false, showPlace = true }: CurrentWeatherProps): JSX.Element | null {
  const { data, isLoading, isError } = useCurrentWeather(houseId)
  if (!houseId) return null
  if (isLoading) return <LoadingSkeleton count={1} className={compact ? 'h-10 w-full rounded-2xl' : 'h-14 w-full rounded-2xl'} />

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
  const WeatherIcon = ICON[icon]
  const rainfall = weather.is_raining && weather.precipitation_mm !== null && weather.precipitation_mm > 0 ? `${t('Mưa')} ${number(weather.precipitation_mm)} mm` : null

  if (compact) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-2xl px-3.5 py-2.5', TONE_CLASS[tone])}>
          <WeatherIcon size={24} weight="duotone" aria-hidden className="shrink-0" />
          <p className="text-body font-semibold">
            {showPlace && `${t('Ngoài nhà yến')}: `}{t(label)}{rainfall && <span className="font-normal text-graphite"> · {rainfall}</span>}
          </p>
          <span className="ml-auto text-small text-warmGray">{t('Cập nhật {{time}}', { time: formatHourMinute(weather.observed_at) })}</span>
        </div>
        <WeatherSource />
      </div>
    )
  }
  const details = [
    weather.temperature_c !== null && `${number(weather.temperature_c)} °C`,
    weather.humidity_pct !== null && `${t('Độ ẩm ngoài trời')} ${number(weather.humidity_pct, 0)} %`,
    rainfall,
  ].filter(Boolean)

  return (
    <div className={cn('flex flex-col gap-1 rounded-2xl px-4 py-3', TONE_CLASS[tone], className)}>
      <div className="flex items-center gap-3">
        <WeatherIcon size={28} weight="duotone" aria-hidden className="shrink-0" />
        <div className="min-w-0">
          <p className="text-body font-semibold">{t('Ngoài nhà yến')}: {t(label)}</p>
          {details.length > 0 && <p className="text-small text-graphite">{details.join(' · ')}</p>}
        </div>
        <span className="ml-auto shrink-0 text-small text-warmGray">{t('Cập nhật {{time}}', { time: formatHourMinute(weather.observed_at) })}</span>
      </div>
      <WeatherSource />
    </div>
  )
}
