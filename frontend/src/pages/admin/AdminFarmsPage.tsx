import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFarms } from "@/hooks/shared/useFarms";
import { useUsersPicker, getUserStatus } from "@/hooks/admin/useUsers";
import { usePageSubtitle } from "@/hooks/common/useBreadcrumb";
import { Button, SearchInput, SelectMenu } from "@/components/ui";
import { IconSortAsc, IconSortDesc } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import DataTable from "@/components/ui/DataTable";
import FilterChip from "@/components/ui/FilterChip";
import Pagination from "@/components/ui/Pagination";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buildFarmColumns } from "@/components/features/admin/farms/farmColumns";
import { FILTERABLE_STATUSES, STATUS_LABEL, type FilterableStatus } from "@/components/features/admin/users/users.constants";
import LockUserModal from "@/components/features/admin/users/LockUserModal";
import UnlockUserModal from "@/components/features/admin/users/UnlockUserModal";
import type { Farm, User, SortDirection } from "@/types";

const ALL_REGIONS = "__all__";
const NO_REGION = "__none__";
const PAGE_SIZE = 10;
type FarmSortKey = "name" | "owner" | "region" | "created_at";
const DEFAULT_SORT_BY: FarmSortKey = "created_at";
const DEFAULT_SORT_DIR: SortDirection = "desc";

function sortFarms(list: Farm[], key: FarmSortKey, dir: SortDirection, ownersById: Map<string, User>): Farm[] {
  const sign = dir === "asc" ? 1 : -1;
  // Thiếu khu vực/chủ sở hữu coi như "\uffff" → xếp cuối khi tăng dần, gom nhóm cần chú ý lại một chỗ
  const value = (f: Farm) => {
    if (key === "region") return f.region ?? "\uffff";
    if (key === "owner") {
      const owner = ownersById.get(f.owner_id);
      return owner?.full_name || owner?.email || "\uffff";
    }
    return f[key];
  };
  return [...list].sort((a, b) => value(a).localeCompare(value(b), "vi") * sign);
}

/**
 * Trang trại toàn hệ thống cho Admin (/system/farms) — FARM-FR-009(a): Admin thấy mọi
 * farm (backend listFarms trả filter {} cho ADMIN). Dạng bảng như trang Người dùng.
 * Không có nút tạo farm — RACI §4.4: Farm Owner là R, Admin chỉ A. Thao tác trên dòng
 * chỉ gồm xem chi tiết + khoá/mở khoá chủ farm (AUTH-FR-011).
 */
