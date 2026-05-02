import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMoods, logMood } from '../../api/mood';
import type { MoodData } from '../../api/mood';

export const useMoods = (userId?: string) => {
  return useQuery({
    queryKey: ['moods', userId],
    queryFn: () => getMoods(userId || ''),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useLogMood = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ userId, moodData, audioBlob }: { userId: string; moodData: MoodData; audioBlob?: Blob }) => 
      logMood(userId, moodData, audioBlob),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moods'] });
    },
  });
};
