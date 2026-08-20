# freq/ — token-frequency lists for frequency-weighted referee metrics

`nb.txt`: Norwegian Bokmål token frequencies from hermitdave **FrequencyWords** (OpenSubtitles;
CC-BY-SA), used to weight the nb referee metric by real-text token frequency (see the nb floor
note in `referee-eval.test.ts`). Ranking data only; no pronunciation content.

`af.txt`: Afrikaans, same source and licence (17,586 words, 337k tokens). ⚠ THE TYPE/TOKEN GAP IS
THE POINT FOR af: the rule engine scores 79.5% / 65.2% word-exact against its two referees, both of
which are DICTIONARY-shaped and over-sample rare Latinate words, but **96.2% / 92.9%
frequency-weighted** — real text is short and native. Every earlier af measurement of "real-text
quality" was a hand-rolled probe against a 2,473-token corpus; this replaces them with a standing
metric. It also earned its keep immediately by exposing a live tagger defect — see
docs/afrikaans_stress_investigation.md Run 20.

`ur.txt`: Urdu, same source and licence (9,181 words, 246k tokens). Two filters, matching the
letters-only shape of `nb.txt`/`af.txt`: 403 non-Urdu-script types (Latin runs, Latin punctuation)
and 8 **Arabic-range** punctuation types — ⟨،⟩ and ⟨۔⟩ are ranks 2 and 4 by count, so a naive
script-range filter keeps them and they would have been 5.6% of the token mass. Urdu had **no** frequency list, so
every accuracy figure in `docs/investigations/ur_tagger_investigation.md` before Run 18 was
dictionary-shaped. The gap is large: **66.3% frequency-weighted on the primary and 79.6% on the
secondary, against word-exact 56.8% / 59.4%**. ⚠ These score the LEXICON-FREE core — the shipped
`lexicon-ipa.tsv` is built from kaikki/wikipron, so the eval must not consult it. ⚠ A high
real-text number does not mean short-vowel restoration works: the core's schwa PLACEMENT is wrong
on 25% of words (Run 17); real text is simply dominated by short common words where the default
[ə] is right.

⚠ Caveat, shared with `nb.txt`: OpenSubtitles skews conversational, so the weighting reflects
dialogue rather than prose. It is still far closer to real text than a uniform type weighting.
⚠ `ur.txt` is the thinnest of the three (9.2k types); formal/technical Urdu has a longer tail than
subtitle dialogue, so it flatters the core more than a prose corpus would.

`ar.txt` / `arz.txt`: MSA and Egyptian, built 2026-08-20 from the in-domain Wikipedia corpora already used for
diacritizer training (`/mnt/data/ar-diac/silver.txt` with diacritics stripped, `/mnt/data/arz-diac/corpus_arz.txt`),
CC BY-SA 4.0. 50k entries each, from 6.6M and 18.3M tokens.

⚠ **COVERAGE IS PARTIAL and the weighted figure describes only the covered subset** — 342 of 590 arz referee
words carry a frequency, 2,001 of 4,758 for ar/wikipron. ⚠ **And the two MSA referees move in OPPOSITE
directions** under token weighting: kaikki 69.7% → 87.4%, wikipron 64.9% → 50.1%. Two referees for one language
disagreeing in direction on common words is a convention problem in one of them, not an engine result — do not
quote either MSA figure without the other. arz behaves as the af precedent predicts: 61.7% → 80.4% (both figures re-measured 2026-08-20 after the arz fold-ordering fix — see docs/investigations/arz_referee_investigation.md).
