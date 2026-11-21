import { InfoIcon } from '@phosphor-icons/react';
import { usePermission } from '@/hooks/common/usePermission';
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights';
import { t } from '@/i18n';

// Badge nhỏ "Chỉ xem" cho Farm Owner trên trang chuyên gia (DE-10, todo-ui-layout §6): thay dải ExpertDecisionNotice
export default function ExpertReadOnlyBadge() {
  const isOwner = usePermission('FARM_OWNER');
  const { canDecide, farmKnown } = useExpertDecisionRights();
  if (!isOwner || !farmKnown) return null;

  const label = canDecide ? t('Quyết định thay') : t('Chỉ xem');
  const tooltip = canDecide
    ? t('Trang trại chưa có chuyên gia: bạn quyết định thay chuyên gia ở kết luận cảnh báo, tham số phát hiện, lịch đếm, vòng đếm và luật thời tiết. Kết luận báo cáo, mùa vụ và duyệt hồ sơ chỉ chuyên gia làm.')
    : t('Trang trại đã có chuyên gia nên bạn chỉ xem các quyết định chuyên môn. Ngưỡng và hệ số mờ bạn vẫn sửa được, chuyên gia duyệt lại sau.');

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warmGray/20 bg-warmGray/5 px-2.5 py-1" title={tooltip}>
      <InfoIcon size={14} className="shrink-0 text-warmGray" />
      <span className="text-small font-medium text-graphite">{label}</span>
    </span>
  );
}
