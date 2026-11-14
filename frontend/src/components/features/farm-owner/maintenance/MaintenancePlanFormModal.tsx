import { useEffect, useState, type FormEvent } from 'react';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { Button, Input, Modal, SelectMenu, Textarea } from '@/components/ui';
import { maintenanceDict } from '@/constants/maintenance.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useMaintenancePlanActions } from '@/hooks/farm-owner/useMaintenance';
import { useToastStore } from '@/stores/toastStore';
import type { MaintenanceBasis, MaintenanceEquipment, MaintenancePlan } from '@/types';
import {
  CHECKLIST_ITEM_MAX_LENGTH, CHECKLIST_MAX_ITEMS, EQUIPMENTS, NOTE_MAX_LENGTH, SOURCE_MAX_LENGTH, basesFor, filledChecklist,
  validateMaintenancePlan, type MaintenancePlanErrors,
} from '@/validations/farm-owner/maintenancePlan.validation';

interface MaintenancePlanFormModalProps {
  open: boolean;
  // Nhà của kế hoạch: nhà đang lọc khi tạo, nhà của kế hoạch khi sửa
  house: { id: string; name: string };
  // null = tạo mới
  plan: MaintenancePlan | null;
  onClose: () => void;
}

// OPS-FR-005 — Farm Owner tạo hoặc sửa kế hoạch bảo trì của 1 nhà; việc bảo trì và cách tính hạn khoá khi sửa
export default function MaintenancePlanFormModal({ open, house, plan, onClose }: MaintenancePlanFormModalProps): JSX.Element {
  const { t } = useTranslation(maintenanceDict);
  const apiErrorMessage = useApiErrorMessage();
  const push = useToastStore(state => state.push);
  const { create, update } = useMaintenancePlanActions();
  const isPending = create.isPending || update.isPending;

  const [equipment, setEquipment] = useState<MaintenanceEquipment>('PUMP');
  const [basis, setBasis] = useState<MaintenanceBasis>('RUN_HOURS');
  const [intervalText, setIntervalText] = useState('');
  const [checklist, setChecklist] = useState<string[]>(['']);
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<MaintenancePlanErrors>({});

  // Popup không unmount giữa các lần mở — nạp lại kế hoạch đang sửa hoặc form trống mỗi lần mở
  useEffect(() => {
    if (!open) return;
    setEquipment(plan?.equipment ?? 'PUMP');
    setBasis(plan?.basis ?? 'RUN_HOURS');
    setIntervalText(plan ? String(plan.interval) : '');
    setChecklist(plan?.checklist_template.length ? plan.checklist_template : ['']);
    setSource(plan?.source ?? '');
    setNote(plan?.note ?? '');
    setErrors({});
  }, [open, plan]);

  // Đổi việc bảo trì thì về cách tính đầu tiên hợp lệ của việc đó
  function changeEquipment(next: MaintenanceEquipment): void {
    setEquipment(next);
    setBasis(basesFor(next)[0]);
  }

  function changeItem(index: number, value: string): void {
    setChecklist(items => items.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const nextErrors = validateMaintenancePlan({ interval: intervalText, checklist, source });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const fields = {
      interval: Number(intervalText),
      checklist_template: filledChecklist(checklist),
      source: source.trim(),
      note: note.trim(),
    };
    const callbacks = {
      onSuccess: () => {
        push(t(plan ? 'form.saved' : 'form.created'));
        onClose();
      },
      onError: (error: unknown) => push(apiErrorMessage(error), 'error'),
    };
    if (plan) update.mutate({ id: plan._id, input: fields }, callbacks);
    // Tạo mới bỏ ghi chú trống
    else create.mutate({ house_id: house.id, equipment, basis, ...fields, note: fields.note || undefined }, callbacks);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(plan ? 'form.editTitle' : 'form.createTitle', { house: house.name })}
      size="lg"
      closeOnBackdrop={!isPending}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <hr className="border-gray-200" />
        {/* Thân popup cuộn khi checklist dài, tiêu đề và nút luôn hiện; đệm 4 phía để viền và vòng focus của ô không bị cắt, chừa chỗ thanh cuộn */}
        <div className="-mx-1 flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-1 pb-1 pr-3">
          <p className="text-sm text-warmGray">{t(plan ? 'form.lockedHint' : 'form.basisHint')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Dropdown kiểu ô form của design system thay <select> native (danh sách theo bảng màu, không do hệ điều hành vẽ) */}
            <div className="flex flex-col gap-1.5">
              <span className="label-caption">{t('form.equipment')}</span>
              <SelectMenu
                field
                ariaLabel={t('form.equipment')}
                value={equipment}
                disabled={Boolean(plan)}
                onChange={changeEquipment}
                highlightFiltered={false}
                options={EQUIPMENTS.map(item => ({ value: item, label: t(`equipment.${item}`) }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="label-caption">{t('form.basis')}</span>
              <SelectMenu
                field
                ariaLabel={t('form.basis')}
                value={basis}
                disabled={Boolean(plan) || basesFor(equipment).length === 1}
                onChange={setBasis}
                highlightFiltered={false}
                options={basesFor(equipment).map(item => ({ value: item, label: t(`basis.${item}`) }))}
              />
            </div>
          </div>
          <Input
            id="maintenance-interval"
            label={t(`form.intervalUnit.${basis}`)}
            required
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={intervalText}
            onChange={event => setIntervalText(event.target.value)}
            error={errors.interval && t(errors.interval)}
          />

          {/* Checklist: mỗi mục 1 ô, thêm/xoá mục */}
          <fieldset className="flex flex-col gap-2">
            <legend className="label-caption">
              {t('form.checklist')}
              <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
            </legend>
            <p className="text-xs text-warmGray">{t('form.checklistHint', { max: CHECKLIST_MAX_ITEMS })}</p>
            {checklist.map((item, index) => (
              // Mục chỉ có chữ, không có mã riêng nên khoá theo vị trí
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    id={`maintenance-checklist-${index}`}
                    aria-label={t('form.checklistItem', { index: index + 1 })}
                    maxLength={CHECKLIST_ITEM_MAX_LENGTH}
                    placeholder={t('form.checklistPlaceholder')}
                    value={item}
                    onChange={event => changeItem(index, event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="icon"
                  size="sm"
                  aria-label={t('form.removeItem', { index: index + 1 })}
                  disabled={checklist.length === 1}
                  onClick={() => setChecklist(items => items.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <TrashIcon size={16} aria-hidden />
                </Button>
              </div>
            ))}
            {errors.checklist && <span className="text-xs text-alertRed">{t(errors.checklist, { max: CHECKLIST_MAX_ITEMS })}</span>}
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={checklist.length >= CHECKLIST_MAX_ITEMS}
                onClick={() => setChecklist(items => [...items, ''])}
              >
                <PlusIcon size={14} weight="bold" aria-hidden />
                {t('form.addItem')}
              </Button>
            </div>
          </fieldset>

          <Input
            id="maintenance-source"
            label={t('form.source')}
            required
            autoComplete="off"
            maxLength={SOURCE_MAX_LENGTH}
            placeholder={t('form.sourcePlaceholder')}
            value={source}
            onChange={event => setSource(event.target.value)}
            error={errors.source && t(errors.source)}
          />
          <Textarea
            id="maintenance-note"
            label={t('form.note')}
            rows={3}
            maxLength={NOTE_MAX_LENGTH}
            placeholder={t('form.notePlaceholder')}
            value={note}
            onChange={event => setNote(event.target.value)}
          />
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>{t('form.cancel')}</Button>
          <Button type="submit" loading={isPending}>{t(plan ? 'form.save' : 'form.create')}</Button>
        </div>
      </form>
    </Modal>
  );
}
