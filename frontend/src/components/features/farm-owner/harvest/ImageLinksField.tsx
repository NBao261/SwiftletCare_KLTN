import { useState, type KeyboardEvent } from 'react';
import { ImageSquareIcon, PlusIcon, XIcon } from '@phosphor-icons/react';

import { harvestDict } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';

// Số ảnh tối đa mỗi lần thu — giữ popup gọn; backend chỉ lưu danh sách link nên không có giới hạn riêng
export const MAX_IMAGE_LINKS = 5;

// Link ảnh hợp lệ: http(s) đã host sẵn (backend chỉ lưu link, chưa nhận file ảnh)
const isImageLink = (text: string): boolean => /^https?:\/\/\S+$/i.test(text);

interface ImageLinksFieldProps {
  links: string[];
  onChange: (links: string[]) => void;
  disabled?: boolean;
}

// Ô dán link ảnh sản phẩm: dán 1 hoặc nhiều link (mỗi dòng 1 link) rồi Enter / bấm Thêm; xem trước ảnh nhỏ, bỏ từng ảnh
export default function ImageLinksField({ links, onChange, disabled = false }: ImageLinksFieldProps): JSX.Element {
  const { t } = useTranslation(harvestDict);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [brokenLinks, setBrokenLinks] = useState<Set<string>>(new Set());
  const isFull = links.length >= MAX_IMAGE_LINKS;

  // Tách chữ đã dán thành từng link, bỏ link sai, trùng hoặc vượt số ảnh tối đa
  function addDraft(): void {
    const candidates = draft.split(/\s+/).map(text => text.trim()).filter(Boolean);
    if (candidates.length === 0) return;
    const existing = new Set(links);
    const valid = candidates.filter(text => isImageLink(text) && !existing.has(text));
    const accepted = [...new Set(valid)].slice(0, Math.max(MAX_IMAGE_LINKS - links.length, 0));
    if (candidates.some(text => !isImageLink(text))) setMessage(t('links.invalid'));
    else if (accepted.length < valid.length) setMessage(t('links.tooMany', { max: MAX_IMAGE_LINKS }));
    else setMessage(null);
    if (accepted.length > 0) onChange([...links, ...accepted]);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addDraft();
    }
  }

  function removeLink(link: string): void {
    onChange(links.filter(item => item !== link));
    setMessage(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-caption">{t('form.imagesOptional')}</span>
        <span className="text-xs text-warmGray">{t('links.count', { count: links.length, max: MAX_IMAGE_LINKS })}</span>
      </div>

      {/* Ô dán link + nút Thêm cùng hàng */}
      <div className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          value={draft}
          disabled={disabled || isFull}
          placeholder={isFull ? t('links.full', { max: MAX_IMAGE_LINKS }) : t('links.placeholder')}
          aria-label={t('form.imagesOptional')}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          className="input h-10 min-w-0 flex-1 py-0 text-sm"
        />
        <button
          type="button"
          disabled={disabled || isFull || draft.trim() === ''}
          onClick={addDraft}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-warmGray/25 px-4 text-xs font-semibold text-charcoal transition-colors hover:bg-warmGray/10 disabled:cursor-not-allowed disabled:text-warmGray/50 disabled:hover:bg-transparent"
        >
          <PlusIcon size={12} weight="bold" />
          {t('links.add')}
        </button>
      </div>

      {message && <p className="text-xs text-alertRed">{message}</p>}

      {/* Xem trước: link không mở được thì hiện ô xám có icon */}
      {links.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {links.map(link => (
            <li key={link} title={link} className="relative h-16 w-16 overflow-hidden rounded-lg border border-warmGray/15 bg-warmGray/5">
              {brokenLinks.has(link) ? (
                <span className="flex h-full w-full items-center justify-center text-warmGray">
                  <ImageSquareIcon size={20} />
                </span>
              ) : (
                <img
                  src={link}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={() => setBrokenLinks(current => new Set(current).add(link))}
                />
              )}
              <button
                type="button"
                aria-label={t('links.remove')}
                disabled={disabled}
                onClick={() => removeLink(link)}
                className={cn('absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-charcoal/80 text-white hover:bg-charcoal')}
              >
                <XIcon size={10} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
