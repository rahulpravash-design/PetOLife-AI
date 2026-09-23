import { generateObject } from 'ai';
import { z } from 'zod';

import { errorResponse, handleRoute, parseBody } from '@/lib/api-utils';
import { requireUserId } from '@/lib/auth';
import { requireOwnedPet } from '@/lib/authorize';

const RECORD_TYPES = [
  'weight',
  'vaccination',
  'medication',
  'vet_visit',
  'symptom',
  'lab_result',
  'note',
] as const;

const requestSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().default('image/jpeg'),
});

const extractionSchema = z.object({
  type: z.enum(RECORD_TYPES).describe('Best-fit record type for this document.'),
  title: z.string().describe('Short title, e.g. "Rabies vaccine" or "Blood panel".'),
  date: z.string().nullable().describe('ISO date found on the document, or null if not legible.'),
  value: z.number().nullable().describe('Primary numeric value if present (weight, dosage amount, lab value).'),
  unit: z.string().nullable().describe('Unit for the value, if any.'),
  notes: z.string().nullable().describe('Any other relevant text from the document.'),
  confidence: z.enum(['low', 'medium', 'high']).describe('Your confidence in this extraction.'),
});

// This ONLY extracts a draft. Nothing is written to the database here — the
// mobile app must show the draft for user review/edit and call the normal
// create-record endpoint to actually save it.
type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return handleRoute(async () => {
    const userId = requireUserId(request);
    const { id } = await params;
    requireOwnedPet(userId, id);

    if (!process.env.AI_GATEWAY_API_KEY) {
      return errorResponse(501, 'Document extraction requires AI_GATEWAY_API_KEY to be configured');
    }

    const { imageBase64, mimeType } = await parseBody(request, requestSchema);

    const { object } = await generateObject({
      model: 'openai/gpt-4o-mini',
      schema: extractionSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract a single pet health record from this document photo (vet invoice, vaccination card, lab report, etc). Only report what is actually visible.',
            },
            { type: 'image', image: `data:${mimeType};base64,${imageBase64}` },
          ],
        },
      ],
    });

    return object;
  });
}
