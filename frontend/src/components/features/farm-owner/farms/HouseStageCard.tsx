import { useState } from 'react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import { farmDict } from '@/constants/farmStructure.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useSetHouseStage } from '@/hooks/shared/useFarms'
import { cn } from '@/lib/cn'
import { useToastStore } from '@/stores/toastStore'
import { NO_VALUE } from '@/constants/display'
import type { House, HouseStage } from '@/types'

const STAGES: HouseStage[] = ['ATTRACTING', 'OCCUPIED']

// giai đoạn nhà: Farm Owner hoặc Domain Expert bấm ô còn lại để chuyển (có xác nhận), người khác chỉ xem
export default function HouseStageCard({ house, canEdit }: { house: House; canEdit: boolean }) {
  const { t, date } = useTranslation(farmDict)
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const setStage = useSetHouseStage(house._id)
  const [target, setTarget] = useState<HouseStage | null>(null)
  // Nhà tạo trước chưa có stage: mặc định OCCUPIED (api-spec House.stage)
  const current = house.stage ?? 'OCCUPIED'
  const history = house.stage_history ?? []
  const lastChange = history[history.length - 1]?.changed_at
  // Mức giảm tỷ lệ chim về do chuyên gia đặt cho cả nhà, chủ nhà yến chỉ xem
  const returnRateDrop = house.bird_count_tuning?.return_rate_drop_pct

  function handleConfirm(): void {
    if (!target) return
    setStage.mutate(target, {
      onSuccess: () => {
        push(t('stage.saved'))
        setTarget(null)
      },
      onError: reason => push(apiErrorMessage(reason, t('stage.saveFailed')), 'error'),
    })
  }

  return (
    <FarmFrame title={t('stage.title')} help={t('stage.desc')}>
      <div role="radiogroup" aria-label={t('stage.title')} className="grid grid-cols-2 gap-2">
        {STAGES.map(stage => {
          const isActive = stage === current
          return (
            <button
              key={stage}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={!canEdit || isActive}
              onClick={() => setTarget(stage)}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                isActive ? 'border-accent-600 bg-accent-50' : 'border-warmGray/15 bg-white',
                canEdit && !isActive && 'hover:border-charcoal/40',
                !canEdit && !isActive && 'opacity-60',
              )}
            >
              <span className="text-sm font-semibold text-charcoal">{t(`stage.${stage}`)}</span>
              <span className="text-xs text-warmGray">{t(`stage.${stage}Hint`)}</span>
            </button>
          )
        })}
      </div>
      {/* mt-auto: dòng cuối nằm sát đáy khi thẻ cao bằng thẻ bên cạnh */}
      <p className="text-xs italic text-warmGray">{lastChange ? t('stage.lastChange', { date: date(lastChange) }) : t('stage.neverChanged')}</p>

      <div className="mt-auto flex items-center justify-between gap-4 border-t border-warmGray/15 pt-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-charcoal">{t('tuning.birdDrop')}</p>
          <p className="text-xs text-warmGray">{t('tuning.birdDropHint')} · {t('tuning.birdBy')}</p>
        </div>
        <p className={cn('shrink-0 text-2xl font-extrabold leading-none tracking-tight', returnRateDrop === undefined ? 'text-warmGray' : 'text-charcoal')}>
          {returnRateDrop === undefined ? NO_VALUE : `${returnRateDrop}%`}
        </p>
      </div>

      <ConfirmModal
        open={!!target}
        title={target ? t('stage.confirmTitle', { stage: t(`stage.${target}`) }) : ''}
        description={target === 'ATTRACTING' ? t('stage.confirmAttracting') : t('stage.confirmOccupied')}
        confirmLabel={t('stage.confirm')}
        loading={setStage.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setTarget(null)}
      />
    </FarmFrame>
  )
}
