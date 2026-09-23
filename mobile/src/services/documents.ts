import { api } from '@/services/api';
import type { HealthRecordType } from '@/types';

export interface ExtractedRecordDraft {
  type: HealthRecordType;
  title: string;
  date: string | null;
  value: number | null;
  unit: string | null;
  notes: string | null;
  confidence: 'low' | 'medium' | 'high';
}

export const documentsService = {
  extract: (petId: string, imageBase64: string, mimeType: string) =>
    api.post<ExtractedRecordDraft>(`/api/pets/${petId}/extract-document`, {
      imageBase64,
      mimeType,
    }),
};
