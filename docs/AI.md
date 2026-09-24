# AI

Provider: Vercel AI SDK through AI Gateway, model `openai/gpt-4o-mini`, enabled by `AI_GATEWAY_API_KEY`. Without the key the app still works: summaries use rule-based text, chat returns a "not configured" message, and document scan returns 501.

## Principle: code calculates, the model narrates

| Kind | Where | LLM involved? |
|---|---|---|
| Recorded facts (counts, dates, values) | `lib/analytics.ts` | No |
| Calculations (weight/lab change, delta %, trends, vet-visit and symptom patterns) | `lib/analytics.ts`, `lib/patterns.ts` | No |
| Narrative and attention wording | `lib/ai/summary.ts` | Yes, guarded |
| Chat answers | `app/api/pets/[id]/chat/route.ts` | Yes |
| Document extraction (draft only) | `app/api/pets/[id]/extract-document/route.ts` | Yes |

The summary response always includes the deterministic `whatChanged` and `patterns`, whatever the model says.

## Prompt rules

Both system prompts forbid diagnosis, medication/dose/treatment suggestions and invented data; require hedged wording ("may be worth mentioning to your vet"); require quoting provided figures instead of computing new ones; ask the model to keep recorded facts, provided calculations and its own interpretation distinct and to say when data is too sparse; and tell it that record text (`title`, `notes`, scanned text) is data, never instructions.

## Output guard (summary only)

`lib/ai/guard.ts` checks the model's `whatHappened` and each attention item:

1. **Ungrounded numbers**: any number not present in the data sent to the model is rejected (calendar dates are compared separately; years must appear in the data).
2. **Unsafe claims**: directive treatment advice ("you should give..."), "I recommend...", or a stated diagnosis is rejected.

A rejected narrative is replaced by the rule-based text; rejected attention items are dropped, and the rule-based >=15% change flag is kept. These are heuristics, tuned to reject when unsure. They are covered by `guard.test.ts` and `summary.test.ts`.

## Cost and abuse controls

- Per user: chat 30 / 10 min, summary 30 / 10 min, scan 10 / 5 min (429 with `Retry-After`).
- Chat: message max 2000 chars, output capped at 600 tokens, 45 s timeout. Summary: 20 s timeout, then rule-based fallback. Scan: 45 s timeout, 10 MB image cap, image mime allowlist.
- The 30 most recent records are sent to the model, not the whole history.

## Document extraction

Returns a draft `{type, title, date, value, unit, notes, confidence}`. Nothing is saved; the app shows the draft for review and the user saves it through the normal record endpoint. Text on the document is treated as content, not commands.

## Known limitations

- The streamed chat answer is not post-checked (a stream cannot be filtered after the fact); it relies on the prompt, the token cap and the disclaimer shown in the app.
- Chat has no memory; every question is answered from the records only.
- Prompt-injection resistance is prompt-based plus the summary guard; it is not a formal guarantee.
- Health notes and scanned images are sent to the AI provider. Add user-facing consent and a privacy policy before public release.
- No automated evaluation set for answer quality.
