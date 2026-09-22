import { useState } from 'react'
import { useDefaultThresholds } from '@/hooks/useSystem'
import { Button, Card } from '@/components/ui'
import { IconEdit } from '@/components/ui/icons'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { getApiErrorMessage } from '@/utils/helpers'
import { THRESHOLD_LIMITS } from '@/constants/thresholds'
import { THRESHOLD_GROUPS } from './constants'
import LastUpdatedFooter from './LastUpdatedFooter'
import ThresholdsEditModal from './ThresholdsEditModal'

/** 1 giá trị trong cặp min/max — nhãn MIN/MAX nhỏ phía trên số để không lẫn 2 bên khi đứng cạnh nhau. Đặt trên panel nền trắng nên dùng màu charcoal thay vì trắng. */
function MinMaxValue({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div>
      <span className="label-caption block text-charcoal/50">{label}</span>
      <span className="text-xl font-bold tabular-nums text-charcoal">
        {value}<span className="ml-1 text-xs font-semibold text-charcoal/50">{unit}</span>
      </span>
    </div>
  )
}

/**
 * Ngưỡng môi trường mặc định (SYSTEM-FR-002) — card tối bên trái, nguồn cho
 * ENV-FR-020. Chỉ ĐỌC — bấm "Chỉnh sửa" mới mở ThresholdsEditModal (popup trắng/đen).
 */
export default function ThresholdsCard() {
  const { data, isLoading, error } = useDefaultThresholds()
  const [isEditing, setIsEditing] = useState(false)

  return (
    <>
      {/* variant="dark" = bg-graphite theo Card mặc định — ghi đè hẳn bg-charcoal cho đúng "nền đen" người dùng yêu cầu.
          flex h-full: card giờ cao bằng hàng grid (auto-rows-fr) — nội dung số liệu được
          canh giữa theo chiều dọc (flex-1 justify-center bên dưới) để lấp khoảng trống thay vì dồn lên đầu.
          shadow-card + hover:shadow-dock: gợi ý có thể tương tác dù chỉ nút Chỉnh sửa mới clickable. */}
      <Card variant="dark" size="lg" className="flex h-full flex-col bg-charcoal p-5 shadow-card transition-shadow duration-200 hover:shadow-dock">
        <div className="flex items-start justify-between gap-6">
          <div className="mt-2 flex min-w-0 items-center gap-2.5">
            <h2 className="font-bold text-white">Ngưỡng môi trường mặc định</h2>
          </div>
          {data && (
            <Button
              type="button"
              variant="accent"
              size="sm"
              className="shrink-0"
              aria-label="Chỉnh sửa ngưỡng môi trường mặc định"
              onClick={() => setIsEditing(true)}
            >
              <IconEdit width={16} height={16} />
              Chỉnh sửa
            </Button>
          )}
        </div>
        <p className="mb-3 mt-1 text-sm text-white/60">
          Nguồn cho hành động "Reset về mặc định" của Farm Owner ở cấp Zone (ENV-FR-020) và ngưỡng khởi tạo cho zone mới.
        </p>

        {isLoading && <LoadingSkeleton count={4} className="h-10 w-full bg-white/10" />}

        {!isLoading && error && (
          <p className="rounded-2xl border border-dashed border-white/20 px-4 py-6 text-center text-sm text-white/70">
            Không tải được ngưỡng mặc định — {getApiErrorMessage(error, 'thử tải lại trang.')}
          </p>
        )}

        {data && (
          <>
            <dl className="grid flex-1 grid-cols-1 content-center gap-3 sm:grid-cols-2">
              {THRESHOLD_GROUPS.map(group => {
                const Icon = group.icon
                return (
                  // Cả icon + tiêu đề + giá trị gộp chung 1 panel nền trắng (trước đây icon/tiêu đề nằm ngoài, trên nền đen)
                  <div key={group.label} className="flex items-start gap-2 rounded-2xl bg-white p-3">
                    {/* Icon-box tròn, lime — cùng cặp màu pill nav active (SideBar.tsx: bg-limeMist text-charcoal) */}
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-limeMist text-charcoal">
                      <Icon width={18} height={18} />
                    </span>
                    {/* Tiêu đề + giá trị chung 1 cột — giá trị thẳng hàng với tiêu đề thay vì thẳng hàng với icon */}
                    <div className="min-w-0 flex-1">
                      <dt className="label-caption text-sm font-bold text-charcoal">{group.label}</dt>
                      {group.kind === 'range' ? (
                        <dd className="mt-2 flex items-end gap-3">
                          <MinMaxValue label="Tối thiểu" value={data[group.minKey]} unit={THRESHOLD_LIMITS[group.minKey].unit} />
                          <span className="pb-1.5 text-charcoal/25">–</span>
                          <MinMaxValue label="Tối đa" value={data[group.maxKey]} unit={THRESHOLD_LIMITS[group.maxKey].unit} />
                        </dd>
                      ) : (
                        <dd className="mt-2 items-baseline text-xl font-bold tabular-nums text-charcoal">
                          {data[group.key]} <span className="text-xs font-semibold text-charcoal/50">{THRESHOLD_LIMITS[group.key].unit}</span>
                        </dd>
                      )}
                    </div>
                  </div>
                )
              })}
            </dl>
            <LastUpdatedFooter meta={data} borderClass="border-white/10" textClass="text-white/40" />
          </>
        )}
      </Card>

      <ThresholdsEditModal open={isEditing} onClose={() => setIsEditing(false)} />
    </>
  )
}
