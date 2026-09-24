import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { remindersService } from '@/services/reminders';
import type { Reminder } from '@/types';

export function useReminders(petId: string) {
  return useQuery({
    queryKey: ['pets', petId, 'reminders'],
    queryFn: () => remindersService.list(petId),
    enabled: !!petId,
  });
}

export function useCreateReminder(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Reminder, 'id' | 'petId' | 'createdAt' | 'isDone'>) =>
      remindersService.create(petId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pets', petId, 'reminders'] }),
  });
}

export function useToggleReminder(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) =>
      remindersService.update(petId, id, { isDone }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pets', petId, 'reminders'] }),
  });
}

export function useDeleteReminder(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reminderId: string) => remindersService.remove(petId, reminderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pets', petId, 'reminders'] }),
  });
}
