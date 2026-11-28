import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useZoneStore } from '@/stores/zoneStore';
import { useToastStore } from '@/stores/toastStore';
import { t } from '@/i18n';
import LoadError from '@/components/ui/LoadError';
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
import { usePermission } from '@/hooks/common/usePermission';

// Ngưỡng & hệ số mờ: nơi duy nhất sửa ngưỡng và hệ số mờ của một Zone trên web
// Câu mở đầu của lỗi theo từng thao tác lưu: người dùng biết thao tác nào vừa thất bại
const FAILED_MESSAGE: Record<string, string> = {
  'Đã lưu ngưỡng môi trường': 'Lưu ngưỡng môi trường thất bại',
  'Đã khôi phục ngưỡng mặc định': 'Khôi phục ngưỡng mặc định thất bại',
  'Đã lưu hệ số mờ': 'Lưu hệ số mờ thất bại',
  'Đã lưu tham số phát hiện': 'Lưu tham số phát hiện thất bại',
  'Đã khôi phục tham số phát hiện mặc định': 'Khôi phục tham số phát hiện thất bại',
  'Đã áp dụng gợi ý hệ số cho Zone': 'Áp dụng gợi ý hệ số thất bại',
  'Đã gửi gợi ý hệ số cho chuyên gia duyệt': 'Gửi gợi ý hệ số thất bại',
  'Đã lưu mức giảm tỷ lệ chim về của nhà': 'Lưu mức giảm tỷ lệ chim về thất bại',
  'Đã khôi phục mức giảm tỷ lệ chim về mặc định': 'Khôi phục mức giảm tỷ lệ chim về thất bại',
}

export default function DomainExpertZoneTuningPage() {
  const { selectedFarmId, selectedZoneId } = useZoneStore();
  const zoneId = selectedZoneId ?? undefined;
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();
  // Kỹ thuật viên chỉ đọc tham số; gợi ý hệ số và đề xuất là của Farm Owner, chuyên gia (backend 403 với thợ)
  const isTechnician = usePermission('FARM_TECHNICIAN');

  const thresholds = useExpertThresholds(zoneId);
  const fuzzy = useExpertFuzzyTuning(zoneId);
  const suggestion = useFuzzySuggestion(isTechnician ? undefined : zoneId);
  const detection = useExpertDetectionTuning(zoneId);
  const { data: verdictStats = [] } = useExpertVerdictStats(undefined, zoneId);

  // Đề xuất hệ số mờ đang chờ chuyên gia duyệt của Zone
  const { total: pendingProposalsCount = 0 } = useCoefficientProposals({
    farmId: selectedFarmId ?? '',
    zoneId,
    status: 'PROPOSED',
  }, { enabled: !isTechnician });

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
  // Trả về true khi lưu được: khối khôi phục mặc định dùng để đặt lại ô đang sửa dở
  function notify(action: Promise<unknown>, doneMessage: string, reviewed = true): Promise<boolean> {
    const message = ownerNeedsExpert && reviewed ? `${t(doneMessage)}. ${t('Chuyên gia sẽ xem lại thay đổi này.')}` : t(doneMessage);
    return action
      .then(() => { push(message); return true; })
      .catch(error => { push(apiErrorMessage(error, t(FAILED_MESSAGE[doneMessage] ?? 'Lưu thất bại')), 'error'); return false; });
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

  // Tải thông số lỗi thì báo lỗi, không để các ô trống như Zone chưa có số liệu
  const loadError = [thresholds, fuzzy, detection].find(query => query.isError)
  if (loadError) {
    return (
      <LoadError
        title={t('Không tải được thông số của Zone')}
        error={loadError.error}
        onRetry={() => void Promise.all([thresholds.refetch(), fuzzy.refetch(), detection.refetch()])}
      />
    )
  }

  return (
    <div className="relative flex w-full flex-1 flex-col gap-6">
      {/* Zone đang sửa nằm ở bộ lọc trên header; đề xuất chờ duyệt là việc cần làm nên giữ một dòng */}
      {pendingProposalsCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-climateOrange/10 px-4 py-3 text-sm text-charcoal">
          <span className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 shrink-0 text-climateOrange" />
            {t('Zone này có {{n}} đề xuất hệ số mờ của chủ nhà yến đang chờ chuyên gia duyệt.', { n: pendingProposalsCount })}
          </span>
          <Link to="/domain-expert/reviews" className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
            {t('Xem đề xuất')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* key theo Zone: đổi Zone thì khối dựng lại, không mang số chưa lưu của Zone trước sang Zone mới */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <fieldset disabled={!canEditParameters} className="contents">
            <ThresholdColumn
              key={zoneId ?? 'none'}
              data={thresholds.data}
              isLoading={thresholds.isLoading}
              isSaving={updateThresholds.isPending}
              isResetting={resetThresholds.isPending}
              onSave={values => notify(updateThresholds.mutateAsync(values), 'Đã lưu ngưỡng môi trường')}
              onReset={() => notify(resetThresholds.mutateAsync(), 'Đã khôi phục ngưỡng mặc định')}
            />
          </fieldset>

          <fieldset disabled={!canEditParameters} className="contents">
            <ReturnRateDropCard
              houseName={house?.name}
              value={house?.bird_count_tuning?.return_rate_drop_pct}
              isSaving={returnRateDrop.update.isPending}
              isResetting={returnRateDrop.reset.isPending}
              onSave={value => house && notify(returnRateDrop.update.mutateAsync({ houseId: house._id, value }), 'Đã lưu mức giảm tỷ lệ chim về của nhà')}
              onReset={() => (house ? notify(returnRateDrop.reset.mutateAsync(house._id), 'Đã khôi phục mức giảm tỷ lệ chim về mặc định') : undefined)}
            />
          </fieldset>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <fieldset disabled={!canEditParameters} className="contents">
            <FuzzyTuningColumn
              key={zoneId ?? 'none'}
              data={fuzzy.data}
              isLoading={fuzzy.isLoading}
              isSaving={updateFuzzy.isPending}
              onSave={changed => notify(updateFuzzy.mutateAsync(changed), 'Đã lưu hệ số mờ')}
              suggestion={suggestion.data}
              isSuggestionLoading={suggestion.isLoading}
              suggestionAction={suggestionAction}
              showSuggestion={!isTechnician}
            />
          </fieldset>

          <fieldset disabled={!canEditParameters} className="contents">
            <DetectionColumn
              key={zoneId ?? 'none'}
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
      </div>

    </div>
  );
}
