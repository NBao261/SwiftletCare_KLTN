import { useState } from 'react';

import { Button, Modal } from '@/components/ui';
import SnapshotSection from '@/components/features/farm-owner/harvest/SnapshotSection';
import { GRAM_DIGITS, KILOGRAM_DIGITS, NEST_TYPE_BADGE_CLASS, NEST_TYPES } from '@/components/features/farm-owner/harvest/harvest.constants';
import type { HarvestGroup } from '@/components/features/farm-owner/harvest/harvestMetrics';
import { harvestDict } from '@/constants/harvest.i18n';
import { LEVEL_BADGE_SIZE } from '@/constants/severity';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import { formatStandardDate } from '@/lib/i18n';
import { NO_VALUE } from '@/constants/display';

const GRAMS_PER_KILOGRAM = 1000;

interface HarvestDetailModalProps {
  group: HarvestGroup;
  houseName: string;
  creatorName: string;
  onClose: () => void;
  onEdit: (group: HarvestGroup) => void;
  onDelete: (group: HarvestGroup) => void;
}

// Chi tiết 1 lần thu: khu vực + ngày, sản lượng từng loại yến và tổng, ảnh sản phẩm, snapshot môi trường/đàn chim, nút sửa/xoá
export default function HarvestDetailModal({ group, houseName, creatorName, onClose, onEdit, onDelete }: HarvestDetailModalProps): JSX.Element {
  const { t, num, exact } = useTranslation(harvestDict);
  const batchByType = new Map(group.batches.map(batch => [batch.nest_type, batch]));

  return (
    <Modal open onClose={onClose} title={t('detail.title')} className="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-bold text-charcoal">{formatStandardDate(group.harvest_date)}</p>
          <p className="text-sm text-warmGray">{houseName} · {t('detail.creator', { name: creatorName })}</p>
        </div>

        {/* Sản lượng đủ 3 loại yến của lần thu (loại không thu ghi 0, chữ mờ) + dòng tổng */}
        <div className="overflow-hidden rounded-2xl border border-warmGray/15">
          <div className="grid grid-cols-[9rem_1fr_1fr] gap-3 border-b border-warmGray/15 bg-warmGray/5 px-3 py-2 label-caption">
            <span>{t('form.colType')}</span>
            <span className="text-right">{t('form.nests')}</span>
            <span className="text-right">{t('detail.weight')}</span>
          </div>
          {NEST_TYPES.map(nestType => {
            const batch = batchByType.get(nestType);
            const nests = batch?.nest_count ?? 0;
            const grams = batch?.weight_grams ?? 0;
            return (
              <div key={nestType} className="grid grid-cols-[9rem_1fr_1fr] items-center gap-3 border-b border-warmGray/10 px-3 py-2.5 text-sm">
                <span className={cn('inline-flex w-fit items-center rounded-full font-medium', LEVEL_BADGE_SIZE, NEST_TYPE_BADGE_CLASS[nestType])}>
                  {t(`nestType.${nestType}`)}
                </span>
                <span className={cn('text-right tabular-nums', batch ? 'text-charcoal' : 'text-warmGray')}>{batch ? num(nests) : NO_VALUE}</span>
                <span className={cn('text-right tabular-nums', batch ? 'text-charcoal' : 'text-warmGray')}>
                  {batch ? t('detail.weightValue', { grams: exact(grams, GRAM_DIGITS), kg: num(grams / GRAMS_PER_KILOGRAM, KILOGRAM_DIGITS) }) : NO_VALUE}
                </span>
              </div>
            );
          })}
          <div className="grid grid-cols-[9rem_1fr_1fr] items-center gap-3 bg-warmGray/5 px-3 py-2.5 text-sm font-semibold text-charcoal">
            <span>{t('form.total')}</span>
            <span className="text-right tabular-nums">{num(group.nest_count)}</span>
            <span className="text-right tabular-nums">
              {t('detail.weightValue', { grams: exact(group.weight_grams, GRAM_DIGITS), kg: num(group.weight_grams / GRAMS_PER_KILOGRAM, KILOGRAM_DIGITS) })}
            </span>
          </div>
        </div>

        {group.product_images.length > 0 && <ProductImages urls={group.product_images} label={t('detail.images')} />}

        {/* Các loại cùng zone + ngày nên snapshot giống nhau, lấy của đợt đầu */}
        <SnapshotSection batch={group.batches[0]} />

        <div className="flex flex-wrap justify-end gap-2 border-t border-warmGray/10 pt-4">
          <Button variant="danger" size="sm" onClick={() => onDelete(group)}>{t('action.delete')}</Button>
          <Button variant="secondary" size="sm" onClick={() => onEdit(group)}>{t('action.edit')}</Button>
        </div>
      </div>
    </Modal>
  );
}

// Lưới ảnh sản phẩm; ảnh tải lỗi thì ẩn khỏi lưới
function ProductImages({ urls, label }: { urls: string[]; label: string }): JSX.Element | null {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const visibleUrls = urls.filter(url => !failedUrls.has(url));
  if (visibleUrls.length === 0) return null;

  return (
    <div>
      <p className="label-caption mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {visibleUrls.map(url => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-warmGray/15">
            <img
              src={url}
              alt=""
              loading="lazy"
              className="aspect-square w-full object-cover"
              onError={() => setFailedUrls(current => new Set(current).add(url))}
            />
          </a>
        ))}
      </div>
    </div>
  );
}
