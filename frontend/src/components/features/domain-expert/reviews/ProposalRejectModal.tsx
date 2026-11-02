import NoteActionModal from '@/components/ui/NoteActionModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
  isSubmitting?: boolean;
}

// Modal từ chối đề xuất hệ số mờ với lý do bắt buộc (EXPERT-FR-011) dùng NoteActionModal chuẩn FE_Design §13.7
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
      title="Từ chối đề xuất hệ số mờ"
      label="Lý do từ chối chuyên môn"
      placeholder="VD: Biên độ ẩm quá hẹp có thể gây bật tắt bơm liên tục trong mùa khô..."
      hint="Vui lòng ghi rõ căn cứ kỹ thuật khi từ chối để Chủ trang trại nắm rõ lý do và có phương án hiệu chỉnh phù hợp."
      submitLabel="Xác nhận từ chối"
      required
      minLength={1}
      emptyMessage="Bắt buộc phải ghi rõ lý do chuyên môn khi từ chối đề xuất."
      danger
      loading={isSubmitting}
      onSubmit={(note) => void onConfirm(note)}
    />
  );
}
