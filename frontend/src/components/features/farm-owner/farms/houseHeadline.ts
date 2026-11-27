import { METRIC_BY_KEY } from '@/components/features/farm-owner/farms/farmStructure.constants';
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure';
import type { farmDict } from '@/constants/farmStructure.i18n';

type FarmKey = keyof typeof farmDict.vi;
type FarmTranslate = (key: FarmKey, params?: Record<string, string | number>) => string;
type FormatNumber = (value: number, digits?: number) => string;

// Sự cố nổi bật nhất: vượt ngưỡng, rồi cảnh báo, rồi mất kết nối
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

// Lý do ngắn dưới nhãn tình trạng của nhà: sự cố của Zone, rồi camera mất kết nối, rồi cảnh báo cấp nhà; nhà bình thường không cần lý do
export function houseReasonText(node: HouseNode, translate: FarmTranslate, formatNumber: FormatNumber): string {
  if (node.health === 'EMPTY') return translate('banner.empty');
  if (node.headline) return houseHeadlineText(node.headline, translate, formatNumber);
  const offlineCameras = node.cameraDevices.filter(device => device.status === 'OFFLINE').length;
  if (offlineCameras > 0) return translate('banner.cameraOffline', { n: formatNumber(offlineCameras) });
  const houseAlert = node.alerts.find(alert => !alert.zone_id);
  return houseAlert ? translate(`alert.${houseAlert.type}`) : '';
}
