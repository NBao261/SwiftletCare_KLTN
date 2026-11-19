// EXPERT-FR-020 — Ngăn kéo kết luận mùa vụ của Chuyên gia (Farm Owner không viết, kể cả khi farm chưa có chuyên gia — BR-22)
import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'
import { Drawer } from '@/components/ui/Drawer'
import { cn } from '@/lib/cn'
import type { HarvestCycle } from '@/types/harvest.types'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useSubmitCycleConclusion } from '@/hooks/domain-expert/useHarvestCycles'
import { harvestCyclesDict } from '@/constants/harvestCycles.i18n'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'

interface Props {
  cycle: HarvestCycle | null
  onClose: () => void
}

function ChangeChip({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-warmGray text-xs">—</span>
  const isPositive = pct >= 0
  return (
    <span className={cn('text-xs font-semibold', isPositive ? 'text-success' : 'text-alertRed')}>
      {isPositive ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-warmGray/10 last:border-0">
      <span className="text-xs text-warmGray">{label}</span>
      <span className="text-xs font-semibold text-charcoal">{value}</span>
    </div>
  )
}

const MAX_LEN = 2000

export default function CycleConclusionDrawer({ cycle, onClose }: Props) {
  const { t, date: formatDate, dateTime: formatDT } = useTranslation(harvestCyclesDict)
  const apiErrorMessage = useApiErrorMessage()
  const mutation = useSubmitCycleConclusion()

  const [text, setText] = useState('')
  const [recs, setRecs] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isOpen = cycle !== null
  const isCycleOpen = cycle?.status === 'OPEN'
  // D-04 — chỉ Domain Expert viết kết luận mùa vụ, kể cả khi farm chưa có chuyên gia (BR-22)
  const { isExpert } = useExpertDecisionRights()
  const canWrite = !isCycleOpen && isExpert

  // Điền lại form khi mở drawer với chu kỳ mới
  useEffect(() => {
    if (cycle) {
      setText(cycle.conclusion?.text ?? '')
      setRecs(cycle.conclusion?.recommendations ?? '')
      setErrorMsg(null)
    }
  }, [cycle])

  const handleSave = async () => {
    if (!cycle || !text.trim()) return
    setErrorMsg(null)
    try {
      await mutation.mutateAsync({
        id: cycle._id,
        input: { text: text.trim(), recommendations: recs.trim() || undefined },
      })
      onClose()
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, t('drawer.saveError')))
    }
  }

  const kg = (grams: number) => (grams / 1000).toFixed(2)

  const closing = cycle?.closing_harvest
  const comp = cycle?.comparison
  const health = cycle?.health

  const fromLabel = cycle ? formatDate(cycle.start_date) : ''
  const toLabel = cycle?.end_date ? formatDate(cycle.end_date) : null

  const drawerTitle = cycle?.conclusion ? t('drawer.titleEdit') : t('drawer.title')
  const subtitleText = toLabel
    ? t('drawer.subtitle', { from: fromLabel, to: toLabel })
    : t('drawer.subtitleOpen', { from: fromLabel })

  return (
    <Drawer open={isOpen} onClose={onClose} title={drawerTitle}>
        {/* Drawer không tự cuộn — vùng cuộn đặt ở đây, nút lưu ở dưới cùng */}
        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 pb-4 space-y-4">
          <p className="text-xs text-warmGray">{subtitleText}</p>

          {/* Cảnh báo chu kỳ chưa đóng */}
          {isCycleOpen && (
            <div className="flex items-center gap-2 rounded-xl bg-statusYellow/10 border border-statusYellow/30 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-statusYellow shrink-0" />
              <p className="text-xs text-charcoal">{t('drawer.openWarning')}</p>
            </div>
          )}

          {/* Thông tin sản lượng */}
          <div className="rounded-xl border border-warmGray/15 bg-warmGray/5 p-3.5 space-y-1.5">
            <p className="text-xs font-bold text-charcoal uppercase tracking-wider">{t('drawer.yieldLabel')}</p>
            {closing ? (
              <p className="text-sm text-charcoal">
                {t('drawer.yieldValue', {
                  n: closing.nest_count,
                  kg: kg(closing.weight_grams),
                  date: formatDate(closing.date),
                })}
              </p>
            ) : (
              <p className="text-xs text-warmGray italic">{t('drawer.yieldNone')}</p>
            )}
            {cycle?.incomplete && (
              <p className="text-xs text-statusYellow font-semibold">{t('drawer.incomplete')}</p>
            )}
          </div>

          {/* So sánh */}
          {comp && (
            <div className="rounded-xl border border-warmGray/15 bg-warmGray/5 p-3.5 space-y-2">
              <p className="text-xs font-bold text-charcoal uppercase tracking-wider">{t('drawer.compLabel')}</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-warmGray mb-1">{t('drawer.compPrev')}</p>
                  {comp.previous ? (
                    <>
                      <ChangeChip pct={comp.previous.nest_count_change_pct} />
                      {comp.previous.reason && <p className="text-warmGray mt-0.5 italic">{comp.previous.reason}</p>}
                    </>
                  ) : (
                    <p className="text-warmGray italic">{t('drawer.compNoData')}</p>
                  )}
                </div>
                <div>
                  <p className="text-warmGray mb-1">{t('drawer.compSameYear')}</p>
                  {comp.same_period_last_year ? (
                    <>
                      <ChangeChip pct={comp.same_period_last_year.nest_count_change_pct} />
                      {comp.same_period_last_year.reason && (
                        <p className="text-warmGray mt-0.5 italic">{comp.same_period_last_year.reason}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-warmGray italic">{t('drawer.compNoData')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sức khỏe */}
          <div className="rounded-xl border border-warmGray/15 bg-warmGray/5 p-3.5 space-y-1">
            <p className="text-xs font-bold text-charcoal uppercase tracking-wider mb-1.5">{t('drawer.healthLabel')}</p>
            {health ? (
              <>
                <StatRow
                  label={t('drawer.healthGoodDays')}
                  value={health.good_days_pct !== null ? `${health.good_days_pct.toFixed(1)}%` : '—'}
                />
                <StatRow
                  label={t('drawer.healthReturnRate')}
                  value={health.return_rate_avg !== null ? `${health.return_rate_avg.toFixed(1)}%` : '—'}
                />
                <StatRow
                  label={t('drawer.healthTimeInRange')}
                  value={health.time_in_range_pct !== null ? `${health.time_in_range_pct.toFixed(1)}%` : '—'}
                />
              </>
            ) : (
              <p className="text-xs text-warmGray italic">{t('drawer.healthNone')}</p>
            )}
          </div>

          {/* Kết luận hiện có (đọc — chỉ hiện khi đã kết luận và form chưa sửa) */}
          {cycle?.conclusion && (
            <div className="rounded-xl border border-infoBlue/20 bg-infoBlue/5 p-3.5 space-y-2">
              <p className="text-xs font-bold text-charcoal uppercase tracking-wider">{t('drawer.existingTitle')}</p>
              <p className="text-xs text-warmGray">
                {t('drawer.existingBy', {
                  role: cycle.conclusion.role === 'DOMAIN_EXPERT' ? t('drawer.roleExpert') : t('drawer.roleOwner'),
                  date: formatDT(cycle.conclusion.at),
                })}
              </p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-charcoal uppercase tracking-wider">{t('drawer.formTitle')}</p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal">{t('drawer.textLabel')}</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value.slice(0, MAX_LEN))}
                disabled={!canWrite || mutation.isPending}
                rows={5}
                placeholder={t('drawer.textPlaceholder')}
                className="w-full rounded-xl border border-warmGray/30 bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-warmGray/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none disabled:bg-warmGray/5 disabled:text-warmGray"
              />
              <p className="text-xs text-warmGray text-right">{t('drawer.textHint', { count: text.length })}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal">{t('drawer.recsLabel')}</label>
              <textarea
                value={recs}
                onChange={e => setRecs(e.target.value.slice(0, MAX_LEN))}
                disabled={!canWrite || mutation.isPending}
                rows={4}
                placeholder={t('drawer.recsPlaceholder')}
                className="w-full rounded-xl border border-warmGray/30 bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-warmGray/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none disabled:bg-warmGray/5 disabled:text-warmGray"
              />
              <p className="text-xs text-warmGray text-right">{t('drawer.recsHint', { count: recs.length })}</p>
            </div>
          </div>

          {/* Lỗi */}
          {errorMsg && (
            <p className="text-xs text-alertRed bg-alertRed/5 border border-alertRed/20 rounded-xl px-4 py-2.5">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="-mx-6 -mb-5 flex shrink-0 items-center justify-end gap-3 border-t border-warmGray/10 px-6 py-3.5">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('drawer.cancel')}</Button>
          <Button
            size="sm"
            disabled={!canWrite || !text.trim()}
            loading={mutation.isPending}
            onClick={handleSave}
          >
            {t('drawer.save')}
          </Button>
        </div>
    </Drawer>
  )
}
