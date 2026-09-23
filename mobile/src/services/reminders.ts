import { api } from '@/services/api';
import type { Reminder } from '@/types';

export const remindersService = {
  list: (petId: string) => api.get<Reminder[]>(`/api/pets/${petId}/reminders`),
  create: (petId: string, data: Omit<Reminder, 'id' | 'petId' | 'createdAt' | 'isDone'>) =>
    api.post<Reminder>(`/api/pets/${petId}/reminders`, data),
  update: (
    petId: string,
    reminderId: string,
    data: Partial<Omit<Reminder, 'id' | 'petId' | 'createdAt'>>,
  ) => api.patch<Reminder>(`/api/pets/${petId}/reminders/${reminderId}`, data),
  remove: (petId: string, reminderId: string) =>
    api.delete<void>(`/api/pets/${petId}/reminders/${reminderId}`),
};
