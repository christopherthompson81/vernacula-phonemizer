# diacritization.tsv — provenance & licence posture

A Tashkeela-derived **pausal** restoration lexicon: `undiacritized<TAB>vocalized`, one type per line (~259k),
each entry the single most-frequent PAUSAL vocalization of a wordform (case endings / final ة / tanwīn dropped),
built by a purely mechanical frequency count. Used by `restore.ts` as a SUPPLEMENT-ONLY pass: it overrides only
the words the neural diacritizer leaves as skeletons, never an already-voweled word.

## Source & posture
- **Source corpus (provenance):** Tashkeela v0.3 (Taha Zerrouki & Rim Balla) — a corpus of vocalized **classical /
  ancient** Arabic text. The underlying text is public-domain classical works; Zerrouki's *compilation* is tagged
  GPL-2.0, credited here for provenance. https://sourceforge.net/projects/tashkeela/
- **Why not treated as GPL-bound:** each entry is a linguistic FACT (the dominant vocalization of a wordform), and
  the artifact is an unoriginal, purely-mechanical frequency aggregation containing none of the corpus's selection
  or arrangement — no protected expression is reproduced (Feist; CCH Canadian 2004 SCC 13). Same facts-not-
  expression posture the neural diacritizer already relies on (ADR-0001, docs/adr/0001-data-licensing-facts-posture.md). This mirrors the file espeak-ng-portable
  ships (`data/ar/diacritization.tsv`); brought into this project by explicit maintainer direction. Not legal
  advice; revisitable; Tashkeela credited regardless.
- **Classical vs modern:** Tashkeela's classical citation-form vocalizations complement the neural diacritizer's
  modern/running-text coverage — the lexicon nails isolated/dictionary headwords the context-trained BiLSTM
  under-vowels. See docs/investigations/ar_referee_investigation.md.
