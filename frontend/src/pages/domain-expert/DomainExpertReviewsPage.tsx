/**
 * DomainExpertReviewsPage.tsx — Màn hình thẩm định thay đổi tham số và đề xuất hệ số mờ (G-04)
 * SRS: EXPERT-FR-010, EXPERT-FR-011; Report 3 §6.10, §6.11
 * Design: Chuẩn Ops Console FE_Design_Claude.md §1.1 & §2.1
 */

import { useState } from 'react';
import {
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useZoneStore } from '@/stores/zoneStore';
import { Card } from '@/components/ui/Card';
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

  const [activeTab, setActiveTab] = useState<ActiveTab>('reviews');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ParameterReviewStatus | 'ALL'>('PENDING_REVIEW');
  const [proposalStatusFilter, setProposalStatusFilter] = useState<CoefficientProposalStatus | 'ALL'>('PROPOSED');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 1. Data hooks
  const {
    data: reviewsData,
    isLoading: isLoadingReviews,
    refetch: refetchReviews,
  } = useParameterReviews({
    farmId,
    zoneId,
    status: reviewStatusFilter === 'ALL' ? undefined : reviewStatusFilter,
  });

  const {
    data: proposalsData,
    isLoading: isLoadingProposals,
    refetch: refetchProposals,
  } = useCoefficientProposals({
    farmId,
    zoneId,
    status: proposalStatusFilter === 'ALL' ? undefined : proposalStatusFilter,
  });

  // Query đếm tổng số pending để hiển thị badge tab
  const { data: pendingReviewsCountData } = useParameterReviews({
    farmId,
    zoneId,
    status: 'PENDING_REVIEW',
  });
  const { data: pendingProposalsCountData } = useCoefficientProposals({
    farmId,
    zoneId,
    status: 'PROPOSED',
  });

  const pendingReviewsCount = pendingReviewsCountData?.data?.length ?? 0;
  const pendingProposalsCount = pendingProposalsCountData?.data?.length ?? 0;

  // 2. Mutation hooks
  const acceptMutation = useAcceptParameterReview();
  const revertMutation = useRevertParameterReview();
  const approveProposalMutation = useApproveCoefficientProposal();
  const rejectProposalMutation = useRejectCoefficientProposal();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Handlers for Parameter Reviews
  const handleAcceptReview = async (id: string) => {
    try {
      setProcessingId(id);
      await acceptMutation.mutateAsync(id);
      showToast('Đã chấp thuận thay đổi tham số thành công.');
      void refetchReviews();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi chấp thuận thay đổi.';
      showToast(msg, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevertReview = async (id: string) => {
    try {
      setProcessingId(id);
      await revertMutation.mutateAsync(id);
      showToast('Đã hoàn nguyên tham số về giá trị ban đầu thành công.');
      void refetchReviews();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi hoàn nguyên tham số.';
      showToast(msg, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Handlers for Coefficient Proposals
  const handleApproveProposal = async (id: string) => {
    try {
      setProcessingId(id);
      await approveProposalMutation.mutateAsync(id);
      showToast('Đã duyệt và áp dụng hệ số mờ đề xuất thành công.');
      void refetchProposals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi duyệt đề xuất hệ số.';
      showToast(msg, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectProposal = async (id: string, note: string) => {
    try {
      setProcessingId(id);
      await rejectProposalMutation.mutateAsync({ proposalId: id, note });
      showToast('Đã từ chối đề xuất hệ số mờ kèm lý do chuyên môn.');
      void refetchProposals();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi từ chối đề xuất.';
      showToast(msg, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const reviewsList = reviewsData?.data || [];
  const proposalsList = proposalsData?.data || [];

  const isReviewFiltered = reviewStatusFilter !== 'ALL';
  const isProposalFiltered = proposalStatusFilter !== 'ALL';

  return (
    <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-5 pt-3">
      {/* Toast thông báo nổi */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2.5 transition-all ${
            notification.type === 'success'
              ? 'bg-[#27231F] text-[#B5D32C] border border-[#B5D32C]/30'
              : 'bg-red-900 text-white border border-red-500'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#B5D32C]" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Khung Card nội dung chính chuẩn hệ thống */}
      <Card size="lg" className="flex flex-col gap-4">
        {/* Header hàng 1: Tabs phân loại nghiệp vụ + Bộ lọc SelectMenu */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-warmGray/10">
          {/* Nhóm Tabs Pill chuẩn hệ thống */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'reviews'
                  ? 'bg-charcoal text-white shadow-xs'
                  : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Duyệt thay đổi tham số</span>
              {pendingReviewsCount > 0 && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {pendingReviewsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('proposals')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeTab === 'proposals'
                  ? 'bg-charcoal text-white shadow-xs'
                  : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Đề xuất hệ số Fuzzy</span>
              {pendingProposalsCount > 0 && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#B5D32C] text-charcoal">
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
                  onChange={(val) => setReviewStatusFilter(val)}
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
                  onChange={(val) => setProposalStatusFilter(val)}
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
        <p className="text-xs text-warmGray -mt-1 pb-1">
          {activeTab === 'reviews'
            ? 'Thẩm định các thay đổi vi khí hậu do Chủ trang trại cập nhật và chấp thuận hoặc hoàn nguyên về giá trị an toàn.'
            : 'Xem xét các gợi ý tối ưu điều khiển mờ (Fuzzy Logic) gửi từ Chủ trang trại và phê duyệt áp dụng xuống thiết bị.'}
        </p>

        {/* Nội dung danh sách theo Tab */}
        <div>
          {activeTab === 'reviews' ? (
            isLoadingReviews ? (
              <LoadingSkeleton count={3} className="h-44 w-full rounded-2xl" />
            ) : reviewsList.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<SlidersHorizontal className="w-8 h-8 text-warmGray" />}
                  title="Không có mục thay đổi tham số nào"
                  description={
                    isReviewFiltered
                      ? 'Không tìm thấy thay đổi tham số nào phù hợp với bộ lọc đã chọn.'
                      : 'Khi Chủ trang trại cập nhật ngưỡng vi khí hậu hoặc hệ số điều khiển, các bản ghi sẽ xuất hiện tại đây để Chuyên gia thẩm định.'
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {reviewsList.map((review) => (
                  <ParameterReviewCard
                    key={review._id}
                    review={review}
                    onAccept={handleAcceptReview}
                    onRevert={handleRevertReview}
                    isProcessing={processingId === review._id}
                  />
                ))}
              </div>
            )
          ) : isLoadingProposals ? (
            <LoadingSkeleton count={3} className="h-44 w-full rounded-2xl" />
          ) : proposalsList.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Sparkles className="w-8 h-8 text-warmGray" />}
                title="Không có đề xuất hệ số mờ nào"
                description={
                  isProposalFiltered
                    ? 'Không tìm thấy đề xuất hệ số mờ nào phù hợp với bộ lọc đã chọn.'
                    : 'Khi Chủ trang trại gửi gợi ý tối ưu Fuzzy Logic từ mô hình AI, các đề xuất sẽ xuất hiện tại đây để Chuyên gia xem xét và phê duyệt.'
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {proposalsList.map((proposal) => (
                <CoefficientProposalCard
                  key={proposal._id}
                  proposal={proposal}
                  onApprove={handleApproveProposal}
                  onReject={handleRejectProposal}
                  isProcessing={processingId === proposal._id}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
