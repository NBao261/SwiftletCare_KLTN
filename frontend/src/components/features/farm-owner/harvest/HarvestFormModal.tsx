import { useState, type FormEvent, type KeyboardEvent } from 'react';

import { Button, Input, Modal, SelectMenu } from '@/components/ui';
import HarvestDatePicker from '@/components/features/farm-owner/harvest/HarvestDatePicker';
import ImageLinksField from '@/components/features/farm-owner/harvest/ImageLinksField';
import { GRAM_DIGITS, KILOGRAM_DIGITS, NEST_TYPE_BADGE_CLASS, NEST_TYPES } from '@/components/features/farm-owner/harvest/harvest.constants';
import { checkNestAmount, type HarvestGroup, type NestAmountError } from '@/components/features/farm-owner/harvest/harvestMetrics';
import { harvestDict, type HarvestKey } from '@/constants/harvest.i18n';
import { LEVEL_BADGE_SIZE } from '@/constants/severity';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useCreateHarvest, useDeleteHarvest, useUpdateHarvest } from '@/hooks/farm-owner/useHarvests';
import { cn } from '@/lib/cn';
import { formatStandardDate } from '@/lib/i18n';
import { useToastStore } from '@/stores/toastStore';
import type { ScopeFilterState } from '@/hooks/farm-owner/useScopeFilter';
import type { HarvestBatch, NestType } from '@/types';
import { NO_VALUE } from '@/constants/display';

const GRAMS_PER_KILOGRAM = 1000;
// Mốc sớm nhất của ngày thu — chặn năm gõ nhầm (vd 0023); backend chỉ kiểm định dạng ngày
const HARVEST_DATE_MIN = '2000-01-01';

type AmountText = { nests: string; grams: string };
type AmountTexts = Record<NestType, AmountText>;

const EMPTY_AMOUNT: AmountText = { nests: '', grams: '' };

// Ô số trong bảng sản lượng: thấp hơn ô nhập chuẩn cho popup gọn, ẩn nút tăng/giảm của trình duyệt
const AMOUNT_INPUT_CLASS = 'input h-9 py-0 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

// Câu lỗi của từng loại lỗi dòng
const AMOUNT_ERROR_KEY: Record<NestAmountError, HarvestKey> = {
  negative: 'form.errorNegative',
  nestsNotInteger: 'form.errorNestsInteger',
  incomplete: 'form.errorIncomplete',
};

// Chặn gõ dấu âm/dương và số mũ (e) vào ô số tổ, trọng lượng — không cho nhập số âm
function blockSignKeys(event: KeyboardEvent<HTMLInputElement>): void {
  if (['-', '+', 'e', 'E'].includes(event.key)) event.preventDefault();
}

// Ngày hôm nay dạng yyyy-mm-dd theo giờ máy, làm mốc chặn ngày thu trong tương lai
function todayInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Số liệu ban đầu của form: sửa thì lấy từ các đợt của lần thu, tạo mới thì để trống
function initialAmounts(group: HarvestGroup | undefined): AmountTexts {
  const batchByType = new Map(group?.batches.map(batch => [batch.nest_type, batch]));
  const amountOf = (nestType: NestType): AmountText => {
    const batch = batchByType.get(nestType);
    return batch ? { nests: String(batch.nest_count), grams: String(batch.weight_grams) } : EMPTY_AMOUNT;
  };
  return { RAW: amountOf('RAW'), CLEANED: amountOf('CLEANED'), PREMIUM: amountOf('PREMIUM') };
}

// 1 thao tác lưu của 1 loại yến (tạo / sửa / xoá đợt)
interface SaveOperation {
  nestType: NestType;
  run: () => Promise<unknown>;
}

// Ô chọn đã có giá trị: viền xanh như ô lọc đang bật; chưa chọn: chữ xám như placeholder
function fieldStateClass(isChosen: boolean): string {
  return isChosen ? 'border-accent-600 focus:border-accent-600' : 'text-warmGray';
}

