import { useEffect, useState, type ReactNode } from 'react'
import { Badge, Modal, ModalHeader, MODAL_SECTION_TITLE } from '@/components/ui'
import { getUserStatus } from '@/hooks/admin/useUsers'
import { formatDateOnly } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { t, trChildren } from '@/i18n'
import { STATUS_LABEL, STATUS_TONE, ROLE_LABEL } from '@/components/features/admin/users/users.constants'
import type { User } from '@/types'

type Section = 'info' | 'assignment' | 'history'
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'info', label: 'Thông tin' },
  { key: 'assignment', label: 'Phân công' },
  { key: 'history', label: 'Lịch sử' },
]

/** Khối nền xám bo góc gom các dòng cùng nhóm — có tiêu đề nhóm nhỏ phía trên */
function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h4 className={MODAL_SECTION_TITLE}>{t(title)}</h4>}
      <dl className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-gray-50 px-4">{children}</dl>
    </section>
  )
}

/** 1 dòng: nhãn (+ chú thích nhỏ) bên trái, giá trị bên phải */
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="text-body font-medium text-charcoal">{t(label)}</dt>
        {hint && <p className="text-xs text-warmGray">{t(hint)}</p>}
      </div>
      <dd className="min-w-0 truncate text-right text-body text-graphite">{children}</dd>
    </div>
  )
}

/** Giá trị trống — chữ xám nhạt */
const Empty = ({ children }: { children: ReactNode }) => <span className="text-warmGray">{trChildren(children)}</span>

/**
 * Popup chi tiết tài khoản (AUTH-FR-011) — bố cục ngang 2 cột: trái = tên + danh mục (Thông tin / Phân công / Lịch sử),
 * phải = nội dung mục đang chọn, mỗi nhóm dòng trong 1 khối nền xám. Chiều cao cố định (h-[22rem]) nên đổi mục không
 * làm popup co giãn. Màu trung tính, chỉ nhãn trạng thái giữ màu tone.
 */
export default function UserDetailModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [section, setSection] = useState<Section>('info')
  // Mở tài khoản khác → về mục đầu
  useEffect(() => { if (user) setSection('info') }, [user])

  const status = user ? getUserStatus(user) : null

  return (
    <Modal open={!!user} onClose={onClose} size="xl" ariaLabel="Chi tiết tài khoản">
      {user && status && (
        <div className="flex flex-col gap-5">
        {/* Tiêu đề chung "Thông tin người dùng" (như các popup khác: tên popup), dòng dưới là người đang xem · vai trò */}
        <ModalHeader title="Thông tin người dùng" description={`${user.full_name} · ${ROLE_LABEL[user.role]}`} />

        {/* 22rem: vừa mục dài nhất ("Thông tin": 2 nhóm, 5 dòng) — không hiện thanh cuộn */}
        <div className="flex h-[22rem] gap-6">
          {/* Cột trái: danh mục — đang chọn nền đen chữ trắng như các popup Admin khác */}
          <nav className="flex w-52 shrink-0 flex-col border-r border-gray-200 pr-5" aria-label={t('Mục chi tiết tài khoản')}>
            <h3 className={MODAL_SECTION_TITLE}>{t('Mục')}</h3>
            <div className="flex flex-col gap-0.5">
              {SECTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-current={section === key ? 'page' : undefined}
                  onClick={() => setSection(key)}
                  className={cn(
                    'rounded-xl px-3 py-2 text-left text-body transition-colors duration-150',
                    section === key ? 'bg-charcoal font-semibold text-white' : 'text-graphite hover:bg-gray-100',
                  )}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </nav>

          {/* Cột phải: nội dung mục đang chọn (tên mục đã sáng ở cột trái, không lặp tiêu đề); dài thì cuộn trong khung */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">


            {section === 'info' && (
              <>
                <Group title="Liên hệ">
                  <Row label="Họ tên"><span className="font-medium text-charcoal" title={user.full_name}>{user.full_name}</span></Row>
                  <Row label="Email"><span title={user.email}>{user.email}</span></Row>
                  <Row label="Số điện thoại">{user.phone || <Empty>Chưa cập nhật</Empty>}</Row>
                </Group>
                <Group title="Tài khoản">
                  <Row label="Vai trò">{ROLE_LABEL[user.role]}</Row>
                  {/* Trạng thái giữ màu tone (xanh hoạt động / đỏ khoá...) — thông tin đọc bằng màu duy nhất trong popup */}
                  <Row label="Trạng thái"><Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge></Row>
                </Group>
              </>
            )}

            {section === 'assignment' && (
              <Group>
                {user.role === 'TECHNICIAN' ? (
                  <Row label="Vùng phụ trách" hint="Ticket của farm trong các vùng này được giao cho người này">
                    {user.assigned_regions?.length
                      ? <span title={user.assigned_regions.join(', ')}>{user.assigned_regions.join(', ')}</span>
                      // Chưa gán thì Ticket Router không giao ticket được cho người này (TICKET-FR-004)
                      : <Empty>Chưa gán — chưa nhận được ticket</Empty>}
                  </Row>
                ) : (
                  <Row label="Vùng phụ trách" hint="Chỉ kỹ thuật viên có vùng phụ trách"><Empty>Không áp dụng</Empty></Row>
                )}
              </Group>
            )}

            {section === 'history' && (
              <Group>
                <Row label="Ngày tạo">{user.created_at ? formatDateOnly(user.created_at) : <Empty>—</Empty>}</Row>
                {/* Khoá (AUTH-FR-011) — lý do Admin nhập lúc khoá */}
                <Row label="Khoá tài khoản" hint={!user.is_active && user.deactivated_reason ? `${t('Lý do')}: ${user.deactivated_reason}` : undefined}>
                  {!user.is_active
                    ? (user.deactivated_at ? t('Từ {{date}}', { date: formatDateOnly(user.deactivated_at) }) : t('Đang bị khoá'))
                    : <Empty>Không</Empty>}
                </Row>
                {/* Yêu cầu xoá / đã xoá (AUTH-FR-012) — xử lý ở trang Yêu cầu tài khoản */}
                <Row label="Xoá tài khoản" hint={user.deletion_requested_at && !user.deleted_at ? 'Xử lý ở trang Yêu cầu tài khoản' : undefined}>
                  {user.deleted_at
                    ? t('Đã xoá {{date}}', { date: formatDateOnly(user.deleted_at) })
                    : user.deletion_requested_at
                      ? t('Yêu cầu {{date}}', { date: formatDateOnly(user.deletion_requested_at) })
                      : <Empty>Không</Empty>}
                </Row>
              </Group>
            )}
            </div>
          </div>
        </div>
        </div>
      )}
    </Modal>
  )
}
