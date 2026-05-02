import { useQuery } from '@tanstack/react-query';
import { getSubscriptionStatus } from '../../api/subscription';

export const useSubscriptionStatus = (userId?: string) => {
  return useQuery({
    queryKey: ['subscription', 'status', userId],
    queryFn: () => getSubscriptionStatus(userId || ''),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
