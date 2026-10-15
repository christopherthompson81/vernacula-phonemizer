# `dict.tsv` — provenance (Xiang Chinese / 湘语, hsn; Changsha 长沙 dialect)

**What it is.** Han → Sinological-IPA readings, 6,591 entries: 4,548 traditional headwords (2,000
single-character readings and 2,548 multi-character words, with Changsha tone sandhi as
`underlying⁻surface`) plus 2,043 simplified aliases.

**Source.** The Wiktionary Chinese dialectal-pronunciation data, via the kaikki.org extract
(`kaikki.org-dictionary-Chinese.jsonl`). Every entry whose `sounds` array carries a pronunciation tagged
``["Changsha","Sinological-IPA"]`` was kept, with the IPA string taken verbatim. Where a character has both a `dated` and a current Changsha reading, the current one is kept.

**Simplified aliases.** The kaikki headwords are traditional. Each key is converted character by character
with OpenCC `TSCharacters` (Apache-2.0), and where the result differs and does not collide with an existing
key, it is added as an alias for the same reading.

**Licence.** Wiktionary content is CC BY-SA 3.0, and the kaikki extract is a mechanical redistribution of it.
OpenCC `TSCharacters` is Apache-2.0. This file is in the share-alike stratum (`LICENSES/PROVENANCE.md` §3).

Build notes: `docs/investigations/hsn/xiang-dict_build_notes_investigation.md`.
