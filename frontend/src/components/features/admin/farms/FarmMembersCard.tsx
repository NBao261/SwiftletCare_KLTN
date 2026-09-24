import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useFarm, useSalesStaff, usePendingSalesStaffRequests } from "@/hooks/shared/useFarms";
import { useUnassignSalesStaff } from "@/hooks/admin/useUsers";
import { Button, Badge, Card } from "@/components/ui";
import ConfirmModal from "@/components/ui/ConfirmModal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import CreateUserModal from "@/components/features/admin/users/CreateUserModal";
import { useToastStore } from "@/stores/toastStore";
import { getApiErrorMessage } from "@/lib/helpers";

const formatDay = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

/**
 * Card charcoal "Thành viên" bên phải cặp lime/charcoal ở AdminFarmDetailPage.
 * Quyền người dùng của Admin theo FARM-FR-009(b) chỉ gồm tạo tài khoản Technician/
 * Sales Staff (AUTH-FR-005c) và khoá/mở khoá (AUTH-FR-011, ở trang Người dùng):
 * - Thành viên Farm Owner: CHỈ XEM — mời/gỡ là việc của Primary Owner (AUTH-FR-005),
 *   dù backend isPrimaryOwner() vẫn cho ADMIN.
 * - Sales Staff: tạo tài khoản gán thẳng farm này (POST /admin/sales-staff), gỡ thẳng
 *   (Flow 16 bước 1e). KHÔNG dùng POST /farms/:id/sales-staff — đó là luồng đề xuất
 *   của Farm Owner (AUTH-FR-005b), Admin gọi thì phải tự duyệt đề xuất của chính mình.
 */
export default function FarmMembersCard({ farmId }: { farmId: string }) {
  const { data: farm, isLoading } = useFarm(farmId);
  const { data: salesStaff } = useSalesStaff(farmId);
  // Đề xuất do Farm Owner gửi, Admin duyệt ở trang Yêu cầu tài khoản (AUTH-FR-005d)
  const { data: pendingSales } = usePendingSalesStaffRequests(farmId);
  const unassign = useUnassignSalesStaff(farmId);
  const push = useToastStore((s) => s.push);
  const [showCreateSales, setShowCreateSales] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<{ id: string; name: string } | null>(null);

  if (isLoading) return <LoadingSkeleton count={2} className="h-16 w-full" />;
  if (!farm) return null;

  const primary = farm.members.find((m) => m.is_primary);
  const otherMembers = farm.members.filter((m) => !m.is_primary);

  function handleUnassign() {
    if (!unassignTarget) return;
    unassign.mutate(unassignTarget.id, {
      onSuccess: () => {
        push(`Đã gỡ ${unassignTarget.name} khỏi farm`);
        setUnassignTarget(null);
      },
      onError: (err) => push(getApiErrorMessage(err, "Gỡ Sales Staff thất bại"), "error"),
    });
  }

  return (
    <Card variant="dark" size="lg" className="flex flex-col gap-5 bg-charcoal p-5 shadow-card">
      <section>
        <div className="mb-3 flex items-center gap-2.5">
          <h2 className="font-bold text-white">Thành viên Farm Owner</h2>
          <CountPill>{otherMembers.length + 1} người</CountPill>
        </div>

        <div className="flex flex-col gap-2">
          <MemberRow name={farm.owner?.full_name} email={farm.owner?.email} badge="Chủ chính" joinedAt={primary?.joined_at} />
          {otherMembers.map((m) => (
            <MemberRow key={m.user_id} name={m.full_name} email={m.email} badge="Thành viên" joinedAt={m.joined_at} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <h2 className="font-bold text-white">Sales Staff</h2>
            {!!salesStaff?.length && <CountPill>{salesStaff.length} người</CountPill>}
          </div>
          <Button variant="accent" size="sm" className="shrink-0" onClick={() => setShowCreateSales(true)}>
            + Tạo Sales Staff
          </Button>
        </div>

        {salesStaff?.length || pendingSales?.length ? (
          <div className="flex flex-col gap-2">
            {salesStaff?.map((s) => (
              <MemberRow
                key={s._id}
                name={s.sales_staff_id.full_name}
                email={s.sales_staff_id.email}
                badge="Sales Staff"
                onRemove={() => setUnassignTarget({ id: s.sales_staff_id._id, name: s.sales_staff_id.full_name })}
              />
            ))}
            {pendingSales?.map((r) => (
              <div
                key={r._id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-white/25 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{r.sales_staff_email}</p>
                  <p className="truncate text-xs text-white/50">
                    Farm Owner đề xuất {formatDay(r.created_at)} ·{" "}
                    <Link to="/account-requests" className="font-semibold text-limeMist hover:underline">
                      Duyệt ở Yêu cầu tài khoản →
                    </Link>
                  </p>
                </div>
                <Badge tone="warning" className="shrink-0">
                  {r.type === "REMOVE" ? "Chờ gỡ" : "Chờ duyệt"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-white/20 px-4 py-4 text-sm text-white/60">
            Chưa có Sales Staff — Farm Owner tự động có toàn bộ quyền quản lý bán hàng.
          </p>
        )}
      </section>

      <CreateUserModal open={showCreateSales} onClose={() => setShowCreateSales(false)} presetFarmId={farmId} />
      <ConfirmModal
        open={!!unassignTarget}
        title="Gỡ Sales Staff khỏi farm?"
        danger
        description={`${unassignTarget?.name ?? "Sales Staff này"} sẽ mất quyền quản lý bán hàng của farm này. Tài khoản vẫn giữ nguyên.`}
        loading={unassign.isPending}
        onConfirm={handleUnassign}
        onCancel={() => setUnassignTarget(null)}
      />
    </Card>
  );
}

function CountPill({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/70">
      {children}
    </span>
  );
}

function MemberRow({
  name,
  email,
  badge,
  joinedAt,
  onRemove,
}: {
  name?: string;
  email?: string;
  badge: string;
  joinedAt?: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
      {/* Avatar chữ cái đầu, lime — đối xứng với icon-box nhà yến ở card trái */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-limeMist text-sm font-bold text-charcoal">
        {(name ?? email ?? "?").charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-charcoal">{name ?? "—"}</p>
        <p className="truncate text-xs text-warmGray">
          {email ?? "—"}
          {joinedAt && ` · tham gia ${formatDay(joinedAt)}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone="neutral">{badge}</Badge>
        {onRemove && (
          <Button variant="secondary" size="sm" onClick={onRemove}>
            Gỡ
          </Button>
        )}
      </div>
    </div>
  );
}
