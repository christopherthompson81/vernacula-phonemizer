# Nepali (ne) native bring-up

Nepali / नेपाली — Indo-Aryan, ~32M speakers (Nepal + India), Devanagari. Reuses the Hindi Devanagari engine
(`makeNativeHindi` — schwa deletion, weight stress, numbers) with a Nepali data file, the Bhojpuri/Marathi/
Gujarati/Maithili pattern.

## Data availability (checked up front)

- **wikipron nep_deva narrow** — 2,329 human pairs (PRIMARY; a *narrow* phonetic transcription).
- **kaikki ne** — 2,231 human IPA entries (SECONDARY). Two corroborating human referees.
- **epitran** — no Nepali.

## The Nepali divergences from Hindi

- **The inherent vowel is [ʌ]**, not Hindi's [ə] (अकास→ʌkas, गर्नु→ɡʌɾnu). Implemented cleanly: the shared
  schwa-deletion logic keys on `ə`, so the manifest keeps the inherent vowel as `ə` and the module maps the
  *surviving* ə→ʌ in a wrapper (like Awadhi's flap wrapper) — deletion still works, the output realises [ʌ].
- **Dental affricates.** च/छ/ज/झ → [t͡s t͡sʰ d͡z d͡zʱ] (अचार→ʌt͡saɾ, मान्छे→mant͡sʰe), where Hindi has palatal
  [t͡ʃ …]. (ज is [d͡z]~[z], folded.)
- **Sibilant merger** श/ष → [s] (भाषा→bʱasa).
- **No phonemic vowel length** — ई→i, ऊ→u (and इ/उ are plain [i]/[u], not the Hindi lax [ɪ]/[ʊ]): नेपाल→nepal,
  पानी→pani.
- **Diphthongs** ऐ→[ʌi], औ→[ʌu]; व→[w] (~[b] word-initially).
- **retainFinalAfterCluster** — Nepali keeps the word-final inherent vowel after a cluster/geminate
  (एकाउन्न→ekäunʌ), the same rule Marathi has and Hindi lacks.
- **Nepali number words** (दुई, छ, दश, सय, हजार) replace the Hindi ones; the irregular 21-99 compounds are
  deferred (graceful unit+tens fallback).

## Run — vs the two referees

**68.9% vs wikipron narrow / 67.8% vs kaikki.** The core divergences (inherent [ʌ], dental affricates, श/ष→s, no
length, diphthongs) are verified; the number is capped by two things:

1. **The narrow referee** captures colloquial detail we don't phonemically emit: **ह-elision / ɦ-weakening**
   (गुहु→ɡu, कहिले→kʌile, हवाईजहाज→…zaz) is pervasive in the narrow transcription but variable, so it can't be
   rule-modelled — we keep [ɦ]. This is the ja/ko narrow-referee shape.
2. **The schwa-position tail.** Nepali's medial + final schwa retention differs from Hindi in ways that are
   proven-lexical (नेपाल deletes the final but एगार retains it; आइतबार retains a medial ə Hindi deletes). The
   retainFinalAfterCluster rule closes the cluster cases; the rest is a lexical residual.

## Verdict — 🟡 Reliable + lexical tail

The segmental core is correct and cross-referee-verified. The residual is the **proven-lexical schwa-position
tail** (the Hindi/Marathi/Gujarati class) plus **narrow-referee ह-elision** noise. The 🟡 path is a
**cross-source consensus schwa lexicon** — pin the schwa pattern only where wikipron ∩ kaikki agree (the gu/bn/id
pattern) — which is deferred here. Numbers: 21-99 compounds deferred.
