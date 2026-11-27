import { useLocation } from 'react-router-dom';
import HeaderTitleBadge from '@/components/layouts/HeaderTitleBadge';
import InfoTip from '@/components/ui/InfoTip';
import { usePermission } from '@/hooks/common/usePermission';
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights';
import { t } from '@/i18n';

// Huy hiệu quyền: từ màn 2xl ghi cả tên quyền, màn hẹp hơn chỉ còn nút (i) để tên trang không bị cắt; tên quyền luôn nằm đầu câu giải thích
function RightsBadge({ label, explanation }: { label: string; explanation: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full border border-warmGray/20 bg-white/60 py-0.5 pl-0.5 pr-0.5 2xl:pl-2.5">
      <span className="hidden text-small font-medium text-graphite 2xl:inline">{label}</span>
      <InfoTip>
        <strong className="font-semibold">{label}.</strong> {explanation}
      </InfoTip>
    </span>
  );
}

// Badge quyền của Farm Owner, Kỹ thuật viên trên trang chuyên gia: nằm ở header cạnh tên trang; câu đầy đủ nằm trong nút (i) vì điện thoại không rê chuột được
export default function ExpertReadOnlyBadge() {
  const isOwner = usePermission('FARM_OWNER');
  const isTechnician = usePermission('FARM_TECHNICIAN');
  const { pathname } = useLocation();
  const { canDecide, farmKnown } = useExpertDecisionRights();
  // Kỹ thuật viên chỉ đọc tham số, lịch đếm, luật thời tiết; riêng vòng đếm thì vẽ được
  if (isTechnician) {
    if (pathname.startsWith('/domain-expert/counting-ring')) return null;
    return (
      <HeaderTitleBadge>
        <RightsBadge label={t('Chỉ xem')} explanation={t('Chuyên gia và chủ nhà yến đặt các thông số này. Bạn xem để đối chiếu khi làm việc tại nhà yến.')} />
      </HeaderTitleBadge>
    );
  }
  // Chưa biết farm có chuyên gia hay chưa (đang tải): không hiện gì kẻo nói sai
  if (!isOwner || !farmKnown) return null;

  const label = canDecide ? t('Quyết định thay') : t('Chuyên gia duyệt lại');
  const explanation = canDecide
    ? t('Trang trại chưa có chuyên gia: bạn quyết định thay chuyên gia ở kiểm chứng cảnh báo, tham số phát hiện, lịch đếm, vòng đếm và luật thời tiết. Kết luận báo cáo, mùa vụ và duyệt hồ sơ chỉ chuyên gia làm.')
    : t('Trang trại đã có chuyên gia: tham số, lịch đếm, vòng đếm bạn sửa có hiệu lực ngay và chuyên gia xem lại. Luật thời tiết, hồ sơ, luật khuyến nghị chạy khi chuyên gia duyệt. Kiểm chứng cảnh báo do chuyên gia làm, bạn nhắc được.');

  return (
    <HeaderTitleBadge>
      <RightsBadge label={label} explanation={explanation} />
    </HeaderTitleBadge>
  );
}
