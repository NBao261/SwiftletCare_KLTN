// ProposalRejectModal.tsx — Modal từ chối đề xuất hệ số mờ kèm lý do (EXPERT-FR-011)

import NoteActionModal from '@/components/ui/NoteActionModal';
import { t } from '@/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
  isSubmitting?: boolean;
}

export default function ProposalRejectModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}: Props): JSX.Element {
  return (
    <NoteActionModal
      open={isOpen}
      onClose={onClose}
      title={t('Từ chối đề xuất hệ số mờ')}
      label={t('Lý do từ chối chuyên môn')}
      placeholder={t('VD: Biên độ ẩm quá hẹp có thể gây bật tắt bơm liên tục trong mùa khô...')}
      hint={t('Vui lòng ghi rõ căn cứ kỹ thuật khi từ chối để Chủ trang trại nắm rõ lý do và có phương án hiệu chỉnh phù hợp.')}
      submitLabel="Xác nhận từ chối"
      required
      minLength={1}
      emptyMessage={t('Bắt buộc phải ghi rõ lý do chuyên môn khi từ chối đề xuất.')}
      danger
      loading={isSubmitting}
      onSubmit={(note) => void onConfirm(note)}
    />
  );
}
