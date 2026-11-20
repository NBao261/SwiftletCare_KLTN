import { InfoIcon } from '@phosphor-icons/react'
import { usePermission } from '@/hooks/common/usePermission'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'
import { t } from '@/i18n'

// Dòng nhắc quyền của Farm Owner trên trang chuyên gia (BR-22)
export default function ExpertDecisionNotice() {
  const isOwner = usePermission('FARM_OWNER')
  const { canDecide, farmKnown } = useExpertDecisionRights()
  // Chưa biết farm có chuyên gia hay chưa (đang tải): không nhắc câu nào kẻo nói sai; nút ghi vẫn khoá
  if (!isOwner || !farmKnown) return null

  return (
    <p className="flex items-center gap-2 rounded-xl border border-warmGray/15 bg-white px-4 py-2.5 text-small text-graphite">
      <InfoIcon size={16} className="shrink-0 text-charcoal" />
      {canDecide
        ? t('Trang trại chưa có chuyên gia: bạn quyết định thay chuyên gia ở kết luận cảnh báo, tham số phát hiện, lịch đếm, vòng đếm và luật thời tiết. Kết luận báo cáo, mùa vụ và duyệt hồ sơ chỉ chuyên gia làm.')
        : t('Trang trại đã có chuyên gia: tham số, lịch đếm, vòng đếm bạn sửa có hiệu lực ngay và chuyên gia xem lại. Luật thời tiết, hồ sơ, luật khuyến nghị chạy khi chuyên gia duyệt. Kết luận cảnh báo do chuyên gia ghi, bạn nhắc được.')}
    </p>
  )
}
