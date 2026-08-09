# nchlt_afr.dict — provenance

**Artifact:** `tools/afrikaans/nchlt_afr.dict` — 15,094 Afrikaans word→phone rows in X-SAMPA.
**Tools-only** (training data for the g2p tagger); nothing in `src/` reads it.

## Source and licence

**NCHLT-inlang Pronunciation Dictionaries** — "broad phonemic transcriptions for 15,000 generic words in
each of 11 languages", Department of Arts and Culture (DAC) / CSIR / North-West University, distributed
via the SADiLaR repository (`repo.sadilar.org`, handle 20.500.12185/365).

**Licence: Creative Commons Attribution 3.0 Unported (CC BY 3.0)** — attribution-only, more permissive
than the RCRL dictionary's share-alike. Attribute to DAC, CSIR and NWU. Citation requested for the
Afrikaans set: W. D. Basson and M. H. Davel, *Category-Based Phoneme-to-Grapheme Transliteration*,
Interspeech 2013, pp. 1956–1960.

## ⚠ It is NOT an independent third referee, and must never be wired as one

Measured against the RCRL secondary: **9,871 headwords overlap and 96.6% of those are transcribed
identically.** The NCHLT README explains why — "initial dictionaries were created using existing
resources, and these then verified by language practitioners … at the individual pronunciation level
(for English and Afrikaans)". Same NWU/CSIR lineage, human-verified, but not an independent opinion.
Wiring it as a referee would manufacture corroboration.

## What it is actually for

**+5,160 headwords RCRL does not have**, which is why it earns a place as *training* data:

| | |
|---|---|
| running-text token coverage, RCRL alone | 86.2% |
| …with NCHLT added | 86.7% |
| unique training pairs, RCRL alone | 27,428 |
| …union with NCHLT | **32,588** |

⚠ **This is the ceiling for Afrikaans.** The third open dictionary, **Lwazi Afrikaans** (4,998 entries,
CC BY 2.5 ZA), was checked and adds **zero** headwords — every one is already in RCRL. There is no
nb/da-scale (199k NST) resource for this language and searching will not produce one.

## Convention

X-SAMPA, no stress marks, no syllable boundaries (RCRL has both). Same inventory gap as RCRL: the only
long vowels it writes are `A:` (ɑː) and `2:` (øː) — no `ɛː`, `œː`, `yː`, and not even `ɔː`. The training
data builder therefore applies the same vetting as the shipped lexicon.

One small corroboration in its favour: on the 338 words where the two dictionaries disagree, **our rule
engine matches NCHLT 68 times against RCRL's 40** — mostly regressive devoicing (`absoluut` → apsulyt).
