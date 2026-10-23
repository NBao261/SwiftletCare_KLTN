import { RobotIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { useHouseAdvice } from '@/hooks/farm-owner/useFarmStructure'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { DeviceRow } from '@/components/features/farm-owner/farms/farmStructure'

/**
 * Khuyến nghị kỹ thuật từ hệ thống AI của nhà. AI chưa triển khai nên hiện là khung trống có sẵn (không bịa nội dung);
 * khi backend có endpoint, `useHouseAdvice` trả dữ liệu là khung tự đầy. Khối camera chỉ dùng mã camera node THẬT của nhà.
 */
export default function AiAdviceCard({ houseId, camera }: { houseId: string; camera?: DeviceRow }) {
  const { t } = useTranslation(farmDict)
  const { data: advice } = useHouseAdvice(houseId)

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-warmGray/15 bg-white p-4 sm:flex-row sm:items-center">
      <div className="flex h-24 w-full shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-warmGray/10 text-warmGray sm:w-40">
        <VideoCameraIcon size={24} />
        <span className="px-2 text-center text-caption">{camera ? camera.deviceId : t('ai.noCamera')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-h3 text-charcoal">{t('ai.title')}</h3>
          {advice?.tag && <span className="rounded-full bg-accent-600 px-2 py-0.5 text-caption text-charcoal">{advice.tag}</span>}
        </div>
        {advice ? (
          <p className="mt-1 text-small text-graphite">{advice.body}</p>
        ) : (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-warmGray/30 px-3 py-3 text-small text-warmGray">
            <RobotIcon size={18} className="shrink-0" />
            {t('ai.empty')}
          </div>
        )}
      </div>
    </div>
  )
}
