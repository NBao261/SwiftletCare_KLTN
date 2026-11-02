// DomainExpertReviewsPage.tsx — Màn hình thẩm định thay đổi tham số và đề xuất hệ số mờ (G-04)

import { useState } from 'react';
import {
  SlidersHorizontal,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useZoneStore } from '@/stores/zoneStore';
import { useToastStore } from '@/stores/toastStore';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu';
import ClearFiltersButton from '@/components/ui/ClearFiltersButton';
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
import ParameterReviewCard from '@/components/features/domain-expert/reviews/ParameterReviewCard';
import CoefficientProposalCard from '@/components/features/domain-expert/reviews/CoefficientProposalCard';
import type {
  ParameterReviewStatus,
  CoefficientProposalStatus,
} from '@/types/expert/reviews.types';

type ActiveTab = 'reviews' | 'proposals';

const REVIEW_STATUS_OPTIONS: SelectMenuOption<ParameterReviewStatus | 'ALL'>[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { value: 'ACCEPTED', label: 'Đã chấp thuận' },
  { value: 'REVERTED', label: 'Đã hoàn nguyên' },
  { value: 'ADJUSTED', label: 'Chuyên gia đã chỉnh' },
];

const PROPOSAL_STATUS_OPTIONS: SelectMenuOption<CoefficientProposalStatus | 'ALL'>[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'PROPOSED', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt áp dụng' },
  { value: 'REJECTED', label: 'Đã từ chối' },
  { value: 'SUPERSEDED', label: 'Đã bị thay thế' },
];

