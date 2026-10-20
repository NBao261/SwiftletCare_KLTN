import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import { Button } from '@/components/ui'
import { Drawer } from '@/components/ui/Drawer'
import { useTicketChat } from '@/hooks/shared/useTicketChat'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { cn } from '@/lib/cn'
import { supportDict } from '@/constants/support.i18n'

const AUTHOR_ROLES = ['TECHNICIAN', 'ADMIN', 'FARM_OWNER'] as const
type AuthorRole = typeof AUTHOR_ROLES[number]
const isAuthorRole = (role: string): role is AuthorRole => (AUTHOR_ROLES as readonly string[]).includes(role)
const MAX_LENGTH = 2000

interface SupportTicketChatProps {
  ticketId: string
  // Yêu cầu đã hoàn tất thì chỉ xem lại lịch sử
  closed: boolean
  open: boolean
  onClose: () => void
}

// Khung trao đổi với kỹ thuật viên phụ trách
export default function SupportTicketChat({ ticketId, closed, open, onClose }: SupportTicketChatProps) {
  const { t, dateTime } = useTranslation(supportDict)
  const userId = useAuthStore(state => state.user?._id)
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const { messages, isLoading, isError, error, live, send } = useTicketChat(ticketId, open)

  // Cuộn trong khung chat (không cuộn cả trang) mỗi khi có tin mới
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  function handleSend() {
    const content = text.trim()
    if (!content) return
    send.mutate(content, {
      onSuccess: () => setText(''),
      onError: sendError => push(apiErrorMessage(sendError, t('chat.sendFailed')), 'error'),
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={t('chat.title')}>
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <p className="label-caption">{t('chat.caption')}</p>
        <span className={cn('flex items-center gap-1.5 text-small font-semibold', live ? 'text-charcoal' : 'text-warmGray')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-success' : 'bg-warmGray/40')} />
          {live ? t('chat.live') : t('chat.polling')}
        </span>
      </div>

      <div ref={listRef} className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {isLoading && <p className="py-6 text-center text-sm text-warmGray">{t('chat.loading')}</p>}

        {isError && (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <p className="text-sm font-medium text-charcoal">{t('chat.errorTitle')}</p>
            <p className="text-small text-warmGray">{apiErrorMessage(error)}</p>
          </div>
        )}

        {!isLoading && !isError && messages.length === 0 && (
          <p className="py-6 text-center text-sm text-warmGray">
            {t('chat.empty')}{closed ? '' : ` ${t('chat.emptyHint')}`}
          </p>
        )}

        {messages.map(message => {
          if (message.is_system || message.role === 'SYSTEM') {
            return (
              <div key={message._id} className="flex flex-col items-center gap-0.5 py-1">
                <span className="rounded-full bg-graphite/5 px-3 py-1 text-center text-small italic text-warmGray">{message.content}</span>
                <span className="text-small text-warmGray/70">{dateTime(message.created_at)}</span>
              </div>
            )
          }
          const mine = message.author_id === userId
          // Nhãn vai trò người gửi, vai trò ngoài danh sách thì bỏ trống
          const roleLabel = isAuthorRole(message.role) ? t(`role.${message.role}`) : undefined
          return (
            <div key={message._id} className={cn('flex flex-col gap-0.5', mine ? 'items-end' : 'items-start')}>
              {!mine && (
                <span className="label-caption">
                  {message.author_name ?? t('chat.unknownUser')}
                  {roleLabel && ` · ${roleLabel}`}
                </span>
              )}
              <div
                className={cn(
                  'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  mine ? 'rounded-br-sm bg-charcoal text-white' : 'rounded-bl-sm border border-graphite/15 bg-warmGray/5 text-charcoal',
                )}
              >
                {message.content}
              </div>
              <span className="text-small text-warmGray/70">{dateTime(message.created_at)}</span>
            </div>
          )
        })}
      </div>

      {!isError && (closed ? (
        <p className="mt-3 shrink-0 border-t border-graphite/10 pt-3 text-small text-warmGray">
          {t('chat.closed')}
        </p>
      ) : (
        <div className="mt-3 flex shrink-0 gap-2 border-t border-graphite/10 pt-3">
          <textarea
            aria-label={t('chat.inputAria')}
            value={text}
            onChange={event => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_LENGTH}
            rows={2}
            placeholder={t('chat.placeholder')}
            className="input flex-1 resize-none"
          />
          <Button onClick={handleSend} loading={send.isPending} disabled={!text.trim()} className="shrink-0 self-end">
            {t('chat.send')}
          </Button>
        </div>
      ))}
    </Drawer>
  )
}
