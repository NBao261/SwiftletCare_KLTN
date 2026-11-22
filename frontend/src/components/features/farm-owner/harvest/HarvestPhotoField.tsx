import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ImageSquareIcon, XIcon } from '@phosphor-icons/react';

import { Button } from '@/components/ui';
import { harvestDict } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { HARVEST_PHOTO_TYPES, validateHarvestPhoto } from '@/validations/farm-owner/harvestPhoto.validation';

interface HarvestPhotoFieldProps {
  photo: File | null;
  // Ảnh đã lưu của lần thu (sửa), hiện khi chưa chọn ảnh mới
  savedUrl?: string | null;
  onChange: (photo: File | null) => void;
  disabled?: boolean;
}

// Ô chọn 1 ảnh lần thu: kiểm định dạng và cỡ trước khi gửi, xem trước ảnh đã chọn hoặc ảnh đã lưu
export default function HarvestPhotoField({ photo, savedUrl, onChange, disabled = false }: HarvestPhotoFieldProps): JSX.Element {
  const { t } = useTranslation(harvestDict);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Link xem trước của file đã chọn; thu hồi khi đổi file hoặc đóng popup
  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function handlePick(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = validateHarvestPhoto(file);
    setError(problem === 'type' ? t('photo.errorType') : problem === 'size' ? t('photo.errorSize') : null);
    if (!problem) onChange(file);
  }

  const shownUrl = previewUrl ?? savedUrl ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="label-caption">{t('photo.label')}</span>
        <p className="mt-0.5 text-xs text-warmGray">{t('photo.hint')}</p>
      </div>
      <div className="flex items-center gap-3">
        {shownUrl ? (
          <img src={shownUrl} alt={t('detail.photo')} className="h-16 w-16 rounded-xl border border-warmGray/15 object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-warmGray/30 text-warmGray">
            <ImageSquareIcon size={24} />
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={HARVEST_PHOTO_TYPES.join(',')}
          className="hidden"
          aria-label={t('photo.label')}
          onChange={handlePick}
          disabled={disabled}
        />
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
          {shownUrl ? t('photo.change') : t('photo.pick')}
        </Button>
        {photo && (
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => onChange(null)} aria-label={t('photo.remove')}>
            <XIcon size={16} />
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-alertRed">{error}</p>}
    </div>
  );
}
