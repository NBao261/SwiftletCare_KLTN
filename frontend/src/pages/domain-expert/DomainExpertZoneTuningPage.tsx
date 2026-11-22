import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useZoneStore } from '@/stores/zoneStore';
import { useToastStore } from '@/stores/toastStore';
import { t } from '@/i18n';
import { Button } from '@/components/ui/Button';
import ThresholdColumn from '@/components/features/domain-expert/tuning/ThresholdColumn';
import FuzzyTuningColumn from '@/components/features/domain-expert/tuning/FuzzyTuningColumn';
import DetectionColumn from '@/components/features/domain-expert/tuning/DetectionColumn';
import ReturnRateDropCard from '@/components/features/domain-expert/tuning/ReturnRateDropCard';
import type { TuningBlockHandle } from '@/components/features/domain-expert/tuning/tuning.utils';
import type { SuggestionAction } from '@/components/features/domain-expert/tuning/FuzzySuggestionBox';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useHouses } from '@/hooks/shared/useFarms';
import {
  useExpertThresholds, useUpdateThresholds, useResetThresholds,
  useExpertFuzzyTuning, useUpdateFuzzyTuning,
  useFuzzySuggestion,
  useExpertDetectionTuning, useUpdateDetectionTuning, useResetDetectionTuning,
  useZoneHouseId, useSaveReturnRateDrop,
} from '@/hooks/domain-expert/useZoneTuning';
import { useExpertVerdictStats } from '@/hooks/domain-expert/useExpertAlerts';
import { useApplySuggestion, useCoefficientProposals, useSubmitCoefficientProposal } from '@/hooks/domain-expert/useExpertReviews';
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights';

