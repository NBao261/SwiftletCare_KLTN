import InfoTip from '@/components/ui/InfoTip';
import { usePermission } from '@/hooks/common/usePermission';
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights';
import { t } from '@/i18n';

// Badge quyền của Farm Owner trên trang chuyên gia; câu đầy đủ nằm trong nút (i) vì điện thoại không rê chuột được
export default function ExpertReadOnlyBadge() {
  const isOwner = usePermission('FARM_OWNER');
  const { canDecide, farmKnown } = useExpertDecisionRights();
  // Chưa biết farm có chuyên gia hay chưa (đang tải): không hiện gì kẻo nói sai
  if (!isOwner || !farmKnown) return null;

  const label = canDecide ? t('Quyết định thay') : t('Chuyên gia duyệt lại');
  const explanation = canDecide
    ? t('Trang trại chưa có chuyên gia: bạn quyết định thay chuyên gia ở kết luận cảnh báo, tham số phát hiện, lịch đếm, vòng đếm và luật thời tiết. Kết luận báo cáo, mùa vụ và duyệt hồ sơ chỉ chuyên gia làm.')
    : t('Trang trại đã có chuyên gia: tham số, lịch đếm, vòng đếm bạn sửa có hiệu lực ngay và chuyên gia xem lại. Luật thời tiết, hồ sơ, luật khuyến nghị chạy khi chuyên gia duyệt. Kết luận cảnh báo do chuyên gia ghi, bạn nhắc được.');

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-warmGray/20 bg-warmGray/5 py-0.5 pl-2.5 pr-0.5">
      <span className="text-small font-medium text-graphite">{label}</span>
      <InfoTip>{explanation}</InfoTip>
    </span>
  );
}
