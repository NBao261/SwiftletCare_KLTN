import { useQuery } from '@tanstack/react-query'
import { weatherApi } from '@/apis/shared/weather.api'

const TEN_MINUTES_MS = 10 * 60_000

// Backend nhớ số 10 phút, nên hỏi lại cùng nhịp là đủ
export function useCurrentWeather(houseId: string | undefined) {
  return useQuery({
    queryKey: ['weather', 'current', houseId],
    queryFn: () => weatherApi.getCurrent(houseId!).then(response => response.data.data),
    enabled: Boolean(houseId),
    staleTime: TEN_MINUTES_MS,
    refetchInterval: TEN_MINUTES_MS,
  })
}
