import { useEffect, useState, type FormEvent } from 'react';
import { Button, Input, Modal, SelectMenu, Textarea } from '@/components/ui';
import { REPAIR_JOB_CAUSES, repairJobTitle, type RepairJobChoice } from '@/components/features/farm-owner/work-orders/repairJobs';
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

// Farm Owner mở tay 1 Work Order sửa chữa cho nhà đang lọc; backend giao thợ đang trực
export default function WorkOrderCreateModal({ open, house, onClose }: WorkOrderCreateModalProps): JSX.Element {
  const { t } = useTranslation(workOrderDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  const { create } = useWorkOrderActions();
  const [job, setJob] = useState<RepairJobChoice>('');
  const [otherTitle, setOtherTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Popup không unmount giữa các lần mở: xoá nội dung cũ mỗi lần mở lại
  useEffect(() => {
    if (!open) return;
    setJob('');
    setOtherTitle('');
    setDescription('');
    setIsSubmitted(false);
  }, [open]);

  // Việc có sẵn thì lấy câu của việc đó; chỉ "Việc khác" mới tự nhập
  const title = repairJobTitle(job, otherTitle);
  const jobError = isSubmitted && job === '' ? t('create.jobRequired') : undefined;
  const otherError = isSubmitted && job === 'OTHER' && !title ? t('form.required', { field: t('create.titleLabel').toLowerCase() }) : undefined;

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setIsSubmitted(true);
    if (!title) return;
    create.mutate(
      { house_id: house.id, title, ...(description.trim() && { description: description.trim() }) },
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
        <div className="flex flex-col gap-1.5">
          <span className="label-caption">{t('create.titleLabel')} <span className="text-alertRed">*</span></span>
          <SelectMenu
            field
            ariaLabel={t('create.titleLabel')}
            value={job}
            onChange={setJob}
            invalid={Boolean(jobError)}
            highlightFiltered={false}
            options={[
              { value: '', label: t('create.jobPlaceholder') },
              ...REPAIR_JOB_CAUSES.map(cause => ({ value: cause, label: t(`create.job.${cause}`) })),
              { value: 'OTHER', label: t('create.job.OTHER') },
            ]}
          />
          {jobError && <p className="text-xs text-alertRed">{jobError}</p>}
        </div>
        {job === 'OTHER' && (
          <Input
            label={t('create.job.OTHER')}
            required
            autoComplete="off"
            maxLength={TITLE_MAX_LENGTH}
            placeholder={t('create.titlePlaceholder')}
            value={otherTitle}
            onChange={event => setOtherTitle(event.target.value)}
            error={otherError}
          />
        )}
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
