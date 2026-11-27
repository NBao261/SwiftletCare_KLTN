// DomainExpertReviewsPage.tsx: Màn hình thẩm định thay đổi tham số và đề xuất hệ số mờ

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useZoneStore } from '@/stores/zoneStore';
import { useToastStore } from '@/stores/toastStore';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { Button, SectionCard } from '@/components/ui';
import StatusTabs from '@/components/common/StatusTabs';
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import {
  useParameterReviews,
  useAcceptParameterReview,
  useRevertParameterReview,
  useCoefficientProposals,
  useApproveCoefficientProposal,
  useRejectCoefficientProposal,
} from '@/hooks/domain-expert/useExpertReviews';
import ParameterReviewCard, { type ReviewPlaces } from '@/components/features/domain-expert/reviews/ParameterReviewCard';
import { useAllZones, useHouses } from '@/hooks/shared/useFarms';
import CoefficientProposalCard from '@/components/features/domain-expert/reviews/CoefficientProposalCard';
import type {
  ParameterReviewStatus,
  CoefficientProposalStatus,
} from '@/types/expert/reviews.types';
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights';
import { t } from '@/i18n';

type ActiveTab = 'reviews' | 'proposals';

const REVIEW_STATUS_OPTIONS: SelectMenuOption<ParameterReviewStatus | 'ALL'>[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { value: 'ACCEPTED', label: 'Đã giữ' },
  { value: 'REVERTED', label: 'Đã hoàn tác' },
  { value: 'ADJUSTED', label: 'Chuyên gia đã chỉnh' },
];

const PROPOSAL_STATUS_OPTIONS: SelectMenuOption<CoefficientProposalStatus | 'ALL'>[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'PROPOSED', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt và áp dụng' },
  { value: 'REJECTED', label: 'Đã từ chối' },
  { value: 'SUPERSEDED', label: 'Đã bị thay thế' },
];

