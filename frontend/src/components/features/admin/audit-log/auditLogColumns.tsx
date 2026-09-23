// Cấu hình cột DataTable của AdminAuditLogPage — tách khỏi trang giống userColumns.tsx.
// Màu chỉ theo nhóm hành động, ở icon tròn đầu hàng (auditLog.constants.ts).
import { useEffect, useRef } from 'react'
import type { DataTableColumn } from '@/components/ui/DataTable'
import { IconCopy } from '@/components/ui/icons'
import { AUDIT_ACTION_LABEL, AUDIT_TARGET_LABEL } from '@/constants/auditActions'
import { ROLE_LABEL } from '@/constants/roles'
import { useToastStore } from '@/stores/toastStore'
import { cn } from '@/lib/cn'
import { formatDate, formatRelativeTime } from '@/lib/helpers'
import type { AuditLogEntry } from '@/types'
import { CATEGORY_STYLE, actionCategory } from './auditLog.constants'

const styleOf = (log: AuditLogEntry) => CATEGORY_STYLE[actionCategory(log.action)]

function ActionChip({ log }: { log: AuditLogEntry }) {
  const { chip, Icon } = styleOf(log)
  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', chip)}>
      <Icon width={16} height={16} />
    </span>
  )
}

/**
 * Nhãn 1 dòng: bình thường cắt "…"; rê chuột vào thì bỏ "…" và cuộn ngang được bằng
 * kéo chuột (nhấn giữ + kéo) hoặc lăn chuột thường. Rời chuột thì về đầu dòng.
 */
function ScrollableLabel({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)

  // wheel phải gắn native { passive: false } — listener wheel của React là passive nên không preventDefault được
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function onPointerDown(e: React.PointerEvent<HTMLParagraphElement>) {
    const el = e.currentTarget
    if (el.scrollWidth <= el.clientWidth) return
    const startX = e.clientX
    const startScroll = el.scrollLeft
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => { el.scrollLeft = startScroll - (ev.clientX - startX) }
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up) }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  return (
    <p
      ref={ref}
      title={text}
      onPointerDown={onPointerDown}
      onPointerLeave={e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.scrollLeft = 0 }}
      className="min-w-0 cursor-default select-none truncate font-semibold text-charcoal [scrollbar-width:none] hover:cursor-grab hover:overflow-x-auto hover:text-clip active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
    >
      {text}
    </p>
  )
}

/** ObjectId rút gọn `6aaab8…b5a6`, hover (title) hiện đủ, nút copy bản đầy đủ */
function ShortId({ id }: { id: string }) {
  const push = useToastStore(s => s.push)
  const short = id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono" title={id}>{short}</span>
      <button
        type="button"
        aria-label={`Sao chép ID ${id}`}
        title="Sao chép ID"
        onClick={() => navigator.clipboard.writeText(id).then(() => push('Đã sao chép ID'), () => push('Không sao chép được', 'error'))}
        className="rounded p-0.5 text-warmGray/70 transition-colors hover:bg-warmGray/10 hover:text-charcoal"
      >
        <IconCopy width={12} height={12} />
      </button>
    </span>
  )
}

/**
 * Tên đối tượng khi tra được. Hiện chỉ loại `user`: tên lấy từ danh sách tài khoản trang
 * đã tải sẵn cho ô lọc "người thực hiện" (useUsersPicker) — không tốn request thêm.
 * Loại khác (ticket, farm, zone, thiết bị...) backend chỉ trả ID → vẫn hiện ID rút gọn.
 */
export function targetName(log: AuditLogEntry, userNames: Map<string, string>) {
  return log.target_type === 'user' && log.target_id ? userNames.get(log.target_id) : undefined
}

/** Đối tượng · tên (hoặc ID rút gọn nếu không tra được tên) · IP (+ lý do nếu có) */
function TargetLine({ log, name }: { log: AuditLogEntry; name?: string }) {
  const reason = typeof log.metadata?.reason === 'string' ? log.metadata.reason : undefined
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-1 text-xs text-warmGray">
        {AUDIT_TARGET_LABEL[log.target_type] ?? log.target_type}
        {name
          ? <>·<span className="font-semibold text-charcoal" title={log.target_id}>{name}</span></>
          : log.target_id && <>·<ShortId id={log.target_id} /></>}
        {log.ip_address && <>· IP {log.ip_address}</>}
      </p>
      {reason && <p className="mt-0.5 truncate text-xs text-charcoal" title={reason}>Lý do: {reason}</p>}
    </>
  )
}

/**
 * Cùng bố cục bảng Người dùng (userColumns.tsx): STT liên tục qua các
 * trang (`startIndex` = (page-1)*limit), tên đậm + dòng phụ xám, ngày giờ đầy đủ,
 * width % tổng 100 cho table-fixed. Không có cột thao tác — nhật ký chỉ đọc.
 */
export function buildAuditLogColumns(startIndex: number, userNames: Map<string, string>): DataTableColumn<AuditLogEntry>[] {
  return [
    {
      key: 'stt', header: 'STT', align: 'center', className: 'w-[6%]',
      render: (_log, index) => <span className="text-warmGray">{startIndex + index + 1}</span>,
    },
    {
      // Hẹp vừa đủ cho nhãn thường gặp — rộng theo nhãn dài nhất thì hàng "Đăng nhập" để
      // trống cả mảng trước cột Người thực hiện. Nhãn dài hơn: "…" + kéo/lăn ngang (ScrollableLabel).
      key: 'action', header: 'Hành động', className: 'w-[22%]',
      render: log => (
        <div className="flex min-w-0 items-center gap-3">
          <ActionChip log={log} />
          <ScrollableLabel text={AUDIT_ACTION_LABEL[log.action] ?? log.action} />
        </div>
      ),
    },
    {
      // pl-6: chừa khoảng thở sau nhãn hành động bị cắt "…" sát mép cột
      key: 'actor', header: 'Người thực hiện', className: 'w-[22%] pl-6',
      render: log => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate font-semibold text-charcoal" title={log.actor_id?.full_name}>{log.actor_id?.full_name ?? 'Hệ thống'}</p>
          {log.actor_id && <p className="truncate text-xs text-warmGray">{ROLE_LABEL[log.actor_id.role]}</p>}
        </div>
      ),
    },
    { key: 'target', header: 'Đối tượng', className: 'w-[30%]', render: log => <TargetLine log={log} name={targetName(log, userNames)} /> },
    {
      key: 'created_at', header: 'Thời gian', className: 'w-[20%] whitespace-nowrap',
      render: log => <span className="text-warmGray" title={formatRelativeTime(log.created_at)}>{formatDate(log.created_at)}</span>,
    },
  ]
}
