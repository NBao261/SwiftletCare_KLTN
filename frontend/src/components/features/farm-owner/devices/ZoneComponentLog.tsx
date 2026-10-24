import { useState } from 'react';
import { ArrowsClockwiseIcon, CaretDownIcon, CloudRainIcon, FanIcon, SpeakerHighIcon, type Icon } from '@phosphor-icons/react';

import { Button } from '@/components/ui';
import { isOutsideRange, metricThresholdRange } from '@/components/features/farm-owner/analytics/analyticsMetrics';
import type { DeviceItem } from '@/components/features/farm-owner/devices/deviceInventory';
import { COMPONENT_STATUS_CLASS } from '@/components/features/farm-owner/devices/devices.constants';
import {
  READING_FIELD, SENSOR_KINDS, summarizeGroup, type ComponentGroup, type ComponentItem, type ComponentKind, type ComponentStatus,
} from '@/components/features/farm-owner/devices/zoneComponents';
import { METRIC_BY_KEY, thresholdRange } from '@/components/features/farm-owner/farms/farmStructure.constants';
import { NO_VALUE } from '@/constants/display';
import { devicesDict, type DevicesKey } from '@/constants/devices.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { componentNameKey, useZoneComponents } from '@/hooks/farm-owner/useZoneComponents';
import { cn } from '@/lib/cn';
import type { Thresholds } from '@/types';

// Icon của thiết bị chấp hành; cảm biến dùng icon chỉ số chung của màn Trang trại
const ACTUATOR_ICON: Partial<Record<ComponentKind, Icon>> = { speaker: SpeakerHighIcon, misting: CloudRainIcon, ventilation: FanIcon };

// Âm lượng tối đa của DFPlayer (backend giới hạn 0–30)
const MAX_VOLUME = 30;

// Thông tin chỉ số (đơn vị, số lẻ, icon) của loại cảm biến; thiết bị chấp hành không có
function metricOf(kind: ComponentKind) {
  return kind in METRIC_BY_KEY ? METRIC_BY_KEY[kind as keyof typeof METRIC_BY_KEY] : undefined;
}

// Nhãn trạng thái; loa đang bật thì ghi "Đang phát"
function statusKey(kind: ComponentKind, status: ComponentStatus): DevicesKey {
  if (status === 'on' && kind === 'speaker') return 'component.playing';
  return `component.${status}`;
}

// Nhãn "đang chạy" của hàng tóm tắt: cảm biến "hoạt động", loa "đang phát", bơm / quạt "đang bật"
function runningKey(kind: ComponentKind): DevicesKey {
  if (kind === 'speaker') return 'summary.playing';
  if (kind === 'misting' || kind === 'ventilation') return 'summary.on';
  return 'summary.running';
}

interface ZoneComponentLogProps {
  zoneId: string;
  nodes: DeviceItem[];
  // Ngưỡng của Zone để đánh giá số đo trong mục Thông số
  thresholds?: Thresholds;
}

