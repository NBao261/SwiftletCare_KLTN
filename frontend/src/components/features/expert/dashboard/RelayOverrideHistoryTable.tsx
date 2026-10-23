/**
 * RelayOverrideHistoryTable — Lịch sử can thiệp relay thủ công
 * Stitch v3: Phần dưới cùng màn hình 01_Expert_Dashboard_v3
 * 5 cột: Thời gian, Người thực hiện (hiển thị đủ - không cắt), Relay, Trạng thái, Thời lượng
 * Chú thích cuối bảng: "Lịch sử 30 ngày — chỉ đọc, Chuyên gia không thể can thiệp trực tiếp"
 * SRS: ENV-FR-019, EXPERT-FR-001 (giám sát)
 */

import { Clock, User, Info } from 'lucide-react'
import { Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useRelayOverrideLogs } from '@/hooks/expert/useExpertDashboard'
import { cn } from '@/lib/cn'
import type { RelayOverrideLogItem } from '@/types/expert.types'

interface Props {
  farmId: string
  zoneId?: string
}

const RELAY_LABEL: Record<string, string> = {
  MISTING: 'Phun sương siêu âm',
  VENTILATION: 'Thông gió đối lưu',
  EXHAUST: 'Quạt hút nhiệt',
  SPEAKER: 'Hệ âm thanh dẫn dụ',
}

const ROLE_LABEL: Record<string, string> = {
  FARM_OWNER: 'Chủ trại',
  TECHNICIAN: 'Kỹ thuật viên',
  ADMIN: 'Quản trị viên',
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`
}

function getActorDisplay(log: RelayOverrideLogItem): { name: string; role: string } {
  if (typeof log.overridden_by === 'string') {
    return { name: log.overridden_by, role: '' }
  }
  return {
    name: log.overridden_by.full_name,
    role: ROLE_LABEL[log.overridden_by.role] ?? log.overridden_by.role,
  }
}

export default function RelayOverrideHistoryTable({ farmId, zoneId }: Props) {
  const { data: logs, isLoading } = useRelayOverrideLogs(farmId, zoneId)

  return (
    <Card size="lg" className="flex flex-col gap-4 hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-h2 text-charcoal">Lịch sử can thiệp thủ công</h2>
          <p className="mt-0.5 text-xs text-warmGray">
            Can thiệp relay do Chủ nhà yến (Chủ trại) thực hiện
          </p>
        </div>
        <Clock size={20} className="shrink-0 text-warmGray" />
      </div>

      {isLoading ? (
        <LoadingSkeleton count={4} className="h-10 w-full" />
      ) : !logs || logs.length === 0 ? (
        <div className="rounded-xl border border-warmGray/15 bg-stone/30 py-8 text-center text-sm text-warmGray">
          Không có lịch sử can thiệp trong giai đoạn này
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-warmGray/15">
                {['Thời gian', 'Người thực hiện', 'Relay', 'Trạng thái', 'Thời lượng'].map(h => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-warmGray"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => {
                const actor = getActorDisplay(log)
                const isExpired = !log.is_active

                return (
                  <tr
                    key={log._id}
                    className={cn(
                      'border-b border-warmGray/10 transition-colors hover:bg-stone/40',
                      idx % 2 === 0 ? 'bg-white' : 'bg-stone/20',
                    )}
                  >
                    {/* Thời gian */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-charcoal">
                      {new Date(log.started_at).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </td>

                    {/* Người thực hiện — KHÔNG cắt ngắn, hiển thị đủ */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="shrink-0 text-warmGray" />
                        <div>
                          <p className="text-xs font-semibold text-charcoal">{actor.name}</p>
                          {actor.role && (
                            <p className="text-[11px] text-warmGray">{actor.role}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Relay */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-charcoal">
                      {RELAY_LABEL[log.relay_name] ?? log.relay_name}
                    </td>

                    {/* Trạng thái */}
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                          log.state
                            ? 'bg-success/15 text-success'
                            : 'bg-warmGray/15 text-warmGray',
                          isExpired && 'opacity-60',
                        )}
                      >
                        {log.state ? 'BẬT' : 'TẮT'}
                        {isExpired && ' (đã hết hạn)'}
                      </span>
                    </td>

                    {/* Thời lượng */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-warmGray">
                      {formatDuration(log.duration_ms)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Chú thích cuối bảng */}
      <div className="flex items-center gap-1.5 border-t border-warmGray/10 pt-3 text-[11px] text-warmGray/70">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>Lịch sử 30 ngày — chỉ đọc. Chuyên gia không thể can thiệp relay trực tiếp, chỉ giám sát và kiểm chứng cảnh báo.</span>
      </div>
    </Card>
  )
}
