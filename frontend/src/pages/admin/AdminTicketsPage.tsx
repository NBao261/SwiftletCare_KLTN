import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTicketsList } from "@/hooks/shared/useTickets";
import { useFarms } from "@/hooks/shared/useFarms";
import { usePageSubtitle } from "@/hooks/common/useBreadcrumb";
import { Button, SearchInput, SelectMenu } from "@/components/ui";
import { IconSortAsc, IconSortDesc } from "@/components/ui/icons";
import DataTable from "@/components/ui/DataTable";
import Pagination from "@/components/ui/Pagination";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buildTicketColumns, ticketCode, technicianName } from "@/components/features/admin/tickets/ticketColumns";
import { ChangePriorityModal, ReassignTicketModal, RescheduleModal } from "@/components/features/admin/tickets/AdminOverrideModals";
import CreateTicketModal from "@/components/features/admin/tickets/CreateTicketModal";
import { TICKET_TYPE_LABEL, STATUS_LABEL } from "@/constants/tickets";
import { cn } from "@/lib/cn";
import type { Ticket, TicketStatus, TicketPriority, SortDirection } from "@/types";

const PAGE_SIZE = 10;
const STATUS_ORDER = Object.keys(STATUS_LABEL) as TicketStatus[];
type TicketSortKey = "type" | "farm" | "priority" | "status" | "technician" | "due" | "created_at";
// Trùng thứ tự backend trả về (created_at giảm dần) — mặc định không cần sắp lại
const DEFAULT_SORT_BY: TicketSortKey = "created_at";
const DEFAULT_SORT_DIR: SortDirection = "desc";
/**
 * Nút "Sắp xếp:" cạnh bộ lọc — như trang Người dùng. 3 trường thời gian/khẩn cấp Admin
 * hay sắp nhất; các cột còn lại (loại, trang trại, trạng thái, KTV) sắp bằng tiêu đề bảng.
 */
const SORT_FIELDS: { key: TicketSortKey; label: string }[] = [
  { key: "created_at", label: "Ngày tạo" },
  { key: "due", label: "Hạn xử lý" },
  { key: "priority", label: "Ưu tiên" },
];

function sortValue(t: Ticket, key: TicketSortKey, farmNames: Map<string, string>): string | number {
  switch (key) {
    case "type": return TICKET_TYPE_LABEL[t.type];
    case "farm": return farmNames.get(t.farm_id) ?? "";
    case "priority": return t.priority; // "P1" < "P2" < "P3" đúng thứ tự khẩn cấp
    case "status": return STATUS_ORDER.indexOf(t.status);
    case "technician": return technicianName(t) ?? "\uffff"; // chưa phân công xếp cuối khi tăng dần
    case "due": return t.status === "CLOSED" || !t.sla_resolve_due_at ? "\uffff" : t.sla_resolve_due_at;
    case "created_at": return t.created_at;
  }
}

/**
 * Ticket toàn hệ thống cho Admin (/system/tickets) — TICKET-FR-005b/006: dạng bảng như
 * trang Người dùng. Lọc trạng thái/ưu tiên/trang trại + phân trang chạy trên backend;
 * GET /tickets chưa có search/sort nên 2 thao tác này chỉ áp dụng trong trang hiện tại
 * (cùng cách AdminUsersPage làm). Thao tác trên dòng = 3 modal can thiệp của Admin.
 */
