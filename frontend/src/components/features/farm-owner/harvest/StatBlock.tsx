export default function StatBlock({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-2">
      {/* [SỬA NGOÀI ADMIN — nhánh feat/admin-settings-config-logs-pages] Ảnh hưởng Farm Owner (trang Thu hoạch). Đổi: nhãn in hoa 11px → .label-caption (FE_Design v2.5.0 §2.8) */}
      <p className="label-caption">
        {label}
      </p>
      <p className="text-xl font-extrabold text-charcoal">{value}</p>
    </div>
  );
}
