# Bhojpuri / भोजपुरी (bho) native bring-up — ⛔ CANNOT-VERIFY

Indo-Aryan (Eastern), ~50M speakers (western Bihar / eastern UP / Nepal Terai). NOT the same as **Fiji Hindi** —
Fiji Hindi (and Caribbean Hindustani / Mauritian Bhojpuri) is a *diaspora koiné* descended from the indentured
Bhojpuri/Awadhi labourers, a distinct variety with heavy Bhojpuri roots. Bhojpuri is the Indian source language.

## The verification problem (why ⛔ cannot-verify)
This is the project's first **cannot-verify** language, and it is a double bind:
1. **No independent referee exists.** Re-checked 2026-07-15: wikipron `bho_deva` → 404; kaikki Bhojpuri → 404 (the
   Wiktionary extract that rescued Javanese/Swahili/Kannada/Amharic simply does not exist for Bhojpuri); epitran
   `bho-Deva` exists but is a **circular Hindi clone** — literally the Hindi Devanagari→IPA map (श→ʃə, ऐ→æː, औ→ɔː:
   the HINDI values).
2. **Bhojpuri's segmental phonology is very close to Hindi.** Its distinctiveness is overwhelmingly lexical,
   morphological, and syntactic — the layers a *phonemizer* does not touch. So a Bhojpuri g2p is, to first order,
   a Hindi g2p; and since the only automated referee is ALSO a Hindi g2p, any agreement is trivial — it measures
   nothing about actual Bhojpuri pronunciation.

Corpus size does not help (an akshara inventory is not a referee). This is the lesson of the espeak-ng-portable
`cannot_verify_status` note: check for an INDEPENDENT referee, not just data volume; a G2P clone of the parent
language is circular.

## What we CAN verify — the distinctive features (the non-circular axis)
User steer: build it anyway, and grade what genuinely differs. Bhojpuri has real SEGMENTAL divergences from Hindi
(Shukla 1981; Grierson LSI VI) — exactly where a Hindi clone is demonstrably WRONG:
- **श/ष → [s]** — Bhojpuri has NO /ʃ/ (शहर→sahar, देश→des); Hindi keeps ʃ.
- **ऐ → [ai], औ → [au]** — Bhojpuri keeps the diphthongs (बैल→bail, कौन→kaun); Hindi monophthongised to ɛː/ɔː.
- **No əɦə→ɛɦɛ lowering** — शहर→səɦəɾ, not the Hindi ɛɦɛ.

## Engine
Reuses the Hindi Devanagari engine (`makeNativeHindi` — schwa deletion, weight stress, numbers) with a Bhojpuri
data file overriding only the divergences above (`finalRules: []`, श/ष→s, ऐ/औ→ai/au). Verified against a
hand-adjudicated gold (`test/bhojpuri.test.ts`) that targets the distinctive features — the ONLY axis that is not
circular with a Hindi clone. Everything else is Hindi-identical **by design** and is neither claimed as verified
nor independently checkable.

## Status
⛔ **cannot-verify**: recorded as `referees: []` + `secondaryGap` (not silently omitted). The engine is correct on
the distinctive features (gold-confirmed) and Hindi-derived elsewhere; correctness on the Hindi-shared bulk is
ASSERTED, not measured. If an independent Bhojpuri transcription source ever appears (a wikipron scrape, a
narrow-transcribed corpus), this can be promoted; until then it stays ⛔.
