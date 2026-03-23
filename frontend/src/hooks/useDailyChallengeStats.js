import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/apiClient';

export function useDailyChallengeStats() {
  return useQuery({
    queryKey: ['dailyChallengeStats'],
    queryFn: () => api.get('/seller/daily-challenge/stats').then(r => r.data),
    staleTime: 60_000,
  });
}
