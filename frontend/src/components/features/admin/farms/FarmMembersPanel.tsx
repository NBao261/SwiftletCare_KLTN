import type { ReactNode } from "react";
import { GraduationCapIcon, HouseIcon } from "@phosphor-icons/react";
import { useAllUsers } from "@/hooks/admin/useUsers";
import { formatDateOnly } from "@/lib/helpers";
import { cn } from "@/lib/cn";
import { t, tr } from "@/i18n";
import type { Farm } from "@/types";

/** Màu nhãn theo nhóm: chủ nhà yến = Lime Mist hệ thống, chuyên gia = xanh accent nhạt — phân biệt bằng màu + chữ */
const TONE = {
  primary: { badge: "bg-limeMist text-charcoal" },
  owner: { badge: "bg-limeMist/60 text-charcoal" },
} as const;
type Tone = keyof typeof TONE;

/** 1 nhóm: icon + tiêu đề + số người, bên dưới là các thẻ người trải hết chiều ngang card */
function Column({ icon, title, count, children }: { icon: ReactNode; title: string; count?: number; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="flex items-center gap-2 text-body font-semibold text-charcoal">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warmGray/10 text-charcoal">{icon}</span>
        {tr(title)}
        {count != null && <span className="rounded-full bg-warmGray/10 px-2 py-0.5 text-xs font-semibold text-graphite">{count}</span>}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** Ô liên hệ: nhãn nhỏ xám trên, giá trị dưới (chưa có thì nghiêng xám); vạch dọc "|" ngăn với cụm trước */
function Contact({ label, value, empty }: { label: string; value?: string; empty: string }) {
  return (
    <div className="min-w-0 md:border-l md:border-gray-200 md:pl-8">
      <p className="text-xs text-warmGray">{tr(label)}</p>
      {value
        ? <p className="truncate text-body text-charcoal" title={value}>{value}</p>
        : <p className="text-body italic text-warmGray">{t(empty)}</p>}
    </div>
  );
}

/**
 * Thẻ 1 người — 3 cụm đứng sát nhau, ngăn bằng vạch dọc: tên + nhãn vai trò (dưới là ngày tham gia) | Email |
 * Số điện thoại. Cụm tên và cụm email rộng cố định để các thẻ thẳng cột; màn nhỏ xếp chồng
 */
function MemberCard({ name, email, phone, badge, since, tone }: {
  name?: string; email?: string; phone?: string; badge: string; since?: string; tone: Tone
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 md:flex-row md:items-center md:gap-8">
      <div className="min-w-0 md:w-80 md:shrink-0">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body font-semibold text-charcoal" title={name}>{name ?? "—"}</span>
          <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-caption font-semibold", TONE[tone].badge)}>{tr(badge)}</span>
        </p>
        {since && <p className="mt-0.5 text-xs text-warmGray">{t("Tham gia {{date}}", { date: formatDateOnly(since) })}</p>}
      </div>
      <div className="md:w-80 md:shrink-0"><Contact label="Email" value={email} empty="Chưa cập nhật" /></div>
      <Contact label="Số điện thoại" value={phone} empty="Chưa cập nhật" />
    </div>
  );
}

/** Ô trống / lỗi gọn — 1 ô cỡ thẻ người, icon + chữ nghiêng */
function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 text-small italic text-warmGray">
      <span className="shrink-0 not-italic">{icon}</span>
      {children}
    </div>
  );
}

/**
 * Tab "Thành viên" ở chi tiết Farm của Admin — CHỈ XEM (SRS RACI: mời/gỡ thành viên là việc của Primary Owner, Admin
 * "I (audit)"). 2 nhóm xếp chồng, thẻ người trải hết chiều ngang; cùng nguồn với trang Thành viên của Farm Owner
 * (FarmMembersManager): Chủ nhà yến = chủ chính + đồng sở hữu; Chuyên gia = "Sắp ra mắt" tới khi backend có API chuyên
 * gia (Domain Expert, SRS v2.0.0) — không gọi /farms/:id/sales-staff đã bị bỏ.
 */
export default function FarmMembersPanel({ farm }: { farm: Farm }) {
  // Thành viên farm không kèm SĐT — tra từ danh sách tài khoản Admin đã tải (cùng cache trang Người dùng), không gọi thêm
  const { data: users } = useAllUsers();
  const phoneOf = (userId?: string) => users?.find((u) => u._id === userId)?.phone;
  const coOwners = farm.members.filter((m) => !m.is_primary);

  return (
    <div className="flex flex-col gap-6">
      <Column icon={<HouseIcon size={14} />} title="Chủ nhà yến" count={1 + coOwners.length}>
        <MemberCard name={farm.owner?.full_name} email={farm.owner?.email} phone={phoneOf(farm.owner_id)} badge="Chủ chính" since={farm.created_at} tone="primary" />
        {coOwners.map((m) => (
          <MemberCard key={m.user_id} name={m.full_name} email={m.email} phone={phoneOf(m.user_id)} badge="Đồng sở hữu" since={m.joined_at} tone="owner" />
        ))}
      </Column>

      {/* Chưa có API danh sách chuyên gia: backend đã bỏ /farms/:id/sales-staff, SRS v2.0.0 chuyển sang Domain Expert do
          Primary Owner mời — ghi rõ trên UI thay vì gọi endpoint thiếu rồi hiện "trống" như dữ liệu thật (FE_Design §13.8) */}
      <Column icon={<GraduationCapIcon size={14} />} title="Chuyên gia">
        <Note icon={<GraduationCapIcon size={18} />}>
          {t("Sắp ra mắt — chưa có API danh sách chuyên gia (luồng đang chuyển sang chuyên gia do chủ nhà yến mời)")}
        </Note>
      </Column>
    </div>
  );
}
