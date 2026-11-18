import { InfoIcon } from '@phosphor-icons/react'
import { useAuthStore } from '@/stores/authStore'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'

// Dòng nhắc cho Farm Owner trên các trang của chuyên gia: quyết định thay khi farm chưa có chuyên gia (BR-22), còn lại chỉ xem
export default function ExpertDecisionNotice() {
  const role = useAuthStore(s => s.user?.role)
  const { canDecide } = useExpertDecisionRights()
  if (role !== 'FARM_OWNER') return null

  return (
    <p className="flex items-center gap-2 rounded-xl border border-warmGray/15 bg-white px-4 py-2.5 text-small text-graphite">
      <InfoIcon size={16} className="shrink-0 text-charcoal" />
      {canDecide
        ? 'Farm chưa có chuyên gia: bạn quyết định thay chuyên gia ở kết luận cảnh báo, tham số phát hiện, lịch đếm, vòng đếm và luật thời tiết (BR-22). Kết luận báo cáo, mùa vụ và duyệt hồ sơ chỉ chuyên gia làm.'
        : 'Farm đã có chuyên gia — các quyết định chuyên môn chỉ xem. Ngưỡng và hệ số mờ bạn vẫn sửa được; chuyên gia sẽ duyệt lại.'}
    </p>
  )
}
