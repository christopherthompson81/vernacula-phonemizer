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

⚠ Caveat, shared with `nb.txt`: OpenSubtitles skews conversational, so the weighting reflects
dialogue rather than prose. It is still far closer to real text than a uniform type weighting.
