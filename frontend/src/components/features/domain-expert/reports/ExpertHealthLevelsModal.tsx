// ExpertHealthLevelsModal.tsx — Chuyên gia chỉnh mức phân loại chỉ số sức khỏe nhà yến
// EXPERT-FR-022 · ANALYTICS-FR-012 · BR-28 · BR-22

import { useEffect, useState } from 'react';
import { AlertCircle, Bird, RotateCcw } from 'lucide-react';

import { Button, EmptyState, LoadingSkeleton, Modal } from '@/components/ui';
import { healthDict } from '@/constants/health.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import {
  useHealthLevels,
  useUpdateHealthLevels,
} from '@/hooks/shared/useHealthDays';
import { useToastStore } from '@/stores/toastStore';
import {
  HEALTH_LEVEL_LIMITS,
  validateHealthLevels,
  type HealthLevelError,
  type HealthLevelKey,
} from '@/validations/common/healthLevels.validation';
import type { HealthLevels } from '@/types';

type Source = 'environment' | 'air' | 'noise';

interface RowConfig {
  source: Source;
  op: '<' | '≥';
  slight: HealthLevelKey;
  clear: HealthLevelKey;
  step: number;
}

const ROWS: RowConfig[] = [
  { source: 'environment', op: '<',  slight: 'in_range_slight_pct', clear: 'in_range_clear_pct', step: 1   },
  { source: 'air',         op: '≥', slight: 'air_slight_h',         clear: 'air_clear_h',         step: 0.5 },
  { source: 'noise',       op: '≥', slight: 'noise_slight',         clear: 'noise_clear',         step: 1   },
];

const ERROR_KEY: Record<
  HealthLevelError,
  | 'levels.errNumber'
  | 'levels.errRange'
  | 'levels.errInteger'
  | 'levels.errEnvironmentOrder'
  | 'levels.errAscendingOrder'
> = {
  number:            'levels.errNumber',
  range:             'levels.errRange',
  integer:           'levels.errInteger',
  environmentOrder:  'levels.errEnvironmentOrder',
  ascendingOrder:    'levels.errAscendingOrder',
};

type Draft = Record<HealthLevelKey, string>;
const toDraft = (levels: HealthLevels): Draft =>
  Object.fromEntries(
    Object.entries(levels).map(([key, value]) => [key, String(value)]),
  ) as Draft;

interface ExpertHealthLevelsModalProps {
  open: boolean;
  onClose: () => void;
  house: { id: string; name: string };
  canEdit: boolean;
  readOnlyNote: string;
}

/**
 * Modal tinh chỉnh mức sức khỏe của nhà yến (màn Chuyên gia).
 * Kết nối GET / PUT /farms/houses/{houseId}/health-levels (Kiệt · BR-28).
 */
