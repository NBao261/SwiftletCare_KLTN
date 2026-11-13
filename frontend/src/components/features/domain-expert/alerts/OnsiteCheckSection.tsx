// EXPERT-FR-021 — Kết quả kiểm tra tại chỗ của Kỹ thuật viên trong bảng bằng chứng
import { ClipboardList, CheckCircle2, Hourglass, Clock } from 'lucide-react'
import type { OnsiteCheck } from '@/types/expert.types'
import { onsiteObservationDict } from '@/constants/enumLabels.i18n'
import { formatDate } from '@/lib/helpers'

const OBSERVATION_LABELS = onsiteObservationDict.vi

interface Props {
  checks: OnsiteCheck[]
}

export default function OnsiteCheckSection({ checks }: Props) {
  if (checks.length === 0) return null

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-blue-600 shrink-0" />
        <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">
          Kiểm tra tại chỗ của Kỹ thuật viên (EXPERT-FR-021)
        </h4>
      </div>

      {checks.map((check, idx) => {
        const techName = check.technician_id?.full_name ?? 'Kỹ thuật viên'
        const isPending = check.observation === null

        return (
          <div key={idx} className="bg-white rounded-xl border border-blue-100 p-3 text-sm space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                {isPending ? (
                  <Hourglass className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                )}
                <span className="font-semibold text-charcoal">{techName}</span>
                {isPending && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                    Chờ phản hồi
                  </span>
                )}
              </div>
              <span className="text-xs text-warmGray flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                {formatDate(check.requested_at)}
              </span>
            </div>

            {!isPending && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-warmGray">Quan sát:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                      check.observation === 'NOTHING_UNUSUAL'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : check.observation === 'SENSOR_DIRTY_OR_FAULTY'
                          ? 'bg-alertRed/5 text-alertRed border-alertRed/20'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {OBSERVATION_LABELS[check.observation!]}
                  </span>
                </div>

                {check.note && (
                  <p className="text-sm text-charcoal/70 italic bg-warmGray/5 px-2.5 py-1.5 rounded-lg border border-warmGray/10">
                    &ldquo;{check.note}&rdquo;
                  </p>
                )}

                {check.photo_url && (
                  <div>
                    <a href={check.photo_url} target="_blank" rel="noreferrer" className="inline-block">
                      <img
                        src={check.photo_url}
                        alt="Ảnh kiểm tra tại chỗ"
                        className="max-h-32 rounded-xl border border-warmGray/15 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </a>
                    <p className="text-xs text-warmGray mt-0.5">Ảnh tại chỗ (URL tạm 1 giờ)</p>
                  </div>
                )}

                {check.answered_at && (
                  <p className="text-xs text-warmGray">
                    Trả lời lúc {formatDate(check.answered_at)}
                    {check.answered_by?.full_name && check.answered_by.full_name !== techName
                      ? ` bởi ${check.answered_by.full_name}`
                      : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
