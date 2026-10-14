import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PlusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useAllTickets } from "@/hooks/admin/useAdminTickets";
import { useFarms } from "@/hooks/shared/useFarms";
import { Button, ClearFiltersButton, EmptyState, FilterChip, SearchInput, SelectMenu, SortChips, SectionCard } from "@/components/ui";
import DataTable from "@/components/ui/DataTable";
import Pagination from "@/components/ui/Pagination";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import {
  buildTicketColumns, ticketCode, technicianName, sortTickets, TICKET_SORT_FIELDS as SORT_FIELDS,
  DEFAULT_TICKET_SORT_BY, DEFAULT_TICKET_SORT_DIR, type TicketSortKey,
} from "@/components/features/admin/tickets/ticketColumns";
import ChangePriorityModal from "@/components/features/admin/tickets/ChangePriorityModal";
import ReassignTicketModal from "@/components/features/admin/tickets/ReassignTicketModal";
import RescheduleModal from "@/components/features/admin/tickets/RescheduleModal";
import CreateTicketModal from "@/components/features/admin/tickets/CreateTicketModal";
import TicketInsights from "@/components/features/admin/tickets/TicketInsights";
import TechnicianWorkloadTable from "@/components/features/admin/tickets/TechnicianWorkloadTable";
import { TICKET_TYPE_LABEL, STATUS_LABEL } from "@/constants/tickets";
import { PRIORITY_LABEL } from "@/constants/sla";
import { getApiErrorMessage } from "@/lib/helpers";
import { cn } from "@/lib/cn";
import { tr } from "@/i18n";
import type { Ticket, TicketStatus, TicketPriority, SortDirection } from "@/types";

