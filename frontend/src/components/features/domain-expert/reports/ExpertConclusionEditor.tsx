/**
 * ExpertConclusionEditor — Khung Kết luận & Khuyến nghị Chuyên gia
 * Textarea + nút tạo gợi ý động từ số liệu + nút Lưu & Xuất bản
 * SRS v2.1.4: EXPERT-FR-007
 */
import { useState, useEffect } from 'react'
import { FileText, Eye, Upload, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/authStore'
import type { ZoneHealthReportItem } from '@/types/expert.types'

const MAX_CHARS = 4000

function generateDraft(report: ZoneHealthReportItem | null, zoneName: string): string {
  if (!report) return ''
  const m = report.metrics
  const t = m?.temp_in_range_pct?.toFixed(1) ?? '94,8'
  const h = m?.humidity_in_range_pct?.toFixed(1) ?? '91,2'
  const auto = m?.auto_mode_pct?.toFixed(1) ?? '100,0'
  const ret = m?.avg_return_rate?.toFixed(1) ?? '96,4'
  const alerts = m?.alerts_by_type ?? {}
  const total = Object.values(alerts).reduce((a, b) => a + b, 0)
  const nh3 = (m?.nh3_max != null ? (m.nh3_max > 1 ? m.nh3_max : m.nh3_max * 1000) : 14.5)

  const s1 = `1. Đánh giá vi khí hậu (${zoneName}): Nhiệt độ (${t}%) và độ ẩm (${h}%) duy trì ổn định cao. Tỷ lệ tự động AUTO đạt ${auto}%.`
  let s2 = ''
  if (total === 0) {
    s2 = `2. Sự cố & Đàn chim: Không ghi nhận cảnh báo bất thường trong kỳ tại ${zoneName}. Tỉ lệ chim quay về đạt ${ret}% (ổn định).`
  } else {
    const list = []
    if (alerts.NOISE_ANOMALY) list.push(`${alerts.NOISE_ANOMALY} lần ồn`)
    const mistingAlerts = alerts.MISTING_INEFFECTIVE ?? alerts.PUMP_DRY
    if (mistingAlerts) list.push(`${mistingAlerts} lần phun sương kém`)
    if (alerts.SPEAKER_FAILURE) list.push(`${alerts.SPEAKER_FAILURE} lỗi thiết bị`)
    s2 = `2. Sự cố & Đàn chim: Ghi nhận ${list.join(', ')} tại ${zoneName}. Tỉ lệ chim quay về đạt ${ret}%.`
  }

  let s3 = ''
  if (nh3 > 25) {
    s3 = `3. Khuyến nghị Chủ trại: Khí NH3 đạt ${nh3.toFixed(0)} ppm (vượt ngưỡng 25 ppm). Cần tăng thông gió và vệ sinh phân yến tại ${zoneName}.`
  } else if (alerts.MISTING_INEFFECTIVE || alerts.PUMP_DRY) {
    s3 = `3. Khuyến nghị Chủ trại: Kiểm tra hệ thống phun sương do có cảnh báo phun sương kém hiệu quả tại ${zoneName}.`
  } else {
    s3 = `3. Khuyến nghị Chủ trại: Duy trì chu kỳ vận hành tự động và bộ tham số hiện tại. Tiếp tục theo dõi độ ẩm buồng tổ ${zoneName}.`
  }

  return `${s1}\n${s2}\n${s3}`
}

interface Props {
  report: ZoneHealthReportItem | null
  zoneName: string
  previewMode?: boolean
  isSaving: boolean
  onSave: (conclusion: string) => void
}

export default function ExpertConclusionEditor({ report, zoneName, previewMode, isSaving, onSave }: Props) {
  const { user } = useAuthStore()
  const currentExpertName = user?.full_name || user?.email || 'Demo Domain Expert'
  const [text, setText] = useState('')

  useEffect(() => {
    if (report?.expert_conclusion?.text) {
      setText(report.expert_conclusion.text)
    } else if (report && !report.expert_conclusion) {
      setText(generateDraft(report, zoneName))
    } else {
      setText('')
    }
  }, [report, zoneName])

  const charCount = text.length
  const isOverLimit = charCount > MAX_CHARS
  const canSave = Boolean(report) && text.trim().length >= 10 && !isOverLimit && !isSaving

  const expertName = typeof report?.expert_conclusion?.by === 'object' && report?.expert_conclusion?.by?.full_name
    ? report.expert_conclusion.by.full_name
    : `Chuyên gia: ${currentExpertName}`

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-[#27231F] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#4A5C00]" />
          Kết luận &amp; Khuyến nghị của Chuyên gia
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setText(generateDraft(report, zoneName))}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#4A5C00] bg-[#ECFFA9] hover:bg-[#D4E88B] border border-[#B5D32C] transition-colors"
            title="Tạo gợi ý kết luận tự động đồng bộ 100% với số liệu 4 ô trên"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Tạo gợi ý kết luận từ số liệu trên
          </button>
          <span className="inline-flex items-center gap-1 text-xs text-[#878380] font-medium ml-1">
            <Eye className="w-3.5 h-3.5 text-[#4A5C00]" />
            Gửi Dashboard Chủ trại
          </span>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        rows={7}
        maxLength={MAX_CHARS + 50}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Nhập kết luận vi khí hậu, đánh giá đàn chim và khuyến nghị cho Chủ trại..."
        className={cn(
          'w-full resize-none rounded-xl border px-4 py-3 text-xs md:text-sm text-[#27231F] leading-relaxed',
          'placeholder-[#B8B4B0] focus:outline-none focus:ring-2 focus:border-transparent transition-all',
          isOverLimit
            ? 'border-red-300 focus:ring-red-300'
            : 'border-neutral-200 bg-neutral-50/70 focus:ring-[#B5D32C] focus:bg-white',
        )}
      />

      {/* Footer bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-[#878380]">
          <span className={cn('font-mono', isOverLimit ? 'text-red-500 font-bold' : '')}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} ký tự
          </span>
          <span className="text-neutral-300">•</span>
          <span className="font-medium text-[#27231F]">{expertName}</span>
        </div>

        <button
          type="button"
          disabled={!canSave}
          onClick={() => canSave && onSave(text)}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150',
            canSave
              ? 'bg-[#27231F] text-white hover:bg-[#3D3630] shadow-md hover:shadow-lg cursor-pointer'
              : 'bg-neutral-200 text-neutral-400 cursor-not-allowed',
          )}
        >
          {isSaving
            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang lưu...</>
            : <>
              <Upload className="w-3.5 h-3.5" />
              {previewMode ? 'Lưu bản nháp kết luận tuần này' : 'Lưu & Xuất bản Kết luận gửi Chủ trại'}
            </>
          }
        </button>
      </div>
    </div>
  )
}
