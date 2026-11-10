import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { CrownIcon, EnvelopeSimpleIcon, UserIcon, UserMinusIcon, UsersIcon } from 'phosphor-react-native'
import { MockDataBadge } from '@/components/common/MockDataBadge'
import { HeaderPicker } from '@/components/farm/HeaderPicker'
import { OptionSheet } from '@/components/farm/OptionSheet'
import { HomeSection } from '@/components/home/HomeSection'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { InviteMemberSheet } from '@/components/profile/InviteMemberSheet'
import { ProfileRow } from '@/components/profile/ProfileRow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { Toast } from '@/components/ui/toast'
import { IS_MOCK_API_ENABLED } from '@/constants/mockApi'
import { Radius, Spacing } from '@/constants/theme'
import { useCurrentFarm } from '@/hooks/farm/useCurrentFarm'
import { useFarmDetail } from '@/hooks/farm/useFarmDetail'
import { useRemoveFarmMember } from '@/hooks/farm/useRemoveFarmMember'
import { useReturnBack } from '@/hooks/navigation/useReturnBack'
import { usePendingInvitations } from '@/hooks/profile/usePendingInvitations'
import { useNow } from '@/hooks/time/useNow'
import { usePalette } from '@/hooks/theme/usePalette'
import { useToastMessage } from '@/hooks/ui/useToastMessage'
import { useAuthStore } from '@/stores/authStore'
import type { FarmMember } from '@/types'
import { getDaysLeft, getMemberRoleLabel, sortMembers } from '@/utils/account.utils'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { formatDate } from '@/utils/date.utils'
import { farmHasExpert } from '@/utils/farm.utils'
import { canPerform } from '@/utils/permission.utils'
import { t } from '@/utils/i18n.utils'

const HOUR_MS = 60 * 60 * 1000

/**
 * Thành viên farm (AUTH-FR-005, EXPERT-FR-001, §6.4): Farm Owner xem chủ chính, đồng sở hữu, chuyên gia;
 * chỉ Primary Owner mời và gỡ. Khoá tài khoản là việc của Administrator (AUTH-FR-011), không có ở đây
 */
