import {
  useListingInquiries,
  useListingStats,
  useUpdateListing,
} from "@/hooks/useMarketplace";
import { Select } from "@/components/ui";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import { useToastStore } from "@/store/toastStore";
import { getApiErrorMessage } from "@/utils/helpers";
import { LISTING_STATUS_LABEL } from "../constants";
import StatBlock from "./StatBlock";
import type { ListingStatus } from "@/types";

export default function ListingPanel({
  farmId,
  listingId,
}: {
  farmId: string;
  listingId: string;
}) {
  const { data: stats, isLoading: loadingStats } = useListingStats(listingId);
  const { data: inquiries } = useListingInquiries(listingId);
  const updateListing = useUpdateListing(farmId);
  const push = useToastStore((s) => s.push);

  return (
    <div className="rounded-xl border border-limeMist bg-limeMist/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label-caption">Tin đăng trên chợ yến</p>
        {stats && (
          <Select
            value={stats.listing_status}
            onChange={(e) =>
              updateListing.mutate(
                {
                  id: listingId,
                  listing_status: e.target.value as ListingStatus,
                },
                {
                  onError: (err) =>
                    push(getApiErrorMessage(err, "Cập nhật thất bại"), "error"),
                },
              )
            }
            className="!w-auto"
          >
            {Object.entries(LISTING_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </div>

      {loadingStats ? (
        <LoadingSkeleton className="mt-3 h-16 w-full" />
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatBlock label="Lượt xem" value={stats?.view_count ?? 0} />
          <StatBlock label="Lượt liên hệ" value={stats?.inquiry_count ?? 0} />
        </div>
      )}

      {inquiries && inquiries.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-t border-charcoal/10 pt-3">
          <p className="label-caption">Liên hệ gần nhất</p>
          {inquiries.slice(0, 5).map((inquiry) => (
            <div
              key={inquiry._id}
              className="rounded-2xl bg-white/60 px-3 py-2 text-sm"
            >
              <p className="font-semibold text-charcoal">
                {inquiry.buyer_name}{" "}
                {inquiry.buyer_phone ? `· ${inquiry.buyer_phone}` : ""}
              </p>
              <p className="text-warmGray">{inquiry.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
