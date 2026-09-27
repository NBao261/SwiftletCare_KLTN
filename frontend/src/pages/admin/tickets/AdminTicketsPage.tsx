// THỬ NGHIỆM taste-skill, CHỈ trang này: khu thống kê dạng ô số + bảng KTV (TicketInsights), icon Phosphor.
// Chốt giữ thì cập nhật FE_Design (§2.5.1/§8 còn nhắc donut, Phosphor chưa có trong tài liệu) trước khi lan sang trang khác.
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PlusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useAllTickets } from "@/hooks/admin/useAdminTickets";
import { useFarms } from "@/hooks/shared/useFarms";
import { Button, ClearFiltersButton, EmptyState, SearchInput, SelectMenu, SortChips } from "@/components/ui";
import DataTable from "@/components/ui/DataTable";
import Pagination from "@/components/ui/Pagination";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buildTicketColumns, ticketCode, technicianName } from "@/components/features/admin/tickets/ticketColumns";
import ChangePriorityModal from "@/components/features/admin/tickets/ChangePriorityModal";
import ReassignTicketModal from "@/components/features/admin/tickets/ReassignTicketModal";
import RescheduleModal from "@/components/features/admin/tickets/RescheduleModal";
import CreateTicketModal from "@/components/features/admin/tickets/CreateTicketModal";
import TicketInsights from "@/components/features/admin/tickets/TicketInsights";
import { TICKET_TYPE_LABEL, STATUS_LABEL } from "@/constants/tickets";
import { getApiErrorMessage } from "@/lib/helpers";
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
  { key: "due", label: "Thời gian SLA" },
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
 * trang Người dùng. Lọc trạng thái/ưu tiên/trang trại chạy trên backend; tìm kiếm + sắp xếp +
 * phân trang chạy trên TOÀN BỘ kết quả đó ở client (useAllTickets) — lọc ra bao nhiêu thì
 * phân trang đúng bấy nhiêu. Thao tác trên dòng = 3 modal can thiệp của Admin.
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

  const { data: farms } = useFarms();
  const farmNames = useMemo(() => new Map((farms ?? []).map((f) => [f._id, f.name])), [farms]);

  // Lọc server (farm/trạng thái/ưu tiên) → toàn bộ kết quả; search/sort/phân trang làm trên đủ tập này
  const { data: allTickets, isLoading, isError, error, refetch } = useAllTickets({
    farmId: farmId || undefined,
    status: status || undefined,
    priority: priority || undefined,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (allTickets ?? []).filter((t) =>
      !q || [ticketCode(t), TICKET_TYPE_LABEL[t.type], farmNames.get(t.farm_id), technicianName(t), t.notes[0]?.content]
        .some((s) => s?.toLowerCase().includes(q)),
    );
    const sign = sortDir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const va = sortValue(a, sortBy, farmNames), vb = sortValue(b, sortBy, farmNames);
      return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "vi")) * sign;
    });
  }, [allTickets, search, sortBy, sortDir, farmNames]);

  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isSortChanged = sortBy !== DEFAULT_SORT_BY || sortDir !== DEFAULT_SORT_DIR;
  // Sắp xếp không làm mất dòng nào — tách riêng để bảng rỗng biết là "hệ thống chưa có ticket" hay "lọc hết"
  const isFiltered = farmId !== "" || status !== "" || priority !== "" || search !== "";
  const hasActiveFilters = isFiltered || isSortChanged;

  function handleSortChange(key: string) {
    if (key === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key as TicketSortKey);
      setSortDir("asc");
    }
    setPage(1);
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
      onView: (t) => navigate(`/system/tickets/${t._id}`),
      onReassign: setReassignTarget,
      onChangePriority: setPriorityTarget,
      onReschedule: setRescheduleTarget,
    },
    (page - 1) * PAGE_SIZE,
    farmNames,
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Hàng 0: 5 ô số (SLA + 4 trạng thái, chỉ xem) · bảng KTV (bấm tên để tìm) + card mức ưu tiên & SLA — số liệu toàn hệ thống */}
      <TicketInsights
        search={search}
        onSelectTechnician={(name) => { setSearch(name); setPage(1); }}
      />

      {/* Hàng 1: tìm kiếm + tạo ticket — cùng khuôn trang Người dùng (POST /tickets cho FARM_OWNER, ADMIN).
          Tổng số ticket nằm ở Pagination dưới bảng ("Hiển thị x–y trong z"), không lặp ở đây. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchInput
            placeholder="Tìm mã, loại ticket, trang trại, kỹ thuật viên..."
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
          />
        </div>
        <Button onClick={() => setShowCreate(true)}><PlusIcon size={16} weight="bold" />Tạo ticket</Button>
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
        <SortChips fields={SORT_FIELDS} sortBy={sortBy} sortDir={sortDir} onChange={handleSortChange} />
        {hasActiveFilters && (
          <ClearFiltersButton onClick={clearFilters} />
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton count={5} className="h-14 w-full" />
      ) : isError ? (
        // FE_Design §13.5 — lỗi tải không được trông như "không có ticket nào"
        <EmptyState
          icon={<WarningCircleIcon size={32} />}
          title="Không tải được danh sách ticket"
          description={getApiErrorMessage(error, "Kiểm tra kết nối tới máy chủ rồi thử lại.")}
          action={<Button variant="secondary" size="sm" onClick={() => refetch()}>Thử lại</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(t) => t._id}
          sortKey={sortBy}
          sortDirection={sortDir}
          onSortChange={handleSortChange}
          onRowClick={(t) => navigate(`/system/tickets/${t._id}`)}
          emptyMessage={isFiltered
            ? "Không có ticket nào khớp bộ lọc — thử đổi bộ lọc hoặc từ khoá tìm kiếm."
            : "Hệ thống chưa có ticket nào."}
        />
      )}

      {/* total = số ticket SAU khi lọc + tìm kiếm — tìm ra 2 thì hiện "1–2 trong 2", không phải 113 */}
      <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onChange={setPage} variant="full" />

      <CreateTicketModal open={showCreate} onClose={() => setShowCreate(false)} defaultFarmId={farmId || undefined} />
      {/* Modal nhận `ticket` bắt buộc — chỉ mount khi đã chọn dòng */}
      {reassignTarget && <ReassignTicketModal open ticket={reassignTarget} onClose={() => setReassignTarget(null)} />}
      {priorityTarget && <ChangePriorityModal open ticket={priorityTarget} onClose={() => setPriorityTarget(null)} />}
      {rescheduleTarget && <RescheduleModal open ticket={rescheduleTarget} onClose={() => setRescheduleTarget(null)} />}
    </div>
  );
}
