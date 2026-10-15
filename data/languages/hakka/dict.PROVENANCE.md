# `dict.tsv` — provenance (Hakka Chinese / 客家话, hak; Meixian 梅县 dialect)

**What it is.** Han → Sinological-IPA readings, 9,220 entries: 6,362 traditional headwords (2,600
single-character readings and 3,762 multi-character words, with Meixian tone sandhi as `underlying⁻surface`),
2,857 simplified aliases, and one derived entry.

**Source.** The Wiktionary Chinese dialectal-pronunciation data, via the kaikki.org extract
(`kaikki.org-dictionary-Chinese.jsonl`). Every entry whose `sounds` array carries a pronunciation tagged
``["Hakka","Meixian","Sinological-IPA"]`` was kept, with the IPA string taken verbatim (the enclosing `/…/` stripped; first reading per word).

**Simplified aliases.** The kaikki headwords are traditional. Each key is converted character by character
with OpenCC `TSCharacters` (Apache-2.0), and where the result differs and does not collide with an existing
key, it is added as an alias for the same reading.

**Licence.** Wiktionary content is CC BY-SA 3.0, and the kaikki extract is a mechanical redistribution of it.
OpenCC `TSCharacters` is Apache-2.0. This file is in the share-alike stratum (`LICENSES/PROVENANCE.md` §3).

**One derived entry.** Every row is verbatim from kaikki except one:

| key | reading | basis |
|---|---|---|
| 度 | `tʰu⁵³` | The source has no single-character Meixian reading for 度. The reading is taken from two Meixian entries in this same file (`印度 in⁵³⁻⁵⁵ tʰu⁵³`, `深度 t͡sʰəm⁴⁴⁻³⁵ tʰu⁵³`). It agrees with the source's own Sixian row (`/tʰu⁵⁵/`, 去聲, which is ˥˧ in Meixian) and with hak.wikipedia's Pha̍k-fa-sṳ spelling `thu`. |

Build notes, including why that entry was needed: `docs/investigations/hak/hakka-dict_build_notes_investigation.md`.
