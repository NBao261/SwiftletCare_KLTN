import { useState } from 'react'
import { Badge, Button, Modal } from '@/components/ui'
import SelectMenu from '@/components/ui/SelectMenu'
import { farmDict } from '@/constants/farmStructure.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useApplyProfile, useApprovedProfiles } from '@/hooks/farm-owner/useApplyProfile'
import { useToastStore } from '@/stores/toastStore'
import type { ConfigProfile, Farm, House } from '@/types'

// Các nhóm hồ sơ có thể chứa; nhóm bỏ trống thì khi áp zone giữ nguyên
const PROFILE_GROUPS = ['thresholds', 'fuzzy_tuning', 'detection_tuning', 'speaker_schedule'] as const

interface ApplyProfileModalProps {
  farm: Farm
  houses: House[]
  onClose: () => void
}

// EXPERT-FR-015 — Farm Owner chọn 1 hồ sơ đã duyệt và các nhà của farm rồi áp
export default function ApplyProfileModal({ farm, houses, onClose }: ApplyProfileModalProps) {
  const { t, num } = useTranslation(farmDict)
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const profiles = useApprovedProfiles(farm._id)
  const apply = useApplyProfile()
  const [profileId, setProfileId] = useState('')
  const [houseIds, setHouseIds] = useState<Set<string>>(new Set())

  const list = profiles.data ?? []
  const profile: ConfigProfile | undefined = list.find(item => item._id === profileId) ?? list[0]
  const isAllSelected = houses.length > 0 && houseIds.size === houses.length

  function toggleHouse(id: string): void {
    setHouseIds(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleApply(): void {
    if (!profile || houseIds.size === 0) return
    apply.mutate({ profileId: profile._id, houseIds: [...houseIds] }, {
      onSuccess: result => {
        push(t('profile.applied', { n: num(result.zones.length) }))
        onClose()
      },
      onError: reason => push(apiErrorMessage(reason, t('profile.applyFailed')), 'error'),
    })
  }

  let body
  if (profiles.isError) body = <p className="text-sm text-warmGray">{t('profile.loadFailed')}</p>
  else if (!profiles.isLoading && list.length === 0) body = <p className="text-sm italic text-warmGray">{t('profile.none')}</p>
  else body = (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="label-caption">{t('profile.pick')}</span>
        <SelectMenu
          field
          ariaLabel={t('profile.pick')}
          value={profile?._id ?? ''}
          onChange={setProfileId}
          disabled={profiles.isLoading}
          options={list.map(item => ({ value: item._id, label: item.name }))}
        />
        {profile && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-warmGray">{t('profile.groups')}:</span>
            {PROFILE_GROUPS.filter(group => profile[group]).map(group => (
              <Badge key={group} tone="neutral">{t(`profile.group.${group}`)}</Badge>
            ))}
            {profile.stage && <span className="text-xs italic text-warmGray">· {t('profile.forStage', { stage: t(`stage.${profile.stage}`) })}</span>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="label-caption">{t('profile.houses')}</span>
          {houses.length > 1 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-graphite">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={() => setHouseIds(isAllSelected ? new Set() : new Set(houses.map(house => house._id)))}
                className="h-4 w-4 rounded accent-charcoal"
              />
              {t('profile.selectAll')}
            </label>
          )}
        </div>
        {houses.length === 0 ? (
          <p className="text-sm italic text-warmGray">{t('profile.noHouse')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-warmGray/10 rounded-2xl border border-warmGray/15">
            {houses.map(house => (
              <li key={house._id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-charcoal hover:bg-warmGray/5">
                  <input type="checkbox" checked={houseIds.has(house._id)} onChange={() => toggleHouse(house._id)} className="h-4 w-4 rounded accent-charcoal" />
                  <span className="min-w-0 flex-1 truncate" title={house.name}>{house.name}</span>
                  <span className="shrink-0 text-xs text-warmGray">{t(`stage.${house.stage ?? 'OCCUPIED'}`)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button className="w-full" loading={apply.isPending} disabled={!profile || houseIds.size === 0} onClick={handleApply}>
        {t('profile.submit', { n: num(houseIds.size) })}
      </Button>
    </>
  )

  return (
    <Modal open onClose={onClose} title={t('profile.applyTitle', { farm: farm.name })}>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        <hr className="border-gray-200" />
        <p className="text-sm text-warmGray">{t('profile.applyIntro')}</p>
        {body}
      </div>
    </Modal>
  )
}
