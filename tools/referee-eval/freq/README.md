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

`ur.txt`: Urdu, same source and licence (9,189 words, 261k tokens; 403 non-Urdu-script types —
punctuation and Latin runs — dropped, keeping 99.7% of tokens). Urdu had **no** frequency list, so
every accuracy figure in `docs/investigations/ur_tagger_investigation.md` before Run 18 was
dictionary-shaped. The gap is large: **66.3% frequency-weighted on the primary and 79.6% on the
secondary, against word-exact 56.8% / 59.4%**. ⚠ These score the LEXICON-FREE core — the shipped
`lexicon-ipa.tsv` is built from kaikki/wikipron, so the eval must not consult it. ⚠ A high
real-text number does not mean short-vowel restoration works: the core's schwa PLACEMENT is wrong
on 25% of words (Run 17); real text is simply dominated by short common words where the default
[ə] is right.

⚠ Caveat, shared with `nb.txt`: OpenSubtitles skews conversational, so the weighting reflects
dialogue rather than prose. It is still far closer to real text than a uniform type weighting.
⚠ `ur.txt` is the thinnest of the four (9.2k types); formal/technical Urdu has a longer tail than
subtitle dialogue, so it flatters the core more than a prose corpus would.