// Nhãn ô chọn kiểu form, cùng nhãn Input/HarvestDatePicker (.label-caption + dấu * đỏ)
function FieldLabel({ text }: { text: string }): JSX.Element {
  return (
    <span className="label-caption">
      {text}
      <span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
    </span>
  );
}

interface HarvestFormModalProps {
  // Khung lọc Nhà + Zone của trang: chọn 1 nhà thì popup khoá nhà đó, chọn 1 Zone thì khoá luôn Zone
  scope: ScopeFilterState;
  onClose: () => void;
  // Có thì là sửa lần thu đó; không có thì tạo mới
  group?: HarvestGroup;
  houseName?: string;
  // Người nhập: tạo mới là người đang đăng nhập, sửa là người đã tạo lần thu
  creatorName: string;
}

// Popup tạo / sửa 1 lần thu (MARKET-FR-001, 005): khu vực + ngày, sản lượng 3 loại yến, ảnh; mỗi loại có số liệu là 1 đợt cùng zone + ngày
export default function HarvestFormModal({ scope, onClose, group, houseName, creatorName }: HarvestFormModalProps): JSX.Element {
  const farmId = scope.farmId;
  const { t, num, exact } = useTranslation(harvestDict);
  const isEdit = group !== undefined;
  const createHarvest = useCreateHarvest(farmId);
  const updateHarvest = useUpdateHarvest(farmId);
  const deleteHarvest = useDeleteHarvest(farmId);
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  // Nhà lấy sẵn từ khung lọc; chưa lọc nhà thì chọn trong các nhà của farm đang xem, không chọn được farm khác
  const [houseId, setHouseId] = useState(scope.houseId);
  const [harvestDate, setHarvestDate] = useState('');
  const [amounts, setAmounts] = useState<AmountTexts>(() => initialAmounts(group));
  // Link ảnh sản phẩm dùng chung cho các loại yến của lần thu (sửa thì lấy link đã lưu)
  const [imageLinks, setImageLinks] = useState<string[]>(() => group?.product_images ?? []);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Kiểm từng dòng và cộng tổng ngay khi gõ
  const checks = NEST_TYPES.map(nestType => ({ nestType, ...checkNestAmount(amounts[nestType].nests, amounts[nestType].grams) }));
  const filledRows = checks.filter(check => check.isFilled);
  const hasRowError = checks.some(check => check.error !== null);
  const totalNests = filledRows.reduce((sum, row) => sum + row.nests, 0);
  const totalGrams = filledRows.reduce((sum, row) => sum + row.grams, 0);
  const isEmpty = filledRows.length === 0;
  const today = todayInputValue();
  // Ngày thu bắt buộc, không ở tương lai, không trước năm 2000 (chuỗi yyyy-mm-dd so sánh được trực tiếp); sửa thì ngày đã cố định
  const dateError: HarvestKey | null = isEdit ? null
    : !harvestDate ? 'form.errorDate'
      : harvestDate > today ? 'form.errorFutureDate'
        : harvestDate < HARVEST_DATE_MIN ? 'form.errorOldDate' : null;
  const isHouseLocked = scope.houseId !== '';
  const houseOptions = [
    { value: '', label: t('form.pickHouse') },
    ...scope.houses.map(house => ({ value: house._id, label: house.name })),
  ];
  // Backend vẫn bắt lần thu thuộc 1 Zone: tự gắn vào Zone tạo sớm nhất của nhà (mã tăng theo thời gian tạo), người dùng không chọn Zone
  const zoneId = scope.zones
    .filter(zone => zone.house_id === houseId)
    .reduce<string>((oldest, zone) => (oldest === '' || zone._id < oldest ? zone._id : oldest), '');
  const isHouseWithoutZone = houseId !== '' && zoneId === '';
  const canSubmit = isEdit || (Boolean(zoneId) && Boolean(harvestDate));

  function setAmount(nestType: NestType, field: keyof AmountText, value: string): void {
    setAmounts(current => ({ ...current, [nestType]: { ...current[nestType], [field]: value } }));
  }

  // Báo loại yến lưu lỗi và giữ lại số liệu các loại đó để thử lại
  function reportFailures(failedTypes: NestType[], reason: unknown): void {
    push(t('form.partialFailed', {
      types: failedTypes.map(nestType => t(`nestType.${nestType}`)).join(', '),
      reason: apiErrorMessage(reason, isEdit ? t('form.updateFailed') : t('form.createFailed')),
    }), 'error');
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setIsSubmitted(true);
    const targetZoneId = group?.zone_id ?? zoneId;
    if (!targetZoneId || dateError || hasRowError || isEmpty) return;

    setIsSaving(true);
    const productImages = imageLinks;
    // Ngày thu là 0 giờ giờ VN của ngày đã chọn; sửa thì giữ nguyên ngày cũ
    const harvestDateIso = group?.harvest_date ?? `${harvestDate}T00:00:00+07:00`;
    const batchByType = new Map<NestType, HarvestBatch>(group?.batches.map(batch => [batch.nest_type, batch]));
    const filledByType = new Map(filledRows.map(row => [row.nestType, row]));

    // Mỗi loại: có số + đã có đợt → sửa; có số + chưa có → tạo; hết số + đã có đợt → xoá
    const operations = NEST_TYPES.flatMap<SaveOperation>(nestType => {
      const row = filledByType.get(nestType);
      const batch = batchByType.get(nestType);
      if (row && batch) {
        return [{ nestType, run: () => updateHarvest.mutateAsync({
          id: batch._id, nest_count: row.nests, weight_grams: row.grams, product_images: productImages,
        }) }];
      }
      if (row) {
        return [{ nestType, run: () => createHarvest.mutateAsync({
          zone_id: targetZoneId, harvest_date: harvestDateIso, nest_count: row.nests, weight_grams: row.grams,
          nest_type: nestType, product_images: productImages,
        }) }];
      }
      if (batch) return [{ nestType, run: () => deleteHarvest.mutateAsync(batch._id) }];
      return [];
    });
    const results = await Promise.allSettled(operations.map(operation => operation.run()));
    setIsSaving(false);

    const failedTypes = operations.filter((_, index) => results[index].status === 'rejected').map(operation => operation.nestType);
    if (failedTypes.length === 0) {
      push(isEdit ? t('form.updated') : t('form.createdCount', { n: filledRows.length }));
      onClose();
      return;
    }
    const firstFailure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    reportFailures(failedTypes, firstFailure.reason);
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? t('form.editTitle') : t('form.createTitle')} className="max-w-2xl">
      <form onSubmit={event => void handleSubmit(event)} noValidate className="flex flex-col gap-4">
        {/* Hàng 1: nhà yến · ngày thu cùng hàng; sửa thì 2 ô này cố định */}
        {isEdit ? (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-3">
              <Input label={t('form.house')} value={houseName ?? NO_VALUE} disabled readOnly />
              <Input label={t('form.creator')} value={creatorName} disabled readOnly />
              <Input label={t('form.date')} value={formatStandardDate(group.harvest_date)} disabled readOnly />
            </div>
            <p className="text-xs text-warmGray">{t('form.lockedHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-3">
              {/* Nhà yến: khoá theo khung lọc nếu đang lọc 1 nhà */}
              {isHouseLocked ? (
                <Input label={t('form.house')} value={scope.houseName} disabled readOnly />
              ) : (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <FieldLabel text={t('form.house')} />
                  <SelectMenu
                    field
                    ariaLabel={t('form.house')}
                    value={houseId}
                    options={houseOptions}
                    className={fieldStateClass(Boolean(houseId))}
                    invalid={isHouseWithoutZone}
                    onChange={setHouseId}
                  />
                  {isHouseWithoutZone && <span className="text-xs text-alertRed">{t('form.houseNoZone')}</span>}
                </div>
              )}
              {/* Người nhập: người đang đăng nhập, backend tự ghi người tạo */}
              <Input label={t('form.creator')} value={creatorName} disabled readOnly />
              <HarvestDatePicker
                id="harvest-date"
                label={t('form.date')}
                min={HARVEST_DATE_MIN}
                max={today}
                value={harvestDate}
                onChange={setHarvestDate}
                error={(isSubmitted || harvestDate !== '') && dateError ? t(dateError) : undefined}
              />
            </div>
            {isHouseLocked && <p className="text-xs text-warmGray">{t('form.scopeHint')}</p>}
          </div>
        )}

        {/* Hàng 2: bảng sản lượng 3 loại yến, rộng hết popup */}
        <div className="flex flex-col gap-2">
          <div>
            <span className="label-caption">{t('form.amountsTitle')}</span>
            <p className="mt-0.5 text-xs text-warmGray">{t('form.amountsHint')}</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-warmGray/15">
            {/* Tiêu đề cột */}
            <div className="grid grid-cols-[8rem_1fr_1fr] gap-3 border-b border-warmGray/15 bg-warmGray/5 px-3 py-1.5 label-caption">
              <span>{t('form.colType')}</span>
              <span>{t('form.nests')}</span>
              <span>{t('form.weight')}</span>
            </div>
            {checks.map(check => {
              const rowError = check.error && (isSubmitted || check.error === 'negative') ? t(AMOUNT_ERROR_KEY[check.error]) : null;
              return (
                <div key={check.nestType} className="border-b border-warmGray/10 px-3 py-1.5 last:border-b-0">
                  <div className="grid grid-cols-[8rem_1fr_1fr] items-center gap-3">
                    {/* Cùng badge loại yến trong bảng lần thu */}
                    <span className={cn('inline-flex w-fit items-center rounded-full font-medium', LEVEL_BADGE_SIZE, NEST_TYPE_BADGE_CLASS[check.nestType])}>
                      {t(`nestType.${check.nestType}`)}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      placeholder="0"
                      aria-label={`${t(`nestType.${check.nestType}`)} — ${t('form.nests')}`}
                      value={amounts[check.nestType].nests}
                      onKeyDown={blockSignKeys}
                      onChange={event => setAmount(check.nestType, 'nests', event.target.value)}
                      className={cn(AMOUNT_INPUT_CLASS, rowError && 'border-alertRed focus:border-alertRed')}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                      placeholder="0"
                      aria-label={`${t(`nestType.${check.nestType}`)} — ${t('form.weight')}`}
                      value={amounts[check.nestType].grams}
                      onKeyDown={blockSignKeys}
                      onChange={event => setAmount(check.nestType, 'grams', event.target.value)}
                      className={cn(AMOUNT_INPUT_CLASS, rowError && 'border-alertRed focus:border-alertRed')}
                    />
                  </div>
                  {rowError && <p className="mt-1 text-right text-xs text-alertRed">{rowError}</p>}
                </div>
              );
            })}
            {/* Dòng tổng, chỉ cộng các loại hợp lệ */}
            <div className="grid grid-cols-[8rem_1fr] items-center gap-3 bg-warmGray/5 px-3 py-2 text-sm">
              <span className="font-semibold text-charcoal">{t('form.total')}</span>
              <span className="tabular-nums text-graphite">
                {t('form.totalValue', { nests: num(totalNests), grams: exact(totalGrams, GRAM_DIGITS), kg: num(totalGrams / GRAMS_PER_KILOGRAM, KILOGRAM_DIGITS) })}
              </span>
            </div>
          </div>
          {isSubmitted && isEmpty && !hasRowError && <p className="text-xs text-alertRed">{t('form.errorEmpty')}</p>}
        </div>

        {/* Hàng 3: link ảnh sản phẩm dùng chung cho các loại */}
        <ImageLinksField links={imageLinks} onChange={setImageLinks} disabled={isSaving} />

        {/* Chân popup: Huỷ / Tạo hoặc Lưu */}
        <div className="flex justify-end gap-2 border-t border-warmGray/10 pt-4">
          <Button type="button" variant="secondary" className="min-w-[8rem]" onClick={onClose}>{t('form.cancel')}</Button>
          <Button type="submit" className="min-w-[8rem]" loading={isSaving} disabled={!canSubmit}>{isEdit ? t('form.save') : t('form.create')}</Button>
        </div>
      </form>
    </Modal>
  );
}