export default function ExpertHealthLevelsModal({
  open,
  onClose,
  house,
  canEdit: canEditGuess,
  readOnlyNote,
}: ExpertHealthLevelsModalProps): JSX.Element {
  const { t, exact } = useTranslation(healthDict);
  const { data, isLoading, isError, error, refetch } = useHealthLevels(open ? house.id : '');
  const update = useUpdateHealthLevels(house.id);
  const push    = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();

  const [draft, setDraft]           = useState<Draft | null>(null);
  const [errors, setErrors]         = useState<Partial<Record<HealthLevelKey, HealthLevelError>>>({});
  const [deniedReason, setDenied]   = useState<string | null>(null);

  // Dùng can_edit từ backend (GET trả về) thay vì tự đoán theo members; fallback sang prop khi chưa load xong
  const backendCanEdit = (data as { can_edit?: boolean } | undefined)?.can_edit;
  const canEdit        = (backendCanEdit ?? canEditGuess) && !deniedReason;

  useEffect(() => {
    if (open && data) setDraft(toDraft(data.health_levels));
    if (!open) { setDraft(null); setErrors({}); setDenied(null); }
  }, [open, data]);

  function handleSave(): void {
    if (!draft) return;
    const values = Object.fromEntries(
      Object.entries(draft).map(([k, v]) => [k, v.trim() === '' ? NaN : Number(v)]),
    ) as Record<HealthLevelKey, number>;
    const nextErrors = validateHealthLevels(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    update.mutate(values, {
      onSuccess: () => { push(t('levels.saved')); onClose(); },
      onError: saveError => {
        const status = (saveError as { response?: { status?: number } }).response?.status;
        if (status === 403) setDenied(apiErrorMessage(saveError));
        else push(apiErrorMessage(saveError), 'error');
      },
    });
  }

  const isDirty    = !!draft && !!data && JSON.stringify(draft) !== JSON.stringify(toDraft(data.health_levels));
  const isAtDefault = !!draft && !!data && JSON.stringify(draft) === JSON.stringify(toDraft(data.defaults));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('levels.title', { house: house.name })}
      closeOnBackdrop={!isDirty && !update.isPending}
    >
      <div className="flex w-full flex-col gap-4">
        {/* Dẫn nhập 1 dòng — đủ ý, không thừa */}
        <p className="text-xs text-warmGray">
          {t('levels.intro')}
        </p>

        {isLoading || (!draft && !isError) ? (
          <LoadingSkeleton count={3} className="h-16 w-full rounded-xl" />
        ) : isError || !data || !draft ? (
          <EmptyState
            title={t('levels.loadFailed')}
            description={apiErrorMessage(error)}
            action={
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                {t('page.retry')}
              </Button>
            }
          />
        ) : (
          <>
            {/* Vùng cuộn — chiều cao giới hạn chống tràn trục Y */}
            <div className="-mx-1 max-h-[55vh] overflow-y-auto px-1">

              {/* Header cột */}
              <div className="mb-2 grid grid-cols-[1fr_auto_auto] items-center gap-3 px-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-warmGray/70">
                  Chỉ số
                </span>
                <div className="flex w-32 items-center justify-center gap-1 rounded-lg border border-amber-200/70 bg-amber-50 px-2 py-1">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-climateOrange" />
                  <span className="text-[11px] font-semibold text-amber-900">{t('levels.slightWhen')}</span>
                </div>
                <div className="flex w-32 items-center justify-center gap-1 rounded-lg border border-red-200/70 bg-red-50 px-2 py-1">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-alertRed" />
                  <span className="text-[11px] font-semibold text-red-900">{t('levels.clearWhen')}</span>
                </div>
              </div>

              {/* Danh sách chỉ số */}
              <ul className="flex flex-col gap-2">
                {ROWS.map(row => {
                  const errorKey = errors[row.slight] ? row.slight : errors[row.clear] ? row.clear : null;
                  const unit     = t(`levels.unit.${row.source}`);

                  // Ô nhập điều kiện: operator + number input (giữ spin buttons) + unit
                  const InputCell = ({ rowKey, header }: { rowKey: HealthLevelKey; header: 'levels.slightWhen' | 'levels.clearWhen' }) => {
                    const hasErr = Boolean(errors[rowKey]);
                    const lim    = HEALTH_LEVEL_LIMITS[rowKey];
                    return (
                      <div
                        className={[
                          'flex w-32 items-center rounded-xl border px-2.5 py-1.5 transition-all',
                          !canEdit
                            ? 'border-warmGray/15 bg-stone/40 opacity-70'
                            : hasErr
                              ? 'border-alertRed bg-red-50/50 ring-1 ring-alertRed/30'
                              : 'border-warmGray/20 bg-stone/30 hover:border-warmGray/40 focus-within:border-charcoal/50 focus-within:bg-white focus-within:ring-1 focus-within:ring-charcoal/15',
                        ].join(' ')}
                      >
                        {/* Operator */}
                        <span className="mr-1.5 w-4 shrink-0 text-center font-mono text-xs font-semibold text-graphite">
                          {row.op}
                        </span>

                        {/* Number input — giữ nguyên spin buttons của trình duyệt */}
                        <input
                          aria-label={`${t(`levels.${row.source}`)} · ${t(header)}`}
                          type="number"
                          step={row.step}
                          min={lim.min}
                          max={lim.max}
                          value={draft[rowKey]}
                          placeholder={exact(data.defaults[rowKey], 1)}
                          title={`Mặc định: ${exact(data.defaults[rowKey], 1)} · Cho phép: ${exact(lim.min, 1)}–${exact(lim.max, 1)} ${unit}`}
                          disabled={!canEdit}
                          onChange={e => {
                            setDraft({ ...draft, [rowKey]: e.target.value });
                            if (errors[row.slight] || errors[row.clear]) {
                              setErrors(prev => {
                                const copy = { ...prev };
                                delete copy[row.slight];
                                delete copy[row.clear];
                                return copy;
                              });
                            }
                          }}
                          className="w-full min-w-0 bg-transparent text-center font-mono text-sm font-semibold tabular-nums text-charcoal outline-none placeholder:text-warmGray/40 disabled:cursor-not-allowed disabled:text-graphite"
                        />

                        {/* Unit */}
                        <span className="ml-1 shrink-0 text-xs text-warmGray">{unit}</span>
                      </div>
                    );
                  };

                  return (
                    <li
                      key={row.source}
                      className={[
                        'grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl border px-4 py-3',
                        errorKey ? 'border-alertRed/30 bg-red-50/10' : 'border-warmGray/15 bg-white',
                      ].join(' ')}
                    >
                      {/* Tên + hint (1 dòng mỗi cái) */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug text-charcoal">
                          {t(`levels.${row.source}`)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-warmGray">
                          {t(`levels.${row.source}Hint`)}
                        </p>
                        {errorKey && (
                          <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-alertRed">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {t(ERROR_KEY[errors[errorKey]!], {
                                min: exact(HEALTH_LEVEL_LIMITS[errorKey].min, 1),
                                max: exact(HEALTH_LEVEL_LIMITS[errorKey].max, 1),
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      <InputCell rowKey={row.slight} header="levels.slightWhen" />
                      <InputCell rowKey={row.clear}  header="levels.clearWhen"  />
                    </li>
                  );
                })}
              </ul>

              {/* Đàn chim — hàng ghi chú tĩnh, kiểu riêng */}
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-dashed border-warmGray/20 bg-stone/30 px-4 py-3">
                <Bird className="h-4 w-4 shrink-0 text-graphite" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-charcoal">{t('levels.flockReturn')}</p>
                  <p className="text-xs text-warmGray">{t('levels.flockNote')}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse gap-3 border-t border-warmGray/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
              {canEdit ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isAtDefault || update.isPending}
                    onClick={() => { setDraft(toDraft(data.defaults)); setErrors({}); }}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {t('levels.reset')}
                  </Button>
                  <Button size="sm" onClick={handleSave} loading={update.isPending}>
                    Lưu
                  </Button>
                </>
              ) : (
                <p className="text-xs italic text-warmGray">{deniedReason ?? readOnlyNote}</p>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