export default function DomainExpertReviewsPage() {
  const { isExpert } = useExpertDecisionRights();
  // Trang ở cấp farm: mục theo nhà, theo camera không có Zone nên không lọc theo Zone đang chọn
  const { selectedFarmId } = useZoneStore();
  const farmId = selectedFarmId || '';
  // Tên Zone và nhà dựng một lần cho mọi thẻ mục duyệt
  const { data: allZones } = useAllZones();
  const { data: houses } = useHouses(farmId || undefined);
  const places = useMemo<ReviewPlaces>(() => ({
    zoneNames: new Map((allZones ?? []).map(zone => [zone._id, `${zone.houseName} · ${zone.name}`])),
    houseNames: new Map((houses ?? []).map(house => [house._id, house.name])),
  }), [allZones, houses]);

  const pushToast = useToastStore((state) => state.push);
  const apiErrorMessage = useApiErrorMessage();

  // Hàng đợi việc mở thẳng tab đề xuất bằng ?tab=proposals
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTab>(searchParams.get('tab') === 'proposals' ? 'proposals' : 'reviews');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ParameterReviewStatus | 'ALL'>('PENDING_REVIEW');
  const [proposalStatusFilter, setProposalStatusFilter] = useState<CoefficientProposalStatus | 'ALL'>('PROPOSED');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 1. Data hooks với usePaginatedListQuery
  const {
    records: reviews,
    isLoading: isLoadingReviews,
    isError: isReviewsError,
    refetch: refetchReviews,
  } = useParameterReviews({
    farmId,
    status: reviewStatusFilter === 'ALL' ? undefined : reviewStatusFilter,
  });

  const {
    records: proposals,
    isLoading: isLoadingProposals,
    isError: isProposalsError,
    refetch: refetchProposals,
  } = useCoefficientProposals({
    farmId,
    status: proposalStatusFilter === 'ALL' ? undefined : proposalStatusFilter,
  });

  // Query đếm tổng số pending để hiển thị badge tab
  const { total: pendingReviewsCount = 0 } = useParameterReviews({
    farmId,
    status: 'PENDING_REVIEW',
  });
  const { total: pendingProposalsCount = 0 } = useCoefficientProposals({
    farmId,
    status: 'PROPOSED',
  });

  // 2. Mutation hooks
  const acceptMutation = useAcceptParameterReview();
  const revertMutation = useRevertParameterReview();
  const approveProposalMutation = useApproveCoefficientProposal();
  const rejectProposalMutation = useRejectCoefficientProposal();

  // Handlers for Parameter Reviews
  const handleAcceptReview = async (reviewId: string) => {
    try {
      setProcessingId(reviewId);
      await acceptMutation.mutateAsync(reviewId);
      pushToast('Đã giữ thay đổi tham số.', 'success');
      void refetchReviews();
    } catch (error: unknown) {
      pushToast(apiErrorMessage(error, 'Không giữ được thay đổi. Thử lại.'), 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevertReview = async (reviewId: string) => {
    try {
      setProcessingId(reviewId);
      await revertMutation.mutateAsync(reviewId);
      pushToast('Đã hoàn tác, tham số về giá trị cũ.', 'success');
      void refetchReviews();
    } catch (error: unknown) {
      pushToast(apiErrorMessage(error, 'Không hoàn tác được. Thử lại.'), 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Handlers for Coefficient Proposals
  const handleApproveProposal = async (proposalId: string) => {
    try {
      setProcessingId(proposalId);
      await approveProposalMutation.mutateAsync(proposalId);
      pushToast('Đã duyệt và áp dụng đề xuất hệ số mờ.', 'success');
      void refetchProposals();
    } catch (error: unknown) {
      pushToast(apiErrorMessage(error, 'Không duyệt được đề xuất. Thử lại.'), 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectProposal = async (proposalId: string, note: string): Promise<boolean> => {
    try {
      setProcessingId(proposalId);
      await rejectProposalMutation.mutateAsync({ proposalId, note });
      pushToast('Đã từ chối đề xuất hệ số mờ kèm lý do chuyên môn.', 'success');
      void refetchProposals();
      return true;
    } catch (error: unknown) {
      pushToast(apiErrorMessage(error, 'Không từ chối được đề xuất. Thử lại.'), 'error');
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const isReviewFiltered = reviewStatusFilter !== 'ALL';
  const isProposalFiltered = proposalStatusFilter !== 'ALL';

  // Render danh sách thay đổi tham số
  const renderReviewsContent = () => {
    if (isLoadingReviews) {
      return <LoadingSkeleton count={3} className="h-44 w-full rounded-2xl" />;
    }

    if (isReviewsError) {
      return (
        <div className="p-8">
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8 text-alertRed" />}
            title={t('Không tải được danh sách thay đổi tham số')}
            description={t('Kiểm tra kết nối mạng rồi thử lại.')}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void refetchReviews()}
              >
                {t('Thử lại')}
              </Button>
            }
          />
        </div>
      );
    }

    if (reviews.length === 0) {
      return (
        <p className="py-6 text-center text-sm text-warmGray">
          {isReviewFiltered ? t('Không tìm thấy mục nào phù hợp bộ lọc.') : t('Chưa có thay đổi tham số nào cần duyệt.')}
        </p>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4">
        {reviews.map((review) => (
          <ParameterReviewCard
            key={review._id}
            review={review}
            onAccept={handleAcceptReview}
            onRevert={handleRevertReview}
            isProcessing={processingId === review._id}
            readOnly={!isExpert}
            places={places}
          />
        ))}
      </div>
    );
  };

  // Render danh sách đề xuất hệ số mờ
  const renderProposalsContent = () => {
    if (isLoadingProposals) {
      return <LoadingSkeleton count={3} className="h-44 w-full rounded-2xl" />;
    }

    if (isProposalsError) {
      return (
        <div className="p-8">
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8 text-alertRed" />}
            title={t('Không tải được danh sách đề xuất hệ số mờ')}
            description={t('Kiểm tra kết nối mạng rồi thử lại.')}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void refetchProposals()}
              >
                {t('Thử lại')}
              </Button>
            }
          />
        </div>
      );
    }

    if (proposals.length === 0) {
      return (
        <p className="py-6 text-center text-sm text-warmGray">
          {isProposalFiltered ? t('Không tìm thấy mục nào phù hợp bộ lọc.') : t('Chưa có đề xuất hệ số mờ nào.')}
        </p>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4">
        {proposals.map((proposal) => (
          <CoefficientProposalCard
            key={proposal._id}
            proposal={proposal}
            onApprove={handleApproveProposal}
            onReject={handleRejectProposal}
            isProcessing={processingId === proposal._id}
            readOnly={!isExpert}
          />
        ))}
      </div>
    );
  };

  return (
    <SectionCard description={activeTab === 'reviews'
      ? t('Giữ hoặc hoàn tác thay đổi ngưỡng, hệ số mờ của chủ nhà yến.')
      : t('Duyệt hoặc từ chối gợi ý hệ số mờ chủ nhà yến gửi lên.')}
    >
      <StatusTabs
        variant="underline"
        ariaLabel={t('Duyệt & đề xuất')}
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'reviews', label: t('Duyệt thay đổi tham số'), badge: pendingReviewsCount },
          { id: 'proposals', label: t('Đề xuất hệ số mờ'), badge: pendingProposalsCount },
        ]}
      />

      {/* Chỉ một ô lọc trạng thái, mặc định "Chờ duyệt": đổi ô là đủ, không cần nút Huỷ lọc */}
      <div>
        {activeTab === 'reviews' ? (
          <SelectMenu
            value={reviewStatusFilter}
            options={REVIEW_STATUS_OPTIONS}
            onChange={setReviewStatusFilter}
            ariaLabel={t('Lọc theo trạng thái duyệt tham số')}
          />
        ) : (
          <SelectMenu
            value={proposalStatusFilter}
            options={PROPOSAL_STATUS_OPTIONS}
            onChange={setProposalStatusFilter}
            ariaLabel={t('Lọc theo trạng thái đề xuất hệ số')}
          />
        )}
      </div>

      {activeTab === 'reviews' ? renderReviewsContent() : renderProposalsContent()}
    </SectionCard>
  );
}
