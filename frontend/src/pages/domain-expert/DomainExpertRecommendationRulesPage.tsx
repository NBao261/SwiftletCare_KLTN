// EXPERT-FR-016…019, BR-42 — Luật khuyến nghị và đo hiệu quả (G-24)
// API backend chưa sẵn (G-24 tuần 4); hook tự động fallback về dữ liệu mẫu.
import { useState } from 'react'
import { Lightbulb, AlertTriangle, Info, TrendingUp } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useZoneStore } from '@/stores/zoneStore'
import { useToastStore } from '@/stores/toastStore'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import {
  useRecommendationRules,
  useRecommendationEffects,
  useCreateRecommendationRule,
  useDeleteRecommendationRule,
  useUpdateRecommendationRule,
} from '@/hooks/domain-expert/useRecommendationRules'
import RecommendationRuleRow from '@/components/features/domain-expert/recommendations/RecommendationRuleRow'
import RecommendationRuleAddForm from '@/components/features/domain-expert/recommendations/RecommendationRuleAddForm'
import RecommendationEffectPanel from '@/components/features/domain-expert/recommendations/RecommendationEffectPanel'
import type { RecommendationRule } from '@/types/expert.types'

type ActiveTab = 'rules' | 'effects'

const MAX_RULES = 20

export default function DomainExpertRecommendationRulesPage() {
  const { selectedFarmId } = useZoneStore()
  const farmId = selectedFarmId ?? undefined

  const [tab, setTab] = useState<ActiveTab>('rules')
  const [error, setError] = useState<string | null>(null)

  const { data: rules, isLoading: rulesLoading } = useRecommendationRules(farmId)
  const { data: effects, isLoading: effectsLoading } = useRecommendationEffects(farmId)

  const createMut = useCreateRecommendationRule(farmId)
  const updateMut = useUpdateRecommendationRule(farmId)
  const deleteMut = useDeleteRecommendationRule(farmId)

  const pushToast = useToastStore(s => s.push)
  const getError = useApiErrorMessage()

  const isPending = createMut.isPending || updateMut.isPending || deleteMut.isPending

  async function handleAdd(rule: Omit<RecommendationRule, '_id'>) {
    setError(null)
    try {
      await createMut.mutateAsync(rule)
      pushToast('Đã thêm luật mới.', 'success')
    } catch (err) {
      setError(getError(err))
    }
  }

  async function handleToggle(rule: RecommendationRule) {
    if (!rule._id) return
    setError(null)
    try {
      const { _id, ...rest } = rule
      await updateMut.mutateAsync({ id: _id, rule: { ...rest, active: !rest.active } })
    } catch (err) {
      setError(getError(err))
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    try {
      await deleteMut.mutateAsync(id)
      pushToast('Đã xoá luật.', 'success')
    } catch (err) {
      setError(getError(err))
    }
  }

  if (!farmId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Lightbulb className="w-10 h-10 text-neutral-300" />
        <p className="text-sm font-medium text-[#878380]">Chọn trang trại ở thanh trên để xem luật khuyến nghị</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-[#27231F]">Luật khuyến nghị</h1>
        <p className="mt-0.5 text-xs text-[#878380]">
          EXPERT-FR-016…019, BR-42 — Job chạy mỗi ngày sau đánh giá sức khỏe, mỗi luật tạo tối đa một khuyến nghị đang mở
        </p>
      </div>

      {/* Banner dữ liệu mẫu khi backend chưa sẵn */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Backend chưa sẵn sàng (G-24 tuần 4). Dữ liệu hiển thị là mẫu từ <code>recommendationRules.data.ts</code>.</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
        {([['rules', 'Danh sách luật'], ['effects', 'Hiệu quả theo luật']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === v ? 'bg-white text-[#27231F] shadow-sm' : 'text-[#878380] hover:text-[#27231F]'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Lỗi */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {tab === 'rules' && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#27231F]">Danh sách luật ({(rules ?? []).length}/{MAX_RULES})</h2>
            {(rules ?? []).length >= MAX_RULES && (
              <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                Đã đạt tối đa
              </span>
            )}
          </div>

          {rulesLoading ? (
            <LoadingSkeleton count={3} className="h-10 w-full rounded-xl" />
          ) : !rules || rules.length === 0 ? (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-dashed border-neutral-300 text-xs text-[#878380] italic">
              <Lightbulb className="w-4 h-4 shrink-0" />
              <span>Chưa có luật nào. Thêm luật đầu tiên bên dưới.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => (
                <RecommendationRuleRow
                  key={rule._id ?? rule.name}
                  rule={rule}
                  onToggle={() => handleToggle(rule)}
                  onRemove={() => rule._id && handleRemove(rule._id)}
                  disabled={isPending}
                />
              ))}
            </div>
          )}

          {(rules ?? []).length < MAX_RULES && (
            <RecommendationRuleAddForm onAdd={handleAdd} disabled={isPending} />
          )}
        </>
      )}

      {tab === 'effects' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#878380]" />
            <h2 className="text-sm font-semibold text-[#27231F]">Hiệu quả theo luật</h2>
          </div>
          <p className="text-xs text-[#878380]">
            Tính vào ngày thứ 7 sau khi Farm Owner chấp nhận khuyến nghị: so sánh chỉ số 7 ngày sau với 7 ngày trước (EXPERT-FR-019).
          </p>
          {effectsLoading ? (
            <LoadingSkeleton count={2} className="h-14 w-full rounded-xl" />
          ) : (
            <RecommendationEffectPanel effects={effects ?? []} />
          )}
        </div>
      )}
    </div>
  )
}
