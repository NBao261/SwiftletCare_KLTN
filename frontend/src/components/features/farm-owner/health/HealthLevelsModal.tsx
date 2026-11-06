import { useEffect, useState } from 'react';

import { Button, EmptyState, Input, LoadingSkeleton, Modal } from '@/components/ui';
import { healthDict } from '@/constants/health.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHealthLevels, useUpdateHealthLevels } from '@/hooks/shared/useHealthDays';
import { useToastStore } from '@/stores/toastStore';
import { HEALTH_LEVEL_LIMITS, validateHealthLevels, type HealthLevelError, type HealthLevelKey } from '@/validations/common/healthLevels.validation';
import type { HealthLevels } from '@/types';

// 3 chỉ số có mức riêng, mỗi chỉ số 1 hàng; đàn chim lấy mức từ tham số phát hiện của nhà (hàng chỉ ghi chú).
// op: phép so sánh như backend (healthAssessment.service) — môi trường thấp hơn mốc là lệch, không khí và tiếng ồn từ mốc trở lên là lệch
type Source = 'environment' | 'air' | 'noise';
const ROWS: Array<{ source: Source; op: '<' | '≥'; slight: HealthLevelKey; clear: HealthLevelKey; step: number }> = [
  { source: 'environment', op: '<', slight: 'in_range_slight_pct', clear: 'in_range_clear_pct', step: 1 },
  { source: 'air', op: '≥', slight: 'air_slight_h', clear: 'air_clear_h', step: 0.5 },
  { source: 'noise', op: '≥', slight: 'noise_slight', clear: 'noise_clear', step: 1 },
];

// Cột: tên chỉ số co giãn + 2 cột điều kiện
const GRID = 'grid grid-cols-[minmax(0,1fr)_8.5rem_8.5rem] items-center gap-x-3';

const ERROR_KEY: Record<HealthLevelError, 'levels.errNumber' | 'levels.errRange' | 'levels.errInteger' | 'levels.errEnvironmentOrder' | 'levels.errAscendingOrder'> = {
  number: 'levels.errNumber',
  range: 'levels.errRange',
  integer: 'levels.errInteger',
  environmentOrder: 'levels.errEnvironmentOrder',
  ascendingOrder: 'levels.errAscendingOrder',
};

type Draft = Record<HealthLevelKey, string>;
const toDraft = (levels: HealthLevels): Draft =>
  Object.fromEntries(Object.entries(levels).map(([key, value]) => [key, String(value)])) as Draft;

interface HealthLevelsModalProps {
  open: boolean;
  onClose: () => void;
  house: { id: string; name: string };
  // Domain Expert sửa; Farm Owner chỉ khi farm chưa có chuyên gia (BR-22) — backend vẫn chặn lần cuối
  canEdit: boolean;
  // Lý do chỉ xem khi không sửa được
  readOnlyNote: string;
}

/**
 * ANALYTICS-FR-012, BR-28 — mức xếp từng chỉ số vào Lệch nhẹ / Lệch rõ của 1 nhà yến.
 * Bảng điều kiện: cột "Lệch nhẹ khi / Lệch rõ khi", mỗi ô là phép so sánh + mốc + đơn vị nên đọc ra luôn ý nghĩa, không cần chữ giải thích.
 * Một khung dọc, mọi chỉ số thấy cùng lúc; thân popup cuộn khi màn thấp nên không tràn.
 */