// Thiết bị bộ kit gom theo loại, bấm xổ log từng thiết bị; số liệu chỉ lấy khi bấm "Kiểm tra thiết bị", không realtime
export default function ZoneComponentLog({ zoneId, nodes, thresholds }: ZoneComponentLogProps): JSX.Element {
  const { t, dateTime } = useTranslation(devicesDict);
  const { groups, componentNames, checkedAt, isChecking, isError, runCheck } = useZoneComponents(zoneId, nodes);
  const [openKinds, setOpenKinds] = useState<Set<ComponentKind>>(() => new Set());

  function toggleKind(kind: ComponentKind): void {
    setOpenKinds(current => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  let checkText = t('check.never');
  if (checkedAt !== undefined) checkText = t('check.at', { time: dateTime(new Date(checkedAt).toISOString()) });

  return (
    <div className="flex flex-col">
      {/* Thanh kiểm tra: bấm mới tải số đo, kết quả giữ tại lần bấm */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-xs text-graphite">{checkText}</p>
          {isError && <p className="text-xs text-alertRed">{t('check.failed')}</p>}
        </div>
        <Button size="sm" variant="secondary" className="h-8 text-xs" loading={isChecking} onClick={runCheck}>
          <ArrowsClockwiseIcon size={14} weight="bold" />
          {checkedAt === undefined ? t('check.run') : t('check.again')}
        </Button>
      </div>
      <ul className="divide-y divide-gray-200">
        {groups.map(group => (
          <KindRow
            key={group.kind}
            group={group}
            thresholds={thresholds}
            componentNames={componentNames}
            isOpen={openKinds.has(group.kind)}
            onToggle={() => toggleKind(group.kind)}
          />
        ))}
      </ul>
      <div className="border-t border-gray-200 px-4 py-2.5">
        <p className="text-xs text-warmGray">{t('group.note')}</p>
        {/* Tên thiết bị con chưa có API, đang lấy từ dữ liệu giả (FE_Design 5.4, 7) */}
        <p className="text-[11px] font-medium italic text-warmGray">This data is FAKE and has not been MOCKAPI</p>
      </div>
    </div>
  );
}

interface KindRowProps {
  group: ComponentGroup;
  thresholds?: Thresholds;
  // Tên Kỹ thuật viên đặt cho từng thiết bị con (khoá componentNameKey)
  componentNames: Map<string, string>;
  isOpen: boolean;
  onToggle: () => void;
}

// 1 loại thiết bị: hàng tóm tắt bấm để xổ, bên dưới mỗi thiết bị 1 dòng log kèm mục Thông số và nút Báo lỗi
function KindRow({ group, thresholds, componentNames, isOpen, onToggle }: KindRowProps): JSX.Element {
  const { t, num } = useTranslation(devicesDict);
  const RowIcon = metricOf(group.kind)?.icon ?? ACTUATOR_ICON[group.kind];
  const summary = summarizeGroup(group.items);
  const isUnchecked = summary.unchecked > 0 && summary.faulty === 0;
  const parts = [
    summary.running > 0 && t(runningKey(group.kind), { n: num(summary.running) }),
    summary.off > 0 && t('summary.off', { n: num(summary.off) }),
    summary.waiting > 0 && t('summary.waiting', { n: num(summary.waiting) }),
  ].filter(Boolean);

  let pill = (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-800">
      <span className="h-2 w-2 rounded-full bg-accent-600" />
      {t('summary.allGood')}
    </span>
  );
  if (isUnchecked) {
    pill = (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-warmGray">
        <span className="h-2 w-2 rounded-full bg-gray-300" />
        {t('component.unchecked')}
      </span>
    );
  }
  if (summary.faulty > 0) {
    pill = (
      <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold', COMPONENT_STATUS_CLASS.fault.text)}>
        <span className={cn('h-2 w-2 rounded-full', COMPONENT_STATUS_CLASS.fault.dot)} />
        {t('summary.faulty', { n: num(summary.faulty) })}
      </span>
    );
  }

  return (
    // Đang xổ: viền xanh chanh ôm cả hàng loại lẫn log từng thiết bị, hàng tiêu đề nền xanh đậm hơn log
    <li className={cn(isOpen && 'outline outline-2 -outline-offset-2 outline-accent-600')}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors', isOpen ? 'bg-accent-100' : 'hover:bg-gray-50')}
      >
        <CaretDownIcon size={14} weight="bold" className={cn('shrink-0 text-graphite transition-transform duration-200', isOpen && 'rotate-180')} />
        {RowIcon && <RowIcon size={18} className="shrink-0 text-graphite" />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-charcoal">{t(`kind.${group.kind}`)}</span>
        <span className="hidden shrink-0 text-xs text-warmGray sm:inline">{parts.join(' · ')}</span>
        {pill}
      </button>

      {isOpen && (
        <ul className="divide-y divide-gray-100 border-t border-gray-200 bg-gray-50/60">
          {group.items.map(item => {
            const tone = COMPONENT_STATUS_CLASS[item.status];
            const name = componentNames.get(componentNameKey(item.nodeId, group.kind));
            return (
              // 1 thiết bị = 1 hàng: tên (VD "Quạt thông gió 1") · thông số · trạng thái; màn hẹp thông số xuống dòng
              <li
                key={item.nodeId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-2.5 pl-14 pr-4 lg:grid-cols-[11rem_minmax(0,1fr)_8.5rem]"
              >
                {/* Tên do Kỹ thuật viên đặt; chưa đặt tên thì "_" */}
                <span className={cn('truncate text-sm font-semibold', name ? 'text-charcoal' : 'text-warmGray')} title={t('list.kitName', { id: item.deviceId })}>
                  {name ?? NO_VALUE}
                </span>
                <div className="order-last col-span-full min-w-0 lg:order-none lg:col-span-1">
                  <ComponentParams kind={group.kind} item={item} thresholds={thresholds} />
                </div>
                <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', tone.text)}>
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.dot)} />
                  {t(statusKey(group.kind, item.status))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

// Thông số của 1 thiết bị nằm ngay trên hàng log (nhãn · giá trị), lấy từ lần kiểm tra; chưa kiểm tra thì mọi giá trị "_"
function ComponentParams({ kind, item, thresholds }: { kind: ComponentKind; item: ComponentItem; thresholds?: Thresholds }): JSX.Element {
  const { t, num, dateTime } = useTranslation(devicesDict);
  const detail = item.detail;
  const onOff = (value: boolean | undefined) => (value === undefined ? NO_VALUE : t(value ? 'param.on' : 'param.off'));
  let params: Array<{ label: string; value: string; isAlert?: boolean }> = [];

  if (SENSOR_KINDS.has(kind)) {
    const metric = metricOf(kind);
    const field = READING_FIELD[kind];
    const range = thresholds && metric ? thresholdRange(metric.key, thresholds) : undefined;
    // Âm thanh chưa có ngưỡng trong Zone nên không đánh giá
    const compareRange = thresholds && field && field !== 'sound_db' ? metricThresholdRange(field as Parameters<typeof metricThresholdRange>[0], thresholds) : undefined;
    const isOutside = item.value !== undefined && compareRange ? isOutsideRange(item.value, compareRange) : undefined;
    params = [
      { label: t('param.reading'), value: item.value !== undefined && metric ? `${num(item.value, metric.decimals)} ${metric.unit}` : NO_VALUE },
      // NH3, CO2 chỉ để cảnh báo, không điều khiển quạt (ENV-FR-006/011)
      kind === 'nh3' || kind === 'co2'
        ? { label: t('param.alertLimit'), value: thresholds ? `> ${thresholds[kind === 'nh3' ? 'nh3_max' : 'co2_max']} ppm` : NO_VALUE }
        : { label: t('param.range'), value: range ?? NO_VALUE },
      {
        label: t('param.verdict'),
        value: isOutside === undefined ? NO_VALUE : t(isOutside ? 'param.outside' : 'param.inside'),
        isAlert: isOutside === true,
      },
      { label: t('param.readingAt'), value: item.readingAt ? dateTime(item.readingAt) : NO_VALUE },
    ];
  }
  if (kind === 'speaker') {
    const audio = detail?.audio;
    const schedule = detail?.speaker_schedule;
    let scheduleText = NO_VALUE;
    if (schedule) scheduleText = schedule.enabled && schedule.windows.length > 0 ? schedule.windows.map(window => `${window.start}–${window.end}`).join(', ') : t('param.scheduleOff');
    params = [
      { label: t('param.relay'), value: onOff(detail?.relay_states?.speaker) },
      { label: t('param.audio'), value: audio ? t(audio.playing ? 'param.playing' : 'param.stopped') : NO_VALUE },
      { label: t('param.volume'), value: audio ? `${num(audio.volume)}/${MAX_VOLUME}` : NO_VALUE },
      { label: t('param.track'), value: audio ? t('param.trackValue', { n: num(audio.current_track) }) : NO_VALUE },
      { label: t('param.loop'), value: audio ? t(audio.loop ? 'param.yes' : 'param.no') : NO_VALUE },
      { label: t('param.schedule'), value: scheduleText },
    ];
  }
  if (kind === 'misting' || kind === 'ventilation') {
    const usage = detail?.relay_usage?.[kind];
    const isManual = detail?.control_mode === 'MANUAL';
    params = [
      { label: t('param.relay'), value: onOff(detail?.relay_states?.[kind]) },
      { label: t('param.mode'), value: detail ? t(isManual ? 'param.manual' : 'param.auto') : NO_VALUE },
      { label: t('param.manualUntil'), value: isManual && detail?.override_expiry ? dateTime(detail.override_expiry) : NO_VALUE },
      { label: t('param.onHours'), value: usage ? t('param.hoursValue', { n: num(usage.on_hours, 1) }) : NO_VALUE },
      { label: t('param.switches'), value: usage ? num(usage.switches) : NO_VALUE },
      {
        label: t('param.sinceService'),
        value: usage ? t('param.sinceServiceValue', { hours: num(usage.since_service_hours, 1), switches: num(usage.since_service_switches) }) : NO_VALUE,
      },
    ];
  }

  return (
    <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
      {params.map(param => (
        <div key={param.label} className="flex min-w-0 items-baseline gap-1.5">
          <dt className="whitespace-nowrap text-xs text-warmGray">{param.label}</dt>
          <dd className={cn('whitespace-nowrap text-sm font-semibold', param.value === NO_VALUE ? 'text-warmGray' : param.isAlert ? 'text-orange-700' : 'text-charcoal')}>
            {param.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
