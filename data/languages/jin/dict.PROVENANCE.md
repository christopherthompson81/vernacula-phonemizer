# `dict.tsv` — provenance (Jin Chinese / 晋语, cjy; Taiyuan 太原 dialect)

**What it is.** Han → Sinological-IPA readings, 6,467 entries: 4,434 traditional headwords (1,967
single-character readings and 2,467 multi-character words, with Taiyuan tone sandhi as `underlying⁻surface`)
plus 2,033 simplified aliases.

**Source.** The Wiktionary Chinese dialectal-pronunciation data, via the kaikki.org extract
(`kaikki.org-dictionary-Chinese.jsonl`). Every entry whose `sounds` array carries a pronunciation tagged
``["Jin","Taiyuan","Sinological-IPA"]`` was kept, with the IPA string taken verbatim (the enclosing `/…/` stripped). Where a character has several readings, the first-listed one is kept. Wiktionary tags this Taiyuan data `dated`, because it comes from an older dialect survey; it is the only machine-readable Taiyuan IPA and is used as is.

**Simplified aliases.** The kaikki headwords are traditional. Each key is converted character by character
with OpenCC `TSCharacters` (Apache-2.0), and where the result differs and does not collide with an existing
key, it is added as an alias for the same reading.

**Licence.** Wiktionary content is CC BY-SA 3.0, and the kaikki extract is a mechanical redistribution of it.
OpenCC `TSCharacters` is Apache-2.0. This file is in the share-alike stratum (`LICENSES/PROVENANCE.md` §3).

Build notes: `docs/investigations/cjy/jin-dict_build_notes_investigation.md`.
