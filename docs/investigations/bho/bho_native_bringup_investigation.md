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

## Run 2 — revised against a reference grammar (⛔ → 🔷)

The user supplied *A Grammar of Bhojpuri* (a dissertation in the Shukla tradition). Rather than hand-pick examples,
its glossed forms were **g2p-mined**: a regex over the pdftotext extraction pulled **1759 Devanagari↔IPA pairs**
(1622 after cleaning misalignments) — a real falsifiable anchor, the Korn/Balochi method.

**The mining settled the open questions and corrected the module** (the original ⛔ module was authored from Shukla's
*rules* and got two things wrong):
- **No phonemic vowel length** — 0 of 1622 mined transcriptions carry a length mark. Bhojpuri has an 8-vowel
  /i e ɛ a ʌ ɔ o u/ system (length is contrastive only in the अ/आ = ʌ/a pair). The module's Hindi-inherited
  iː/aː/uː were wrong → ई/इ→i, ऊ/उ→u, ा→ɑ.
- **⟨ऐ⟩→[ɛ], ⟨औ⟩→[ɔ] are MONOPHTHONGS** (ऐस→ɛs, गैर→ger, बैल→bɛl) — the original module's headline claim that
  Bhojpuri *keeps* them as diphthongs [ai]/[au] was **contradicted by every mined example**. Corrected.
- **⟨व⟩→[w]** (67 mined [w] vs 10 [b]) — not Hindi's [ʋ]; the [b] cases are a word-initial minority (वर्ष→bʌrs).
- **⟨ण ञ⟩→[n]** (allophones of /n/; Grammar Table 4.13) and the confirmed **श/ष→s** (only /s ɦ/ fricatives).

**Result.** With the module revised, `npx tsx tools/referee-eval/eval.ts bho` scores **62.1% folded (1008/1623)**
against the mined referee — folds are notation only (j for य, j/c for ज/च, r for the tap, ʌ for schwa, the breathy
diacritic). The ~38% residual is a bounded, documented tail: the grammar's finer **schwa-deletion** granularity
(our shared Hindi rule keeps some medial schwas the grammar drops), **tatsama vowel epenthesis** (स्त्री→istiri,
स्कूल→iskul — an insertion the module doesn't do), and **auto-mining noise** (roots/fragments and a fraction of
misaligned pairs the regex captured).

**Verdict: ⛔ → 🔷.** The module is now grammar-correct on the vowel system + the key consonants, and anchored on a
1622-pair mine of a published grammar (single source, falsifiable) instead of a self-authored hand gold. Bug fixed
en route: setting the inherent vowel to [ʌ] broke the shared schwa-deletion rule (which keys on [ə]) — reverted to
[ə] with an ə~ʌ fold. The alias `mag`→`bho` inherits all of this (Magahi shares the phonology).
