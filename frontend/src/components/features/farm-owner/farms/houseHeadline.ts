import { METRIC_BY_KEY } from '@/components/features/farm-owner/farms/farmStructure.constants';
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure';
import type { farmDict } from '@/constants/farmStructure.i18n';

type FarmKey = keyof typeof farmDict.vi;
type FarmTranslate = (key: FarmKey, params?: Record<string, string | number>) => string;
type FormatNumber = (value: number, digits?: number) => string;

// Câu sự cố nổi bật nhất của 1 nhà: vượt ngưỡng → cảnh báo thật → thiết bị mất kết nối; không có sự cố thì chuỗi rỗng
export function houseHeadlineText(headline: HouseNode['headline'], translate: FarmTranslate, formatNumber: FormatNumber): string {
  if (!headline) return '';
  const zoneLabel = headline.zone.name || translate('card.unknownZone');

  if (headline.breach) {
    const metric = METRIC_BY_KEY[headline.breach.metric];
    return translate(headline.breach.direction === 'high' ? 'banner.high' : 'banner.low', {
      metric: translate(metric.labelKey),
      zone: zoneLabel,
      value: `${formatNumber(headline.breach.value, metric.decimals)} ${metric.unit}`,
    });
  }

  // Tên cảnh báo lấy theo loại (type), không dùng title của server vì có thể chứa "undefined"
  if (headline.alert) return translate('banner.alert', { title: translate(`alert.${headline.alert.type}`), zone: zoneLabel });

  return translate('banner.offline', { n: headline.offlineDevices ?? 0, zone: zoneLabel });
}
