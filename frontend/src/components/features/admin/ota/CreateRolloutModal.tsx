import { useEffect, useMemo, useState } from 'react'
import { Button, DataTable, Input, Modal, ModalHeader, SearchInput, SelectMenu, type DataTableColumn } from '@/components/ui'
import StatusDot from '@/components/common/StatusDot'
import { busyNodeIds, ineligibleReason } from '@/components/features/admin/ota/rollout.utils'
import { useCreateFirmwareRollout } from '@/hooks/admin/useFirmwareRollouts'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { compareVersions } from '@/lib/firmwareFlasher'
import { formatDateOnly } from '@/lib/helpers'
import { t } from '@/i18n'
import type { FirmwareImage, FirmwareRollout, SensorNode } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (rollout: FirmwareRollout) => void
  images: FirmwareImage[]
  nodes: SensorNode[]
  rollouts: FirmwareRollout[]
  locationById: Map<string, string>
  // Bản vừa tải lên ở trang này: mở sẵn bản đó
  initialImageId?: string
}

interface Row { node: SensorNode; reason: string | null }

const NO_CANARY = ''

// Tạo đợt: chọn bản trong kho, chọn máy (máy không cập nhật được thì khoá kèm lý do), chọn máy thử trước
export default function CreateRolloutModal({ open, onClose, onCreated, images, nodes, rollouts, locationById, initialImageId }: Props) {
  const create = useCreateFirmwareRollout()
  const apiErrorMessage = useApiErrorMessage()
  const [imageId, setImageId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // null = tự chọn máy online đầu tiên; NO_CANARY = Administrator chọn không thử trước
  const [canaryChoice, setCanaryChoice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const image = images.find(i => i._id === imageId) ?? images[0]
  const version = image?.version ?? ''
  const busy = useMemo(() => busyNodeIds(rollouts), [rollouts])

  const rows: Row[] = useMemo(() => nodes
    .map(node => ({ node, reason: ineligibleReason(node, version, busy) }))
    .sort((a, b) => Number(a.reason !== null) - Number(b.reason !== null) || a.node.device_id.localeCompare(b.node.device_id, undefined, { numeric: true })),
  [nodes, version, busy])
  const query = search.trim().toLowerCase()
  const visibleRows = rows.filter(row => !query
    || row.node.device_id.toLowerCase().includes(query)
    || (locationById.get(row.node._id) ?? '').toLowerCase().includes(query))
  const olderIds = rows.filter(row => !row.reason && compareVersions(row.node.firmware_version, version) < 0).map(row => row.node._id)

  const chosen = rows.filter(row => !row.reason && selected.has(row.node._id)).map(row => row.node)
  const online = chosen.filter(node => node.status === 'ONLINE')
  // Mặc định máy online đầu tiên; không máy nào online thì không thử trước, để đợt không chờ một máy chưa biết khi nào lên
  const canary = canaryChoice === NO_CANARY ? undefined : chosen.find(node => node._id === canaryChoice) ?? online[0]

  // Mở lại hoặc đổi bản: bắt đầu từ mọi máy chạy bản cũ hơn
  useEffect(() => {
    if (!open) return
    setSelected(new Set(olderIds))
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi mở hoặc đổi bản, không theo từng lần tải lại danh sách
  }, [open, version])

  useEffect(() => {
    if (open) setImageId(initialImageId ?? '')
    else { setSearch(''); setNote(''); setCanaryChoice(null) }
  }, [open, initialImageId])

  function toggle(id: string) {
    setSelected(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit() {
    if (!image || chosen.length === 0) return
    setError(null)
    create.mutate({
      image_id: image._id,
      node_ids: chosen.map(node => node._id),
      canary_node_ids: canary ? [canary._id] : [],
      note: note.trim() || undefined,
    }, {
      onSuccess: onCreated,
      onError: err => setError(apiErrorMessage(err, t('Không tạo được đợt cập nhật'))),
    })
  }

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'select', header: '', className: 'w-10',
      render: row => (
        <input
          type="checkbox"
          aria-label={t('Chọn {{id}}', { id: row.node.device_id })}
          checked={!row.reason && selected.has(row.node._id)}
          disabled={row.reason !== null}
          // Cả hàng cũng bấm được: không để lần bấm vào ô đảo hai lần
          onClick={event => event.stopPropagation()}
          onChange={() => toggle(row.node._id)}
        />
      ),
    },
    {
      key: 'device', header: 'Thiết bị',
      render: row => (
        <span className="flex items-center gap-2 font-semibold text-charcoal">
          <StatusDot status={row.node.status} />{row.node.device_id}
        </span>
      ),
    },
    { key: 'location', header: 'Vị trí', render: row => <span className="text-graphite">{locationById.get(row.node._id) ?? '_'}</span> },
    { key: 'firmware', header: 'Firmware', render: row => <span className="font-mono">{row.node.firmware_version}</span> },
    { key: 'note', header: '', render: row => row.reason && <span className="text-xs text-warmGray">{t(row.reason)}</span> },
  ]

  const imageOptions = images.map(i => ({ value: i._id, label: `${i.version} · ${formatDateOnly(i.created_at)}` }))
  const canaryOptions = [
    { value: NO_CANARY, label: t('Không thử trước, gửi tất cả ngay') },
    ...chosen.map(node => ({
      value: node._id,
      label: node.status === 'ONLINE' ? node.device_id : t('{{id}} (mất kết nối)', { id: node.device_id }),
    })),
  ]
  const offlineCount = chosen.length - online.length

  const title = t('Tạo đợt cập nhật firmware')
  return (
    <Modal open={open} onClose={create.isPending ? () => undefined : onClose} size="xl" ariaLabel={title}>
      <div className="flex flex-col gap-5">
        <ModalHeader title={title} description="Máy mất kết nối nhận bản cập nhật khi kết nối lại. Một máy cập nhật lỗi thì đợt tự dừng." />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal">
            {t('Phiên bản')}
            <SelectMenu field ariaLabel={t('Phiên bản')} value={image?._id ?? ''} options={imageOptions} onChange={setImageId} highlightFiltered={false} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal">
            {t('Thử trước trên')}
            <SelectMenu field ariaLabel={t('Thử trước trên')} value={canary?._id ?? NO_CANARY} options={canaryOptions} onChange={setCanaryChoice} highlightFiltered={false} />
          </label>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[200px] flex-1">
              <SearchInput placeholder="Tìm mã thiết bị hoặc vị trí..." value={search} onChange={setSearch} />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set(olderIds))} disabled={olderIds.length === 0}>
              {t('Chọn máy chạy bản cũ hơn ({{n}})', { n: olderIds.length })}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())} disabled={chosen.length === 0}>{t('Bỏ chọn')}</Button>
          </div>
          <DataTable
            columns={columns}
            rows={visibleRows}
            getRowKey={row => row.node._id}
            visibleRows={6}
            minTableWidth={560}
            emptyMessage={query ? 'Không có bộ điều khiển nào khớp từ khoá.' : 'Chưa có bộ điều khiển nào đang dùng.'}
            onRowClick={row => { if (!row.reason) toggle(row.node._id) }}
          />
        </section>

        <Input label="Ghi chú" placeholder="VD: sửa lỗi kết nối lại" maxLength={200} value={note} onChange={event => setNote(event.target.value)} />

        <div className="rounded-2xl bg-gray-50 p-4 text-sm text-charcoal" aria-live="polite">
          {chosen.length === 0 ? t('Chưa chọn bộ điều khiển nào.') : (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>{t('Cập nhật {{n}} bộ điều khiển lên firmware {{version}}.', { n: chosen.length, version })}</li>
              {offlineCount > 0 && <li>{t('{{n}} máy mất kết nối sẽ nhận khi kết nối lại.', { n: offlineCount })}</li>}
              {canary
                ? <li>{t('Thử trước trên {{id}}; các máy còn lại chờ máy này cập nhật xong.', { id: canary.device_id })}</li>
                : <li>{t('Gửi tất cả cùng lúc, không thử trước.')}</li>}
              {canary && canary.status !== 'ONLINE' && (
                <li className="font-semibold text-orange-700">{t('Máy thử đang mất kết nối: các máy còn lại chờ tới khi máy này kết nối lại và cập nhật xong.')}</li>
              )}
            </ul>
          )}
        </div>

        {error && <p role="alert" className="rounded-2xl bg-orange-50 p-4 text-sm text-orange-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>{t('Huỷ')}</Button>
          <Button onClick={submit} disabled={chosen.length === 0 || !image} loading={create.isPending}>{t('Bắt đầu cập nhật')}</Button>
        </div>
      </div>
    </Modal>
  )
}
