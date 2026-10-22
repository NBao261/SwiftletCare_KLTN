/**
 * Màn hình 03_Zone_Tuning_v3 — Tinh chỉnh & Hiệu chuẩn (Page Shell)
 * Kiến trúc Bento 2 Tầng:
 * - Tầng 1 (Full-width): Tham số điều khiển mờ (Fuzzy Logic) & Gợi ý AI tích hợp
 * - Tầng 2 (2 Cột 50%-50%): Ngưỡng vi khí hậu & Tham số phát hiện bất thường
 * SRS v2.1.4: EXPERT-FR-004/008, ENV-FR-006/020/021, ANALYTICS-FR-010
 */
import { useState, useCallback } from 'react'
import { Check } from 'lucide-react'
import { useZoneStore } from '@/stores/zoneStore'
import ThresholdColumn from '@/components/features/expert/tuning/ThresholdColumn'
import FuzzyTuningColumn from '@/components/features/expert/tuning/FuzzyTuningColumn'
import DetectionColumn from '@/components/features/expert/tuning/DetectionColumn'
import {
  useExpertThresholds, useUpdateThresholds, useResetThresholds,
  useExpertFuzzyTuning, useUpdateFuzzyTuning,
  useExpertAiSuggestion,
  useExpertDetectionTuning, useUpdateDetectionTuning,
} from '@/hooks/expert/useZoneTuning'
import { useExpertVerdictStats } from '@/hooks/expert/useExpertAlerts'
import type { ExpertFuzzyTuning } from '@/types/expert.types'

function Toast({ show, message }: { show: boolean; message: string }) {
  if (!show) return null
  return (
    <div className="fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3 bg-[#27231F] text-[#ECFFA9]">
      <Check className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  )
}

export default function ExpertZoneTuningPage() {
  const { selectedZoneId } = useZoneStore()
  const zoneId = selectedZoneId ?? 'zone_demo_01'

  // Data hooks
  const thresholds = useExpertThresholds(zoneId)
  const fuzzy = useExpertFuzzyTuning(zoneId)
  const aiSuggestion = useExpertAiSuggestion(zoneId)
  const detection = useExpertDetectionTuning(zoneId)
  const { data: verdictStats = [] } = useExpertVerdictStats(undefined, zoneId)

  // Mutation hooks
  const updateThresholds = useUpdateThresholds(zoneId)
  const resetThresholds = useResetThresholds(zoneId)
  const updateFuzzy = useUpdateFuzzyTuning(zoneId)
  const updateDetection = useUpdateDetectionTuning(zoneId)

  // AI suggestion apply state
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [highlightedFuzzyFields, setHighlightedFuzzyFields] = useState<Set<keyof ExpertFuzzyTuning>>(new Set())
  const [fuzzyOverride, setFuzzyOverride] = useState<Partial<ExpertFuzzyTuning>>({})
  const [toast, setToast] = useState({ show: false, message: '' })

  const showToast = (message: string) => {
    setToast({ show: true, message })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000)
  }

  const handleApplySuggestion = useCallback((suggestion: Partial<ExpertFuzzyTuning>) => {
    setFuzzyOverride(suggestion)
    setHighlightedFuzzyFields(new Set(Object.keys(suggestion) as Array<keyof ExpertFuzzyTuning>))
    setTimeout(() => setHighlightedFuzzyFields(new Set()), 4000)
    showToast('Đã áp dụng đề xuất hệ số mờ — Xem lại và bấm Lưu để xác nhận')
  }, [])

  return (
    <div className="relative w-full flex-1 flex flex-col gap-6">
      <div className="w-full max-w-screen-xl mx-auto space-y-6">

        {/* TẦNG 1: Card Full-width Tham số điều khiển mờ (Fuzzy Logic) & Gợi ý AI */}
        <FuzzyTuningColumn
          data={fuzzyOverride && Object.keys(fuzzyOverride).length > 0
            ? { ...fuzzy.data, ...fuzzyOverride } as ExpertFuzzyTuning
            : fuzzy.data}
          isLoading={fuzzy.isLoading}
          isSaving={updateFuzzy.isPending}
          highlightedFields={highlightedFuzzyFields}
          onSave={v => updateFuzzy.mutateAsync(v).then(() => { setFuzzyOverride({}); showToast('Đã lưu hệ số mờ') })}
          onFormChange={v => setFuzzyOverride(prev => ({ ...prev, ...v }))}
          suggestion={aiSuggestion.data}
          isSuggestionLoading={aiSuggestion.isLoading}
          onApplySuggestion={handleApplySuggestion}
          onDismissSuggestion={() => setSuggestionDismissed(true)}
          suggestionDismissed={suggestionDismissed}
        />

        {/* TẦNG 2: 2 Cột 50% - 50% cân đối tuyệt đối */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <ThresholdColumn
            data={thresholds.data} isLoading={thresholds.isLoading}
            isSaving={updateThresholds.isPending} isResetting={resetThresholds.isPending}
            onSave={v => updateThresholds.mutateAsync(v).then(() => showToast('Đã lưu ngưỡng môi trường'))}
            onReset={() => resetThresholds.mutateAsync().then(() => showToast('Đã khôi phục ngưỡng mặc định'))}
          />

          <DetectionColumn
            data={detection.data} verdictStats={verdictStats}
            isLoading={detection.isLoading}
            isSaving={updateDetection.isPending} isResetting={updateDetection.isPending}
            onSave={v => updateDetection.mutateAsync(v).then(() => showToast('Đã lưu tham số phát hiện'))}
            onReset={() => updateDetection.mutateAsync({
              noise_margin_db: 15, noise_min_sec: 10, pump_dry_on_sec: 300,
              pump_dry_min_rise_pct: 2.0, speaker_drop_pct: 70, return_rate_drop_pct: 20,
            }).then(() => showToast('Đã khôi phục tham số phát hiện mặc định'))}
          />
        </div>
      </div>

      <Toast show={toast.show} message={toast.message} />
    </div>
  )
}
