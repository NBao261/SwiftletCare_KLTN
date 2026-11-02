/**
 * ProposalRejectModal.tsx — Modal từ chối đề xuất hệ số mờ với lý do bắt buộc (G-04)
 * SRS: EXPERT-FR-011, Report 3 §6.11
 * User Rule: Debug UI border-red-500, z-50 modal
 */

import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';

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
}: Props) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) {
      setError('Bắt buộc phải ghi rõ lý do chuyên môn khi từ chối đề xuất.');
      return;
    }
    if (trimmed.length > 1000) {
      setError('Lý do không được vượt quá 1000 ký tự.');
      return;
    }
    setError(null);
    try {
      await onConfirm(trimmed);
      setNote('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi từ chối đề xuất.';
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-popover border border-warmGray/15">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-warmGray/10">
          <div className="flex items-center gap-2 text-charcoal font-bold text-base">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <span>Từ chối đề xuất hệ số mờ</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-warmGray hover:text-charcoal hover:bg-warmGray/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <p className="text-xs text-warmGray leading-relaxed">
            Vui lòng ghi rõ căn cứ kỹ thuật khi từ chối để Chủ trang trại nắm rõ lý do và có phương án hiệu chỉnh phù hợp.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-charcoal">
              Lý do từ chối chuyên môn <span className="text-alertRed">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError(null);
              }}
              rows={4}
              maxLength={1000}
              placeholder="VD: Biên độ ẩm quá hẹp có thể gây bật tắt bơm liên tục trong mùa khô..."
              className="w-full rounded-xl border border-warmGray/25 p-3 text-sm focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600/20 text-charcoal resize-none"
              autoFocus
            />
            <div className="flex justify-between items-center text-[11px] text-warmGray">
              <span>Tối thiểu 1 ký tự, tối đa 1000 ký tự</span>
              <span>{note.trim().length}/1000</span>
            </div>
            {error && <p className="text-xs font-medium text-alertRed">{error}</p>}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm"
              loading={isSubmitting}
            >
              Xác nhận từ chối
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
