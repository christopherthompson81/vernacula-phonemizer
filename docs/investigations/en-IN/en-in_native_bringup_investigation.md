# Indian English (en-IN) native bring-up

General Indian English (GIE), ~200M L2 speakers, the OmniVoice FLEURS `en_in` training locale. Built as the third
**accent variant** of the GenAm `en` engine — a context-free surface post-process on the English G2P output, the
es-419 pattern (no lexical sets, so shipped == rule path), NOT an engine fork. `src/languages/english-in/`.

## Why post-process (not a fork)

Every GIE-distinctive feature that is rule-recoverable from the GenAm citation form is a categorical surface remap:
retroflexion, TH-stopping, the v/w merger, FACE/GOAT monophthongisation, de-aspiration, clear-l, and rhotic-tap.
None loses information the engine already computed, so a `toIndian()` delta on the output suffices (the pt-BR case —
where EP pretonic reduction was unrecoverable and forced `dialect:"bp"` in the engine — does not arise here).

## The delta (GenAm → GIE), sourced from Wells 1982 vol. 3 + Sailaja 2009 *Indian English*

Ordered in `toIndian()` (order matters):
1. **Retroflexion** /t d/ → [ʈ ɖ]. The signature. Implemented as `t[ʰ̬̰]?(?!͡)→ʈ` / `d[̬̰]?(?!͡)→ɖ` — matches the
   plain, aspirated, and flapped coronals but the negative-lookahead on the tie U+0361 protects the affricates
   t͡ʃ/d͡ʒ (church→t͡ʃəɾt͡ʃ, NOT ʈ͡ʃ). Runs BEFORE TH-stopping so the dental stops created next aren't swept up.
2. **TH-stopping** /θ/→[t̪ʰ] (aspirated dental), /ð/→[d̪]. Distinct from the retroflex /t d/ by PLACE (dental vs
   retroflex) → thin [t̪ʰɪn] ≠ tin [ʈɪn]. The aspiration on /θ/ is the documented GIE realisation (the Indic dental
   aspirate mapped onto English); it is consistent with de-aspirating the *other* stops (Indic speakers run their
   own aspiration system).
3. **Monophthongisation** FACE [eᶦ]→[eː], GOAT [oᶷ]→[oː]. PRICE/MOUTH stay diphthongs ([aᶦ]→[aɪ], [aᶷ]→[aʊ]).
4. **/v/–/w/ merger** → [ʋ] (labiodental approximant): wet = vet = ʋɛʈ.
5. **De-aspiration** of the remaining voiceless stops /p k/ → [p k] (GIE lacks English aspiration); /t/ was already
   de-aspirated by the retroflexion.
6. **Clear /l/** — drop the dark-coda [ɫ] → [l].
7. **Rhotic with a tap** — GIE is rhotic (spelling-pronunciation), so coda /ɹ/ is KEPT (unlike en-GB's non-rhotic
   drop) and every /ɹ/ → [ɾ]; the r-coloured vowels de-rhoticise to V+[ɾ] (NURSE ɝ→əɾ, lettER ɚ→əɾ). car→kɑːɾ,
   letter→lɛʈəɾ, word→ʋəɾɖ.
8. **Fuller vowels** — reduced [ᵻ]→[ɪ]; drop the palatal on-glide [ʲ].

## Verification

No en-IN pronunciation corpus exists — wikipron and kaikki have no Indian English, and epitran has no en-IN model —
so, exactly as for en-GB, the anchor is a **hand-adjudicated diagnostic gold** (`english-in.test.ts`, 30 words), one
group per feature, adjudicated from the cited phonology. All pass. The delta is context-free (no mined lexical sets),
so there is no circularity concern (shipped == rule path).

Sample output: train→ʈɾeːn, water→ʋɔːʈəɾ, think→t̪ʰɪŋk, they→d̪eː, wet/vet→ʋɛʈ, university→juːnəʋəɾsɪʈi,
church→t͡ʃəɾt͡ʃ, student→sʈuːɖənʈ, cat→kæʈ.

## Deferred (documented, need a lexical distinction or a referee to adjudicate)

- **TRAP/DRESS and LOT/THOUGHT vowel qualities** — GIE TRAP is [æ]~[ɛ]~[a], LOT is [ɒ]; recovering these from the
  GenAm merger (which writes æ, and merges cot/caught to ɑː) needs a lexical set, and there is no en-IN referee to
  build one against (the en-GB BATH/CLOTH mechanism, but with no corpus). Kept as GenAm for now.
- **Yod-retention** student→[stjuːɖənʈ], new→[njuː] — variable in GIE; deferred like the vowel sets.
- **Syllable-timed full-vowel restoration** — GIE gives unstressed syllables fuller vowels by spelling, which is not
  recoverable from the already-reduced GenAm schwa without the orthography (the pt-BR reduction lesson, inverted).

## Status: 🟡 accent variant — diagnostic-gold-anchored

The loud, categorical, won't-infer GIE features (retroflexion, TH-stopping, v/w, monophthongs, rhotic-tap, clear-l,
de-aspiration) are all shipped and gold-verified. The residual is the vowel-quality/reduction tail, which is
referee-blocked (no en-IN corpus). Labels FLEURS `en_in`.
