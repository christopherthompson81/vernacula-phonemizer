# Ewe (ee) native bring-up investigation

Target: **Ewe** (Eʋegbe), a **Gbe** language (Niger-Congo, Kwa), ~7M (Ghana/Togo),
Latin-based African alphabet with the special letters ⟨ɖ ƒ ʋ ɣ ŋ ɔ ɛ⟩ + labial-velar
⟨gb kp⟩, TONAL (H/M/L) but tone UNMARKED in the standard orthography. Canonical IPA,
espeak-independent. Joins the Kwa branch (Akan is the fleet's first Kwa).

## Run 1 — referee landscape

- **wikipron**: `ewe_latn_broad` (250) + `ewe_latn_narrow` (229) — HUMAN but SMALL and
  PROPER-NOUN-heavy (Abraham, Adam…).
- **kaikki Ewe**: 688 entries, **249 phonemic /…/ pairs** — HUMAN, NATIVE vocabulary
  (mi, go, papa, eve, fo, agbe…). Richer for native words → the PRIMARY referee.
- **epitran**: NO ewe-Latn mapping.

Both referees are Wiktionary-derived → 🔷 single-source-FAMILY. ~250 native pairs.

## Map mined from kaikki

VOWELS: a e i o u ɛ ɔ (7 oral) + NASALIZED (written with a TILDE in the orthography:
ã ẽ ĩ õ ũ ɛ̃ ɔ̃ → recoverable, kept). CONSONANTS: b d f→f g→ɡ h k l m n p s t v w
y→j z; the SPECIAL letters ⟨ƒ⟩→[ɸ] (bilabial, vs ⟨f⟩ labiodental), ⟨ʋ⟩→[β] (bilabial,
vs ⟨v⟩ labiodental), ⟨ɖ⟩→[ɖ], ⟨ɣ⟩→[ɰ] (velar approximant, [ɣ] variant), ⟨x⟩→[x],
⟨ŋ⟩→[ŋ], ⟨ɔ ɛ⟩. DIGRAPHS: ⟨gb⟩→[ɡ͡b], ⟨kp⟩→[k͡p] (labial-velars), ⟨dz⟩→[d͡z],
⟨ts⟩→[t͡s], ⟨ny⟩→[ɲ]. Clusters bl/kl/ml/gbl fall out; ⟨dr⟩→[dl] (r→l after d — the
referee writes l: ʋɔnudrɔ̃la→βɔnudlɔ̃la).

TONE: marked in the referee IPA (á/à = H/L, mid unmarked) via combining acute/grave,
but NOT in the orthography (headwords are toneless apart from the nasalization tilde) →
NOT emitted; the backbone folds the referee's tone marks (the Akan/Shona unwritten-tone
situation — a tone lexicon is the deferred path). Syllable dots folded. Iterate the
consonant/vowel skeleton against the ~249-pair referee in Run 2.

## Run 2 — engine + Jalloh verification

Engine (`src/languages/ewe/ewe.ts`): near-1:1 longest-match scan. First pass **91.6%
folded / 98.3% symbol**. Two systematic residuals, both resolved by the SAME independent
source the user supplied — **Jalloh, *A Phonological and Grammatical Analysis of Ewe***:
- **⟨w⟩→[ɰ]** (velar approximant), the dominant residual (~15 words: wɔ→ɰɔ). Jalloh (§5,
  Approximants): "[ɰ] occurs only before UNROUNDED vowels…; /w/ occurs only before
  ROUNDED vowels" → we emit that rounding-conditioned allophone ([w]/o u ɔ, else [ɰ]) for
  CANONICAL output, and FOLD w~ɰ for the eval (the Wiktionary referee GENERALIZES [ɰ]).
- **⟨r⟩→[l] in an onset cluster** (adre→adle, tro→tlo, febru→feblu), [r] elsewhere (loans
  Mars→mars). Jalloh: the /l/~/r/ are "variants of each other". → **92.9% → 95.6% → 100.0%.**

**Result: 100.0% folded / 100.0% symbol** on all 249 kaikki pairs (Ewe orthography is
near-1:1 phonemic; tone folded).

**Jalloh verification (cleaner OCR):** the phonetics chart confirms the WHOLE inventory —
7 oral vowels (i e ɛ a ɔ o u) + nasals; the LABIAL-VELARS kp/gb; the BILABIAL ⟨ƒ⟩=[ɸ]/
⟨ʋ⟩=[β] (column 8) vs LABIODENTAL ⟨f⟩=[f]/⟨v⟩=[v] (column 9); the velar approximant
⟨ɣ/w⟩→[ɰ]; /n ɲ m ŋ/. So the g2p is INDEPENDENTLY CORROBORATED by a scholarly grammar,
not merely referee-fit — a meaningful honesty upgrade over pure single-source.

**★ ONE grammar-vs-referee CONFLICT (noted, not "fixed"):** Jalloh splits the l/r
allophony finely — "[l] must follow VELAR and LABIAL consonants, [r] … after ALVEOLAR
consonants" — so d/t/s + r should be [r]. But the Wiktionary referee uses [l] after ALL
consonants incl. alveolars (adre→adle, atikatre→…tle). We follow the REFEREE (our only
machine validation, 100%) and treat Jalloh's alveolar→[r] split as a dialectal/deferred
refinement. (Also deferred, per Jalloh: the nasalized-vowel approximant [ɰ̃], and the
palatalization of the alveolars before /i/.)

## Run 3 — 2-agent review

Both reviewers flagged the recurring **text() tokenizer vs NFC** bug (memory:
Estonian/Maltese/cdo/Tashelhit): the TOKEN class relied on the combining range but real
input is NFC, so precomposed nasal/toned vowels (ã ẽ ĩ õ ũ, á à) were dropped mid-word
(text("agbalẽ")→aɡ͡bal) — invisible to the eval/goldens (they call phonemizeWord directly).
Also uppercase ⟨Ɖ⟩ was missing from the class. FIX: NFD-normalise input at the top of
text() + add Ɖ; added a text()-path golden. Plus: **isVowelSeg** now NFD-aware so ⟨r⟩ after
a PRECOMPOSED nasal vowel (ãra) stays [r] not [l]; and a **post-consonant ⟨w⟩→[w]**
labialization glide (loan Cw: xwe→xwe, kwasiɖa→kwasiɖa). Eval unchanged (100%). Phonology
otherwise confirmed solid + Jalloh-grounded; the l/r alveolar split stays a documented
grammar-vs-referee choice.
