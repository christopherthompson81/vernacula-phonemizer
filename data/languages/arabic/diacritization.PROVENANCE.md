# `diacritization.tsv` — provenance & licence posture

**What it is.** A pausal restoration lexicon, `undiacritized<TAB>vocalized`, about 259k types. Each entry is
the single most frequent pausal vocalization of a wordform (case endings, final ة and tanwīn dropped),
produced by a purely mechanical frequency count.

**Source.** Tashkeela v0.3 (Taha Zerrouki & Rim Balla), a corpus of vocalized classical Arabic text.
<https://sourceforge.net/projects/tashkeela/>. The underlying texts are public-domain classical works.
Zerrouki's compilation is tagged GPL-2.0 and is credited here and in NOTICE.

**Why it is not treated as GPL-bound.** Each entry is a linguistic fact (the dominant vocalization of a
wordform). The file is an unoriginal, mechanical frequency aggregation that reproduces none of the corpus's
selection or arrangement, so no protected expression is copied (*Feist*; *CCH Canadian* 2004 SCC 13). This
is the facts posture in `LICENSES/licencing_posture.md` and `LICENSES/PROVENANCE.md` §4 item 1. It is the
project author's reasoned posture, not legal advice, and is open to revision. Tashkeela is credited either
way.

Build notes: `docs/investigations/ar/diacritization_build_notes_investigation.md`.