// Ngưỡng & hệ số mờ (ENV-FR-020…022, EXPERT-FR-004/008/011): nơi duy nhất sửa ngưỡng và hệ số mờ của một Zone trên web
export default function DomainExpertZoneTuningPage() {
  const { selectedFarmId, selectedZoneId, selectedZoneName } = useZoneStore();
  const zoneId = selectedZoneId ?? undefined;
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();

  const thresholds = useExpertThresholds(zoneId);
  const fuzzy = useExpertFuzzyTuning(zoneId);
  const suggestion = useFuzzySuggestion(zoneId);
  const detection = useExpertDetectionTuning(zoneId);
  const { data: verdictStats = [] } = useExpertVerdictStats(undefined, zoneId);

  // Đề xuất hệ số mờ đang chờ chuyên gia duyệt của Zone (EXPERT-FR-011)
  const { total: pendingProposalsCount = 0 } = useCoefficientProposals({
    farmId: selectedFarmId ?? '',
    zoneId,
    status: 'PROPOSED',
  });

  const updateThresholds = useUpdateThresholds(zoneId);
  const resetThresholds = useResetThresholds(zoneId);
  const updateFuzzy = useUpdateFuzzyTuning(zoneId);
  const updateDetection = useUpdateDetectionTuning(zoneId);
  const resetDetection = useResetDetectionTuning(zoneId);
  const applySuggestion = useApplySuggestion();
  const submitProposal = useSubmitCoefficientProposal();
  // BR-22 — Farm Owner sửa mọi tham số (chuyên gia duyệt sau); gợi ý hệ số ở farm có chuyên gia thì gửi duyệt
  const { canDecide, canEditParameters, ownerNeedsExpert } = useExpertDecisionRights();

  // Mức giảm tỷ lệ chim về thuộc nhà chứa Zone đang chọn (EXPERT-FR-008)
  const { data: houseId } = useZoneHouseId(zoneId);
  const { data: houses } = useHouses(selectedFarmId ?? undefined);
  const house = houses?.find(item => item._id === houseId);
  const returnRateDrop = useSaveReturnRateDrop(selectedFarmId);

  // DE-04: thanh lưu dính đáy chung, mỗi khối tự đếm số trường đã đổi và tự validate, gọi API qua ref
  const fuzzyRef = useRef<TuningBlockHandle>(null);
  const thresholdRef = useRef<TuningBlockHandle>(null);
  const detectionRef = useRef<TuningBlockHandle>(null);
  const returnRateRef = useRef<TuningBlockHandle>(null);
  const [dirtyCounts, setDirtyCounts] = useState({ fuzzy: 0, threshold: 0, detection: 0, returnRate: 0 });
  const totalDirty = dirtyCounts.fuzzy + dirtyCounts.threshold + dirtyCounts.detection + dirtyCounts.returnRate;
  // Giữ nguyên object khi số không đổi để React bỏ qua render, tránh vòng lặp với effect báo số của từng khối
  const reportDirty = useCallback((block: keyof typeof dirtyCounts, count: number) => {
    setDirtyCounts(previous => (previous[block] === count ? previous : { ...previous, [block]: count }));
  }, []);
  const onFuzzyDirty = useCallback((count: number) => reportDirty('fuzzy', count), [reportDirty]);
  const onThresholdDirty = useCallback((count: number) => reportDirty('threshold', count), [reportDirty]);
  const onDetectionDirty = useCallback((count: number) => reportDirty('detection', count), [reportDirty]);
  const onReturnRateDirty = useCallback((count: number) => reportDirty('returnRate', count), [reportDirty]);
  const isBulkSaving = updateFuzzy.isPending || updateThresholds.isPending || updateDetection.isPending || returnRateDrop.update.isPending;

  function handleSaveAll() {
    if (dirtyCounts.fuzzy > 0) fuzzyRef.current?.save();
    if (dirtyCounts.threshold > 0) thresholdRef.current?.save();
    if (dirtyCounts.detection > 0) detectionRef.current?.save();
    if (dirtyCounts.returnRate > 0) returnRateRef.current?.save();
  }

  function handleCancelAll() {
    fuzzyRef.current?.cancel();
    thresholdRef.current?.cancel();
    detectionRef.current?.cancel();
    returnRateRef.current?.cancel();
  }

  // Mọi thao tác lưu báo kết quả, kể cả lỗi (FE_Design 13.5); thay đổi của Farm Owner ở farm có chuyên gia mở mục duyệt
  function notify(action: Promise<unknown>, doneMessage: string, reviewed = true) {
    const message = ownerNeedsExpert && reviewed ? `${t(doneMessage)}. ${t('Chuyên gia sẽ xem lại thay đổi này.')}` : t(doneMessage);
    action.then(() => push(message)).catch(error => push(apiErrorMessage(error), 'error'));
  }

  // Gợi ý hệ số (EXPERT-FR-011): người được quyết thì áp ngay, Farm Owner ở farm có chuyên gia thì gửi chuyên gia duyệt
  let suggestionAction: SuggestionAction | undefined;
  if (zoneId && canDecide) {
    suggestionAction = {
      label: t('Áp dụng gợi ý'),
      loading: applySuggestion.isPending,
      onClick: () => notify(applySuggestion.mutateAsync(zoneId), 'Đã áp dụng gợi ý hệ số cho Zone', false),
    };
  }
  if (zoneId && ownerNeedsExpert) {
    suggestionAction = {
      label: t('Gửi chuyên gia duyệt'),
      loading: submitProposal.isPending,
      onClick: () => notify(submitProposal.mutateAsync(zoneId), 'Đã gửi gợi ý hệ số cho chuyên gia duyệt', false),
    };
  }

  return (
    <div className="relative w-full flex-1 flex flex-col gap-6">
      <div className="w-full max-w-screen-xl mx-auto space-y-6">
        {/* DE-04a: dòng phạm vi — hiện Zone đang chọn */}
        {selectedZoneName && (
          <p className="text-small text-graphite">
            {t('Áp cho Zone {{zone}}', { zone: selectedZoneName })}
          </p>
        )}

        {pendingProposalsCount > 0 && (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs shadow-sm">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{t('Zone này có {{n}} đề xuất hệ số mờ của chủ nhà yến đang chờ chuyên gia duyệt.', { n: pendingProposalsCount })}</span>
            </div>
            <Link
              to="/domain-expert/reviews"
              className="flex items-center gap-1 font-semibold text-amber-800 hover:text-amber-950 underline px-3 py-1 rounded-lg bg-amber-100/60 hover:bg-amber-100 transition-colors"
            >
              <span>{t('Xem đề xuất')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* key theo Zone: đổi Zone thì khối dựng lại, không mang số chưa lưu của Zone trước sang Zone mới */}
        <FuzzyTuningColumn
          key={zoneId ?? 'none'}
          ref={fuzzyRef}
          data={fuzzy.data}
          isLoading={fuzzy.isLoading}
          isSaving={updateFuzzy.isPending}
          onSave={changed => notify(updateFuzzy.mutateAsync(changed), 'Đã lưu hệ số mờ')}
          onDirtyChange={onFuzzyDirty}
          suggestion={suggestion.data}
          isSuggestionLoading={suggestion.isLoading}
          suggestionAction={suggestionAction}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <ThresholdColumn
            key={zoneId ?? 'none'}
            ref={thresholdRef}
            data={thresholds.data}
            isLoading={thresholds.isLoading}
            isSaving={updateThresholds.isPending}
            isResetting={resetThresholds.isPending}
            onSave={values => notify(updateThresholds.mutateAsync(values), 'Đã lưu ngưỡng môi trường')}
            onReset={() => notify(resetThresholds.mutateAsync(), 'Đã khôi phục ngưỡng mặc định')}
            onDirtyChange={onThresholdDirty}
          />

          <fieldset disabled={!canEditParameters} className="contents">
            <DetectionColumn
              key={zoneId ?? 'none'}
              ref={detectionRef}
              data={detection.data}
              verdictStats={verdictStats}
              isLoading={detection.isLoading}
              isSaving={updateDetection.isPending}
              isResetting={resetDetection.isPending}
              onSave={values => notify(updateDetection.mutateAsync(values), 'Đã lưu tham số phát hiện')}
              onReset={() => notify(resetDetection.mutateAsync(), 'Đã khôi phục tham số phát hiện mặc định')}
              onDirtyChange={onDetectionDirty}
            />
          </fieldset>
        </div>

        <fieldset disabled={!canEditParameters} className="contents">
          <ReturnRateDropCard
            ref={returnRateRef}
            houseName={house?.name}
            value={house?.bird_count_tuning?.return_rate_drop_pct}
            isSaving={returnRateDrop.update.isPending}
            isResetting={returnRateDrop.reset.isPending}
            onDirtyChange={onReturnRateDirty}
            onSave={value => house && notify(returnRateDrop.update.mutateAsync({ houseId: house._id, value }), 'Đã lưu mức giảm tỷ lệ chim về của nhà')}
            onReset={() => house && notify(returnRateDrop.reset.mutateAsync(house._id), 'Đã khôi phục mức giảm tỷ lệ chim về mặc định')}
          />
        </fieldset>
      </div>

      {/* DE-04: thanh lưu dính đáy chung cho 4 khối, nằm trên dock ở điện thoại; mỗi khối tự validate và gọi API của mình */}
      {totalDirty > 0 && (
        <div className="sticky bottom-4 z-10 mx-auto flex w-full max-w-screen-xl items-center justify-between gap-3 rounded-2xl border border-warmGray/15 bg-white px-4 py-3 shadow-dock max-lg:bottom-24">
          <span className="text-sm font-medium text-charcoal">
            {t('{{n}} thay đổi', { n: totalDirty })}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleCancelAll} disabled={isBulkSaving}>
              {t('Huỷ')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveAll} loading={isBulkSaving}>
              {t('Lưu')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
