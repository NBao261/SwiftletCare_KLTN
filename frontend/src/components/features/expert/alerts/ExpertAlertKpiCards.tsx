/**
 * ExpertAlertKpiCards — 4 Thẻ KPI đầu trang 02A_Expert_Alerts_v3
 * SRS v2.1.4: EXPERT-FR-003
 */

import React from 'react'
import { Bell, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

interface AlertKpiCounts {
  total: number
  pending: number
  confirmed: number
  rejected: number
}

interface Props {
  counts: AlertKpiCounts
  isLoading?: boolean
}

interface KpiCardProps {
  label: string
  sublabel: string
  value: number | string
  icon: React.ReactNode
  accent: string
  dotColor: string
}

function KpiCard({ label, sublabel, value, icon, accent, dotColor }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#878380] leading-tight">{label}</span>
        <span className="text-neutral-300">{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className={cn('text-3xl font-bold leading-none tabular-nums', accent)}>
          {value}
        </span>
        <span className={cn('w-2 h-2 rounded-full mb-1 flex-shrink-0', dotColor)} />
      </div>
      <span className="text-[11px] text-[#878380] leading-tight">{sublabel}</span>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 animate-pulse">
      <div className="h-3 bg-neutral-100 rounded w-2/3 mb-3" />
      <div className="h-8 bg-neutral-100 rounded w-1/3 mb-2" />
      <div className="h-3 bg-neutral-100 rounded w-1/2" />
    </div>
  )
}

export default function ExpertAlertKpiCards({ counts, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
      </div>
    )
  }

  const cards: KpiCardProps[] = [
    {
      label: 'Tổng cảnh báo suy luận',
      sublabel: '30 ngày qua',
      value: counts.total,
      accent: 'text-[#27231F]',
      dotColor: 'bg-[#B5D32C]',
      icon: <Bell className="w-4 h-4 text-[#27231F]" />,
    },
    {
      label: 'Chờ kiểm chứng',
      sublabel: 'Cần chuyên gia thẩm định',
      value: counts.pending.toString().padStart(2, '0'),
      accent: 'text-orange-500',
      dotColor: 'bg-orange-400',
      icon: <Clock className="w-4 h-4 text-orange-400" />,
    },
    {
      label: 'Đã xác nhận (Sự cố thật)',
      sublabel: 'Hệ thống suy luận chính xác',
      value: counts.confirmed,
      accent: 'text-[#27231F]',
      dotColor: 'bg-[#B5D32C]',
      icon: <CheckCircle2 className="w-4 h-4 text-[#B5D32C]" />,
    },
    {
      label: 'Đã bác bỏ (Báo động giả)',
      sublabel: 'Nhiều hoặc dao động tự nhiên',
      value: counts.rejected.toString().padStart(2, '0'),
      accent: 'text-[#878380]',
      dotColor: 'bg-neutral-300',
      icon: <XCircle className="w-4 h-4 text-neutral-400" />,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  )
}