const PAGE_SIZE = 10;
type TicketTab = "tickets" | "technicians";
const TABS: { key: TicketTab; label: string }[] = [
  { key: "tickets", label: "Danh sách ticket" },
  { key: "technicians", label: "Hiệu suất kỹ thuật viên" },
];
const STATUS_ORDER = Object.keys(STATUS_LABEL) as TicketStatus[];
// Mặc định / nút "Sắp xếp:" / comparator dùng chung với Ticket gần nhất ở trang chi tiết Farm — xem ticketColumns.tsx
const DEFAULT_SORT_BY = DEFAULT_TICKET_SORT_BY;
const DEFAULT_SORT_DIR = DEFAULT_TICKET_SORT_DIR;
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
  // ?nodeId=&device= — mở từ drawer chi tiết thiết bị: chỉ ticket sinh từ cảnh báo của thiết bị đó (device = mã hiển thị)
  const [node, setNode] = useState(() => {
    const id = params.get("nodeId");
    return id ? { id, label: params.get("device") ?? id } : null;
  });
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<TicketSortKey>(DEFAULT_SORT_BY);
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<TicketTab>("tickets");
  const [showCreate, setShowCreate] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<Ticket | null>(null);
  const [priorityTarget, setPriorityTarget] = useState<Ticket | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Ticket | null>(null);

  const { data: farms } = useFarms();
  const farmNames = useMemo(() => new Map((farms ?? []).map((f) => [f._id, f.name])), [farms]);

  // Lọc server (farm/trạng thái/ưu tiên) → toàn bộ kết quả; search/sort/phân trang làm trên đủ tập này
  const { data: allTickets, isLoading, isError, error, refetch } = useAllTickets({
    farmId: farmId || undefined,
    nodeId: node?.id,
    status: status || undefined,
    priority: priority || undefined,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (allTickets ?? []).filter((t) =>
      !q || [ticketCode(t), TICKET_TYPE_LABEL[t.type], farmNames.get(t.farm_id), technicianName(t), t.notes[0]?.content]
        .some((s) => s?.toLowerCase().includes(q)),
    );
    return sortTickets(list, sortBy, sortDir, farmNames);
  }, [allTickets, search, sortBy, sortDir, farmNames]);

  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isSortChanged = sortBy !== DEFAULT_SORT_BY || sortDir !== DEFAULT_SORT_DIR;
  // Sắp xếp không làm mất dòng nào — tách riêng để bảng rỗng biết là "hệ thống chưa có ticket" hay "lọc hết"
  const isFiltered = farmId !== "" || !!node || status !== "" || priority !== "" || search !== "";
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
    setNode(null);
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
      {/* Hàng 0: 5 ô số (SLA + 4 trạng thái, chỉ xem) — số liệu toàn hệ thống */}
      <TicketInsights />

      {/* 1 card, 2 tab: "Danh sách ticket" (tìm kiếm → bộ lọc → bảng → phân trang) | "Kỹ thuật viên" (khối lượng việc
          theo người — bấm tên → về tab ticket đã lọc theo người đó) */}
      <SectionCard
        title={tab === "tickets" ? "Danh sách ticket" : "Thống kê tỉ lệ ticket của kỹ thuật viên"}
        description={tab === "tickets"
          ? "Ticket trên toàn hệ thống"
          : "Số ticket đang giữ, đã xử lý và khu vực phụ trách của từng kỹ thuật viên"}
        action={
          // Thanh chuyển dạng viên thuốc — cùng kiểu chọn vai trò ở popup Tạo tài khoản
          <div className="inline-flex gap-1 rounded-full bg-warmGray/10 p-1" role="tablist" aria-label={tr("Chế độ xem")}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "h-9 whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150",
                  tab === t.key ? "bg-white text-charcoal shadow-card" : "text-warmGray hover:text-charcoal",
                )}
              >
                {tr(t.label)}
              </button>
            ))}
          </div>
        }
      >
        {tab === "technicians" ? (
          <TechnicianWorkloadTable onSelectTechnician={(name) => { setSearch(name); setPage(1); setTab("tickets"); }} />
        ) : (
        <>

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
            options={[{ value: "" as const, label: "Tất cả ưu tiên" }, ...(["P1", "P2", "P3"] as const).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))]}
          />
          <SelectMenu
            ariaLabel="Lọc theo trang trại"
            value={farmId}
            onChange={(v) => { setFarmId(v); setPage(1); }}
            options={[{ value: "", label: "Tất cả trang trại" }, ...(farms ?? []).map((f) => ({ value: f._id, label: f.name }))]}
          />
          {/* Lọc theo thiết bị chỉ đến từ drawer Thiết bị — chip đen, bấm để bỏ lọc */}
          {node && (
            <FilterChip active label={`${tr("Thiết bị")}: ${node.label} ✕`} onClick={() => { setNode(null); setPage(1); }} />
          )}
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
            onRowClick={(t) => navigate(`/system/tickets/${t._id}`)}
            emptyMessage={isFiltered
              ? "Không có ticket nào khớp bộ lọc — thử đổi bộ lọc hoặc từ khoá tìm kiếm."
              : "Hệ thống chưa có ticket nào."}
          />
        )}

        {/* total = số ticket SAU khi lọc + tìm kiếm — tìm ra 2 thì hiện "1–2 trong 2", không phải 113 */}
        <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onChange={setPage} variant="full" />
        </>
        )}
      </SectionCard>

      <CreateTicketModal open={showCreate} onClose={() => setShowCreate(false)} defaultFarmId={farmId || undefined} />
      {/* Modal nhận `ticket` bắt buộc — chỉ mount khi đã chọn dòng */}
      {reassignTarget && <ReassignTicketModal open ticket={reassignTarget} onClose={() => setReassignTarget(null)} />}
      {priorityTarget && <ChangePriorityModal open ticket={priorityTarget} onClose={() => setPriorityTarget(null)} />}
      {rescheduleTarget && <RescheduleModal open ticket={rescheduleTarget} onClose={() => setRescheduleTarget(null)} />}
    </div>
  );
}