export default function HealthLevelsModal({ open, onClose, house, canEdit: canEditGuess, readOnlyNote }: HealthLevelsModalProps): JSX.Element {
  const { t, exact } = useTranslation(healthDict);
  const { data, isLoading, isError, error, refetch } = useHealthLevels(open ? house.id : '');
  const update = useUpdateHealthLevels(house.id);
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<HealthLevelKey, HealthLevelError>>>({});
  // Backend là chốt cuối của BR-22: lưu bị 403 thì chuyển sang chỉ xem với lý do backend trả về.
  // ponytail: canEdit của trang đoán theo members[].role (không biết chuyên gia bị khoá) — bỏ khi backend trả can_edit trong HouseHealthLevels
  const [deniedReason, setDeniedReason] = useState<string | null>(null);
  const canEdit = canEditGuess && !deniedReason;

  // Mở popup hoặc tải xong thì lấy giá trị đang dùng
  useEffect(() => {
    if (open && data) setDraft(toDraft(data.health_levels));
    if (!open) {
      setDraft(null);
      setErrors({});
      setDeniedReason(null);
    }
  }, [open, data]);

  function handleSave(): void {
    if (!draft) return;
    const values = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim() === '' ? NaN : Number(value)])) as Record<HealthLevelKey, number>;
    const nextErrors = validateHealthLevels(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    update.mutate(values, {
      onSuccess: () => {
        push(t('levels.saved'));
        onClose();
      },
      onError: saveError => {
        const status = (saveError as { response?: { status?: number } }).response?.status;
        if (status === 403) setDeniedReason(apiErrorMessage(saveError));
        else push(apiErrorMessage(saveError), 'error');
      },
    });
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={t('levels.title', { house: house.name })}>
      <div className="flex flex-col gap-5">
        {/* Thanh ngang ngăn tiêu đề với nội dung (cùng nét ModalHeader của popup người dùng) */}
        <hr className="border-gray-200" />
        <p className="text-sm text-warmGray">{t('levels.intro')}</p>

        {isLoading || (!draft && !isError) ? (
          <LoadingSkeleton count={3} className="h-16 w-full" />
        ) : isError || !data || !draft ? (
          <EmptyState
            title={t('levels.loadFailed')}
            description={apiErrorMessage(error)}
            action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('page.retry')}</Button>}
          />
        ) : (
          <>
            {/* Thân popup cuộn trong khung khi màn thấp (đầu popup và nút luôn thấy) */}
            <div className="-mx-1 max-h-[55vh] overflow-y-auto px-1">
              <div className={`${GRID} border-b border-gray-200 pb-2`}>
                <span />
                <span className="label-caption">{t('levels.slightWhen')}</span>
                <span className="label-caption">{t('levels.clearWhen')}</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {ROWS.map(row => {
                  // Lỗi của hàng (mốc nhẹ trước); khoảng cho phép chỉ hiện khi nhập ra ngoài
                  const errorKey = errors[row.slight] ? row.slight : errors[row.clear] ? row.clear : null;
                  // Ô điều kiện: phép so sánh + ô số nhỏ + đơn vị; mặc định hiện mờ khi ô trống
                  const condition = (key: HealthLevelKey, header: 'levels.slightWhen' | 'levels.clearWhen') => (
                    <div className="flex items-center gap-2 text-sm text-graphite">
                      <span className="w-3 text-center">{row.op}</span>
                      <Input
                        aria-label={`${t(`levels.${row.source}`)} · ${t(header)}`}
                        type="number"
                        step={row.step}
                        value={draft[key]}
                        placeholder={exact(data.defaults[key], 1)}
                        title={t('levels.default', { value: exact(data.defaults[key], 1) })}
                        disabled={!canEdit}
                        className={`w-16 px-2 py-1.5 text-center disabled:border-warmGray/20 disabled:bg-white disabled:text-graphite ${errors[key] ? 'border-alertRed' : ''}`}
                        onChange={event => setDraft({ ...draft, [key]: event.target.value })}
                      />
                      <span>{t(`levels.unit.${row.source}`)}</span>
                    </div>
                  );
                  return (
                    <li key={row.source} className="py-3">
                      <div className={GRID}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-charcoal">{t(`levels.${row.source}`)}</p>
                          <p className="truncate text-xs text-warmGray">{t(`levels.${row.source}Hint`)}</p>
                        </div>
                        {condition(row.slight, 'levels.slightWhen')}
                        {condition(row.clear, 'levels.clearWhen')}
                      </div>
                      {errorKey && (
                        <p className="mt-1 text-right text-xs text-alertRed">
                          {t(ERROR_KEY[errors[errorKey]!], { min: exact(HEALTH_LEVEL_LIMITS[errorKey].min, 1), max: exact(HEALTH_LEVEL_LIMITS[errorKey].max, 1) })}
                        </p>
                      )}
                    </li>
                  );
                })}
                {/* Đàn chim: không có ô nhập ở đây, chỉ ghi nguồn mốc */}
                <li className={`${GRID} py-3`}>
                  <p className="text-sm font-semibold text-charcoal">{t('levels.flockReturn')}</p>
                  <p className="col-span-2 text-sm text-warmGray">{t('levels.flockNote')}</p>
                </li>
              </ul>
            </div>

            {/* Sửa được: Về mặc định + Lưu; chỉ xem: lý do (đóng bằng ✕ ở góc) */}
            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              {canEdit ? (
                <>
                  <Button variant="secondary" onClick={() => {
                    setDraft(toDraft(data.defaults));
                    setErrors({});
                  }}>
                    {t('levels.reset')}
                  </Button>
                  <Button onClick={handleSave} loading={update.isPending}>{t('levels.save')}</Button>
                </>
              ) : (
                <p className="text-sm italic text-warmGray">{deniedReason ?? readOnlyNote}</p>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
