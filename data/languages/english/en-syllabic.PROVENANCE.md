# `en-syllabic.tsv` — provenance

**What it is.** For 4,835 English dictionary words, which of their `AH0`/`IH0` phones before an
`L`/`N`/`M` is a REDUCED slot: a syllabic consonant, or an extra-short schwa. CMUdict does not mark
this — `able` and `normal` are both `AH0 L` — so it cannot be derived from our own source.

**Source.** misaki `us_gold.json` — [hexgrad/misaki](https://github.com/hexgrad/misaki), **Apache
License 2.0**. Only the SLOT POSITIONS are taken: no phoneme strings are copied, and only for words
our own CMUdict-derived dictionary already contains. Regenerate with
`tools/english/en_build_syllabic.mts`, which is the whole extraction.

**Why misaki and not a referee.** There is no rule and no independent oracle:

| | |
|---|---|
| best ARPABET context (`AH0 L` word-final) | 76.1% syllabic — 409 words wrong where it half-works |
| every other context | 17–26%, a coin flip |
| the one shipped English referee (wikipron, human, 4,558 rows) | marks a syllabic consonant on **60** |
| its agreement with misaki on the 35 they share | **66%** |

The referee disagreements are systematic, not scattered: it marks `-tion` as `ʃn̩` and `-ism` as
`zm̩` where misaki writes a plain schwa. **Whether `-tion` is written syllabic or schwa+n is a
transcription convention, not a fact about the sound** — both describe the same articulation. Kokoro
learned misaki's convention, so matching it is copying it; no rule and no second opinion can
reconstruct an arbitrary choice. This file is therefore openly a convention import.

**What that costs, declared.** It makes any comparison against misaki's lexicon CIRCULAR for this
feature. It covers 4,835 of our 135,313 dictionary words — the ones the two lexicons share, which
are the common ones — and the OOV tagger has no syllabicity to predict, so unrecorded words keep a
plain schwa.

**Why it is worth it.** The distinction is one Kokoro actually renders. A/B'd through the graph in a
carrier sentence, the local spectral distance at the changed token is 0.12–0.80 against a 0.040
noise floor — above the `ə→ɪ` control (0.148) in most cases. Not a cosmetic token.

**Why a separate file.** `g2p-dict.tsv` is regenerated from upstream CMUdict by
`en_g2p_ngram.ts --emit`, which silently reverts hand edits (that is what `g2p-curated.tsv` records).
Marks written there would not survive.

See `docs/investigations/kokoro_vphon_investigation.md` Run 15 for the measurements.
