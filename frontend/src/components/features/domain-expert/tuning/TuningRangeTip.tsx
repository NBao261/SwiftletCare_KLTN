import InfoTip from '@/components/ui/InfoTip';
import { t } from '@/i18n';

export interface TuningHint {
  label: string;
  range: string;
  defaultValue?: string;
}

// "Phạm vi: …" và "Mặc định: …": chỉ dịch chữ đầu, số và đơn vị giữ nguyên
function translateHint(hint: string): string {
  return hint.replace(/^Phạm vi:/, t('Phạm vi:')).replace(/^Mặc định:/, t('Mặc định:')).replace(/(\d)s\b/g, '$1 s');
}

// "Phạm vi · Mặc định" của cả khối trong một nút (i), thay một nút cho mỗi ô số
export default function TuningRangeTip({ hints }: { hints: TuningHint[] }) {
  return (
    <InfoTip>
      <ul className="space-y-1">
        {hints.map(hint => (
          <li key={hint.label}>
            <span className="font-semibold">{hint.label}</span>: {translateHint(hint.range)}
            {hint.defaultValue && ` · ${translateHint(hint.defaultValue)}`}
          </li>
        ))}
      </ul>
    </InfoTip>
  );
}
