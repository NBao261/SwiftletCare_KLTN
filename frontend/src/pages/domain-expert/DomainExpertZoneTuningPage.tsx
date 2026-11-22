import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useZoneStore } from '@/stores/zoneStore';
import { useToastStore } from '@/stores/toastStore';
import { t } from '@/i18n';
import ThresholdColumn from '@/components/features/domain-expert/tuning/ThresholdColumn';
import FuzzyTuningColumn from '@/components/features/domain-expert/tuning/FuzzyTuningColumn';
import DetectionColumn from '@/components/features/domain-expert/tuning/DetectionColumn';
import ReturnRateDropCard from '@/components/features/domain-expert/tuning/ReturnRateDropCard';
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

// Ngưỡng & hệ số mờ: nơi duy nhất sửa ngưỡng và hệ số mờ của một Zone trên web
export default function DomainExpertZoneTuningPage() {
  const { selectedFarmId, selectedZoneId } = useZoneStore();
  const zoneId = selectedZoneId ?? undefined;
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();

  const thresholds = useExpertThresholds(zoneId);
  const fuzzy = useExpertFuzzyTuning(zoneId);
  const suggestion = useFuzzySuggestion(zoneId);
  const detection = useExpertDetectionTuning(zoneId);
  const { data: verdictStats = [] } = useExpertVerdictStats(undefined, zoneId);

  // Đề xuất hệ số mờ đang chờ chuyên gia duyệt của Zone
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
  // Farm Owner sửa mọi tham số (chuyên gia duyệt sau); gợi ý hệ số ở farm có chuyên gia thì gửi duyệt
  const { canDecide, canEditParameters, ownerNeedsExpert } = useExpertDecisionRights();

  // Mức giảm tỷ lệ chim về thuộc nhà chứa Zone đang chọn
  const { data: houseId } = useZoneHouseId(zoneId);
  const { data: houses } = useHouses(selectedFarmId ?? undefined);
  const house = houses?.find(item => item._id === houseId);
  const returnRateDrop = useSaveReturnRateDrop(selectedFarmId);

  // Mọi thao tác lưu báo kết quả, kể cả lỗi (FE_Design 13.5); thay đổi của Farm Owner ở farm có chuyên gia mở mục duyệt
  function notify(action: Promise<unknown>, doneMessage: string, reviewed = true) {
    const message = ownerNeedsExpert && reviewed ? `${t(doneMessage)}. ${t('Chuyên gia sẽ xem lại thay đổi này.')}` : t(doneMessage);
    action.then(() => push(message)).catch(error => push(apiErrorMessage(error), 'error'));
  }

  // Gợi ý hệ số: người được quyết thì áp ngay, Farm Owner ở farm có chuyên gia thì gửi chuyên gia duyệt
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

        <FuzzyTuningColumn
          data={fuzzy.data}
          isLoading={fuzzy.isLoading}
          isSaving={updateFuzzy.isPending}
          onSave={changed => notify(updateFuzzy.mutateAsync(changed), 'Đã lưu hệ số mờ')}
          suggestion={suggestion.data}
          isSuggestionLoading={suggestion.isLoading}
          suggestionAction={suggestionAction}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <ThresholdColumn
            data={thresholds.data}
            isLoading={thresholds.isLoading}
            isSaving={updateThresholds.isPending}
            isResetting={resetThresholds.isPending}
            onSave={values => notify(updateThresholds.mutateAsync(values), 'Đã lưu ngưỡng môi trường')}
            onReset={() => notify(resetThresholds.mutateAsync(), 'Đã khôi phục ngưỡng mặc định')}
          />

          <fieldset disabled={!canEditParameters} className="contents">
            <DetectionColumn
              data={detection.data}
              verdictStats={verdictStats}
              isLoading={detection.isLoading}
              isSaving={updateDetection.isPending}
              isResetting={resetDetection.isPending}
              onSave={values => notify(updateDetection.mutateAsync(values), 'Đã lưu tham số phát hiện')}
              onReset={() => notify(resetDetection.mutateAsync(), 'Đã khôi phục tham số phát hiện mặc định')}
            />
          </fieldset>
        </div>

        <fieldset disabled={!canEditParameters} className="contents">
          <ReturnRateDropCard
            houseName={house?.name}
            value={house?.bird_count_tuning?.return_rate_drop_pct}
            isSaving={returnRateDrop.update.isPending}
            isResetting={returnRateDrop.reset.isPending}
            onSave={value => house && notify(returnRateDrop.update.mutateAsync({ houseId: house._id, value }), 'Đã lưu mức giảm tỷ lệ chim về của nhà')}
            onReset={() => house && notify(returnRateDrop.reset.mutateAsync(house._id), 'Đã khôi phục mức giảm tỷ lệ chim về mặc định')}
          />
        </fieldset>
      </div>
    </div>
  );
}