export default function MembersScreen() {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const current = useCurrentFarm()
  // Mở từ nhãn "Chưa có chuyên gia" ở danh sách nhà: farmId của farm đang xem; ‹ quay về đó
  const { farmId: requestedFarmId } = useLocalSearchParams<{ farmId?: string }>()
  const returnBack = useReturnBack()
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const linkedFarmId = current.farms.some(item => item._id === requestedFarmId) ? requestedFarmId : undefined
  const farmId = selectedFarmId ?? linkedFarmId ?? current.farm?._id ?? ''
  const detailQuery = useFarmDetail(farmId)
  const invitationsQuery = usePendingInvitations(farmId)
  const removeMember = useRemoveFarmMember(farmId)
  const toast = useToastMessage()
  // Số ngày còn lại của lời mời: cập nhật mỗi giờ là đủ
  const now = useNow(HOUR_MS)
  const [isFarmSheetOpen, setFarmSheetOpen] = useState(false)
  const [isInviteOpen, setInviteOpen] = useState(false)
  // Mỗi lần mở sheet mời là một sheet mới, không giữ email cũ
  const [inviteSheetKey, setInviteSheetKey] = useState(0)

  const farm = detailQuery.data?.data ?? current.farms.find(item => item._id === farmId) ?? null
  const isPrimaryOwner = Boolean(farm && user && farm.owner_id === user._id)
  const canManage = canPerform(user, 'manageFarmMembers', { isPrimaryOwner })
  const hasExpert = farm ? farmHasExpert(farm) : false

  if (!canPerform(user, 'viewFarmMembers')) return <Redirect href="/(tabs)/profile" />

  const confirmRemove = (member: FarmMember) => {
    const name = member.full_name || member.email || t('thành viên này')
    Alert.alert(t('Gỡ thành viên'), t('Gỡ {name} khỏi {farm}? Người này không xem được farm nữa.', { name, farm: farm?.name ?? '' }), [
      { text: t('Huỷ'), style: 'cancel' },
      {
        text: t('Gỡ'),
        style: 'destructive',
        onPress: () =>
          removeMember.mutate(member.user_id, {
            onSuccess: () => toast.show(t('Đã gỡ {name}', { name })),
            onError: error =>
              toast.show(
                getSettingsErrorMessage(error, {
                  400: t('Không gỡ được chủ chính của farm'),
                  403: t('Chỉ chủ chính của farm mới gỡ được thành viên'),
                }),
              ),
          }),
      },
    ])
  }

  const renderMembers = () => {
    if (detailQuery.isLoading) {
      return (
        <View style={styles.list} accessibilityLabel={t('Đang tải')}>
          {[0, 1, 2].map(index => (
            <Skeleton key={index} width="100%" height={56} radius={Radius.md} />
          ))}
        </View>
      )
    }
    if (detailQuery.isError || !farm) {
      return <EmptyState message={t('Không tải được danh sách thành viên')} actionLabel={t('Thử lại')} onAction={() => detailQuery.refetch()} />
    }
    const members = sortMembers(farm.members, farm.owner_id)
    return (
      <Card style={styles.listCard}>
        {members.map((member, index) => {
          const isOwner = member.is_primary || member.user_id === farm.owner_id
          const isSelf = member.user_id === user?._id
          const canRemove = canManage && !isOwner && !isSelf
          return (
            <ProfileRow
              key={member.user_id}
              icon={isOwner ? CrownIcon : UserIcon}
              label={`${member.full_name || member.email || '_'}${isSelf ? ` (${t('bạn')})` : ''}`}
              caption={`${getMemberRoleLabel(member, farm.owner_id)} · ${t('Từ {date}', { date: formatDate(member.joined_at) })}`}
              hasDivider={index < members.length - 1}
              trailing={
                canRemove ? (
                  <IconButton
                    icon={UserMinusIcon}
                    label={t('Gỡ {name}', { name: member.full_name || member.email || '' })}
                    color={palette.alert}
                    // Đang gỡ thì khoá nút (IconButton không có onPress là bị khoá)
                    onPress={removeMember.isPending ? undefined : () => confirmRemove(member)}
                  />
                ) : undefined
              }
            />
          )
        })}
      </Card>
    )
  }

  const renderInvitations = () => {
    if (!IS_MOCK_API_ENABLED) {
      return <EmptyState message={t('Danh sách lời mời đang chờ: Sắp có')} />
    }
    const invitations = invitationsQuery.data ?? []
    if (invitationsQuery.isLoading) return <Skeleton width="100%" height={56} radius={Radius.md} />
    if (invitations.length === 0) return <EmptyState message={t('Không có lời mời nào đang chờ')} />
    return (
      <Card style={styles.listCard}>
        <MockDataBadge />
        {invitations.map((invitation, index) => (
          <ProfileRow
            key={invitation._id}
            icon={EnvelopeSimpleIcon}
            label={invitation.invited_email}
            caption={`${invitation.invited_role === 'DOMAIN_EXPERT' ? t('Chuyên gia') : t('Đồng sở hữu')} · ${t('còn {days} ngày', {
              days: getDaysLeft(invitation.expires_at, now),
            })}`}
            hasDivider={index < invitations.length - 1}
          />
        ))}
      </Card>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader
        title={t('Thành viên farm')}
        onBack={returnBack ?? (() => router.back())}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.lg + TAB_BAR_OVERLAP }]}
      >
        <HeaderPicker
          title={farm?.name ?? '_'}
          onPress={current.hasMultipleFarms ? () => setFarmSheetOpen(true) : undefined}
          accessibilityLabel={t('Chọn farm, đang xem {farm}', { farm: farm?.name ?? '' })}
        />

        {/* Farm chưa có chuyên gia thì chủ trại tự quyết thay (BR-22); gợi ý mời chuyên gia */}
        {farm && !hasExpert && (
          <Card style={styles.hint}>
            <View style={[styles.hintIcon, { backgroundColor: palette.surfaceStrong }]}>
              <UsersIcon size={20} color={palette.text} />
            </View>
            <View style={styles.hintText}>
              <Text variant="body" weight="medium">
                {t('Farm chưa có chuyên gia')}
              </Text>
              <Text variant="small" color={palette.textSecondary}>
                {t('Khi chưa có chuyên gia, chủ trại tự quyết các việc của chuyên gia. Mời chuyên gia để kiểm chứng cảnh báo và chỉnh tham số.')}
              </Text>
            </View>
          </Card>
        )}

        <HomeSection title={t('Thành viên')}>{renderMembers()}</HomeSection>
        <HomeSection title={t('Lời mời đang chờ')}>{renderInvitations()}</HomeSection>

        {canManage ? (
          <Button
            label={t('Mời thành viên')}
            onPress={() => {
              setInviteSheetKey(key => key + 1)
              setInviteOpen(true)
            }}
          />
        ) : (
          <Text variant="small" color={palette.textSecondary} center>
            {t('Chỉ chủ chính của farm mới mời và gỡ được thành viên.')}
          </Text>
        )}
      </ScrollView>

      <OptionSheet
        visible={isFarmSheetOpen}
        title={t('Chọn farm')}
        options={current.farms.map(item => ({ id: item._id, label: item.name, caption: item.address }))}
        selectedId={farmId}
        onSelect={id => {
          setSelectedFarmId(id)
          setFarmSheetOpen(false)
        }}
        onClose={() => setFarmSheetOpen(false)}
      />
      {farm && (
        <InviteMemberSheet
          key={inviteSheetKey}
          visible={isInviteOpen}
          farmId={farm._id}
          farmName={farm.name}
          defaultRole={hasExpert ? 'FARM_OWNER' : 'DOMAIN_EXPERT'}
          onInvited={email => {
            setInviteOpen(false)
            toast.show(t('Đã gửi lời mời tới {email}', { email }))
          }}
          onClose={() => setInviteOpen(false)}
        />
      )}
      {toast.message && <Toast message={toast.message} bottomOffset={TAB_BAR_OVERLAP + Spacing.lg} />}
    </View>
  )
}

const HINT_ICON_SIZE = 40

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  list: { gap: Spacing.sm },
  listCard: { paddingVertical: Spacing.xs },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  hintIcon: {
    width: HINT_ICON_SIZE,
    height: HINT_ICON_SIZE,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: { flex: 1, gap: Spacing.xs },
})