export default function AdminTicketsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // ?farmId= — link "Xem tất cả" ở trang chi tiết Farm mở thẳng bảng đã lọc theo farm đó
  const [farmId, setFarmId] = useState(params.get("farmId") ?? "");
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<TicketSortKey>(DEFAULT_SORT_BY);
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<Ticket | null>(null);
  const [priorityTarget, setPriorityTarget] = useState<Ticket | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Ticket | null>(null);

  usePageSubtitle("Ticket toàn hệ thống — theo dõi SLA, gán lại kỹ thuật viên, đổi ưu tiên và lịch hẹn khi cần can thiệp.");

  const { data: farms } = useFarms();
  const farmNames = useMemo(() => new Map((farms ?? []).map((f) => [f._id, f.name])), [farms]);

  const { records, total, limit, isLoading } = useTicketsList({
    farmId: farmId || undefined,
    status: status || undefined,
    priority: priority || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? records.filter((t) =>
          [ticketCode(t), TICKET_TYPE_LABEL[t.type], farmNames.get(t.farm_id), technicianName(t), t.notes[0]?.content]
            .some((s) => s?.toLowerCase().includes(q)),
        )
      : records;
    const sign = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = sortValue(a, sortBy, farmNames), vb = sortValue(b, sortBy, farmNames);
      return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "vi")) * sign;
    });
  }, [records, search, sortBy, sortDir, farmNames]);

  const isSortChanged = sortBy !== DEFAULT_SORT_BY || sortDir !== DEFAULT_SORT_DIR;
  const hasActiveFilters = farmId !== "" || status !== "" || priority !== "" || search !== "" || isSortChanged;
  // Có hơn 1 trang thì phải nói rõ search/sort chỉ trong trang này — không thì Admin tưởng "không có ticket"
  const isPageScoped = (search !== "" || isSortChanged) && total > limit;

  function handleSortChange(key: string) {
    if (key === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key as TicketSortKey);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setFarmId("");
    setStatus("");
    setPriority("");
    setSearch("");
    setSortBy(DEFAULT_SORT_BY);
    setSortDir(DEFAULT_SORT_DIR);
    setPage(1);
  }

  const columns = buildTicketColumns(
    {
      onView: (t) => navigate(`/tickets/${t._id}`),
      onReassign: setReassignTarget,
      onChangePriority: setPriorityTarget,
      onReschedule: setRescheduleTarget,
    },
    (page - 1) * limit,
    farmNames,
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Hàng 1: tìm kiếm + tạo ticket — cùng khuôn trang Người dùng (POST /tickets cho FARM_OWNER, ADMIN).
          Tổng số ticket nằm ở Pagination dưới bảng ("Hiển thị x–y trong z"), không lặp ở đây. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchInput
            placeholder="Tìm mã, loại ticket, trang trại, kỹ thuật viên trong trang này..."
            value={search}
            onChange={setSearch}
          />
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Tạo ticket</Button>
      </div>

      {/* Hàng 2: toàn bộ bộ lọc + sắp xếp — mọi control cao bằng nhau (h-8, text-xs) như trang Người dùng */}
      <div className="flex flex-wrap items-center gap-3">
        <SelectMenu
          ariaLabel="Lọc theo trạng thái"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: "" as const, label: "Tất cả trạng thái" }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
        />
        <SelectMenu
          ariaLabel="Lọc theo ưu tiên"
          value={priority}
          onChange={(v) => { setPriority(v); setPage(1); }}
          options={[{ value: "" as const, label: "Tất cả ưu tiên" }, ...(["P1", "P2", "P3"] as const).map((p) => ({ value: p, label: p }))]}
        />
        <SelectMenu
          ariaLabel="Lọc theo trang trại"
          value={farmId}
          onChange={(v) => { setFarmId(v); setPage(1); }}
          options={[{ value: "", label: "Tất cả trang trại" }, ...(farms ?? []).map((f) => ({ value: f._id, label: f.name }))]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caption">Sắp xếp:</span>
          {SORT_FIELDS.map((f) => {
            const active = sortBy === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => handleSortChange(f.key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  active ? "bg-charcoal text-white" : "bg-warmGray/10 text-warmGray hover:bg-warmGray/20",
                )}
              >
                {f.label}
                {active && (sortDir === "asc" ? <IconSortAsc width={12} height={12} /> : <IconSortDesc width={12} height={12} />)}
              </button>
            );
          })}
        </div>
        {hasActiveFilters && (
          <Button variant="danger" size="sm" className="h-8 px-3.5 text-xs" onClick={clearFilters}>Hủy lọc</Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton count={5} className="h-14 w-full" />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(t) => t._id}
          sortKey={sortBy}
          sortDirection={sortDir}
          onSortChange={handleSortChange}
          emptyMessage={search && total > limit
            ? "Không có ticket nào khớp trong trang này — thử lật sang trang khác hoặc đổi bộ lọc."
            : "Không có ticket nào — thử đổi bộ lọc hoặc từ khoá tìm kiếm."}
        />
      )}

      {/* Đặt dưới bảng, sát phân trang — ghi chú này nói về "trang hiện tại", không chen giữa thanh lọc và bảng */}
      {isPageScoped && (
        <p className="-mt-2 text-xs text-climateOrange">
          Tìm kiếm và sắp xếp chỉ áp dụng trong trang hiện tại ({rows.length}/{total} ticket) — dùng bộ lọc trạng thái/ưu tiên/trang trại hoặc lật trang để tìm tiếp.
        </p>
      )}

      <Pagination page={page} limit={limit} total={total} onChange={setPage} />

      <CreateTicketModal open={showCreate} onClose={() => setShowCreate(false)} defaultFarmId={farmId || undefined} />
      {/* Modal nhận `ticket` bắt buộc — chỉ mount khi đã chọn dòng */}
      {reassignTarget && <ReassignTicketModal open ticket={reassignTarget} onClose={() => setReassignTarget(null)} />}
      {priorityTarget && <ChangePriorityModal open ticket={priorityTarget} onClose={() => setPriorityTarget(null)} />}
      {rescheduleTarget && <RescheduleModal open ticket={rescheduleTarget} onClose={() => setRescheduleTarget(null)} />}
    </div>
  );
}
