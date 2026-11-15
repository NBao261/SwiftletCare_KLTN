import { useEffect, useState, type FormEvent } from 'react';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { workOrderDict } from '@/constants/workOrders.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useWorkOrderActions } from '@/hooks/farm-owner/useWorkOrders';
import { useToastStore } from '@/stores/toastStore';

// Giới hạn của POST /work-orders (api-spec)
const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 2000;

interface WorkOrderCreateModalProps {
  open: boolean;
  house: { id: string; name: string };
  onClose: () => void;
}

// OPS-FR-001 — Farm Owner mở tay 1 Work Order sửa chữa cho nhà đang lọc; backend giao thợ đang trực
export default function WorkOrderCreateModal({ open, house, onClose }: WorkOrderCreateModalProps): JSX.Element {
  const { t } = useTranslation(workOrderDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  const { create } = useWorkOrderActions();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Popup không unmount giữa các lần mở — xoá nội dung cũ mỗi lần mở lại
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setIsSubmitted(false);
  }, [open]);

  const titleError = isSubmitted && !title.trim() ? t('form.required', { field: t('create.titleLabel').toLowerCase() }) : undefined;

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setIsSubmitted(true);
    if (!title.trim()) return;
    create.mutate(
      { house_id: house.id, title: title.trim(), ...(description.trim() && { description: description.trim() }) },
      {
        onSuccess: () => {
          push(t('create.done'));
          onClose();
        },
        onError: error => push(apiErrorMessage(error), 'error'),
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('create.title', { house: house.name })} size="lg" closeOnBackdrop={!create.isPending}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <hr className="border-gray-200" />
        <p className="text-sm text-warmGray">{t('create.hint')}</p>
        <Input
          label={t('create.titleLabel')}
          required
          autoComplete="off"
          maxLength={TITLE_MAX_LENGTH}
          placeholder={t('create.titlePlaceholder')}
          value={title}
          onChange={event => setTitle(event.target.value)}
          error={titleError}
        />
        <Textarea
          label={t('create.description')}
          rows={4}
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder={t('create.descriptionPlaceholder')}
          value={description}
          onChange={event => setDescription(event.target.value)}
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={create.isPending}>{t('form.cancel')}</Button>
          <Button type="submit" loading={create.isPending}>{t('create.submit')}</Button>
        </div>
      </form>
    </Modal>
  );
}