export default function AdminFarmsPage() {
  const navigate = useNavigate();
  const { data: farms, isLoading } = useFarms();
  // GET /farms chỉ trả owner_id — tra tên/email/trạng thái chủ farm từ /admin/users
  const { records: owners, truncated: ownersTruncated } = useUsersPicker({ role: "FARM_OWNER" });
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState(ALL_REGIONS);
  // Lọc theo trạng thái TÀI KHOẢN CHỦ FARM (AUTH-FR-011) — cùng bộ chip với trang Người dùng
  const [ownerStatus, setOwnerStatus] = useState<FilterableStatus | undefined>(undefined);
  const [sortBy, setSortBy] = useState<FarmSortKey>(DEFAULT_SORT_BY);
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR);
  const [page, setPage] = useState(1);
  const [lockTarget, setLockTarget] = useState<User | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<User | null>(null);

  usePageSubtitle("Toàn bộ trang trại trong hệ thống — farm do Farm Owner tự tạo; Admin xem cấu trúc, người dùng và ticket của từng farm.");

  const ownersById = useMemo(() => new Map(owners.map((u) => [u._id, u])), [owners]);

  const regionOptions = useMemo(() => {
    const regions = [...new Set(farms?.map((f) => f.region).filter((r): r is string => !!r))].sort();
    return [
      { value: ALL_REGIONS, label: "Tất cả khu vực" },
      ...regions.map((r) => ({ value: r, label: r })),
      { value: NO_REGION, label: "Chưa gán khu vực" },
    ];
  }, [farms]);

  // ponytail: lọc/sắp xếp/phân trang client-side vì GET /farms chưa có ?search=/region/page — đủ ở quy mô KLTN, chuyển sang query server khi BE có
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (farms ?? []).filter((f) => {
      if (region !== ALL_REGIONS && (region === NO_REGION ? !!f.region : f.region !== region)) return false;
      const owner = ownersById.get(f.owner_id);
      // Chủ farm không tra được (danh sách /admin/users bị cắt ở 100) thì không khẳng định được trạng thái → loại khi đang lọc
      if (ownerStatus && (!owner || getUserStatus(owner) !== ownerStatus)) return false;
      if (!q) return true;
      return [f.name, f.address, owner?.full_name, owner?.email].some((s) => s?.toLowerCase().includes(q));
    });
    return sortFarms(list, sortBy, sortDir, ownersById);
  }, [farms, ownersById, search, region, ownerStatus, sortBy, sortDir]);

  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasActiveFilters = search !== "" || region !== ALL_REGIONS || ownerStatus !== undefined
    || sortBy !== DEFAULT_SORT_BY || sortDir !== DEFAULT_SORT_DIR;

  function handleSortChange(key: string) {
    if (key === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key as FarmSortKey);
      setSortDir("asc");
    }
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setRegion(ALL_REGIONS);
    setOwnerStatus(undefined);
    setSortBy(DEFAULT_SORT_BY);
    setSortDir(DEFAULT_SORT_DIR);
    setPage(1);
  }

  const columns = buildFarmColumns(
    {
      onView: (farm) => navigate(`/system/farms/${farm._id}`),
      onLockOwner: setLockTarget,
      onUnlockOwner: setUnlockTarget,
    },
    (page - 1) * PAGE_SIZE,
    ownersById,
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Hàng 1: tìm kiếm riêng 1 hàng */}
      <SearchInput
        placeholder="Tìm theo tên farm, địa chỉ hoặc chủ sở hữu..."
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
      />

      {/* Hàng 2: bộ lọc + sắp xếp theo ngày tạo — cùng khuôn trang Người dùng, mọi control cao h-8 */}
      <div className="flex flex-wrap items-center gap-3">
        <SelectMenu
          ariaLabel="Lọc theo khu vực"
          value={region}
          options={regionOptions}
          onChange={(v) => { setRegion(v); setPage(1); }}
        />
        <div className="flex flex-nowrap gap-2">
          <FilterChip active={ownerStatus === undefined} label="Tất cả chủ farm" onClick={() => { setOwnerStatus(undefined); setPage(1); }} />
          {FILTERABLE_STATUSES.map((s) => (
            <FilterChip
              key={s}
              active={ownerStatus === s}
              label={`Chủ ${STATUS_LABEL[s].toLowerCase()}`}
              onClick={() => { setOwnerStatus(s); setPage(1); }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="label-caption">Sắp xếp:</span>
          <button
            type="button"
            onClick={() => handleSortChange("created_at")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              sortBy === "created_at" ? "bg-charcoal text-white" : "bg-warmGray/10 text-warmGray hover:bg-warmGray/20",
            )}
          >
            Ngày tạo
            {sortBy === "created_at" && (sortDir === "asc" ? <IconSortAsc width={12} height={12} /> : <IconSortDesc width={12} height={12} />)}
          </button>
        </div>
        {hasActiveFilters && (
          <Button variant="danger" size="sm" className="h-8 px-3.5 text-xs" onClick={clearFilters}>Hủy lọc</Button>
        )}
      </div>

      {!isLoading && (
        <p className="-mt-2 text-sm text-warmGray">
          {filtered.length === (farms?.length ?? 0)
            ? `${filtered.length} trang trại`
            : `${filtered.length} / ${farms?.length ?? 0} trang trại`}
        </p>
      )}

      {ownersTruncated && (
        <p className="-mt-2 text-xs text-climateOrange">
          Hệ thống có hơn 100 chủ farm — một số dòng có thể không hiện tên chủ sở hữu (giới hạn 1 lần tải của /admin/users).
        </p>
      )}

      {isLoading ? (
        <LoadingSkeleton count={4} className="h-14 w-full" />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(f) => f._id}
          sortKey={sortBy}
          sortDirection={sortDir}
          onSortChange={handleSortChange}
          emptyMessage={farms?.length
            ? "Không có trang trại nào khớp — thử từ khoá khác hoặc chọn lại khu vực."
            : "Chưa có trang trại nào trong hệ thống — farm do Farm Owner tự tạo sau khi đăng ký."}
        />
      )}

      <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onChange={setPage} />

      <LockUserModal user={lockTarget} onClose={() => setLockTarget(null)} />
      <UnlockUserModal user={unlockTarget} onClose={() => setUnlockTarget(null)} />
    </div>
  );
}