export default function DomainExpertReviewsPage() {
  const { selectedFarmId, selectedZoneId } = useZoneStore();
  const farmId = selectedFarmId || '';
  const zoneId = selectedZoneId || undefined;

  const pushToast = useToastStore((state) => state.push);
  const apiErrorMessage = useApiErrorMessage();

  const [activeTab, setActiveTab] = useState<ActiveTab>('reviews');
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
    zoneId,
    status: reviewStatusFilter === 'ALL' ? undefined : reviewStatusFilter,
  });

  const {
    records: proposals,
    isLoading: isLoadingProposals,
    isError: isProposalsError,
    refetch: refetchProposals,
  } = useCoefficientProposals({
    farmId,
    zoneId,
    status: proposalStatusFilter === 'ALL' ? undefined : proposalStatusFilter,
  });

  // Query đếm tổng số pending để hiển thị badge tab
  const { total: pendingReviewsCount = 0 } = useParameterReviews({
    farmId,
    zoneId,
    status: 'PENDING_REVIEW',
  });
  const { total: pendingProposalsCount = 0 } = useCoefficientProposals({
    farmId,
    zoneId,
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
      pushToast('Đã chấp thuận thay đổi tham số thành công.', 'success');
      void refetchReviews();
    } catch (error: unknown) {
      pushToast(apiErrorMessage(error, 'Lỗi khi chấp thuận thay đổi'), 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevertReview = async (reviewId: string) => {
    try {
      setProcessingId(reviewId);
      await revertMutation.mutateAsync(reviewId);
      pushToast('Đã hoàn nguyên tham số về giá trị ban đầu thành công.', 'success');
      void refetchReviews();
    } catch (error: unknown) {
      pushToast(apiErrorMessage(error, 'Lỗi khi hoàn nguyên tham số'), 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Handlers for Coefficient Proposals
  const handleApproveProposal = async (proposalId: string) => {
    try {
      setProcessingId(proposalId);
      await approveProposalMutation.mutateAsync(proposalId);
      pushToast('Đã duyệt và áp dụng hệ số mờ đề xuất thành công.', 'success');
      void refetchProposals();
    } catch (error: unknown) {
      pushToast(apiErrorMessage(error, 'Lỗi khi duyệt đề xuất hệ số'), 'error');
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
      pushToast(apiErrorMessage(error, 'Lỗi khi từ chối đề xuất'), 'error');
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
            title="Không thể tải danh sách thay đổi tham số"
            description="Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng kiểm tra lại mạng hoặc thử lại."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void refetchReviews()}
              >
                Thử lại
              </Button>
            }
          />
        </div>
      );
    }

    if (reviews.length === 0) {
      return (
        <div className="p-8">
          <EmptyState
            icon={<SlidersHorizontal className="h-8 w-8 text-warmGray" />}
            title="Không có mục thay đổi tham số nào"
            description={
              isReviewFiltered
                ? 'Không tìm thấy thay đổi tham số nào phù hợp với bộ lọc đã chọn.'
                : 'Khi Chủ trang trại cập nhật ngưỡng vi khí hậu hoặc hệ số điều khiển, các bản ghi sẽ xuất hiện tại đây để Chuyên gia thẩm định.'
            }
          />
        </div>
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
            title="Không thể tải danh sách đề xuất hệ số"
            description="Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng kiểm tra lại mạng hoặc thử lại."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void refetchProposals()}
              >
                Thử lại
              </Button>
            }
          />
        </div>
      );
    }

    if (proposals.length === 0) {
      return (
        <div className="p-8">
          <EmptyState
            icon={<Sparkles className="h-8 w-8 text-warmGray" />}
            title="Không có đề xuất hệ số mờ nào"
            description={
              isProposalFiltered
                ? 'Không tìm thấy đề xuất hệ số mờ nào phù hợp với bộ lọc đã chọn.'
                : 'Khi Chủ trang trại gửi gợi ý tối ưu Fuzzy Logic từ mô hình AI, các đề xuất sẽ xuất hiện tại đây để Chuyên gia xem xét và phê duyệt.'
            }
          />
        </div>
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
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-5 pt-3">
      {/* Khung Card nội dung chính chuẩn hệ thống */}
      <Card size="lg" className="flex flex-col gap-4">
        {/* Header hàng 1: Tabs phân loại nghiệp vụ + Bộ lọc SelectMenu */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warmGray/10 pb-3">
          {/* Nhóm Tabs Pill chuẩn hệ thống */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === 'reviews'
                  ? 'bg-charcoal text-white shadow-xs'
                  : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Duyệt thay đổi tham số</span>
              {pendingReviewsCount > 0 && (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {pendingReviewsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('proposals')}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === 'proposals'
                  ? 'bg-charcoal text-white shadow-xs'
                  : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Đề xuất hệ số Fuzzy</span>
              {pendingProposalsCount > 0 && (
                <span className="rounded-full bg-limeMist px-2 py-0.5 text-[10px] font-bold text-charcoal">
                  {pendingProposalsCount}
                </span>
              )}
            </button>
          </div>

          {/* Bộ lọc trạng thái chuẩn SelectMenu */}
          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'reviews' ? (
              <>
                <SelectMenu
                  value={reviewStatusFilter}
                  options={REVIEW_STATUS_OPTIONS}
                  onChange={(selectedValue) => setReviewStatusFilter(selectedValue)}
                  ariaLabel="Lọc theo trạng thái duyệt tham số"
                />
                {isReviewFiltered && (
                  <ClearFiltersButton onClick={() => setReviewStatusFilter('ALL')} />
                )}
              </>
            ) : (
              <>
                <SelectMenu
                  value={proposalStatusFilter}
                  options={PROPOSAL_STATUS_OPTIONS}
                  onChange={(selectedValue) => setProposalStatusFilter(selectedValue)}
                  ariaLabel="Lọc theo trạng thái đề xuất hệ số"
                />
                {isProposalFiltered && (
                  <ClearFiltersButton onClick={() => setProposalStatusFilter('ALL')} />
                )}
              </>
            )}
          </div>
        </div>

        {/* Header hàng 2: Mô tả nhiệm vụ nghiệp vụ gọn gàng */}
        <p className="-mt-1 pb-1 text-xs text-warmGray">
          {activeTab === 'reviews'
            ? 'Thẩm định các thay đổi vi khí hậu do Chủ trang trại cập nhật và chấp thuận hoặc hoàn nguyên về giá trị an toàn.'
            : 'Xem xét các gợi ý tối ưu điều khiển mờ (Fuzzy Logic) gửi từ Chủ trang trại và phê duyệt áp dụng xuống thiết bị.'}
        </p>

        {/* Nội dung danh sách theo Tab */}
        <div>
          {activeTab === 'reviews' ? renderReviewsContent() : renderProposalsContent()}
        </div>
      </Card>
    </div>
  );
}
